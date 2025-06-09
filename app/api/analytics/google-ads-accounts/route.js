import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { createGoogleAdsService } from '@/lib/googleAds';
import { logInfo, logError } from '@/lib/logger';

const prisma = new PrismaClient();

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
        }

        // Get user's Google Ads integration
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                providerName: 'google-ads',
                isActive: true
            }
        });

        if (!integration) {
            return NextResponse.json({
                error: 'לא נמצא חיבור ל-Google Ads',
                accounts: []
            }, { status: 404 });
        }

        logInfo('Fetching Google Ads accounts', {
            userId: session.user.id,
            integrationId: integration.id
        });

        // Create Google Ads service
        const adsService = await createGoogleAdsService(integration);

        // Get accessible accounts
        const accountResourceNames = await adsService.getAccessibleAccounts();

        // Extract customer IDs and get account details
        const accounts = [];
        for (const resourceName of accountResourceNames) {
            try {
                // Extract customer ID from resource name (format: customers/1234567890)
                const customerId = resourceName.split('/')[1];

                if (customerId) {
                    const accountDetails = await adsService.getAccountDetails(customerId);

                    if (accountDetails) {
                        accounts.push({
                            customerId: customerId,
                            name: accountDetails.customer?.descriptiveName || `חשבון ${customerId}`,
                            currencyCode: accountDetails.customer?.currencyCode || 'ILS',
                            timeZone: accountDetails.customer?.timeZone || 'Asia/Jerusalem',
                            status: accountDetails.customer?.status || 'UNKNOWN'
                        });
                    }
                }
            } catch (accountError) {
                logError('Error fetching individual account details', {
                    resourceName,
                    error: accountError.message
                });
                // Continue with other accounts
            }
        }

        logInfo('Successfully retrieved Google Ads accounts', {
            userId: session.user.id,
            accountsCount: accounts.length
        });

        return NextResponse.json({
            success: true,
            accounts: accounts,
            integration: {
                id: integration.id,
                accountId: integration.accountId,
                connected: true
            }
        });

    } catch (error) {
        logError('Error in Google Ads accounts discovery', {
            error: error.message,
            stack: error.stack,
            userId: session?.user?.id
        });

        return NextResponse.json({
            success: false,
            error: 'שגיאה בטעינת חשבונות Google Ads',
            accounts: []
        }, { status: 500 });
    }
} 