import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '@/lib/logger';
import { encrypt } from '@/lib/encryption';
import { triggerBackfill } from '@/lib/backfill';
import { syncGoogleAdsCustomers } from '@/lib/property-discovery';

const prisma = new PrismaClient();

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        logInfo('Google Ads OAuth callback received', {
            hasCode: !!code,
            codeLength: code?.length,
            hasState: !!state,
            hasError: !!error,
            receivedScopes: searchParams.get('scope'),
            fullUrl: request.url,
            timestamp: new Date().toISOString()
        });

        if (error) {
            logError('Google Ads OAuth error from Google', { error });
            return NextResponse.redirect(new URL('/profile/integrations?error=oauth_denied', request.url));
        }

        if (!code || !state) {
            logError('Missing required OAuth parameters', { hasCode: !!code, hasState: !!state });
            return NextResponse.redirect(new URL('/profile/integrations?error=missing_code', request.url));
        }

        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.id !== state) {
            logError('Invalid session or state mismatch', {
                hasSession: !!session,
                hasUser: !!session?.user,
                stateMatch: session?.user?.id === state,
                expectedState: state,
                actualUserId: session?.user?.id
            });
            return NextResponse.redirect(new URL('/profile/integrations?error=invalid_state', request.url));
        }

        const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/google-ads/callback`;

        logInfo('Attempting token exchange with direct HTTP request', {
            userId: session.user.id,
            codeLength: code.length,
            redirectUri: redirectUri,
            clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
            timestamp: new Date().toISOString()
        });

        // Use direct HTTP request instead of google.auth.OAuth2 to avoid PKCE issues
        const tokenRequestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            code: code
        });

        let tokenResponse;
        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: tokenRequestBody.toString()
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorData}`);
            }

            tokenResponse = await response.json();

        } catch (tokenError) {
            logError('Token exchange failed with direct HTTP', {
                error: tokenError.message,
                userId: session.user.id,
                codeLength: code.length,
                timestamp: new Date().toISOString()
            });

            return NextResponse.redirect(new URL('/profile/integrations?error=token_exchange_failed', request.url));
        }

        logInfo('Token exchange successful', {
            userId: session.user.id,
            hasAccessToken: !!tokenResponse.access_token,
            hasRefreshToken: !!tokenResponse.refresh_token,
            tokenType: tokenResponse.token_type,
            expiresIn: tokenResponse.expires_in,
            scope: tokenResponse.scope,
            timestamp: new Date().toISOString()
        });

        // Calculate token expiry
        const expiryDate = tokenResponse.expires_in ?
            new Date(Date.now() + (tokenResponse.expires_in * 1000)) :
            new Date(Date.now() + 3600 * 1000); // 1 hour default

        // Use pending placeholder - auto-discovery will replace with real customer IDs
        let accountId = 'pending_customer_selection';

        // Check if integration already exists
        const existingIntegration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: 'google_ads'
            }
        });

        // Save integration to database
        const integrationData = {
            accountId: accountId,
            encryptedAccessToken: encrypt(tokenResponse.access_token),
            encryptedRefreshToken: tokenResponse.refresh_token ? encrypt(tokenResponse.refresh_token) : null,
            tokenExpiresAt: expiryDate,
            scopes: JSON.stringify(tokenResponse.scope?.split(' ') || []),
            isActive: true,
            lastError: null,
            updatedAt: new Date()
        };

        let savedIntegration;
        if (existingIntegration) {
            savedIntegration = await prisma.userIntegration.update({
                where: { id: existingIntegration.id },
                data: integrationData
            });
            logInfo('Updated existing Google Ads integration', {
                userId: session.user.id,
                integrationId: savedIntegration.id,
                accountId: savedIntegration.accountId
            });
        } else {
            savedIntegration = await prisma.userIntegration.create({
                data: {
                    userId: session.user.id,
                    providerName: 'google_ads',
                    ...integrationData
                }
            });
            logInfo('Created new Google Ads integration', {
                userId: session.user.id,
                integrationId: savedIntegration.id,
                accountId: savedIntegration.accountId
            });
        }

        logInfo('Google Ads integration saved successfully', {
            userId: session.user.id,
            integrationId: savedIntegration.id,
            isActive: savedIntegration.isActive,
            hasTokens: !!(savedIntegration.encryptedAccessToken),
            timestamp: new Date().toISOString()
        });

        // Automatically trigger customer discovery after successful OAuth
        try {
            console.log('🔄 Triggering automatic Google Ads customer discovery...');

            // Call the discovery function directly
            const discoveryResult = await syncGoogleAdsCustomers(session.user.id);

            if (discoveryResult.success) {
                console.log('✅ Automatic Google Ads customer discovery completed:', {
                    totalCustomers: discoveryResult.customers?.length || 0,
                    changes: discoveryResult.changes,
                    added: discoveryResult.added,
                    removed: discoveryResult.removed
                });
            } else {
                console.warn('⚠️ Automatic customer discovery failed:', discoveryResult.error);
            }
        } catch (discoveryError) {
            console.warn('⚠️ Automatic customer discovery error:', discoveryError.message);
            // Don't fail the OAuth - user can still refresh manually
        }

        // Trigger backfill for new Google Ads integration
        if (!existingIntegration) {
            triggerBackfill(session.user.email, 'google_ads', true);
        }

        return NextResponse.redirect(new URL('/profile/integrations?success=google_ads_connected', request.url));

    } catch (error) {
        logError('Unexpected error in Google Ads OAuth callback', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        return NextResponse.redirect(new URL('/profile/integrations?error=unexpected_error', request.url));
    }
} 