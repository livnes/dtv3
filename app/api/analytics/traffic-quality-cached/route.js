import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req) {
    try {
        // Get user session
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const { searchParams } = new URL(req.url);
        const dateRange = searchParams.get('date_range') || '30days';
        const propertyId = searchParams.get('property_id');

        console.log(`🔍 Fetching cached analytics data for user ${userId}, range: ${dateRange}`);

        // Find user's Google Analytics integration (prioritize analytics over search console)
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: userId,
                OR: [
                    { providerName: 'google_analytics' },
                    { providerName: 'google_search_console' }
                ],
                isActive: true
            },
            orderBy: [
                { providerName: 'asc' }, // 'google_analytics' comes before 'google_search_console'
                { createdAt: 'desc' }
            ]
        });

        if (!integration) {
            return NextResponse.json({
                success: false,
                error: 'Google Analytics not connected'
            }, { status: 404 });
        }

        console.log(`📋 Selected integration: ID=${integration.id}, Provider=${integration.providerName}, Account=${integration.accountId}, BackfillCompleted=${integration.backfillCompleted}`);

        // Check if backfill has been completed
        const isBackfillCompleted = integration.backfillCompleted ||
            integration.status === 'connected';

        if (!isBackfillCompleted) {
            return NextResponse.json({
                success: false,
                error: 'הנתונים נטענים כרגע. אנא המתן מספר דקות ונסה שוב.',
                status: 'importing',
                debug: {
                    integrationId: integration.id,
                    providerName: integration.providerName,
                    integrationStatus: integration.status,
                    backfillCompleted: integration.backfillCompleted,
                    accountId: integration.accountId,
                    metadata: integration.metadata
                }
            }, { status: 202 });
        }

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();

        switch (dateRange) {
            case '7days':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30days':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90days':
                startDate.setDate(startDate.getDate() - 90);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }

        // Use provided propertyId or integration's default
        // Handle property ID format - extract numeric part if it contains "properties/"
        let targetPropertyId = propertyId || integration.accountId;
        if (targetPropertyId && targetPropertyId.includes('properties/')) {
            targetPropertyId = targetPropertyId.replace('properties/', '');
        }

        console.log(`🎯 Using property ID: ${targetPropertyId} (original: ${propertyId || integration.accountId})`);

        console.log(`📅 Querying cached data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        // Debug: Check what property IDs exist for this integration
        const existingPropertyIds = await prisma.dailyTrafficSourceMetrics.groupBy({
            by: ['propertyId'],
            where: {
                userId: userId,
                integrationId: integration.id
            }
        });
        console.log(`🔍 Available property IDs in database:`, existingPropertyIds.map(p => p.propertyId));

        // Query cached traffic source metrics
        const cachedMetrics = await prisma.dailyTrafficSourceMetrics.findMany({
            where: {
                userId: userId,
                integrationId: integration.id,
                propertyId: targetPropertyId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: {
                date: 'desc'
            }
        });

        console.log(`📊 Found ${cachedMetrics.length} cached metric records`);

        if (cachedMetrics.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No data available for the selected date range',
                status: 'no_data'
            }, { status: 404 });
        }

        // Group by source/medium and aggregate
        const sourceAggregates = {};

        for (const metric of cachedMetrics) {
            const key = metric.sourceMedium;

            if (!sourceAggregates[key]) {
                sourceAggregates[key] = {
                    source: metric.channelGroup,
                    source_medium: metric.sourceMedium,
                    sessions: 0,
                    users: 0,
                    total_duration: 0,
                    total_bounce_rate: 0,
                    total_pages: 0,
                    conversions: 0,
                    days_with_data: 0
                };
            }

            const agg = sourceAggregates[key];
            agg.sessions += metric.sessions;
            agg.users += metric.users;
            agg.total_duration += metric.avgSessionDuration * metric.sessions;
            agg.total_bounce_rate += metric.bounceRate * metric.sessions;
            agg.total_pages += metric.pagesPerSession * metric.sessions;
            agg.conversions += metric.conversions;
            agg.days_with_data += 1;
        }

        // Convert aggregates to final format
        const traffic_sources = Object.values(sourceAggregates).map(agg => {
            const avgSessionDuration = agg.sessions > 0 ? agg.total_duration / agg.sessions : 0;
            const avgBounceRate = agg.sessions > 0 ? agg.total_bounce_rate / agg.sessions : 0;
            const avgPagesPerSession = agg.sessions > 0 ? agg.total_pages / agg.sessions : 0;

            // Format session duration as MM:SS
            const durationMinutes = Math.floor(avgSessionDuration / 60);
            const durationSeconds = Math.floor(avgSessionDuration % 60);
            const durationFormatted = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;

            // Calculate quality score
            const qualityScore = calculateQualityScore(
                avgSessionDuration, avgBounceRate, avgPagesPerSession, agg.conversions, agg.sessions
            );

            return {
                source: agg.source,
                source_medium: agg.source_medium,
                sessions: agg.sessions,
                users: agg.users,
                avg_session_duration: durationFormatted,
                avg_session_duration_seconds: avgSessionDuration,
                bounce_rate: Math.round(avgBounceRate * 10) / 10,
                pages_per_session: Math.round(avgPagesPerSession * 10) / 10,
                conversions: agg.conversions,
                quality_score: qualityScore
            };
        });

        // Sort by quality score
        traffic_sources.sort((a, b) => b.quality_score - a.quality_score);

        // Generate insights and recommendations
        const totalSessions = traffic_sources.reduce((sum, source) => sum + source.sessions, 0);
        const insights = generateInsights(traffic_sources, totalSessions);
        const recommendations = generateRecommendations(traffic_sources);

        const response = {
            success: true,
            traffic_sources: traffic_sources.slice(0, 10), // Top 10 sources
            date_range: {
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            },
            total_sessions: totalSessions,
            insights: insights,
            recommendations: recommendations,
            cache_info: {
                cached: true,
                last_updated: integration.lastFetchAt,
                records_found: cachedMetrics.length
            }
        };

        console.log(`✅ Returning cached analytics data: ${traffic_sources.length} sources, ${totalSessions} total sessions`);

        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ Error fetching cached analytics data:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch analytics data',
                details: error.message
            },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

function calculateQualityScore(avgDuration, bounceRate, pagesPerSession, conversions, sessions) {
    // Normalize session duration (max 600 seconds = 10 minutes)
    const durationScore = Math.min(avgDuration / 600, 1) * 100;

    // Bounce rate score (inverse - lower bounce rate = higher score)
    const bounceScore = Math.max(0, 100 - bounceRate);

    // Pages per session score (max 10 pages)
    const pagesScore = Math.min(pagesPerSession / 10, 1) * 100;

    // Conversion rate score
    const conversionRate = sessions > 0 ? (conversions / sessions * 100) : 0;
    const conversionScore = Math.min(conversionRate * 10, 100);

    // Weighted average
    const qualityScore = (
        durationScore * 0.3 +
        bounceScore * 0.3 +
        pagesScore * 0.2 +
        conversionScore * 0.2
    );

    return Math.round(qualityScore);
}

function generateInsights(traffic_sources, total_sessions) {
    if (!traffic_sources.length) {
        return "לא נמצאו נתונים לניתוח";
    }

    const best_source = traffic_sources[0];
    const worst_source = traffic_sources[traffic_sources.length - 1];

    const insights = [];

    // Best performer insight
    insights.push(`<strong>${best_source.source}</strong> הוא מקור התנועה הכי איכותי שלך ` +
        `(ציון ${best_source.quality_score}) עם ${best_source.sessions.toLocaleString()} ביקורים`);

    // Session duration insights
    if (best_source.avg_session_duration_seconds > 180) { // 3 minutes
        insights.push(`זמן השהייה הממוצע מ-${best_source.source} מצוין ` +
            `(${best_source.avg_session_duration})`);
    }

    // Bounce rate insights
    if (best_source.bounce_rate < 30) {
        insights.push(`שיעור הנטישה מ-${best_source.source} נמוך מאוד ` +
            `(${best_source.bounce_rate}%) - זה מעולה!`);
    }

    // Volume vs Quality insight
    const highest_volume = traffic_sources.reduce((max, source) =>
        source.sessions > max.sessions ? source : max, traffic_sources[0]);

    if (highest_volume !== best_source) {
        insights.push(`<strong>${highest_volume.source}</strong> מביא הכי הרבה תנועה ` +
            `(${highest_volume.sessions.toLocaleString()} ביקורים) אבל לא בהכרח הכי איכותית`);
    }

    // Improvement opportunity
    if (traffic_sources.length > 1 && worst_source.sessions > total_sessions * 0.1) {
        insights.push(`יש הזדמנות לשיפור ב-<strong>${worst_source.source}</strong> - ` +
            `מביא הרבה תנועה (${worst_source.sessions.toLocaleString()}) אבל עם איכות נמוכה יותר`);
    }

    return "<ul class='mb-0 mt-2'>" + insights.map(insight => `<li>${insight}</li>`).join("") + "</ul>";
}

function generateRecommendations(traffic_sources) {
    if (!traffic_sources.length) {
        return "אין מספיק נתונים להמלצות";
    }

    const recommendations = [];
    const best_source = traffic_sources[0];

    // Investment recommendation
    recommendations.push(`<strong>הגדל השקעה ב-${best_source.source}</strong> - ` +
        `זה המקור הכי איכותי שלך`);

    // Find sources with high bounce rate
    const high_bounce_sources = traffic_sources.filter(s => s.bounce_rate > 60);
    if (high_bounce_sources.length > 0) {
        const source_name = high_bounce_sources[0].source;
        recommendations.push(`<strong>שפר את חוויית המשתמש מ-${source_name}</strong> - ` +
            `שיעור נטישה גבוה (${high_bounce_sources[0].bounce_rate}%)`);
    }

    // Find sources with low pages per session
    const low_engagement = traffic_sources.filter(s => s.pages_per_session < 2);
    if (low_engagement.length > 0) {
        const source_name = low_engagement[0].source;
        recommendations.push(`<strong>שפר את התוכן עבור ${source_name}</strong> - ` +
            `מבקרים רואים מעט דפים (${low_engagement[0].pages_per_session})`);
    }

    // Conversion opportunity
    const high_traffic_low_conversion = traffic_sources.filter(s =>
        s.sessions > 100 && s.conversions === 0);
    if (high_traffic_low_conversion.length > 0) {
        const source_name = high_traffic_low_conversion[0].source;
        recommendations.push(`<strong>הוסף מטרות המרה עבור ${source_name}</strong> - ` +
            `תנועה גבוהה ללא מעקב המרות`);
    }

    return "<ul class='mb-0 mt-2'>" + recommendations.map(rec => `<li>${rec}</li>`).join("") + "</ul>";
} 