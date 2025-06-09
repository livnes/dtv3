import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request) {
    try {
        // Get the authenticated session
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { success: false, error: 'לא מחובר למערכת' },
                { status: 401 }
            );
        }

        logInfo('Fetching user integrations', { userEmail: session.user.email });

        // Get user integrations from database
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                integrations: true,
            },
        });

        if (!user) {
            logError('User not found', { email: session.user.email });
            return NextResponse.json(
                { success: false, error: 'משתמש לא נמצא' },
                { status: 404 }
            );
        }

        // Filter integrations by type
        const analyticsIntegrations = user.integrations.filter(
            i => i.providerName === 'google_analytics'
        );

        const searchConsoleIntegrations = user.integrations.filter(
            i => i.providerName === 'google_search_console'
        );

        const googleAdsIntegrations = user.integrations.filter(
            i => i.providerName === 'google_ads'
        );

        logInfo('User integrations fetched successfully', {
            userEmail: session.user.email,
            analyticsCount: analyticsIntegrations.length,
            searchConsoleCount: searchConsoleIntegrations.length,
            googleAdsCount: googleAdsIntegrations.length,
            analyticsData: analyticsIntegrations.map(i => ({
                id: i.id,
                accountId: i.accountId,
                accountName: i.accountName,
                propertyName: i.propertyName,
                isActive: i.isActive
            })),
            searchConsoleData: searchConsoleIntegrations.map(i => ({
                id: i.id,
                accountId: i.accountId,
                accountName: i.accountName,
                propertyName: i.propertyName,
                isActive: i.isActive
            }))
        });

        return NextResponse.json({
            success: true,
            integrations: {
                analytics: analyticsIntegrations,
                searchConsole: searchConsoleIntegrations,
                googleAds: googleAdsIntegrations
            }
        });

    } catch (error) {
        logError('Error in integrations API', { error: error.message });

        return NextResponse.json(
            {
                success: false,
                error: 'שגיאה בטעינת התחברויות'
            },
            { status: 500 }
        );
    }
} 