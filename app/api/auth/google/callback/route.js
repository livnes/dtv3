import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { logInfo, logError } from '@/lib/logger';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
);

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/login?error=no_session`
            );
        }

        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');

        if (error) {
            logError('Google OAuth error', { error, userId: session.user.id });
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/profile/integrations?error=oauth_denied`
            );
        }

        if (!code) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/profile/integrations?error=no_code`
            );
        }

        logInfo('Processing Google OAuth callback', {
            userId: session.user.id,
            state: state
        });

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.access_token) {
            throw new Error('No access token received');
        }

        // Encrypt the tokens
        const encryptedAccessToken = encrypt(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token ?
            encrypt(tokens.refresh_token) : null;

        // Calculate token expiry
        const tokenExpiresAt = tokens.expiry_date ?
            new Date(tokens.expiry_date) :
            new Date(Date.now() + 3600 * 1000); // 1 hour default

        // Store Google Analytics integration
        const analyticsIntegration = await prisma.userIntegration.create({
            data: {
                userId: session.user.id,
                providerName: 'google_analytics',
                accountId: 'sync_required',
                accountName: 'Sync with Google Analytics Required',
                propertyName: null,
                encryptedAccessToken: encryptedAccessToken,
                encryptedRefreshToken: encryptedRefreshToken,
                tokenExpiresAt: tokenExpiresAt,
                scopes: 'analytics.readonly,webmasters.readonly,profile,email',
                isActive: true,
                lastFetchAt: new Date()
            }
        });

        // Store Search Console integration
        const searchConsoleIntegration = await prisma.userIntegration.create({
            data: {
                userId: session.user.id,
                providerName: 'google_search_console',
                accountId: 'sync_required',
                accountName: 'Sync with Search Console Required',
                propertyName: null,
                encryptedAccessToken: encryptedAccessToken,
                encryptedRefreshToken: encryptedRefreshToken,
                tokenExpiresAt: tokenExpiresAt,
                scopes: 'analytics.readonly,webmasters.readonly,profile,email',
                isActive: true,
                lastFetchAt: new Date()
            }
        });

        logInfo('Google integrations created successfully', {
            userId: session.user.id,
            analyticsId: analyticsIntegration.id,
            searchConsoleId: searchConsoleIntegration.id
        });

        // Redirect back to integrations page with success
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/profile/integrations?success=google_connected`
        );

    } catch (error) {
        logError('Error in Google OAuth callback', {
            error: error.message,
            userId: session?.user?.id
        });

        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/profile/integrations?error=oauth_failed`
        );
    }
} 