import { AnalyticsService } from './analytics';
import { createSearchConsoleService } from './searchConsole';
import { createGoogleAdsService } from './googleAds';
import { logInfo, logError } from './logger';
import prisma from './prisma';

/**
 * Sync Analytics properties with current Google Analytics account
 * This completely replaces the old approach - always syncs with Google Analytics
 */
export async function syncAnalyticsProperties(userId) {
    try {
        logInfo('Syncing Analytics properties with Google Analytics', {
            userId: userId
        });

        // Get current OAuth tokens from any existing Analytics integration
        const existingIntegration = await prisma.userIntegration.findFirst({
            where: {
                userId: userId,
                providerName: 'google_analytics'
            }
        });

        if (!existingIntegration) {
            logInfo('No existing Analytics integration found - user needs to connect first', { userId });
            return { success: false, error: 'No Analytics integration found - please connect first' };
        }

        // ✅ Use existing AnalyticsService that handles OAuth properly
        const analyticsService = await AnalyticsService.fromUser(userId);

        // Fetch current properties from Google Analytics
        const propertiesResult = await analyticsService.getProperties();

        if (!propertiesResult.success) {
            throw new Error(propertiesResult.error || 'Failed to fetch properties from Google Analytics');
        }

        const currentProperties = propertiesResult.properties.map(property => {
            const propertyId = property.name.match(/properties\/(\d+)/)?.[1];
            return {
                id: propertyId,
                name: property.name,
                displayName: property.displayName,
                websiteUrl: property.websiteUrl || '',
                accountName: property.accountName,
                createTime: property.createTime
            };
        }).filter(property => property.id); // Filter out invalid properties

        logInfo('Current properties from Google Analytics', {
            userId: userId,
            propertiesCount: currentProperties.length,
            properties: currentProperties.map(p => ({ id: p.id, name: p.displayName }))
        });

        // Get existing properties from database
        const existingProperties = await prisma.userIntegration.findMany({
            where: {
                userId: userId,
                providerName: 'google_analytics'
            }
        });

        const existingPropertyIds = new Set(existingProperties.map(p => p.accountId));
        const currentPropertyIds = new Set(currentProperties.map(p => p.id));

        // Find properties to add (exist in Google Analytics but not in DB)
        const propertiesToAdd = currentProperties.filter(p => !existingPropertyIds.has(p.id));

        // Find properties to remove (exist in DB but not in Google Analytics)
        const propertiesToRemove = existingProperties.filter(p => !currentPropertyIds.has(p.accountId));

        // Find properties to update (exist in both but may have changed details)
        const propertiesToUpdate = currentProperties.filter(p => existingPropertyIds.has(p.id));

        let changes = 0;

        // Remove obsolete properties
        if (propertiesToRemove.length > 0) {
            const removedCount = await prisma.userIntegration.deleteMany({
                where: {
                    userId: userId,
                    providerName: 'google_analytics',
                    accountId: {
                        in: propertiesToRemove.map(p => p.accountId)
                    }
                }
            });

            logInfo('Removed obsolete properties', {
                userId: userId,
                removedCount: removedCount.count,
                removedProperties: propertiesToRemove.map(p => ({ id: p.accountId, name: p.propertyName }))
            });

            changes += removedCount.count;
        }

        // Add new properties
        for (const property of propertiesToAdd) {
            await prisma.userIntegration.create({
                data: {
                    userId: userId,
                    providerName: 'google_analytics',
                    accountId: property.id,
                    accountName: property.accountName,
                    propertyName: property.displayName,
                    encryptedAccessToken: existingIntegration.encryptedAccessToken,
                    encryptedRefreshToken: existingIntegration.encryptedRefreshToken,
                    tokenExpiresAt: existingIntegration.tokenExpiresAt,
                    scopes: existingIntegration.scopes || JSON.stringify(['https://www.googleapis.com/auth/analytics.readonly']),
                    isActive: false, // User needs to select which one to activate
                    lastFetchAt: new Date()
                }
            });

            changes++;
        }

        if (propertiesToAdd.length > 0) {
            logInfo('Added new properties', {
                userId: userId,
                addedCount: propertiesToAdd.length,
                addedProperties: propertiesToAdd.map(p => ({ id: p.id, name: p.displayName }))
            });
        }

        // Update existing properties (in case names or details changed)
        for (const property of propertiesToUpdate) {
            const existingProperty = existingProperties.find(p => p.accountId === property.id);

            if (existingProperty &&
                (existingProperty.propertyName !== property.displayName ||
                    existingProperty.accountName !== property.accountName)) {

                await prisma.userIntegration.update({
                    where: { id: existingProperty.id },
                    data: {
                        propertyName: property.displayName,
                        accountName: property.accountName,
                        lastFetchAt: new Date()
                    }
                });

                changes++;
            }
        }

        // Get final state
        const finalProperties = await prisma.userIntegration.findMany({
            where: {
                userId: userId,
                providerName: 'google_analytics'
            }
        });

        logInfo('Analytics properties sync completed', {
            userId: userId,
            totalProperties: finalProperties.length,
            changesCount: changes,
            finalProperties: finalProperties.map(p => ({
                id: p.accountId,
                name: p.propertyName,
                isActive: p.isActive
            }))
        });

        return {
            success: true,
            properties: finalProperties,
            changes: changes,
            added: propertiesToAdd.length,
            removed: propertiesToRemove.length
        };

    } catch (error) {
        logError('Error syncing Analytics properties', {
            userId: userId,
            error: error.message
        });

        throw error;
    }
}

