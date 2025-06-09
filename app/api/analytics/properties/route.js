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

        logInfo('Fetching Analytics properties', { userId: session.user.id });

        // Create Analytics service for the user
        const analyticsService = await AnalyticsService.fromUser(session.user.id);

        // Get properties
        const result = await analyticsService.getProperties();

        if (result.success) {
            logInfo('Analytics properties fetched successfully', {
                userId: session.user.id,
                propertiesCount: result.properties.length
            });
        } else {
            logError('Failed to fetch Analytics properties', {
                userId: session.user.id,
                error: result.error
            });
        }

        return NextResponse.json(result);

    } catch (error) {
        logError('Error in analytics properties API', { error: error.message });

        return NextResponse.json(
            {
                success: false,
                error: 'שגיאה בטעינת נכסי Analytics'
            },
            { status: 500 }
        );
    }
} 