import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { createGoogleAdsService } from '@/lib/googleAds';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const days = parseInt(searchParams.get('days')) || 30;

        if (!customerId) {
            return NextResponse.json({
                error: 'Customer ID נדרש'
            }, { status: 400 });
        }

        // Get user's Google Ads integration
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: 'google-ads',
                isActive: true
            }
        });

        if (!integration) {
            return NextResponse.json({
                error: 'לא נמצא חיבור ל-Google Ads'
            }, { status: 404 });
        }

        logInfo('Fetching Google Ads performance data', {
            userId: session.user.id,
            customerId,
            days
        });

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Create Google Ads service
        const adsService = await createGoogleAdsService(integration);

        // Get campaign performance data
        const [campaignData, adGroupData] = await Promise.all([
            adsService.getCampaignPerformance(customerId, startDateStr, endDateStr),
            adsService.getAdGroupPerformance(customerId, startDateStr, endDateStr)
        ]);

        // Calculate insights and recommendations
        const insights = adsService.calculateInsights(campaignData);

        // Aggregate data by date for charts
        const dailyData = {};
        campaignData.forEach(campaign => {
            if (!dailyData[campaign.date]) {
                dailyData[campaign.date] = {
                    date: campaign.date,
                    cost: 0,
                    clicks: 0,
                    impressions: 0,
                    conversions: 0
                };
            }
            dailyData[campaign.date].cost += campaign.cost;
            dailyData[campaign.date].clicks += campaign.clicks;
            dailyData[campaign.date].impressions += campaign.impressions;
            dailyData[campaign.date].conversions += campaign.conversions;
        });

        const dailyDataArray = Object.values(dailyData).sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        // Top performing campaigns
        const topCampaigns = campaignData
            .reduce((acc, campaign) => {
                const existing = acc.find(c => c.campaignId === campaign.campaignId);
                if (existing) {
                    existing.cost += campaign.cost;
                    existing.clicks += campaign.clicks;
                    existing.impressions += campaign.impressions;
                    existing.conversions += campaign.conversions;
                } else {
                    acc.push({
                        campaignId: campaign.campaignId,
                        campaignName: campaign.campaignName,
                        cost: campaign.cost,
                        clicks: campaign.clicks,
                        impressions: campaign.impressions,
                        conversions: campaign.conversions,
                        ctr: 0,
                        cpc: 0,
                        roas: 0
                    });
                }
                return acc;
            }, [])
            .map(campaign => ({
                ...campaign,
                ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0,
                cpc: campaign.clicks > 0 ? campaign.cost / campaign.clicks : 0,
                roas: campaign.cost > 0 ? (campaign.conversions * 100) / campaign.cost : 0 // Assuming 100 ILS per conversion
            }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10);

        // Summary metrics
        const summary = {
            totalCost: insights.summary.totalCost || 0,
            totalClicks: insights.summary.totalClicks || 0,
            totalImpressions: insights.summary.totalImpressions || 0,
            totalConversions: insights.summary.totalConversions || 0,
            avgCtr: insights.summary.avgCtr || 0,
            avgCpc: insights.summary.avgCpc || 0,
            avgConversionRate: insights.summary.avgConversionRate || 0,
            campaignsCount: new Set(campaignData.map(c => c.campaignId)).size,
            adGroupsCount: new Set(adGroupData.map(ag => ag.adGroupId)).size
        };

        logInfo('Successfully retrieved Google Ads performance data', {
            userId: session.user.id,
            customerId,
            campaignsCount: summary.campaignsCount,
            totalCost: summary.totalCost
        });

        return NextResponse.json({
            success: true,
            data: {
                summary,
                campaigns: topCampaigns,
                dailyData: dailyDataArray,
                insights: insights.insights,
                recommendations: insights.recommendations,
                dateRange: {
                    startDate: startDateStr,
                    endDate: endDateStr,
                    days
                }
            }
        });

    } catch (error) {
        logError('Error in Google Ads performance API', {
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