/**
 * Legacy function - now just calls the new sync function
 * @deprecated Use syncAnalyticsProperties instead
 */
export async function discoverAndStoreAnalyticsProperties(userId, integration) {
    return await syncAnalyticsProperties(userId);
}

/**
 * Sync Search Console sites with current Google Search Console account
 */
export async function syncSearchConsoleSites(userId) {
    try {
        logInfo('Syncing Search Console sites with Google Search Console', {
            userId: userId
        });

        // Get current OAuth tokens from any existing Search Console integration
        const existingIntegration = await prisma.userIntegration.findFirst({
            where: {
                userId: userId,
                providerName: 'google_search_console'
            }
        });

        if (!existingIntegration) {
            logInfo('No existing Search Console integration found - user needs to connect first', { userId });
            return { success: false, error: 'No Search Console integration found - please connect first' };
        }

        // ✅ Use existing SearchConsoleService that handles OAuth properly
        const searchConsoleService = await createSearchConsoleService(existingIntegration);

        // Fetch current sites from Google Search Console
        const sites = await searchConsoleService.getSites();
        const verifiedSites = sites.filter(site => site.permissionLevel === 'siteFullUser' || site.permissionLevel === 'siteOwner');

        logInfo('Current sites from Google Search Console', {
            userId: userId,
            totalSites: sites.length,
            verifiedSites: verifiedSites.length,
            sites: verifiedSites.map(s => ({ url: s.siteUrl, permission: s.permissionLevel }))
        });

        // Get existing sites from database
        const existingSites = await prisma.userIntegration.findMany({
            where: {
                userId: userId,
                providerName: 'google_search_console'
            }
        });

        const existingSiteUrls = new Set(existingSites.map(s => s.accountId));
        const currentSiteUrls = new Set(verifiedSites.map(s => s.siteUrl));

        // Find sites to add/remove/update
        const sitesToAdd = verifiedSites.filter(s => !existingSiteUrls.has(s.siteUrl));
        const sitesToRemove = existingSites.filter(s => !currentSiteUrls.has(s.accountId));
        const sitesToUpdate = verifiedSites.filter(s => existingSiteUrls.has(s.siteUrl));

        let changes = 0;

        // Remove obsolete sites
        if (sitesToRemove.length > 0) {
            const removedCount = await prisma.userIntegration.deleteMany({
                where: {
                    userId: userId,
                    providerName: 'google_search_console',
                    accountId: {
                        in: sitesToRemove.map(s => s.accountId)
                    }
                }
            });

            logInfo('Removed obsolete Search Console sites', {
                userId: userId,
                removedCount: removedCount.count,
                removedSites: sitesToRemove.map(s => ({ url: s.accountId }))
            });

            changes += removedCount.count;
        }

        // Add new sites
        for (const site of sitesToAdd) {
            await prisma.userIntegration.create({
                data: {
                    userId: userId,
                    providerName: 'google_search_console',
                    accountId: site.siteUrl,
                    accountName: site.siteUrl,
                    propertyName: site.siteUrl,
                    encryptedAccessToken: existingIntegration.encryptedAccessToken,
                    encryptedRefreshToken: existingIntegration.encryptedRefreshToken,
                    tokenExpiresAt: existingIntegration.tokenExpiresAt,
                    scopes: existingIntegration.scopes,
                    isActive: false, // User needs to select which one to activate
                    lastFetchAt: new Date()
                }
            });

            changes++;
        }

        if (sitesToAdd.length > 0) {
            logInfo('Added new Search Console sites', {
                userId: userId,
                addedCount: sitesToAdd.length,
                addedSites: sitesToAdd.map(s => ({ url: s.siteUrl }))
            });
        }

        // Get final state
        const finalSites = await prisma.userIntegration.findMany({
            where: {
                userId: userId,
                providerName: 'google_search_console'
            }
        });

        logInfo('Search Console sites sync completed', {
            userId: userId,
            totalSites: finalSites.length,
            changesCount: changes,
            finalSites: finalSites.map(s => ({
                url: s.accountId,
                isActive: s.isActive
            }))
        });

        return {
            success: true,
            sites: finalSites,
            changes: changes,
            added: sitesToAdd.length,
            removed: sitesToRemove.length
        };

    } catch (error) {
        logError('Error syncing Search Console sites', {
            userId: userId,
            error: error.message
        });

        throw error;
    }
}

