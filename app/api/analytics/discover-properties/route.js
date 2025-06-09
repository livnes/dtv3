import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { discoverGA4Properties } from '@/lib/analytics-properties';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'לא מחובר למערכת' },
                { status: 401 }
            );
        }

        logInfo('Discovering Analytics properties', { userId: session.user.id });

        // Get user's Google Analytics integration
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: 'google_analytics',
                isActive: true
            }
        });

        if (!integration) {
            return NextResponse.json({
                success: false,
                error: 'Google Analytics integration not found'
            }, { status: 404 });
        }

        // Use the same discovery function as backfill
        const properties = await discoverGA4Properties(integration);

        if (properties.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'לא נמצאו נכסי GA4 בחשבון שלך'
            });
        }

        logInfo('Analytics properties discovered successfully', {
            userId: session.user.id,
            propertiesCount: properties.length,
            properties: properties.map(p => ({ id: p.id, name: p.displayName }))
        });

        return NextResponse.json({
            success: true,
            properties: properties
        });

    } catch (error) {
        logError('Error discovering Analytics properties', {
            userId: session.user.id,
            error: error.message,
            stack: error.stack
        });

        return NextResponse.json({
            success: false,
            error: 'שגיאה בחיפוש נכסי Analytics'
        }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
} 