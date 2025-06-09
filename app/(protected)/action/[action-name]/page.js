import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

// Server Components for each action
import TrafficQualityServerAction from '@/components/actions/traffic-quality/TrafficQualityServerAction';
import KeywordsServerAction from '@/components/actions/keywords/KeywordsServerAction';
import GoogleAuthServerAction from '@/components/actions/GoogleAuthServerAction';
import ActionHeader from '@/components/actions/ActionHeader';
import ErrorBanner from '@/components/actions/ErrorBanner';

// Valid action names
const VALID_ACTIONS = ['traffic-quality', 'keywords', 'google-auth'];

async function getActionData(actionName, session, searchParams) {
    // Pre-fetch data on server for each action type
    switch (actionName) {
        case 'traffic-quality':
            try {
                // Use direct imports instead of internal fetch to avoid authentication issues
                const { discoverGA4Properties } = await import('@/lib/analytics-properties');
                const { PrismaClient } = await import('@prisma/client');

                const prisma = new PrismaClient();

                try {
                    // Get Analytics integration directly from database
                    const integration = await prisma.userIntegration.findFirst({
                        where: {
                            userId: session.user.id,
                            providerName: 'google_analytics',
                            isActive: true
                        }
                    });

                    if (integration) {
                        const properties = await discoverGA4Properties(integration);
                        await prisma.$disconnect();

                        return {
                            properties: { success: true, data: properties },
                            cachedData: null // Will be fetched later if needed
                        };
                    } else {
                        await prisma.$disconnect();
                        return {
                            properties: { success: false, error: 'Google Analytics integration not found' },
                            cachedData: null
                        };
                    }
                } catch (error) {
                    await prisma.$disconnect();
                    console.error('Error fetching traffic quality data:', error);
                    return {
                        properties: { success: false, error: 'שגיאה בטעינת נכסי Analytics' },
                        cachedData: null
                    };
                }
            } catch (error) {
                console.error('Error importing dependencies:', error);
                return {
                    properties: { success: false, error: 'שגיאה במערכת' },
                    cachedData: null
                };
            }

        case 'keywords':
            try {
                // Import Search Console service and dependencies
                const { PrismaClient } = await import('@prisma/client');
                const { google } = await import('googleapis');
                const { decrypt } = await import('@/lib/encryption');
                const { GoogleSearchConsoleService } = await import('@/app/(protected)/action/services/google-search-console');

                const prisma = new PrismaClient();

                try {
                    // Get Search Console integration directly from database
                    const integration = await prisma.userIntegration.findFirst({
                        where: {
                            userId: session.user.id,
                            providerName: 'google_search_console',
                            isActive: true
                        }
                    });

                    if (integration) {
                        // Decrypt the tokens
                        const accessToken = decrypt(integration.encryptedAccessToken);
                        const refreshToken = integration.encryptedRefreshToken ? decrypt(integration.encryptedRefreshToken) : null;

                        // Create OAuth2 client
                        const oauth2Client = new google.auth.OAuth2(
                            process.env.GOOGLE_CLIENT_ID,
                            process.env.GOOGLE_CLIENT_SECRET
                        );

                        oauth2Client.setCredentials({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                            expiry_date: integration.tokenExpiresAt?.getTime()
                        });

                        // Create Search Console service
                        const searchConsoleService = new GoogleSearchConsoleService(oauth2Client);

                        // Get Search Console sites
                        const sitesResult = await searchConsoleService.getSearchConsoleSites();

                        let keywordsData = null;
                        let insights = null;
                        let recommendations = null;

                        // If we have sites, fetch data for the first site as demo
                        if (sitesResult.success && sitesResult.sites.length > 0) {
                            const firstSite = sitesResult.sites[0];
                            console.log(`🎯 Demo: Fetching keywords for ${firstSite.siteUrl}`);

                            // Get keywords data with AI insights
                            const keywordsResult = await searchConsoleService.getTopSearchKeywords(
                                firstSite.siteUrl,
                                '30days'
                            );

                            if (keywordsResult.success) {
                                keywordsData = keywordsResult;

                                // Generate AI insights and recommendations
                                insights = searchConsoleService.generateInsights(
                                    keywordsResult.keywords,
                                    keywordsResult.summary
                                );

                                recommendations = searchConsoleService.generateRecommendations(
                                    keywordsResult.keywords,
                                    keywordsResult.summary
                                );
                            }
                        }

                        await prisma.$disconnect();

                        return {
                            sites: sitesResult,
                            keywordsData,
                            insights,
                            recommendations,
                            demoSite: sitesResult.success && sitesResult.sites.length > 0 ? sitesResult.sites[0].siteUrl : null
                        };
                    } else {
                        await prisma.$disconnect();
                        return {
                            sites: { success: false, error: 'Google Search Console integration not found' },
                            keywordsData: null,
                            insights: null,
                            recommendations: null,
                            demoSite: null
                        };
                    }
                } catch (error) {
                    await prisma.$disconnect();
                    console.error('Error fetching Search Console data:', error);
                    return {
                        sites: { success: false, error: 'שגיאה בטעינת נתוני Search Console' },
                        keywordsData: null,
                        insights: null,
                        recommendations: null,
                        demoSite: null
                    };
                }
            } catch (error) {
                console.error('Error importing Search Console dependencies:', error);
                return {
                    sites: { success: false, error: 'שגיאה במערכת' },
                    keywordsData: null,
                    insights: null,
                    recommendations: null,
                    demoSite: null
                };
            }

        case 'google-auth':
            try {
                const { PrismaClient } = await import('@prisma/client');
                const prisma = new PrismaClient();

                try {
                    const integrations = await prisma.userIntegration.findMany({
                        where: {
                            userId: session.user.id,
                            isActive: true
                        }
                    });

                    const hasAnalytics = integrations.some(i => i.providerName === 'google_analytics');
                    const hasSearchConsole = integrations.some(i => i.providerName === 'google_search_console');

                    await prisma.$disconnect();

                    return {
                        integrationStatus: {
                            success: true,
                            isConnected: hasAnalytics || hasSearchConsole,
                            hasAnalytics,
                            hasSearchConsole
                        }
                    };
                } catch (error) {
                    await prisma.$disconnect();
                    console.error('Error fetching integration status:', error);
                    return {
                        integrationStatus: { success: false, error: 'שגיאה בבדיקת סטטוס חיבורים' }
                    };
                }
            } catch (error) {
                console.error('Error importing dependencies:', error);
                return {
                    integrationStatus: { success: false, error: 'שגיאה במערכת' }
                };
            }

        default:
            return null;
    }
}

