import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { createSearchConsoleService } from '@/lib/searchConsole';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
        }

        // Get user's Search Console integration
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: 'google_search_console',
                isActive: true
            }
        });

        if (!integration) {
            return NextResponse.json({
                error: 'לא נמצא חיבור ל-Google Search Console',
                sites: []
            }, { status: 404 });
        }

        logInfo('Fetching Search Console sites', {
            userId: session.user.id,
            integrationId: integration.id
        });

        // Create Search Console service
        const searchConsoleService = await createSearchConsoleService(integration);

        // Get sites
        const sites = await searchConsoleService.getSites();

        // Format sites data
        const formattedSites = sites.map(site => ({
            siteUrl: site.siteUrl,
            permissionLevel: site.permissionLevel,
            verified: site.permissionLevel === 'siteOwner' || site.permissionLevel === 'siteFullUser'
        })).filter(site => site.verified); // Only return verified sites

        logInfo('Successfully retrieved Search Console sites', {
            userId: session.user.id,
            sitesCount: formattedSites.length
        });

        return NextResponse.json({
            success: true,
            sites: formattedSites,
            integration: {
                id: integration.id,
                accountId: integration.accountId,
                connected: true
            }
        });

    } catch (error) {
        logError('Error in Search Console sites discovery', {
            error: error.message,
            stack: error.stack,
            userId: session?.user?.id
        });

        return NextResponse.json({
            success: false,
            error: 'שגיאה בטעינת אתרי Search Console',
            sites: []
        }, { status: 500 });
    }
} 