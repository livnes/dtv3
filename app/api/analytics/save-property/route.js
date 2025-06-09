import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { triggerBackfill } from '@/lib/backfill';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { propertyId, propertyName, accountName, integrationType } = await request.json();

        if (!propertyId || !integrationType) {
            return NextResponse.json({
                success: false,
                error: 'Property ID and integration type are required'
            }, { status: 400 });
        }

        logInfo('Saving selected Analytics property', {
            userId: session.user.id,
            userEmail: session.user.email,
            propertyId,
            propertyName,
            integrationType
        });

        // Determine the provider name based on integration type
        const providerName = integrationType === 'analytics' ? 'google_analytics' : 'google_search_console';

        // Update the integration with the selected property ID
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: providerName,
                isActive: true
            }
        });

        if (!integration) {
            return NextResponse.json({
                success: false,
                error: `No ${integrationType} integration found`
            }, { status: 404 });
        }

        // Update the integration with the correct property ID and name
        await prisma.userIntegration.update({
            where: { id: integration.id },
            data: {
                accountId: propertyId,
                propertyName: propertyName, // Store the property display name
                accountName: accountName, // Store the account name
                lastError: null,
                backfillCompleted: false, // Reset backfill flag
                updatedAt: new Date()
            }
        });

        logInfo('✅ Updated integration with selected property', {
            userId: session.user.id,
            userEmail: session.user.email,
            integrationId: integration.id,
            propertyId,
            propertyName
        });

        // Trigger backfill for the selected property
        try {
            await triggerBackfill(session.user.email, integrationType, false);

            logInfo('✅ Triggered backfill after property selection', {
                userId: session.user.id,
                userEmail: session.user.email,
                propertyId,
                integrationType
            });
        } catch (backfillError) {
            logError('Failed to trigger backfill after property selection', {
                userId: session.user.id,
                error: backfillError.message
            });
            // Don't fail the whole request if backfill trigger fails
        }

        return NextResponse.json({
            success: true,
            message: `Successfully saved ${integrationType} property and triggered backfill`,
            propertyId,
            propertyName,
            integrationType
        });

    } catch (error) {
        logError('Error saving Analytics property', {
            error: error.message,
            stack: error.stack
        });

        return NextResponse.json({
            success: false,
            error: 'Failed to save Analytics property',
            details: error.message
        }, { status: 500 });
    }
} 