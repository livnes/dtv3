import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
    syncAnalyticsProperties,
    syncSearchConsoleSites,
    syncGoogleAdsCustomers
} from '@/lib/property-discovery';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        logInfo('Starting property discovery', { userId: session.user.id });

        // Get any existing Google integrations (we'll sync Analytics regardless)
        const integrations = await prisma.userIntegration.findMany({
            where: {
                userId: session.user.id,
                providerName: {
                    in: ['google_analytics', 'google_search_console', 'google_ads']
                }
            }
        });

        // We always try to sync Analytics, even if no existing integrations
        const hasGoogleAuth = integrations.length > 0;

        if (!hasGoogleAuth) {
            return NextResponse.json({
                success: false,
                error: 'No Google integrations found - please connect Google Analytics first'
            });
        }

        const results = {
            discovered: 0,
            errors: 0,
            details: []
        };

        // Always sync properties if we have Google auth for each service
        const analyticsIntegrations = integrations.filter(i => i.providerName === 'google_analytics');
        const searchConsoleIntegrations = integrations.filter(i => i.providerName === 'google_search_console');
        const googleAdsIntegrations = integrations.filter(i => i.providerName === 'google_ads');

        // Sync Analytics properties
        if (analyticsIntegrations.length > 0 || hasGoogleAuth) {
            try {
                logInfo('Syncing Analytics properties', { userId: session.user.id });
                const discoveryResult = await syncAnalyticsProperties(session.user.id);

                if (discoveryResult?.success) {
                    results.discovered++;
                    results.details.push({
                        providerName: 'google_analytics',
                        status: 'success',
                        changes: discoveryResult.changes,
                        added: discoveryResult.added,
                        removed: discoveryResult.removed,
                        totalProperties: discoveryResult.properties?.length || 0
                    });
                } else {
                    results.errors++;
                    results.details.push({
                        providerName: 'google_analytics',
                        status: 'error',
                        error: discoveryResult?.error || 'Unknown error'
                    });
                }
            } catch (error) {
                logError('Error syncing Analytics properties', {
                    userId: session.user.id,
                    error: error.message
                });

                results.errors++;
                results.details.push({
                    providerName: 'google_analytics',
                    status: 'error',
                    error: error.message
                });
            }
        }

        // Sync Search Console sites
        if (searchConsoleIntegrations.length > 0) {
            try {
                logInfo('Syncing Search Console sites', { userId: session.user.id });
                const discoveryResult = await syncSearchConsoleSites(session.user.id);

                if (discoveryResult?.success) {
                    results.discovered++;
                    results.details.push({
                        providerName: 'google_search_console',
                        status: 'success',
                        changes: discoveryResult.changes,
                        added: discoveryResult.added,
                        removed: discoveryResult.removed,
                        totalSites: discoveryResult.sites?.length || 0
                    });
                } else {
                    results.errors++;
                    results.details.push({
                        providerName: 'google_search_console',
                        status: 'error',
                        error: discoveryResult?.error || 'Unknown error'
                    });
                }

            } catch (error) {
                logError('Error syncing Search Console sites', {
                    userId: session.user.id,
                    error: error.message
                });

                results.errors++;
                results.details.push({
                    providerName: 'google_search_console',
                    status: 'error',
                    error: error.message
                });
            }
        }

        // Sync Google Ads customers
        if (googleAdsIntegrations.length > 0) {
            try {
                logInfo('Syncing Google Ads customers', { userId: session.user.id });
                const discoveryResult = await syncGoogleAdsCustomers(session.user.id);

                if (discoveryResult?.success) {
                    results.discovered++;
                    results.details.push({
                        providerName: 'google_ads',
                        status: 'success',
                        changes: discoveryResult.changes,
                        added: discoveryResult.added,
                        removed: discoveryResult.removed,
                        totalCustomers: discoveryResult.customers?.length || 0
                    });
                } else {
                    results.errors++;
                    results.details.push({
                        providerName: 'google_ads',
                        status: 'error',
                        error: discoveryResult?.error || 'Unknown error'
                    });
                }

            } catch (error) {
                logError('Error syncing Google Ads customers', {
                    userId: session.user.id,
                    error: error.message
                });

                results.errors++;
                results.details.push({
                    providerName: 'google_ads',
                    status: 'error',
                    error: error.message
                });
            }
        }

        logInfo('Property discovery completed', {
            userId: session.user.id,
            discovered: results.discovered,
            errors: results.errors
        });

        return NextResponse.json({
            success: true,
            message: `Discovery completed: ${results.discovered} successful, ${results.errors} errors`,
            results
        });

    } catch (error) {
        logError('Property discovery failed', { error: error.message });

        return NextResponse.json({
            success: false,
            error: 'Property discovery failed: ' + error.message
        }, { status: 500 });
    }
} 