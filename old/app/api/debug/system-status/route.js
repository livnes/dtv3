import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        // Check database without authentication
        const integrations = await prisma.userIntegration.findMany({
            where: { provider: 'google' },
            select: {
                id: true,
                userId: true,
                status: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
                accessToken: true, // Check if exists (will be encrypted blob)
                refreshToken: true
            }
        });

        const metrics = await prisma.metrics.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        const userCount = await prisma.user.count();

        return Response.json({
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                userCount,
                integrations: integrations.map(int => ({
                    id: int.id,
                    userId: int.userId,
                    status: int.status,
                    metadata: int.metadata,
                    hasAccessToken: !!int.accessToken,
                    hasRefreshToken: !!int.refreshToken,
                    created: int.createdAt,
                    updated: int.updatedAt,
                    ageMinutes: Math.round((Date.now() - new Date(int.createdAt).getTime()) / 1000 / 60)
                })),
                recentMetrics: metrics.length,
                latestMetric: metrics[0]?.createdAt || 'None'
            }
        });

    } catch (error) {
        return Response.json({
            error: 'Database error',
            details: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
} 