import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { integrationId, providerName } = await request.json();

        if (!integrationId || !providerName) {
            return NextResponse.json({
                error: 'Integration ID and provider name are required'
            }, { status: 400 });
        }

        logInfo('Activating property integration', {
            userId: session.user.id,
            integrationId,
            providerName
        });

        // First, deactivate all other integrations of the same type for this user
        await prisma.userIntegration.updateMany({
            where: {
                userId: session.user.id,
                providerName: providerName
            },
            data: {
                isActive: false
            }
        });

        // Then activate the selected integration
        const activatedIntegration = await prisma.userIntegration.update({
            where: {
                id: parseInt(integrationId),
                userId: session.user.id // Security: ensure user owns this integration
            },
            data: {
                isActive: true
            }
        });

        logInfo('Property integration activated successfully', {
            userId: session.user.id,
            integrationId,
            accountId: activatedIntegration.accountId,
            propertyName: activatedIntegration.propertyName
        });

        return NextResponse.json({
            success: true,
            message: 'Property activated successfully',
            integration: {
                id: activatedIntegration.id,
                accountId: activatedIntegration.accountId,
                propertyName: activatedIntegration.propertyName,
                accountName: activatedIntegration.accountName
            }
        });

    } catch (error) {
        logError('Error activating property integration', {
            userId: session?.user?.id,
            error: error.message
        });

        return NextResponse.json({
            success: false,
            error: 'Failed to activate property: ' + error.message
        }, { status: 500 });
    }
} 