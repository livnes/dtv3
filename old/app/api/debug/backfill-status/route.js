import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get integration status
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                provider: 'google'
            }
        });

        // Get any recent metrics to see if backfill is working
        const recentMetrics = await prisma.metrics.count({
            where: {
                userId: session.user.id,
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
            }
        });

        // Check if there are any analytics properties
        const totalMetrics = await prisma.metrics.count({
            where: { userId: session.user.id }
        });

        return Response.json({
            integration: {
                status: integration?.status,
                metadata: integration?.metadata,
                hasTokens: !!(integration?.accessToken && integration?.refreshToken),
                lastUpdated: integration?.updatedAt
            },
            metrics: {
                recentMetrics,
                totalMetrics
            },
            timeInfo: {
                now: new Date().toISOString(),
                integrationAge: integration ?
                    Math.round((Date.now() - new Date(integration.createdAt).getTime()) / 1000 / 60) + ' minutes'
                    : 'N/A'
            }
        });

    } catch (error) {
        return Response.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
} 