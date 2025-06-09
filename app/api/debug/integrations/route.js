import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get user integrations with all fields
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                integrations: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Return raw integration data for debugging
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            integrations: user.integrations.map(integration => ({
                id: integration.id,
                providerName: integration.providerName,
                accountId: integration.accountId,
                accountName: integration.accountName,
                propertyName: integration.propertyName,
                isActive: integration.isActive,
                backfillCompleted: integration.backfillCompleted,
                lastFetchAt: integration.lastFetchAt,
                lastError: integration.lastError,
                createdAt: integration.createdAt,
                updatedAt: integration.updatedAt
            }))
        });

    } catch (error) {
        console.error('Debug integrations error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
} 