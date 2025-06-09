import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '@/lib/encryption';
import { google } from 'googleapis';
import { updateIntegrationWithGA4Property, getPrimaryGA4Property, discoverGA4Properties } from '@/lib/analytics-properties';

const prisma = new PrismaClient();

// This cron job runs once per user when they first connect Google Analytics
// It backfills 90 days of historical traffic source data

export async function POST(req) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        if (authHeader !== expectedAuth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔄 Starting analytics backfill process...');

        // Find users with Google Analytics who need backfill
        const usersNeedingBackfill = await prisma.userIntegration.findMany({
            where: {
                OR: [
                    { providerName: 'google_analytics' },
                    { providerName: 'google_search_console' }
                ],
                isActive: true,
                backfillCompleted: false
            },
            include: {
                user: true
            }
        });

        console.log(`📊 Found ${usersNeedingBackfill.length} users needing backfill`);

        let processedUsers = 0;
        let errors = [];

        for (const integration of usersNeedingBackfill) {
            try {
                console.log(`📈 Processing backfill for user ${integration.user.email}`);

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

                // Get GA4 property ID - first try stored accountId, if invalid, auto-discover
                let propertyId = integration.accountId;

                // Check if the stored property ID looks like a valid GA4 property ID (numeric and reasonable length)
                const isValidPropertyId = propertyId && propertyId.match(/^\d+$/) && propertyId.length >= 9 && propertyId.length <= 12;

                if (!isValidPropertyId) {
                    console.log(`🔍 Invalid or missing property ID (${propertyId}), attempting auto-discovery...`);
                    console.log(`🔧 Integration details - ID: ${integration.id}, Provider: ${integration.providerName}, User: ${integration.user.email}`);

                    try {
                        // Discover available properties but don't auto-select
                        console.log(`🔍 Discovering available GA4 properties for user to choose from...`);
                        const properties = await discoverGA4Properties(integration);

                        if (properties.length > 0) {
                            console.log(`🎯 Found ${properties.length} GA4 properties:`);
                            properties.forEach(prop => {
                                console.log(`  - ${prop.displayName} (ID: ${prop.id}) - ${prop.websiteUrl}`);
                            });

                            // Set to pending selection so user can choose
                            await prisma.userIntegration.update({
                                where: { id: integration.id },
                                data: {
                                    accountId: 'pending_property_selection',
                                    lastError: `Found ${properties.length} Analytics properties - please select one in the dashboard`,
                                    lastFetchAt: new Date()
                                }
                            });

                            console.log(`⏳ User needs to select from ${properties.length} available properties in dashboard`);

                            errors.push({
                                userId: integration.userId,
                                email: integration.user.email,
                                error: `Property selection required - ${properties.length} properties available`
                            });
                            continue; // Skip this integration until user selects
                        } else {
                            console.log(`❌ Could not discover GA4 properties for user ${integration.user.email}`);
                            console.log(`🔍 This could mean: 1) No GA4 properties exist, 2) API permissions issue, 3) Token expired`);

                            // Update error status
                            await prisma.userIntegration.update({
                                where: { id: integration.id },
                                data: {
                                    lastError: 'No GA4 properties found for this account - please ensure you have GA4 set up',
                                    lastFetchAt: new Date()
                                }
                            });

                            errors.push({
                                userId: integration.userId,
                                email: integration.user.email,
                                error: 'No GA4 properties found for this account'
                            });
                            continue; // Skip this integration
                        }
                    } catch (discoveryError) {
                        console.error(`❌ Property discovery failed:`, discoveryError.message);

                        // Update error status
                        await prisma.userIntegration.update({
                            where: { id: integration.id },
                            data: {
                                lastError: `Property discovery failed: ${discoveryError.message}`,
                                lastFetchAt: new Date()
                            }
                        });

                        errors.push({
                            userId: integration.userId,
                            email: integration.user.email,
                            error: `Property discovery failed: ${discoveryError.message}`
                        });
                        continue; // Skip this integration
                    }
                }

                // Backfill last 90 days in monthly chunks
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 90);

                // Process monthly chunks to avoid rate limits
                const monthsToProcess = [];
                let currentDate = new Date(startDate);

                while (currentDate < endDate) {
                    const monthStart = new Date(currentDate);
                    const monthEnd = new Date(currentDate);
                    monthEnd.setMonth(monthEnd.getMonth() + 1);
                    monthEnd.setDate(0); // Last day of month

                    if (monthEnd > endDate) monthEnd.setTime(endDate.getTime());

                    monthsToProcess.push({
                        start: monthStart.toISOString().split('T')[0],
                        end: monthEnd.toISOString().split('T')[0]
                    });

                    currentDate.setMonth(currentDate.getMonth() + 1);
                }

                console.log(`📅 Processing ${monthsToProcess.length} monthly chunks`);

                for (const period of monthsToProcess) {
                    try {
                        // Get traffic source data for this month
                        const response = await analytics.properties.runReport({
                            property: `properties/${propertyId}`,
                            requestBody: {
                                dateRanges: [{
                                    startDate: period.start,
                                    endDate: period.end
                                }],
                                dimensions: [
                                    { name: 'date' },
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
                                limit: 10000
                            }
                        });

                        if (response.data.rows) {
                            console.log(`📊 Processing ${response.data.rows.length} rows for ${period.start} to ${period.end}`);

                            // Prepare batch insert data
                            const metricsData = [];

                            for (const row of response.data.rows) {
                                const dateString = row.dimensionValues[0].value; // Format: YYYYMMDD
                                const channelGroup = row.dimensionValues[1].value;
                                const sourceMedium = row.dimensionValues[2].value;

                                // Parse GA4 date format (YYYYMMDD) to proper Date object
                                const year = parseInt(dateString.substring(0, 4));
                                const month = parseInt(dateString.substring(4, 6)) - 1; // JS months are 0-indexed
                                const day = parseInt(dateString.substring(6, 8));
                                const parsedDate = new Date(year, month, day);

                                // Validate the parsed date
                                if (isNaN(parsedDate.getTime())) {
                                    console.error(`❌ Invalid date format: ${dateString}`);
                                    continue; // Skip this row
                                }

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

                                metricsData.push({
                                    userId: integration.userId,
                                    integrationId: integration.id,
                                    propertyId: propertyId,
                                    date: parsedDate,
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

                            // Optimized batch insert with smaller chunks to avoid timeouts
                            if (metricsData.length > 0) {
                                const CHUNK_SIZE = 50; // Process in smaller chunks
                                let insertedCount = 0;

                                for (let i = 0; i < metricsData.length; i += CHUNK_SIZE) {
                                    const chunk = metricsData.slice(i, i + CHUNK_SIZE);

                                    try {
                                        await prisma.$transaction(async (tx) => {
                                            for (const data of chunk) {
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
                                        }, {
                                            timeout: 15000 // 15 seconds per chunk
                                        });

                                        insertedCount += chunk.length;
                                        console.log(`✅ Processed chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(metricsData.length / CHUNK_SIZE)} (${chunk.length} records)`);

                                        // Small delay between chunks to avoid overwhelming the DB
                                        await new Promise(resolve => setTimeout(resolve, 100));

                                    } catch (chunkError) {
                                        console.error(`❌ Error processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}:`, chunkError.message);
                                        // Continue with next chunk
                                    }
                                }

                                console.log(`✅ Inserted ${insertedCount}/${metricsData.length} records for ${period.start}`);
                            }
                        }

                        // Rate limiting - wait between chunks
                        await new Promise(resolve => setTimeout(resolve, 1000));

                    } catch (error) {
                        console.error(`❌ Error processing period ${period.start}:`, error.message);
                        // Continue with next period
                    }
                }

                // Mark backfill as completed
                await prisma.userIntegration.update({
                    where: { id: integration.id },
                    data: {
                        backfillCompleted: true,
                        lastFetchAt: new Date(),
                        lastError: null
                    }
                });

                processedUsers++;
                console.log(`✅ Completed backfill for ${integration.user.email}`);

                // Rate limiting between users
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`❌ Error processing user ${integration.user.email}:`, error.message);

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

        console.log(`🎉 Backfill completed! Processed: ${processedUsers}, Errors: ${errors.length}`);

        return NextResponse.json({
            success: true,
            processed: processedUsers,
            errors: errors.length,
            errorDetails: errors
        });

    } catch (error) {
        console.error('❌ Backfill cron job error:', error);
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