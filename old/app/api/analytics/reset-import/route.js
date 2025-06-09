import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Reset any stuck import flags
        await prisma.userIntegration.updateMany({
            where: {
                userId: session.user.id,
                provider: 'google'
            },
            data: {
                status: 'connected' // Reset from any 'importing' status
            }
        });

        return Response.json({
            success: true,
            message: 'Import status reset'
        });

    } catch (error) {
        return Response.json({
            error: 'Failed to reset status',
            details: error.message
        }, { status: 500 });
    }
} 