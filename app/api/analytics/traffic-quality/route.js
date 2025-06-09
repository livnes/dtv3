import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/analytics';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request) {
    try {
        // Get the authenticated session
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'לא מחובר למערכת' },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { propertyId, dateRange = '30days', comparison = null } = body;

        if (!propertyId) {
            return NextResponse.json(
                { success: false, error: 'נדרש מזהה נכס Analytics' },
                { status: 400 }
            );
        }

        logInfo('Fetching traffic quality data', {
            userId: session.user.id,
            propertyId,
            dateRange
        });

        // Create Analytics service for the user
        const analyticsService = await AnalyticsService.fromUser(session.user.id);

        // Get traffic quality data
        const result = await analyticsService.getTrafficQualityData(
            propertyId,
            dateRange,
            comparison
        );

        if (result.success && result.traffic_sources) {
            // Generate insights and recommendations
            const insights = analyticsService.generateInsights(
                result.traffic_sources,
                result.total_sessions
            );

            const recommendations = analyticsService.generateRecommendations(
                result.traffic_sources
            );

            result.insights = insights;
            result.recommendations = recommendations;

            logInfo('Traffic quality data fetched successfully', {
                userId: session.user.id,
                propertyId,
                sourcesCount: result.traffic_sources.length,
                totalSessions: result.total_sessions
            });
        } else {
            logError('Failed to fetch traffic quality data', {
                userId: session.user.id,
                propertyId,
                error: result.error
            });
        }

        return NextResponse.json(result);

    } catch (error) {
        logError('Error in traffic quality API', { error: error.message });

        return NextResponse.json(
            {
                success: false,
                error: 'שגיאה בטעינת נתוני איכות התנועה'
            },
            { status: 500 }
        );
    }
} 