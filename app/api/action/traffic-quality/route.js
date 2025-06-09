import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/analytics';

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'לא מחובר למערכת' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const propertyId = searchParams.get('propertyId');
        const dateRange = searchParams.get('dateRange') || '30days';

        if (!propertyId) {
            return NextResponse.json({
                success: false,
                error: 'נדרש מזהה נכס Analytics'
            }, { status: 400 });
        }

        console.log(`🔍 Making direct Google Analytics API call for property: ${propertyId}`);

        // Create analytics service from user
        const analyticsService = await AnalyticsService.fromUser(session.user.id);

        // Get traffic quality data directly from Google API
        const result = await analyticsService.getTrafficQualityData(propertyId, dateRange);

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || 'שגיאה בטעינת נתוני איכות תנועה'
            }, { status: 500 });
        }

        // Transform data to match frontend expectations
        const trafficSources = result.traffic_sources.map(source => ({
            source: source.source,
            sourceMedium: source.source_medium,
            sessions: source.sessions,
            users: source.users,
            bounceRate: source.bounce_rate,
            pagesPerSession: source.pages_per_session,
            avgSessionDuration: source.avg_session_duration,
            conversions: source.conversions,
            qualityScore: source.quality_score
        }));

        // Generate structured insights and recommendations
        const insights = generateStructuredInsights(trafficSources, result.total_sessions, dateRange);
        const recommendations = generateStructuredRecommendations(trafficSources, result.total_sessions);

        return NextResponse.json({
            success: true,
            data: {
                totalSessions: result.total_sessions,
                trafficSources: trafficSources,
                insights: insights,
                recommendations: recommendations,
                dateRange: result.date_range
            }
        });

    } catch (error) {
        console.error('❌ Error in traffic quality API:', error);
        return NextResponse.json({
            success: false,
            error: 'שגיאה בטעינת נתוני איכות תנועה'
        }, { status: 500 });
    }
}

