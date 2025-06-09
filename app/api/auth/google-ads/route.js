import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logInfo, logError } from '@/lib/logger';

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            logError('No session found for Google Ads OAuth initiation');
            return NextResponse.redirect(new URL('/login', request.url));
        }

        logInfo('Initiating Google Ads OAuth', {
            userId: session.user.id,
            timestamp: new Date().toISOString()
        });

        // Force a completely fresh OAuth session for Google Ads integration
        // This is separate from NextAuth login
        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/google-ads/callback`,
            scope: 'https://www.googleapis.com/auth/adwords', // ONLY Google Ads scope
            response_type: 'code',
            access_type: 'offline',
            prompt: 'select_account consent', // Force account selection + consent
            include_granted_scopes: 'false', // Don't include existing scopes
            state: session.user.id,
            // Force fresh session - don't reuse existing Google session
            login_hint: '', // Clear any login hints
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        logInfo('Generated Google Ads OAuth URL', {
            userId: session.user.id,
            authUrl: authUrl,
            onlyAdsScope: true,
            timestamp: new Date().toISOString()
        });

        return NextResponse.redirect(authUrl);

    } catch (error) {
        logError('Error in Google Ads OAuth initiation', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        return NextResponse.redirect(new URL('/profile/integrations?error=oauth_failed', request.url));
    }
} 