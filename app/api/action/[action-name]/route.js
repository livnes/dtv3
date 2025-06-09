import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// Import all action services
import { createGoogleAnalyticsService } from '@/app/(protected)/action/services/google-analytics';
import { createGoogleSearchConsoleService } from '@/app/(protected)/action/services/google-search-console';
import { GoogleOAuthService } from '@/app/(protected)/action/services/google-oauth';

export async function GET(request, { params }) {
    try {
        // Check authentication for all actions
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { 'action-name': actionName } = await params;
        const { searchParams } = new URL(request.url);

        console.log(`🎯 Action requested: ${actionName}`);

        // Route to specific action handlers
        switch (actionName) {
            case 'traffic-quality':
                return await handleTrafficQuality(request, session.user.id, searchParams);

            case 'keywords':
                return await handleKeywords(request, session.user.id, searchParams);

            case 'google-auth':
                return await handleGoogleAuth(request, session.user.id);

            case 'google-callback':
                return await handleGoogleCallback(request, session.user.id, searchParams);

            case 'google-status':
                return await handleGoogleStatus(request, session.user.id);

            case 'analytics-properties':
                return await handleAnalyticsProperties(request, session.user.id);

            case 'search-console-sites':
                return await handleSearchConsoleSites(request, session.user.id);

            default:
                return NextResponse.json(
                    { error: `Action '${actionName}' not found` },
                    { status: 404 }
                );
        }

    } catch (error) {
        console.error(`Error in action ${params?.['action-name']}:`, error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { 'action-name': actionName } = params;
        const body = await request.json();

        console.log(`🎯 POST Action requested: ${actionName}`);

        // Route to specific POST action handlers
        switch (actionName) {
            case 'traffic-quality':
                return await handleTrafficQualityConfig(request, session.user.id, body);

            case 'keywords':
                return await handleKeywordsConfig(request, session.user.id, body);

            case 'google-disconnect':
                return await handleGoogleDisconnect(request, session.user.id);

            case 'google-refresh':
                return await handleGoogleRefresh(request, session.user.id);

            default:
                return NextResponse.json(
                    { error: `POST action '${actionName}' not found` },
                    { status: 404 }
                );
        }

    } catch (error) {
        console.error(`Error in POST action ${params?.['action-name']}:`, error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Action Handlers
async function handleTrafficQuality(request, userId, searchParams) {
    const propertyId = searchParams.get('propertyId');
    const dateRange = searchParams.get('dateRange') || '30days';

    if (!propertyId) {
        return NextResponse.json(
            { error: 'Property ID is required' },
            { status: 400 }
        );
    }

    try {
        const analyticsService = await createGoogleAnalyticsService(userId);
        const result = await analyticsService.getTrafficQualityData(propertyId, dateRange);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        const insights = analyticsService.generateInsights(result.trafficSources, result.totalSessions);
        const recommendations = analyticsService.generateRecommendations(result.trafficSources);

        return NextResponse.json({
            success: true,
            action: 'traffic-quality',
            data: {
                ...result,
                insights,
                recommendations
            }
        });

    } catch (error) {
        if (error.message.includes('No active Google Analytics integration')) {
            return NextResponse.json(
                { error: 'Google Analytics integration not found. Please connect your account.' },
                { status: 404 }
            );
        }
        throw error;
    }
}

async function handleKeywords(request, userId, searchParams) {
    const siteUrl = searchParams.get('siteUrl');
    const dateRange = searchParams.get('dateRange') || '30days';

    if (!siteUrl) {
        return NextResponse.json(
            { error: 'Site URL is required' },
            { status: 400 }
        );
    }

    try {
        const searchConsoleService = await createGoogleSearchConsoleService(userId);
        const result = await searchConsoleService.getTopSearchKeywords(siteUrl, dateRange);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        const insights = searchConsoleService.generateInsights(result.keywords, result.summary);
        const recommendations = searchConsoleService.generateRecommendations(result.keywords, result.summary);

        return NextResponse.json({
            success: true,
            action: 'keywords',
            data: {
                ...result,
                insights,
                recommendations
            }
        });

    } catch (error) {
        if (error.message.includes('No active Google Search Console integration')) {
            return NextResponse.json(
                { error: 'Google Search Console integration not found. Please connect your account.' },
                { status: 404 }
            );
        }
        throw error;
    }
}

async function handleGoogleAuth(request, userId) {
    try {
        const oauthService = new GoogleOAuthService();
        const result = oauthService.getAuthUrl('google_integration');

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.redirect(result.authUrl);

    } catch (error) {
        console.error('Error in Google auth:', error);
        return NextResponse.json(
            { error: 'Failed to initiate Google authentication' },
            { status: 500 }
        );
    }
}

async function handleGoogleCallback(request, userId, searchParams) {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        console.log('OAuth cancelled by user:', error);
        return NextResponse.redirect('/dashboard?error=oauth_cancelled');
    }

    if (state !== 'google_integration') {
        console.error('Invalid state parameter');
        return NextResponse.redirect('/dashboard?error=invalid_state');
    }

    if (!code) {
        console.error('No authorization code received');
        return NextResponse.redirect('/dashboard?error=no_code');
    }

    try {
        const oauthService = new GoogleOAuthService();
        const result = await oauthService.handleCallback(code, userId);

        if (!result.success) {
            console.error('OAuth callback failed:', result.error);
            return NextResponse.redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
        }

        return NextResponse.redirect('/integrations?success=google_connected');

    } catch (error) {
        console.error('Error in Google callback:', error);
        return NextResponse.redirect('/dashboard?error=callback_error');
    }
}

// POST Configuration Handlers
async function handleTrafficQualityConfig(request, userId, body) {
    const { propertyId, accountName, propertyName } = body;

    if (!propertyId) {
        return NextResponse.json(
            { error: 'Property ID is required' },
            { status: 400 }
        );
    }

    try {
        const { prisma } = await import('@/lib/prisma');

        await prisma.userIntegration.updateMany({
            where: {
                userId,
                providerName: 'google_analytics'
            },
            data: {
                accountId: propertyId,
                accountName: accountName || `Analytics Property ${propertyId}`,
                propertyName: propertyName,
                isActive: true
            }
        });

        return NextResponse.json({
            success: true,
            action: 'traffic-quality',
            message: 'Google Analytics integration configured successfully'
        });

    } catch (error) {
        console.error('Error configuring Analytics integration:', error);
        return NextResponse.json(
            { error: 'Failed to configure integration' },
            { status: 500 }
        );
    }
}

// Additional Google Auth Handlers
async function handleGoogleStatus(request, userId) {
    try {
        const { prisma } = await import('@/lib/prisma');

        const integrations = await prisma.userIntegration.findMany({
            where: {
                userId,
                providerName: {
                    in: ['google_analytics', 'google_search_console']
                }
            },
            select: {
                providerName: true,
                isActive: true,
                lastSyncAt: true,
                error: true,
                accountName: true,
                createdAt: true,
                updatedAt: true
            }
        });

        const analyticsIntegration = integrations.find(i => i.providerName === 'google_analytics');
        const searchConsoleIntegration = integrations.find(i => i.providerName === 'google_search_console');

        const status = {
            isConnected: integrations.length > 0 && integrations.some(i => i.isActive),
            analyticsConnected: analyticsIntegration?.isActive || false,
            searchConsoleConnected: searchConsoleIntegration?.isActive || false,
            hasError: integrations.some(i => i.error),
            analyticsError: analyticsIntegration?.error,
            searchConsoleError: searchConsoleIntegration?.error,
            userEmail: analyticsIntegration?.accountName || searchConsoleIntegration?.accountName,
            lastUpdated: Math.max(
                ...integrations.map(i => new Date(i.updatedAt).getTime())
            ) || null
        };

        return NextResponse.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Error fetching Google status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch integration status' },
            { status: 500 }
        );
    }
}

async function handleAnalyticsProperties(request, userId) {
    try {
        const analyticsService = await createGoogleAnalyticsService(userId);
        const result = await analyticsService.getAnalyticsProperties();

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.properties || []
        });

    } catch (error) {
        console.error('Error fetching Analytics properties:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Analytics properties' },
            { status: 500 }
        );
    }
}

