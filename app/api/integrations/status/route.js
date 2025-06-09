import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '@/lib/analytics';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'לא מחובר' }, { status: 401 });
        }

        logInfo('Checking integrations status', { userId: session.user.id });

        // Get all user integrations
        const integrations = await prisma.userIntegration.findMany({
            where: { userId: session.user.id }
        });

        // Organize integrations by provider (only count active integrations)
        const gaIntegration = integrations.find(i => i.providerName === 'google_analytics' && i.isActive);
        const gadsIntegration = integrations.find(i => i.providerName === 'google-ads' && i.isActive);
        const fbIntegration = integrations.find(i => i.providerName === 'facebook' && i.isActive);
        const tiktokIntegration = integrations.find(i => i.providerName === 'tiktok' && i.isActive);
        const scIntegration = integrations.find(i => i.providerName === 'google_search_console' && i.isActive);

        const integrationsStatus = {
            google_analytics: gaIntegration ? {
                connected: true,
                accountId: gaIntegration.accountId,
                lastError: gaIntegration.lastError,
                backfillCompleted: gaIntegration.backfillCompleted
            } : false,
            google_ads: gadsIntegration ? {
                connected: true,
                accountId: gadsIntegration.accountId,
                lastError: gadsIntegration.lastError,
                backfillCompleted: gadsIntegration.backfillCompleted
            } : false,
            facebook_business: !!fbIntegration,
            facebook_pixel: false, // Will be checked dynamically
            tiktok_ads: !!tiktokIntegration,
            tiktok_pixel: false, // Will be checked dynamically
            search_console: scIntegration ? {
                connected: true,
                accountId: scIntegration.accountId,
                lastError: scIntegration.lastError,
                backfillCompleted: scIntegration.backfillCompleted
            } : false
        };

        // Add backfill status information
        const backfillStatus = {
            google_analytics: gaIntegration ? {
                completed: gaIntegration.backfillCompleted,
                lastFetch: gaIntegration.lastFetchAt,
                error: gaIntegration.lastError
            } : null,
            google_ads: gadsIntegration ? {
                completed: gadsIntegration.backfillCompleted,
                lastFetch: gadsIntegration.lastFetchAt,
                error: gadsIntegration.lastError
            } : null,
            facebook_business: fbIntegration ? {
                completed: fbIntegration.backfillCompleted,
                lastFetch: fbIntegration.lastFetchAt,
                error: fbIntegration.lastError
            } : null,
            tiktok_ads: tiktokIntegration ? {
                completed: tiktokIntegration.backfillCompleted,
                lastFetch: tiktokIntegration.lastFetchAt,
                error: tiktokIntegration.lastError
            } : null,
            search_console: scIntegration ? {
                completed: scIntegration.backfillCompleted,
                lastFetch: scIntegration.lastFetchAt,
                error: scIntegration.lastError
            } : null
        };

        // Calculate data quality if GA4 is connected
        let dataQuality = null;
        if (gaIntegration) {
            dataQuality = await calculateDataQuality(gaIntegration);
        }

        return NextResponse.json({
            success: true,
            integrations: integrationsStatus,
            backfillStatus: backfillStatus,
            dataQuality: dataQuality
        });

    } catch (error) {
        logError('Error checking integrations status', error);
        return NextResponse.json({
            success: false,
            error: 'שגיאה בבדיקת סטטוס התחברויות'
        }, { status: 500 });
    }
}

async function calculateDataQuality(gaIntegration) {
    try {
        // Mock data quality calculation - replace with real implementation
        const mockDataQuality = {
            overallScore: 85,
            ga4: {
                score: 78,
                sessions: 2345,
                sessions_check: true,
                age_coverage: 72.4,
                gender_coverage: 70.1,
                source_medium_coverage: 98.5,
                utm_coverage: 85.0,
                conversions_exist: true
            },
            facebook: {
                score: 65,
                pixel_installed: true,
                conversions_tracked: false,
                utm_match: 40
            },
            tiktok: {
                score: 0,
                pixel_installed: false,
                events_tracked: false,
                attribution_window: false
            },
            google_ads: {
                score: 90,
                linked_to_ga4: true,
                conversion_tracking: true,
                enhanced_conversions: true
            },
            issues: [
                "TikTok Pixel חסר באתר",
                "UTM tracking חסר ב-40% מהתנועה מפייסבוק",
                "אין המרות מוגדרות בפייסבוק"
            ]
        };

        return mockDataQuality;

    } catch (error) {
        logError('Error calculating data quality', error);
        return null;
    }
} 