/**
 * Legacy function - now just calls the new sync function
 * @deprecated Use syncSearchConsoleSites instead
 */
export async function discoverAndStoreSearchConsoleSites(integration) {
    try {
        logInfo('Discovering Search Console sites', {
            integrationId: integration.id,
            userId: integration.userId
        });

        // ✅ CORRECT - Use existing SearchConsoleService that handles OAuth properly
        const searchConsoleService = await createSearchConsoleService(integration);

        // Use the service's getSites method
        const sites = await searchConsoleService.getSites();

        // Filter for verified sites only
        const verifiedSites = sites.filter(site => site.permissionLevel === 'siteFullUser' || site.permissionLevel === 'siteOwner');

        logInfo('Discovered Search Console sites', {
            integrationId: integration.id,
            totalSites: sites.length,
            verifiedSites: verifiedSites.length,
            sites: verifiedSites.map(s => ({ url: s.siteUrl, permission: s.permissionLevel }))
        });

        if (verifiedSites.length === 0) {
            // No verified sites found
            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: {
                    accountId: 'no_sites_found',
                    accountName: 'No Verified Sites Found',
                    propertyName: null,
                    lastError: 'No verified sites found in Search Console',
                    lastFetchAt: new Date()
                }
            });
            return { success: false, error: 'No verified sites found' };
        }

        if (verifiedSites.length === 1) {
            // Single site - auto-select it
            const site = verifiedSites[0];
            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: {
                    accountId: site.siteUrl,
                    accountName: site.siteUrl,
                    propertyName: site.siteUrl,
                    lastError: null,
                    lastFetchAt: new Date()
                }
            });

            logInfo('Auto-selected single Search Console site', {
                integrationId: integration.id,
                siteUrl: site.siteUrl
            });

            return { success: true, autoSelected: site };
        }

        // Multiple sites - set to pending selection
        await prisma.userIntegration.update({
            where: { id: integration.id },
            data: {
                accountId: 'pending_site_selection',
                accountName: `${verifiedSites.length} sites available`,
                propertyName: null,
                lastError: `Found ${verifiedSites.length} verified sites - user needs to select one`,
                lastFetchAt: new Date()
            }
        });

        logInfo('Multiple Search Console sites found - pending user selection', {
            integrationId: integration.id,
            sitesCount: verifiedSites.length
        });

        return { success: true, needsSelection: verifiedSites };

    } catch (error) {
        logError('Error discovering Search Console sites', {
            integrationId: integration.id,
            error: error.message
        });

        await prisma.userIntegration.update({
            where: { id: integration.id },
            data: {
                lastError: `Site discovery failed: ${error.message}`,
                lastFetchAt: new Date()
            }
        });

        throw error;
    }
}

/**
 * Update a selected Analytics property in the database
 */
