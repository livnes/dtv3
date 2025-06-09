const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./lib/encryption');
const { google } = require('googleapis');

const prisma = new PrismaClient();

async function testBackfill() {
    try {
        console.log('🔄 Testing backfill process...');

        // Find users with Google Analytics who need backfill
        const usersNeedingBackfill = await prisma.userIntegration.findMany({
            where: {
                OR: [
                    { providerName: 'google_analytics' },
                    { providerName: 'google_search_console' }
                ],
                isActive: true,
                backfillCompleted: false
            },
            include: {
                user: true
            }
        });

        console.log(`📊 Found ${usersNeedingBackfill.length} users needing backfill`);

        if (usersNeedingBackfill.length === 0) {
            console.log('✅ No users need backfill');
            return;
        }

        for (const integration of usersNeedingBackfill) {
            console.log(`📈 Testing for user ${integration.user.email}`);
            console.log(`  Provider: ${integration.providerName}`);
            console.log(`  Account ID: ${integration.accountId}`);
            console.log(`  Has tokens: ${!!integration.encryptedAccessToken}`);

            try {
                // Try to decrypt tokens
                const accessToken = decrypt(integration.encryptedAccessToken);
                console.log(`  ✅ Access token decrypted successfully (length: ${accessToken.length})`);

                // Test OAuth2 client creation
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET
                );

                oauth2Client.setCredentials({
                    access_token: accessToken,
                    refresh_token: integration.encryptedRefreshToken
                        ? decrypt(integration.encryptedRefreshToken)
                        : null
                });

                console.log('  ✅ OAuth2 client created successfully');

                // Test Analytics API client
                const analytics = google.analyticsdata({
                    version: 'v1beta',
                    auth: oauth2Client
                });

                console.log('  ✅ Analytics client created successfully');

                // The account ID might be the user ID, not property ID
                // Let's try to get properties first
                console.log(`  🔍 Trying to use property ID: ${integration.accountId}`);

                // Try a simple test query for yesterday
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                try {
                    const response = await analytics.properties.runReport({
                        property: `properties/${integration.accountId}`,
                        requestBody: {
                            dateRanges: [{
                                startDate: yesterdayStr,
                                endDate: yesterdayStr
                            }],
                            dimensions: [
                                { name: 'sessionDefaultChannelGrouping' }
                            ],
                            metrics: [
                                { name: 'sessions' }
                            ],
                            limit: 1
                        }
                    });

                    console.log(`  ✅ Test query successful! Found ${response.data.rows?.length || 0} rows`);

                    // If we get here, we can proceed with backfill
                    console.log(`  🎉 Ready for backfill!`);

                } catch (analyticsError) {
                    console.log(`  ❌ Analytics API error: ${analyticsError.message}`);

                    // The account ID might be wrong - let's try to get properties
                    try {
                        const adminAnalytics = google.analyticsadmin({
                            version: 'v1beta',
                            auth: oauth2Client
                        });

                        const accountsResponse = await adminAnalytics.accounts.list();
                        console.log(`  📋 Found ${accountsResponse.data.accounts?.length || 0} accounts`);

                        if (accountsResponse.data.accounts?.length > 0) {
                            for (const account of accountsResponse.data.accounts) {
                                console.log(`    Account: ${account.name} (${account.displayName})`);

                                const propertiesResponse = await adminAnalytics.properties.list({
                                    filter: `parent:${account.name}`
                                });

                                console.log(`    Properties: ${propertiesResponse.data.properties?.length || 0}`);

                                if (propertiesResponse.data.properties?.length > 0) {
                                    const firstProperty = propertiesResponse.data.properties[0];
                                    const propertyId = firstProperty.name.split('/')[1];
                                    console.log(`    First property ID: ${propertyId}`);

                                    // Update the integration with correct property ID
                                    await prisma.userIntegration.update({
                                        where: { id: integration.id },
                                        data: { accountId: propertyId }
                                    });

                                    console.log(`  ✅ Updated integration with correct property ID: ${propertyId}`);
                                }
                            }
                        }

                    } catch (adminError) {
                        console.log(`  ❌ Admin API error: ${adminError.message}`);
                    }
                }

            } catch (tokenError) {
                console.log(`  ❌ Token error: ${tokenError.message}`);
            }

            console.log('');
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testBackfill(); 