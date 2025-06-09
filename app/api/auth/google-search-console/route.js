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

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/auth/google-search-console/callback`
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/webmasters.readonly'
            ],
            state: session.user.id,
            prompt: 'consent'
        });

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('Search Console OAuth initiation error:', error);
        return NextResponse.redirect(new URL('/profile/integrations?error=oauth_init_failed', request.url));
    }
} 