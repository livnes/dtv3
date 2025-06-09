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

        const { searchParams } = new URL(request.url);
        const siteUrl = searchParams.get('siteUrl');
        const days = parseInt(searchParams.get('days')) || 30;

        if (!siteUrl) {
            return NextResponse.json({
                error: 'Site URL נדרש'
            }, { status: 400 });
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
                error: 'לא נמצא חיבור ל-Google Search Console'
            }, { status: 404 });
        }

        logInfo('Fetching Search Console performance data', {
            userId: session.user.id,
            siteUrl,
            days
        });

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Create Search Console service
        const searchConsoleService = await createSearchConsoleService(integration);

        // Get performance data
        const [keywords, pages, deviceData, countryData] = await Promise.all([
            searchConsoleService.getTopKeywords(siteUrl, startDateStr, endDateStr, 100),
            searchConsoleService.getTopPages(siteUrl, startDateStr, endDateStr, 50),
            searchConsoleService.getDevicePerformance(siteUrl, startDateStr, endDateStr),
            searchConsoleService.getCountryPerformance(siteUrl, startDateStr, endDateStr)
        ]);

        // Calculate summary metrics
        const summary = searchConsoleService.calculateSummary(keywords);

        // Generate insights and recommendations
        const { insights, recommendations } = searchConsoleService.generateInsights(keywords, pages, summary);

        // Top performing keywords analysis
        const topKeywords = keywords.slice(0, 20).map(keyword => ({
            ...keyword,
            ctrPercentage: (keyword.ctr * 100).toFixed(2),
            positionRounded: Math.round(keyword.position * 10) / 10
        }));

        // Top performing pages analysis
        const topPages = pages.slice(0, 20).map(page => ({
            ...page,
            ctrPercentage: (page.ctr * 100).toFixed(2),
            positionRounded: Math.round(page.position * 10) / 10,
            pageTitle: page.page.split('/').pop() || page.page // Extract page name
        }));

        // Device performance summary
        const deviceSummary = deviceData.reduce((acc, device) => {
            acc[device.device] = {
                clicks: device.clicks,
                impressions: device.impressions,
                ctr: (device.ctr * 100).toFixed(2),
                position: Math.round(device.position * 10) / 10
            };
            return acc;
        }, {});

        // Country performance (top 10)
        const topCountries = countryData.slice(0, 10).map(country => ({
            ...country,
            ctrPercentage: (country.ctr * 100).toFixed(2),
            positionRounded: Math.round(country.position * 10) / 10
        }));

        logInfo('Successfully retrieved Search Console performance data', {
            userId: session.user.id,
            siteUrl,
            keywordsCount: keywords.length,
            totalClicks: summary.totalClicks
        });

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalClicks: summary.totalClicks,
                    totalImpressions: summary.totalImpressions,
                    avgCtr: (summary.avgCtr * 100).toFixed(2),
                    avgPosition: Math.round(summary.avgPosition * 10) / 10,
                    keywordsCount: summary.keywordsCount,
                    pagesCount: pages.length
                },
                keywords: topKeywords,
                pages: topPages,
                devices: deviceSummary,
                countries: topCountries,
                insights: insights,
                recommendations: recommendations,
                dateRange: {
                    startDate: startDateStr,
                    endDate: endDateStr,
                    days
                },
                site: {
                    url: siteUrl
                }
            }
        });

    } catch (error) {
        logError('Error in Search Console performance API', {
            error: error.message,
            stack: error.stack,
            userId: session?.user?.id
        });

        return NextResponse.json({
            success: false,
            error: 'שגיאה בטעינת נתוני ביצועים',
            data: null
        }, { status: 500 });
    }
} 