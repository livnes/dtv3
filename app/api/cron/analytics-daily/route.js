import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '@/lib/encryption';
import { google } from 'googleapis';

const prisma = new PrismaClient();

// This cron job runs daily to update yesterday's analytics data for all active users

export async function POST(req) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        if (authHeader !== expectedAuth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔄 Starting daily analytics update...');

        // Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        console.log(`📅 Updating data for ${yesterdayStr}`);

        // Find active Google Analytics integrations with completed backfill
        const activeIntegrations = await prisma.userIntegration.findMany({
            where: {
                OR: [
                    { providerName: 'google_analytics' },
                    { providerName: 'google_search_console' }
                ],
                isActive: true,
                backfillCompleted: true
            },
            include: {
                user: true
            }
        });

        console.log(`📊 Found ${activeIntegrations.length} active integrations to update`);

        let processedIntegrations = 0;
        let errors = [];

        for (const integration of activeIntegrations) {
            try {
                console.log(`📈 Updating data for user ${integration.user.email}`);

                // Decrypt tokens
                const accessToken = decrypt(integration.encryptedAccessToken);
                const refreshToken = integration.encryptedRefreshToken
                    ? decrypt(integration.encryptedRefreshToken)
                    : null;

                // Create OAuth2 client
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET
                );

                oauth2Client.setCredentials({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });

                // Create Analytics client
                const analytics = google.analyticsdata({
                    version: 'v1beta',
                    auth: oauth2Client
                });

                // Get GA4 property ID from account data
                const propertyId = integration.accountId;

                // Get yesterday's traffic source data
                const response = await analytics.properties.runReport({
                    property: `properties/${propertyId}`,
                    requestBody: {
                        dateRanges: [{
                            startDate: yesterdayStr,
                            endDate: yesterdayStr
                        }],
                        dimensions: [
                            { name: 'sessionDefaultChannelGrouping' },
                            { name: 'sessionSourceMedium' }
                        ],
                        metrics: [
                            { name: 'sessions' },
                            { name: 'totalUsers' },
                            { name: 'bounceRate' },
                            { name: 'averageSessionDuration' },
                            { name: 'screenPageViewsPerSession' },
                            { name: 'conversions' }
                        ],
                        limit: 1000
                    }
                });

                if (response.data.rows) {
                    console.log(`📊 Processing ${response.data.rows.length} traffic sources for ${yesterdayStr}`);

                    // Prepare batch update data
                    const updates = [];

                    for (const row of response.data.rows) {
                        const channelGroup = row.dimensionValues[0].value;
                        const sourceMedium = row.dimensionValues[1].value;

                        const sessions = parseInt(row.metricValues[0].value) || 0;
                        const users = parseInt(row.metricValues[1].value) || 0;
                        const bounceRate = parseFloat(row.metricValues[2].value) || 0;
                        const avgSessionDuration = parseFloat(row.metricValues[3].value) || 0;
                        const pagesPerSession = parseFloat(row.metricValues[4].value) || 0;
                        const conversions = parseInt(row.metricValues[5].value) || 0;

                        // Calculate quality score
                        const qualityScore = calculateQualityScore(
                            avgSessionDuration, bounceRate * 100, pagesPerSession, conversions, sessions
                        );

                        updates.push({
                            userId: integration.userId,
                            integrationId: integration.id,
                            propertyId: propertyId,
                            date: yesterday,
                            channelGroup,
                            sourceMedium,
                            sessions,
                            users,
                            bounceRate: bounceRate * 100, // Convert to percentage
                            avgSessionDuration,
                            pagesPerSession,
                            conversions,
                            qualityScore
                        });
                    }

                    // Batch upsert
                    if (updates.length > 0) {
                        await prisma.$transaction(async (tx) => {
                            for (const data of updates) {
                                await tx.dailyTrafficSourceMetrics.upsert({
                                    where: {
                                        integrationId_propertyId_date_sourceMedium: {
                                            integrationId: data.integrationId,
                                            propertyId: data.propertyId,
                                            date: data.date,
                                            sourceMedium: data.sourceMedium
                                        }
                                    },
                                    update: data,
                                    create: data
                                });
                            }
                        });

                        console.log(`✅ Updated ${updates.length} records for ${integration.user.email}`);
                    }
                }

                // Update last fetch time
                await prisma.userIntegration.update({
                    where: { id: integration.id },
                    data: {
                        lastFetchAt: new Date(),
                        lastError: null
                    }
                });

                processedIntegrations++;

                // Rate limiting between users
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`❌ Error updating user ${integration.user.email}:`, error.message);

                // Update error status
                await prisma.userIntegration.update({
                    where: { id: integration.id },
                    data: {
                        lastError: error.message,
                        lastFetchAt: new Date()
                    }
                });

                errors.push({
                    userId: integration.userId,
                    email: integration.user.email,
                    error: error.message
                });
            }
        }

        console.log(`🎉 Daily update completed! Processed: ${processedIntegrations}, Errors: ${errors.length}`);

        return NextResponse.json({
            success: true,
            date: yesterdayStr,
            processed: processedIntegrations,
            errors: errors.length,
            errorDetails: errors
        });

    } catch (error) {
        console.error('❌ Daily analytics cron job error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

function calculateQualityScore(avgDuration, bounceRate, pagesPerSession, conversions, sessions) {
    // Normalize session duration (max 600 seconds = 10 minutes)
    const durationScore = Math.min(avgDuration / 600, 1) * 100;

    // Bounce rate score (inverse - lower bounce rate = higher score)
    const bounceScore = Math.max(0, 100 - bounceRate);

    // Pages per session score (max 10 pages)
    const pagesScore = Math.min(pagesPerSession / 10, 1) * 100;

    // Conversion rate score
    const conversionRate = sessions > 0 ? (conversions / sessions * 100) : 0;
    const conversionScore = Math.min(conversionRate * 10, 100); // 10% conversion = 100 score

    // Weighted average
    const qualityScore = (
        durationScore * 0.3 +
        bounceScore * 0.3 +
        pagesScore * 0.2 +
        conversionScore * 0.2
    );

    return Math.round(qualityScore);
} 