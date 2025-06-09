import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import demographicsService from '@/lib/demographicsService';
import logger from '@/lib/logger';

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { propertyId, startDate, endDate } = body;

        if (!propertyId) {
            return Response.json({ error: 'Property ID is required' }, { status: 400 });
        }

        const options = {
            startDate: startDate || '30daysAgo',
            endDate: endDate || 'today'
        };

        const demographicData = await demographicsService.getDemographicData(
            session.user.id,
            propertyId,
            options
        );

        logger.info(`Fetched demographic data for property ${propertyId}, user ${session.user.id}`);

        return Response.json({
            success: true,
            data: demographicData,
            propertyId
        });

    } catch (error) {
        logger.error('Error in /api/analytics/demographics:', error);

        return Response.json({
            error: 'Failed to fetch demographic data',
            details: error.message
        }, { status: 500 });
    }
} 