function generateStructuredInsights(trafficSources, totalSessions, dateRange) {
    if (!trafficSources.length) {
        return {
            summary: 'אין מספיק נתונים לניתוח',
            items: []
        };
    }

    const topSource = trafficSources[0];
    const topSourcePercentage = ((topSource.sessions / totalSessions) * 100).toFixed(1);

    const dateText = dateRange === '7days' ? '7 הימים האחרונים' :
        dateRange === '30days' ? '30 הימים האחרונים' :
            '90 הימים האחרונים';

    const insights = [];

    // Overall performance insight
    // insights.push({
    //     type: 'overview',
    //     icon: '🎯',
    //     title: 'ביצועים כלליים',
    //     message: `באתר שלך היו ${totalSessions.toLocaleString()} ביקורים ב-${dateText} מ-${trafficSources.length} מקורות תנועה שונים`,
    //     value: totalSessions,
    //     metric: 'ביקורים',
    //     period: dateText
    // });

    // Best source analysis
    insights.push({
        type: 'top_source',
        icon: '🏆',
        title: 'מקור מוביל',
        message: `${topSource.source} מייצר ${topSourcePercentage}% מהתנועה עם ציון איכות ${topSource.qualityScore}`,
        source: topSource.source,
        percentage: parseFloat(topSourcePercentage),
        qualityScore: topSource.qualityScore,
        sessions: topSource.sessions
    });

    // Quality analysis
    const highQualitySources = trafficSources.filter(s => s.qualityScore >= 70);
    const mediumQualitySources = trafficSources.filter(s => s.qualityScore >= 40 && s.qualityScore < 70);
    const lowQualitySources = trafficSources.filter(s => s.qualityScore < 40);

    if (highQualitySources.length > 0) {
        const highQualitySessionsPercent = ((highQualitySources.reduce((sum, s) => sum + s.sessions, 0) / totalSessions) * 100).toFixed(1);
        insights.push({
            type: 'quality',
            icon: '✨',
            title: 'איכות גבוהה',
            message: `${highQualitySessionsPercent}% מהתנועה שלך מגיעה ממקורות איכותיים (ציון 70+)`,
            percentage: parseFloat(highQualitySessionsPercent),
            sourcesCount: highQualitySources.length,
            sources: highQualitySources.map(s => s.source)
        });
    }

    // Engagement insights
    const avgBounceRate = (trafficSources.reduce((sum, s) => sum + (s.bounceRate * s.sessions), 0) / totalSessions).toFixed(1);

    if (avgBounceRate < 40) {
        insights.push({
            type: 'engagement',
            icon: '👥',
            title: 'מעורבות מצוינת',
            message: `שיעור נטישה ממוצע של ${avgBounceRate}% - המבקרים שלך מעורבים!`,
            bounceRate: parseFloat(avgBounceRate),
            status: 'excellent'
        });
    } else if (avgBounceRate > 60) {
        insights.push({
            type: 'engagement',
            icon: '⚠️',
            title: 'הזדמנות לשיפור',
            message: `שיעור נטישה ממוצע של ${avgBounceRate}% - יש מקום לשיפור חוויית המשתמש`,
            bounceRate: parseFloat(avgBounceRate),
            status: 'needs_improvement'
        });
    }

    // Session duration insight
    if (topSource.avgSessionDuration && topSource.avgSessionDuration !== '0:00') {
        const durationInsight = getSessionDurationInsight(topSource.avgSessionDuration);
        insights.push({
            type: 'duration',
            icon: '⏱️',
            title: 'זמן שהייה',
            message: `מבקרים מ-${topSource.source} נשארים בממוצע ${topSource.avgSessionDuration} - ${durationInsight.text}`,
            source: topSource.source,
            duration: topSource.avgSessionDuration,
            status: durationInsight.status
        });
    }

    // Conversion insights
    const totalConversions = trafficSources.reduce((sum, s) => sum + s.conversions, 0);
    if (totalConversions > 0) {
        const conversionRate = ((totalConversions / totalSessions) * 100).toFixed(2);
        const bestConvertingSource = trafficSources.reduce((best, current) =>
            (current.conversions / current.sessions) > (best.conversions / best.sessions) ? current : best
        );

        insights.push({
            type: 'conversions',
            icon: '🎯',
            title: 'המרות',
            message: `שיעור המרה כללי של ${conversionRate}%, ${bestConvertingSource.source} הוא המקור הכי טוב להמרות`,
            conversionRate: parseFloat(conversionRate),
            totalConversions: totalConversions,
            bestSource: bestConvertingSource.source,
            bestSourceRate: ((bestConvertingSource.conversions / bestConvertingSource.sessions) * 100).toFixed(2)
        });
    }

    // Diversity insight
    if (trafficSources.length >= 5) {
        insights.push({
            type: 'diversity',
            icon: '🌐',
            title: 'גיוון מקורות',
            message: `יש לך ${trafficSources.length} מקורות תנועה פעילים - זה מצוין לביטחון וגדילה`,
            sourcesCount: trafficSources.length,
            status: 'excellent'
        });
    } else if (trafficSources.length <= 2) {
        insights.push({
            type: 'diversity',
            icon: '⚠️',
            title: 'תלות במקורות',
            message: `רק ${trafficSources.length} מקורות תנועה עיקריים - כדאי לגוון`,
            sourcesCount: trafficSources.length,
            status: 'warning'
        });
    }

    return {
        summary: `נותחו ${trafficSources.length} מקורות תנועה עם ${totalSessions.toLocaleString()} ביקורים ב-${dateText}`,
        items: insights
    };
}

