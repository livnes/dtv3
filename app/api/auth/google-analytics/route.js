import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/google-analytics/callback`;
        console.log('🔍 Analytics OAuth redirect URI:', redirectUri);

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/analytics.readonly'
            ],
            state: session.user.id,
            prompt: 'consent'
        });

        console.log('🔍 Generated auth URL:', authUrl);

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('OAuth initiation error:', error);
        return NextResponse.redirect(new URL('/profile/integrations?error=oauth_init_failed', request.url));
    }
} 