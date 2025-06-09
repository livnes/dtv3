import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { encrypt } from '@/lib/encryption';
import { syncAnalyticsProperties } from '@/lib/property-discovery';

const prisma = new PrismaClient();

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        console.log('🔥 Analytics OAuth callback received:', {
            hasCode: !!code,
            codeLength: code?.length,
            hasState: !!state,
            hasError: !!error,
            fullUrl: request.url
        });

        if (error) {
            console.error('❌ OAuth error from Google:', error);
            return NextResponse.redirect(new URL('/profile/integrations?error=oauth_denied', request.url));
        }

        if (!code || !state) {
            console.error('❌ Missing required OAuth parameters:', { hasCode: !!code, hasState: !!state });
            return NextResponse.redirect(new URL('/profile/integrations?error=missing_code', request.url));
        }

        // Verify session and state
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.id !== state) {
            console.error('❌ Invalid session or state mismatch:', {
                hasSession: !!session,
                hasUser: !!session?.user,
                stateMatch: session?.user?.id === state
            });
            return NextResponse.redirect(new URL('/profile/integrations?error=invalid_state', request.url));
        }

        console.log('✅ Session and state verified for user:', session.user.email);

        // Exchange code for tokens using direct HTTP (same method as Google Ads OAuth)
        const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/google-analytics/callback`;
        console.log('🔄 Attempting token exchange with redirect URI:', redirectUri);

        const tokenRequestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            code: code
        });

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
            console.error('❌ Token exchange HTTP error:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
            });
            throw new Error(`HTTP ${response.status}: ${errorData}`);
        }

        const tokens = await response.json();
        console.log('✅ Token exchange successful:', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type
        });

        // Calculate token expiry
        const expiryDate = tokens.expires_in ?
            new Date(Date.now() + (tokens.expires_in * 1000)) :
            new Date(Date.now() + 3600 * 1000);

        // Check if integration already exists
        const existingIntegration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: 'google_analytics'
            }
        });

        const integrationData = {
            accountId: 'pending_property_selection',
            encryptedAccessToken: encrypt(tokens.access_token),
            encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            tokenExpiresAt: expiryDate,
            scopes: JSON.stringify(['https://www.googleapis.com/auth/analytics.readonly']),
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
            console.log('✅ Updated existing Analytics integration:', {
                integrationId: savedIntegration.id,
                userId: session.user.id,
                accountId: savedIntegration.accountId
            });
        } else {
            savedIntegration = await prisma.userIntegration.create({
                data: {
                    userId: session.user.id,
                    providerName: 'google_analytics',
                    ...integrationData
                }
            });
            console.log('✅ Created new Analytics integration:', {
                integrationId: savedIntegration.id,
                userId: session.user.id,
                accountId: savedIntegration.accountId
            });
        }

        // Automatically trigger property discovery after successful OAuth
        try {
            console.log('🔄 Triggering automatic property discovery...');

            // Call the discovery function directly
            const discoveryResult = await syncAnalyticsProperties(session.user.id);

            if (discoveryResult.success) {
                console.log('✅ Automatic property discovery completed:', {
                    totalProperties: discoveryResult.properties?.length || 0,
                    changes: discoveryResult.changes,
                    added: discoveryResult.added,
                    removed: discoveryResult.removed
                });
            } else {
                console.warn('⚠️ Automatic property discovery failed:', discoveryResult.error);
            }
        } catch (discoveryError) {
            console.warn('⚠️ Automatic property discovery error:', discoveryError.message);
            // Don't fail the OAuth - user can still refresh manually
        }

        console.log('🎉 Analytics OAuth completed successfully for:', session.user.email);
        return NextResponse.redirect(new URL('/profile/integrations?success=analytics_connected', request.url));

    } catch (error) {
        console.error('❌ OAuth callback error:', error);

        // More specific error handling
        if (error.message?.includes('invalid_grant')) {
            console.error('💡 invalid_grant error - possible causes:', {
                'Code already used': 'Authorization codes can only be used once',
                'Code expired': 'Authorization codes expire in ~10 minutes',
                'Clock skew': 'System time might be off',
                'Redirect URI mismatch': 'Check Google Cloud Console configuration'
            });
            return NextResponse.redirect(new URL('/profile/integrations?error=invalid_grant', request.url));
        }

        return NextResponse.redirect(new URL('/profile/integrations?error=oauth_callback_failed', request.url));
    }
} 