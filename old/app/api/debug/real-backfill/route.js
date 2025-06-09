import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
    try {
        console.log('🚀 Starting REAL backfill process...');

        // 1. Check if we have Google integrations
        const integrations = await prisma.userIntegration.findMany({
            where: { provider: 'google' }
        });

        console.log(`Found ${integrations.length} Google integrations`);

        if (integrations.length === 0) {
            return Response.json({
                error: 'No Google integrations found',
                message: 'User needs to connect Google Analytics first'
            });
        }

        // 2. Try to use Google Analytics API
        const { google } = require('googleapis');

        for (const integration of integrations) {
            console.log(`Processing integration ${integration.id}...`);

            if (!integration.accessToken) {
                console.log('❌ No access token found');
                continue;
            }

            try {
                // Decrypt token (you'll need to implement this)
                const { decrypt } = require('@/lib/encryption');
                const accessToken = decrypt(integration.accessToken);

                // Set up Google client
                const oauth2Client = new google.auth.OAuth2();
                oauth2Client.setCredentials({ access_token: accessToken });

                // Test Analytics API access
                const analytics = google.analyticsadmin('v1beta');
                const response = await analytics.accounts.list({ auth: oauth2Client });

                console.log('✅ Successfully connected to Analytics API');
                console.log(`Found ${response.data.accounts?.length || 0} Analytics accounts`);

                // Mark as completed
                await prisma.userIntegration.update({
                    where: { id: integration.id },
                    data: {
                        status: 'connected',
                        metadata: {
                            backfillCompleted: true,
                            backfillDate: new Date().toISOString(),
                            accountsFound: response.data.accounts?.length || 0
                        }
                    }
                });

            } catch (apiError) {
                console.error('❌ Analytics API Error:', apiError.message);

                await prisma.userIntegration.update({
                    where: { id: integration.id },
                    data: {
                        status: 'error',
                        metadata: {
                            backfillCompleted: false,
                            error: apiError.message,
                            lastAttempt: new Date().toISOString()
                        }
                    }
                });
            }
        }

        return Response.json({
            success: true,
            message: 'Real backfill process completed',
            processedIntegrations: integrations.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Backfill process failed:', error);

        return Response.json({
            error: 'Backfill failed',
            details: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
} 