async function handleSearchConsoleSites(request, userId) {
    try {
        const searchConsoleService = await createGoogleSearchConsoleService(userId);
        const result = await searchConsoleService.getSearchConsoleSites();

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.sites || []
        });

    } catch (error) {
        console.error('Error fetching Search Console sites:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Search Console sites' },
            { status: 500 }
        );
    }
}

async function handleGoogleDisconnect(request, userId) {
    try {
        const { prisma } = await import('@/lib/prisma');

        // Deactivate all Google integrations
        await prisma.userIntegration.updateMany({
            where: {
                userId,
                providerName: {
                    in: ['google_analytics', 'google_search_console']
                }
            },
            data: {
                isActive: false,
                error: null,
                updatedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Google integrations disconnected successfully'
        });

    } catch (error) {
        console.error('Error disconnecting Google integrations:', error);
        return NextResponse.json(
            { error: 'Failed to disconnect Google integrations' },
            { status: 500 }
        );
    }
}

async function handleGoogleRefresh(request, userId) {
    try {
        const oauthService = new GoogleOAuthService();

        // Attempt to refresh tokens and verify connections
        const refreshResult = await oauthService.refreshUserTokens(userId);

        if (!refreshResult.success) {
            return NextResponse.json(
                { error: refreshResult.error },
                { status: 500 }
            );
        }

        // Update last sync timestamp
        const { prisma } = await import('@/lib/prisma');
        await prisma.userIntegration.updateMany({
            where: {
                userId,
                providerName: {
                    in: ['google_analytics', 'google_search_console']
                }
            },
            data: {
                lastSyncAt: new Date(),
                error: null,
                updatedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Google connection refreshed successfully'
        });

    } catch (error) {
        console.error('Error refreshing Google connection:', error);
        return NextResponse.json(
            { error: 'Failed to refresh Google connection' },
            { status: 500 }
        );
    }
}

async function handleKeywordsConfig(request, userId, body) {
    const { siteUrl, permissionLevel } = body;

    if (!siteUrl) {
        return NextResponse.json(
            { error: 'Site URL is required' },
            { status: 400 }
        );
    }

    try {
        const { prisma } = await import('@/lib/prisma');

        await prisma.userIntegration.updateMany({
            where: {
                userId,
                providerName: 'google_search_console'
            },
            data: {
                accountId: siteUrl,
                accountName: `${siteUrl} (${permissionLevel || 'verified'})`,
                isActive: true
            }
        });

        return NextResponse.json({
            success: true,
            action: 'keywords',
            message: 'Google Search Console integration configured successfully'
        });

    } catch (error) {
        console.error('Error configuring Search Console integration:', error);
        return NextResponse.json(
            { error: 'Failed to configure integration' },
            { status: 500 }
        );
    }
} 