function generateStructuredRecommendations(trafficSources, totalSessions) {
    if (!trafficSources.length) {
        return {
            summary: 'אין מספיק נתונים להמלצות',
            items: []
        };
    }

    const recommendations = [];
    const topSource = trafficSources[0];

    // Priority 1: Amplify best performer
    if (topSource.qualityScore >= 70) {
        recommendations.push({
            priority: 'high',
            type: 'amplify',
            icon: '🚀',
            title: 'הגדל השקעה במקור המוביל',
            description: `הגדל השקעה ב-${topSource.source} - זה המקור הכי איכותי שלך`,
            source: topSource.source,
            qualityScore: topSource.qualityScore,
            sessions: topSource.sessions,
            action: 'increase_investment'
        });
    }

    // Priority 2: Fix high-traffic low-quality sources
    const highTrafficLowQuality = trafficSources.filter(s =>
        s.sessions > totalSessions * 0.1 && s.qualityScore < 50
    );

    if (highTrafficLowQuality.length > 0) {
        const source = highTrafficLowQuality[0];
        recommendations.push({
            priority: 'medium',
            type: 'optimize',
            icon: '🔧',
            title: 'שיפור איכות תנועה',
            description: `שפר את איכות התנועה מ-${source.source} - הרבה תנועה אבל איכות נמוכה`,
            source: source.source,
            sessions: source.sessions,
            qualityScore: source.qualityScore,
            action: 'improve_quality'
        });
    }

    // Priority 3: Bounce rate optimization
    const highBounceSources = trafficSources.filter(s => s.bounceRate > 70 && s.sessions > 50);
    if (highBounceSources.length > 0) {
        const source = highBounceSources[0];
        recommendations.push({
            priority: 'medium',
            type: 'bounce_rate',
            icon: '💡',
            title: 'שיפור דף נחיתה',
            description: `שפר את דף הנחיתה עבור ${source.source} - שיעור נטישה גבוה`,
            source: source.source,
            bounceRate: source.bounceRate,
            sessions: source.sessions,
            action: 'improve_landing_page'
        });
    }

    // Priority 4: Diversification
    if (trafficSources.length <= 3) {
        const missingChannels = getMissingChannels(trafficSources);
        if (missingChannels.length > 0) {
            recommendations.push({
                priority: 'low',
                type: 'diversify',
                icon: '🌱',
                title: 'פיתוח מקורות חדשים',
                description: 'שקול להוסיף מקורות תנועה נוספים',
                currentSources: trafficSources.length,
                suggestedChannels: missingChannels,
                action: 'add_channels'
            });
        }
    }

    // Priority 5: Conversion tracking
    const highTrafficNoConversions = trafficSources.filter(s =>
        s.sessions > 10 && s.conversions === 0
    );

    if (highTrafficNoConversions.length > 0) {
        recommendations.push({
            priority: 'medium',
            type: 'tracking',
            icon: '📊',
            title: 'הגדרת מעקב המרות',
            description: `הגדר מעקב המרות עבור ${highTrafficNoConversions[0].source} - תנועה ללא מדידת תוצאות`,
            sources: highTrafficNoConversions.map(s => s.source),
            action: 'setup_conversion_tracking'
        });
    }

    return {
        summary: `${recommendations.length} המלצות לשיפור ביצועי התנועה`,
        items: recommendations
    };
}

function getSessionDurationInsight(duration) {
    const [minutes, seconds] = duration.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;

    if (totalSeconds > 300) return { text: 'מעולה! מבקרים מאוד מעורבים', status: 'excellent' };
    if (totalSeconds > 120) return { text: 'טוב, יש מעורבות', status: 'good' };
    if (totalSeconds > 60) return { text: 'בסיסי, יש מקום לשיפור', status: 'fair' };
    return { text: 'נמוך, צריך לשפר את התוכן', status: 'poor' };
}

function getMissingChannels(existingSources) {
    const existingChannels = existingSources.map(s => s.source.toLowerCase());
    const commonChannels = [
        'Organic Search', 'Direct', 'Social Media', 'Email', 'Paid Search',
        'Display', 'Referral', 'Video', 'Shopping'
    ];

    return commonChannels.filter(channel =>
        !existingChannels.some(existing =>
            existing.includes(channel.toLowerCase().split(' ')[0])
        )
    ).slice(0, 3);
} 