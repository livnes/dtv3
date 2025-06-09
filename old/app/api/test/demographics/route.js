import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import logger from '@/lib/logger';

const prisma = new PrismaClient();

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Test database connection
        const userCount = await prisma.user.count();
        logger.info(`Database connected. Total users: ${userCount}`);

        return Response.json({
            success: true,
            test: 'demographics_api',
            results: {
                databaseConnection: true,
                userCount,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error in demographics test:', error);

        return Response.json({
            error: 'Test failed',
            details: error.message
        }, { status: 500 });
    }
} 