export async function updateSelectedAnalyticsProperty(integrationId, propertyId, propertyName, accountName) {
    try {
        await prisma.userIntegration.update({
            where: { id: integrationId },
            data: {
                accountId: propertyId,
                accountName: accountName,
                propertyName: propertyName,
                lastError: null,
                lastFetchAt: new Date()
            }
        });

        logInfo('Updated selected Analytics property', {
            integrationId,
            propertyId,
            propertyName
        });

        return { success: true };
    } catch (error) {
        logError('Error updating selected Analytics property', {
            integrationId,
            propertyId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Update a selected Search Console site in the database
 */
export async function updateSelectedSearchConsoleSite(integrationId, siteUrl) {
    try {
        await prisma.userIntegration.update({
            where: { id: integrationId },
            data: {
                accountId: siteUrl,
                accountName: siteUrl,
                propertyName: siteUrl,
                lastError: null,
                lastFetchAt: new Date()
            }
        });

        logInfo('Updated selected Search Console site', {
            integrationId,
            siteUrl
        });

        return { success: true };
    } catch (error) {
        logError('Error updating selected Search Console site', {
            integrationId,
            siteUrl,
            error: error.message
        });
        throw error;
    }
}

/**
 * Sync Google Ads customers with current Google Ads account
 */
export async function syncGoogleAdsCustomers(userId) {
    try {
        logInfo('Syncing Google Ads customers with Google Ads account', {
            userId: userId
        });

        // Get current OAuth tokens from any existing Google Ads integration
        const existingIntegration = await prisma.userIntegration.findFirst({
            where: {
                userId: userId,
                providerName: 'google_ads'
            }
        });

        if (!existingIntegration) {
            logInfo('No existing Google Ads integration found - user needs to connect first', { userId });
            return { success: false, error: 'No Google Ads integration found - please connect first' };
        }

        // ✅ Use existing GoogleAdsService that handles OAuth properly
        const googleAdsService = await createGoogleAdsService(existingIntegration);

        // Fetch current customers from Google Ads
        const customersResult = await googleAdsService.getAccessibleCustomers();

        if (!customersResult || customersResult.length === 0) {
            logInfo('No customers found in Google Ads account', { userId });
            return { success: true, customers: [], changes: 0, added: 0, removed: 0 };
        }

        const currentCustomers = customersResult.map(customer => ({
            id: customer.id,
            resourceName: customer.resourceName,
            descriptiveName: customer.descriptiveName || `Account ${customer.id}`
        }));

        logInfo('Current customers from Google Ads', {
            userId: userId,
            customersCount: currentCustomers.length,
            customers: currentCustomers.map(c => ({ id: c.id, name: c.descriptiveName }))
        });

        // Get existing customers from database
        const existingCustomers = await prisma.userIntegration.findMany({
            where: {
                userId: userId,
                providerName: 'google_ads'
            }
        });

        const existingCustomerIds = new Set(existingCustomers.map(c => c.accountId));
        const currentCustomerIds = new Set(currentCustomers.map(c => c.id));

        // Find customers to add (exist in Google Ads but not in DB)
        const customersToAdd = currentCustomers.filter(c => !existingCustomerIds.has(c.id));

        // Find customers to remove (exist in DB but not in Google Ads)
        const customersToRemove = existingCustomers.filter(c => !currentCustomerIds.has(c.accountId));

        // Find customers to update (exist in both but may have changed details)
        const customersToUpdate = currentCustomers.filter(c => existingCustomerIds.has(c.id));

        let changes = 0;

        // Remove obsolete customers
        if (customersToRemove.length > 0) {
            const removedCount = await prisma.userIntegration.deleteMany({
                where: {
                    userId: userId,
                    providerName: 'google_ads',
                    accountId: {
                        in: customersToRemove.map(c => c.accountId)
                    }
                }
            });

            logInfo('Removed obsolete customers', {
                userId: userId,
                removedCount: removedCount.count,
                removedCustomers: customersToRemove.map(c => ({ id: c.accountId, name: c.propertyName }))
            });

            changes += removedCount.count;
        }

        // Add new customers
        for (const customer of customersToAdd) {
            await prisma.userIntegration.create({
                data: {
                    userId: userId,
                    providerName: 'google_ads',
                    accountId: customer.id,
                    accountName: customer.descriptiveName,
                    propertyName: customer.descriptiveName,
                    encryptedAccessToken: existingIntegration.encryptedAccessToken,
                    encryptedRefreshToken: existingIntegration.encryptedRefreshToken,
                    tokenExpiresAt: existingIntegration.tokenExpiresAt,
                    scopes: existingIntegration.scopes || JSON.stringify(['https://www.googleapis.com/auth/adwords']),
                    isActive: false, // User needs to select which one to activate
                    lastFetchAt: new Date()
                }
            });

            changes++;
        }

        if (customersToAdd.length > 0) {
            logInfo('Added new customers', {
                userId: userId,
                addedCount: customersToAdd.length,
                addedCustomers: customersToAdd.map(c => ({ id: c.id, name: c.descriptiveName }))
            });
        }

        // Update existing customers (in case names changed)
        for (const customer of customersToUpdate) {
            const existingCustomer = existingCustomers.find(c => c.accountId === customer.id);

            if (existingCustomer &&
                (existingCustomer.propertyName !== customer.descriptiveName ||
                    existingCustomer.accountName !== customer.descriptiveName)) {

                await prisma.userIntegration.update({
                    where: { id: existingCustomer.id },
                    data: {
                        propertyName: customer.descriptiveName,
                        accountName: customer.descriptiveName,
                        lastFetchAt: new Date()
                    }
                });

                changes++;
            }
        }

        // Get final state
        const finalCustomers = await prisma.userIntegration.findMany({
            where: {
                userId: userId,
                providerName: 'google_ads'
            }
        });

        logInfo('Google Ads customers sync completed', {
            userId: userId,
            totalCustomers: finalCustomers.length,
            changesCount: changes,
            finalCustomers: finalCustomers.map(c => ({
                id: c.accountId,
                name: c.propertyName,
                isActive: c.isActive
            }))
        });

        return {
            success: true,
            customers: finalCustomers,
            changes: changes,
            added: customersToAdd.length,
            removed: customersToRemove.length
        };

    } catch (error) {
        logError('Error syncing Google Ads customers', {
            userId: userId,
            error: error.message
        });

        throw error;
    }
} 