import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { encrypt } from '@/lib/encryption';
import { syncSearchConsoleSites } from '@/lib/property-discovery';

const prisma = new PrismaClient();

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
            return NextResponse.redirect(new URL('/profile/integrations?error=oauth_denied', request.url));
        }

        if (!code || !state) {
            return NextResponse.redirect(new URL('/profile/integrations?error=missing_code', request.url));
        }

        // Verify session and state
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.id !== state) {
            return NextResponse.redirect(new URL('/profile/integrations?error=invalid_state', request.url));
        }

        // ✅ CORRECT: Direct HTTP token exchange (prevents invalid_grant)
        const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/google-search-console/callback`;

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
            const errorText = await response.text();
            console.error('Token exchange failed:', errorText);
            throw new Error('Token exchange failed');
        }

        const tokens = await response.json();

        // Calculate token expiry (expires_in is in seconds)
        const expiryDate = tokens.expires_in ?
            new Date(Date.now() + (tokens.expires_in * 1000)) :
            new Date(Date.now() + 3600 * 1000);

        // Check if integration already exists
        const existingIntegration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: 'google_search_console'
            }
        });

        const integrationData = {
            accountId: 'pending_property_selection',
            encryptedAccessToken: encrypt(tokens.access_token),
            encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            tokenExpiresAt: expiryDate,
            scopes: JSON.stringify(['https://www.googleapis.com/auth/webmasters.readonly']),
            isActive: true,
            lastError: null,
            updatedAt: new Date()
        };

        if (existingIntegration) {
            await prisma.userIntegration.update({
                where: { id: existingIntegration.id },
                data: integrationData
            });
        } else {
            await prisma.userIntegration.create({
                data: {
                    userId: session.user.id,
                    providerName: 'google_search_console',
                    ...integrationData
                }
            });
        }

        // Automatically trigger site discovery after successful OAuth
        try {
            console.log('🔄 Triggering automatic Search Console site discovery...');

            // Call the discovery function directly
            const discoveryResult = await syncSearchConsoleSites(session.user.id);

            if (discoveryResult.success) {
                console.log('✅ Automatic Search Console site discovery completed:', {
                    totalSites: discoveryResult.sites?.length || 0,
                    changes: discoveryResult.changes,
                    added: discoveryResult.added,
                    removed: discoveryResult.removed
                });
            } else {
                console.warn('⚠️ Automatic site discovery failed:', discoveryResult.error);
            }
        } catch (discoveryError) {
            console.warn('⚠️ Automatic site discovery error:', discoveryError.message);
            // Don't fail the OAuth - user can still refresh manually
        }

        return NextResponse.redirect(new URL('/profile/integrations?success=search_console_connected', request.url));

    } catch (error) {
        console.error('Search Console OAuth callback error:', error);
        return NextResponse.redirect(new URL('/profile/integrations?error=oauth_callback_failed', request.url));
    }
} 