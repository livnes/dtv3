import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { providerName, integrationId } = await request.json();

        if (!providerName) {
            return NextResponse.json(
                { success: false, error: 'Provider name is required' },
                { status: 400 }
            );
        }

        logInfo('Disconnecting service integration', {
            userId: session.user.id,
            userEmail: session.user.email,
            providerName,
            integrationId
        });

        let deletedCount = 0;

        if (integrationId) {
            // Delete specific integration by ID
            const deletedIntegration = await prisma.userIntegration.delete({
                where: {
                    id: integrationId,
                    userId: session.user.id // Ensure user can only delete their own integrations
                }
            });
            deletedCount = 1;

            logInfo('Deleted specific integration', {
                userId: session.user.id,
                integrationId,
                providerName: deletedIntegration.providerName,
                accountId: deletedIntegration.accountId
            });
        } else {
            // Delete all integrations for this provider
            const result = await prisma.userIntegration.deleteMany({
                where: {
                    userId: session.user.id,
                    providerName: providerName
                }
            });
            deletedCount = result.count;

            logInfo('Deleted all integrations for provider', {
                userId: session.user.id,
                providerName,
                deletedCount
            });
        }

        if (deletedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'No integrations found to disconnect' },
                { status: 404 }
            );
        }

        // Return success with provider-specific message
        const providerDisplayNames = {
            'google_analytics': 'Google Analytics',
            'google_search_console': 'Google Search Console',
            'google_ads': 'Google Ads',
            'facebook_ads': 'Facebook Ads',
            'tiktok_ads': 'TikTok Ads'
        };

        const displayName = providerDisplayNames[providerName] || providerName;

        return NextResponse.json({
            success: true,
            message: `${displayName} disconnected successfully`,
            deletedCount,
            providerName
        });

    } catch (error) {
        logError('Error disconnecting service integration', {
            error: error.message,
            stack: error.stack,
            userId: session?.user?.id
        });

        if (error.code === 'P2025') {
            // Prisma record not found
            return NextResponse.json(
                { success: false, error: 'Integration not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Failed to disconnect service' },
            { status: 500 }
        );
    }
} 