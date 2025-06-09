import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createGoogleAdsService } from '@/lib/googleAds';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function POST(request) {
    try {
        logInfo('Starting Google Ads backfill process');

        // Get all active Google Ads integrations that haven't completed backfill
        const integrations = await prisma.userIntegration.findMany({
            where: {
                providerName: 'google-ads',
                isActive: true,
                backfillCompleted: false
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        logInfo(`Found ${integrations.length} Google Ads integrations pending backfill`);

        const results = [];

        for (const integration of integrations) {
            try {
                logInfo(`Processing Google Ads backfill for user ${integration.user.email}`, {
                    userId: integration.userId,
                    integrationId: integration.id
                });

                // Create Google Ads service
                const adsService = await createGoogleAdsService(integration);

                // Get accessible accounts
                const accountResourceNames = await adsService.getAccessibleAccounts();

                if (accountResourceNames.length === 0) {
                    logError('No accessible Google Ads accounts found', {
                        userId: integration.userId,
                        integrationId: integration.id
                    });
                    continue;
                }

                // Use the first account for backfill (or could be user-selected)
                const customerId = accountResourceNames[0].split('/')[1];

                // Calculate 90-day backfill date range
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 90);

                const startDateStr = startDate.toISOString().split('T')[0];
                const endDateStr = endDate.toISOString().split('T')[0];

                logInfo('Fetching Google Ads campaign data for backfill', {
                    customerId,
                    dateRange: `${startDateStr} to ${endDateStr}`,
                    userId: integration.userId
                });

                // Get campaign performance data
                const campaignData = await adsService.getCampaignPerformance(
                    customerId,
                    startDateStr,
                    endDateStr
                );

                if (campaignData.length === 0) {
                    logInfo('No campaign data found for the date range', {
                        customerId,
                        userId: integration.userId
                    });
                } else {
                    // Save campaign metrics to database in chunks
                    const CHUNK_SIZE = 50;
                    let totalSaved = 0;

                    for (let i = 0; i < campaignData.length; i += CHUNK_SIZE) {
                        const chunk = campaignData.slice(i, i + CHUNK_SIZE);

                        try {
                            const metricsData = chunk.map(campaign => ({
                                userId: integration.userId,
                                integrationId: integration.id,
                                campaignId: campaign.campaignId,
                                campaignName: campaign.campaignName,
                                providerName: 'google-ads',
                                date: new Date(campaign.date),
                                impressions: campaign.impressions,
                                clicks: campaign.clicks,
                                spend: campaign.cost,
                                ctr: campaign.ctr,
                                cpc: campaign.averageCpc,
                                conversions: campaign.conversions,
                                conversionsValue: campaign.conversionsValue,
                                costPerConversion: campaign.costPerConversion,
                                deviceCategory: 'all', // Google Ads API needs separate query for device breakdown
                                country: 'all', // Google Ads API needs separate query for geo breakdown
                                userType: 'all'
                            }));

                            await prisma.dailyCampaignMetrics.createMany({
                                data: metricsData,
                                skipDuplicates: true
                            });

                            totalSaved += chunk.length;

                            logInfo(`Saved chunk of Google Ads data`, {
                                chunkSize: chunk.length,
                                totalSaved,
                                userId: integration.userId
                            });

                            // Add delay between chunks to avoid rate limits
                            await new Promise(resolve => setTimeout(resolve, 100));

                        } catch (chunkError) {
                            logError('Error saving Google Ads data chunk', {
                                chunkIndex: Math.floor(i / CHUNK_SIZE),
                                error: chunkError.message,
                                userId: integration.userId
                            });
                            // Continue with next chunk
                        }
                    }

                    logInfo(`Google Ads backfill completed for user`, {
                        userId: integration.userId,
                        totalRecords: totalSaved,
                        campaignsCount: new Set(campaignData.map(c => c.campaignId)).size
                    });
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

                results.push({
                    userId: integration.userId,
                    userEmail: integration.user.email,
                    status: 'completed',
                    recordsProcessed: campaignData.length,
                    customerId: customerId
                });

            } catch (userError) {
                logError('Error processing Google Ads backfill for user', {
                    userId: integration.userId,
                    userEmail: integration.user.email,
                    error: userError.message,
                    stack: userError.stack
                });

                // Update integration with error
                await prisma.userIntegration.update({
                    where: { id: integration.id },
                    data: {
                        lastError: userError.message,
                        lastFetchAt: new Date()
                    }
                });

                results.push({
                    userId: integration.userId,
                    userEmail: integration.user.email,
                    status: 'error',
                    error: userError.message
                });
            }
        }

        logInfo('Google Ads backfill process completed', {
            totalIntegrations: integrations.length,
            results: results
        });

        return NextResponse.json({
            success: true,
            message: `Google Ads backfill completed for ${integrations.length} integrations`,
            results: results
        });

    } catch (error) {
        logError('Error in Google Ads backfill cron job', {
            error: error.message,
            stack: error.stack
        });

        return NextResponse.json({
            success: false,
            error: 'שגיאה בתהליך איסוף נתוני Google Ads'
        }, { status: 500 });
    }
} 