export default async function ActionPage({ params, searchParams }) {
    // Server-side authentication check
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect('/login');
    }

    // Await params and searchParams (Next.js 15 requirement)
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const actionName = resolvedParams?.['action-name'];

    // Validate action name
    if (!actionName || !VALID_ACTIONS.includes(actionName)) {
        notFound();
    }

    // Pre-fetch action-specific data on server
    const actionData = await getActionData(actionName, session, resolvedSearchParams);

    // Handle URL parameters
    const success = resolvedSearchParams?.success;
    const error = resolvedSearchParams?.error ? decodeURIComponent(resolvedSearchParams.error) : null;

    // Render action-specific server components
    const renderActionComponent = () => {
        switch (actionName) {
            case 'traffic-quality':
                return (
                    <TrafficQualityServerAction
                        userId={session.user.id}
                        initialData={actionData}
                        searchParams={resolvedSearchParams}
                    />
                );

            case 'keywords':
                return (
                    <KeywordsServerAction
                        userId={session.user.id}
                        initialData={actionData}
                    />
                );

            case 'google-auth':
                return (
                    <GoogleAuthServerAction
                        userId={session.user.id}
                        initialData={actionData}
                    />
                );

            default:
                return notFound();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <ActionHeader
                actionName={actionName}
                user={session.user}
            />

            {error && <ErrorBanner error={error} />}
            {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 m-4">
                    <div className="text-sm text-green-700">✅ {success}</div>
                </div>
            )}

            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {renderActionComponent()}
            </main>
        </div>
    );
} 