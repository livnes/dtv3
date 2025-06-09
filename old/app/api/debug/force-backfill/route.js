import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import analyticsService from '@/lib/analytics';

export async function POST() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Try to fetch just recent data (last 7 days) to test
        const properties = await analyticsService.getUserProperties(session.user.id);

        if (properties.length === 0) {
            return Response.json({
                error: 'No Analytics properties found. Check OAuth scopes.'
            });
        }

        // Test with just one property, last 7 days
        const testData = await analyticsService.getTrafficQualityData(
            session.user.id,
            properties[0].propertyId,
            { days: 7 }
        );

        return Response.json({
            success: true,
            message: 'Manual backfill test completed',
            properties: properties.length,
            testData
        });

    } catch (error) {
        return Response.json({
            error: 'Manual backfill failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
} 