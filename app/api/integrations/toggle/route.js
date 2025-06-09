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
            return NextResponse.json({ success: false, error: 'לא מחובר' }, { status: 401 });
        }

        const { provider, action } = await request.json();

        if (!provider || !action) {
            return NextResponse.json({
                success: false,
                error: 'נדרש ספק ופעולה'
            }, { status: 400 });
        }

        logInfo('Toggling integration', { userId: session.user.id, provider, action });

        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: provider
            }
        });

        if (!integration) {
            return NextResponse.json({
                success: false,
                error: 'חיבור לא נמצא'
            }, { status: 404 });
        }

        if (action === 'disconnect') {
            // Deactivate the integration (don't delete, keep for potential reconnection)
            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            logInfo('Integration deactivated', { userId: session.user.id, provider });

            return NextResponse.json({
                success: true,
                message: `חיבור ל${getProviderDisplayName(provider)} הופסק בהצלחה`
            });

        } else if (action === 'reconnect') {
            // Reactivate the integration
            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: {
                    isActive: true,
                    updatedAt: new Date()
                }
            });

            logInfo('Integration reactivated', { userId: session.user.id, provider });

            return NextResponse.json({
                success: true,
                message: `חיבור ל${getProviderDisplayName(provider)} הופעל מחדש בהצלחה`
            });

        } else if (action === 'toggle') {
            // Toggle the current active status
            const newActiveStatus = !integration.isActive;

            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: {
                    isActive: newActiveStatus,
                    updatedAt: new Date()
                }
            });

            logInfo('Integration toggled', {
                userId: session.user.id,
                provider,
                newStatus: newActiveStatus
            });

            return NextResponse.json({
                success: true,
                message: `חיבור ל${getProviderDisplayName(provider)} ${newActiveStatus ? 'הופעל' : 'הושבת'} בהצלחה`
            });

        } else if (action === 'delete') {
            // Completely remove the integration
            await prisma.userIntegration.delete({
                where: { id: integration.id }
            });

            logInfo('Integration deleted', { userId: session.user.id, provider });

            return NextResponse.json({
                success: true,
                message: `חיבור ל${getProviderDisplayName(provider)} נמחק לחלוטין`
            });

        } else {
            return NextResponse.json({
                success: false,
                error: 'פעולה לא תקינה'
            }, { status: 400 });
        }

    } catch (error) {
        logError('Error toggling integration', error);
        return NextResponse.json({
            success: false,
            error: 'שגיאה בעדכון חיבור'
        }, { status: 500 });
    }
}

function getProviderDisplayName(provider) {
    const names = {
        'google': 'Google Analytics',
        'google-ads': 'Google Ads',
        'facebook': 'Facebook Business',
        'tiktok': 'TikTok Ads',
        'search-console': 'Search Console'
    };
    return names[provider] || provider;
} 