import { google } from 'googleapis';
import { decrypt } from '@/lib/encryption';
import { logInfo, logError } from '@/lib/logger';

/**
 * Discovers GA4 properties for a user integration
 * @param {Object} integration - User integration object with encrypted tokens
 * @returns {Array} Array of GA4 properties with { id, displayName, websiteUrl }
 */
export async function discoverGA4Properties(integration) {
    try {
        logInfo('🔍 Discovering GA4 properties', {
            userId: integration.userId,
            integrationId: integration.id
        });

        // Decrypt tokens
        const accessToken = decrypt(integration.encryptedAccessToken);
        const refreshToken = integration.encryptedRefreshToken ?
            decrypt(integration.encryptedRefreshToken) : null;

        // Create OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        // Create Analytics Admin client to discover properties
        const analyticsAdmin = google.analyticsadmin('v1beta');

        // Get accounts first
        console.log('🔍 Fetching Google Analytics accounts...');
        const accountsResponse = await analyticsAdmin.accounts.list({
            auth: oauth2Client
        });

        console.log(`📊 Found ${accountsResponse.data.accounts?.length || 0} Google Analytics accounts`);

        const properties = [];

        if (accountsResponse.data.accounts) {
            for (const account of accountsResponse.data.accounts) {
                try {
                    console.log(`🏢 Processing account: ${account.displayName} (${account.name})`);

                    // Get properties for this account
                    const propertiesResponse = await analyticsAdmin.properties.list({
                        filter: `parent:${account.name}`,
                        auth: oauth2Client
                    });

                    console.log(`📊 Found ${propertiesResponse.data.properties?.length || 0} properties for account ${account.displayName}`);

                    if (propertiesResponse.data.properties) {
                        for (const property of propertiesResponse.data.properties) {
                            console.log(`🏗️ Property: ${property.displayName} (${property.name}) - Type: ${property.propertyType}`);

                            // Only include GA4 properties (they have property IDs)
                            const propertyId = property.name.match(/properties\/(\d+)/)?.[1];

                            if (propertyId && property.propertyType === 'PROPERTY_TYPE_ORDINARY') {
                                console.log(`✅ Valid GA4 property found: ID ${propertyId}`);
                                properties.push({
                                    id: propertyId,
                                    displayName: property.displayName,
                                    websiteUrl: property.websiteUrl || '',
                                    account: account.displayName,
                                    createTime: property.createTime
                                });
                            } else {
                                console.log(`❌ Skipping property (not GA4 or invalid): ${property.displayName}`);
                            }
                        }
                    }
                } catch (propertyError) {
                    console.error(`❌ Error fetching properties for account ${account.displayName}:`, propertyError.message);
                    logError('Error fetching properties for account', {
                        accountName: account.name,
                        error: propertyError.message
                    });
                    // Continue with other accounts
                }
            }
        }

        logInfo('✅ Discovered GA4 properties', {
            userId: integration.userId,
            propertiesCount: properties.length,
            properties: properties.map(p => ({ id: p.id, name: p.displayName }))
        });

        return properties;

    } catch (error) {
        logError('❌ Error discovering GA4 properties', {
            userId: integration.userId,
            integrationId: integration.id,
            error: error.message
        });
        return [];
    }
}

/**
 * Gets the primary (first) GA4 property for an integration
 * @param {Object} integration - User integration object
 * @returns {string|null} Property ID or null if none found
 */
export async function getPrimaryGA4Property(integration) {
    try {
        const properties = await discoverGA4Properties(integration);

        if (properties.length === 0) {
            logError('No GA4 properties found for user', {
                userId: integration.userId,
                integrationId: integration.id
            });
            return null;
        }

        // Return the first property ID
        const primaryProperty = properties[0];

        logInfo('📊 Using primary GA4 property', {
            userId: integration.userId,
            propertyId: primaryProperty.id,
            propertyName: primaryProperty.displayName
        });

        return primaryProperty.id;

    } catch (error) {
        logError('❌ Error getting primary GA4 property', {
            userId: integration.userId,
            error: error.message
        });
        return null;
    }
}

/**
 * Updates integration with discovered GA4 property ID
 * @param {Object} integration - User integration object
 * @param {Object} prisma - Prisma client
 * @returns {boolean} Success status
 */
export async function updateIntegrationWithGA4Property(integration, prisma) {
    try {
        const propertyId = await getPrimaryGA4Property(integration);

        if (!propertyId) {
            logError('Cannot update integration - no GA4 property found', {
                userId: integration.userId,
                integrationId: integration.id
            });
            return false;
        }

        // Update the integration with the correct property ID
        await prisma.userIntegration.update({
            where: { id: integration.id },
            data: {
                accountId: propertyId, // Store the GA4 property ID
                lastError: null,
                updatedAt: new Date()
            }
        });

        logInfo('✅ Updated integration with GA4 property ID', {
            userId: integration.userId,
            integrationId: integration.id,
            propertyId: propertyId
        });

        return true;

    } catch (error) {
        logError('❌ Error updating integration with GA4 property', {
            userId: integration.userId,
            integrationId: integration.id,
            error: error.message
        });
        return false;
    }
} 