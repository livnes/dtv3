// Google OAuth Service - moved to services folder
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/encryption';

export class GoogleOAuthService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Scopes needed for Analytics and Search Console
        this.scopes = [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/webmasters.readonly',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ];
    }

    /**
     * Generate authorization URL for Google OAuth
     */
    getAuthUrl(state = null) {
        try {
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline', // Required for refresh token
                scope: this.scopes,
                include_granted_scopes: true,
                prompt: 'consent', // Force consent screen to get refresh token
                state: state || 'google_auth'
            });

            return {
                success: true,
                authUrl
            };

        } catch (error) {
            console.error('Error generating auth URL:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle OAuth callback and exchange code for tokens
     */
    async handleCallback(code, userId) {
        try {
            // Exchange authorization code for tokens
            const { tokens } = await this.oauth2Client.getToken(code);

            // Set credentials to get user info
            this.oauth2Client.setCredentials(tokens);

            // Get user info from Google
            const userInfo = await this.getUserInfo();
            if (!userInfo.success) {
                throw new Error('Failed to get user info from Google');
            }

            // Save tokens to database
            await this.saveTokens(userId, tokens);

            // Fetch user's Google accounts (Analytics properties and Search Console sites)
            await this.fetchGoogleAccounts(userId);

            return {
                success: true,
                userInfo: userInfo.data,
                message: 'Google account connected successfully'
            };

        } catch (error) {
            console.error('Error in OAuth callback:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user information from Google
     */
    async getUserInfo() {
        try {
            const oauth2 = google.oauth2({
                version: 'v2',
                auth: this.oauth2Client
            });

            const response = await oauth2.userinfo.get();

            return {
                success: true,
                data: {
                    googleId: response.data.id,
                    email: response.data.email,
                    name: response.data.name,
                    picture: response.data.picture
                }
            };

        } catch (error) {
            console.error('Error getting user info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save Google tokens to database
     */
    async saveTokens(userId, tokens) {
        try {
            // Delete existing Google integrations
            await prisma.userIntegration.deleteMany({
                where: {
                    userId,
                    providerName: {
                        in: ['google_analytics', 'google_search_console']
                    }
                }
            });

            const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

            // Create Google Analytics integration
            await prisma.userIntegration.create({
                data: {
                    userId,
                    providerName: 'google_analytics',
                    accountId: 'pending', // Will be updated when user selects properties
                    accountName: 'Google Analytics',
                    encryptedAccessToken: await encryptToken(tokens.access_token),
                    encryptedRefreshToken: tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null,
                    tokenExpiresAt: expiresAt,
                    scopes: JSON.stringify(this.scopes),
                    isActive: false // User needs to select properties first
                }
            });

            // Create Google Search Console integration
            await prisma.userIntegration.create({
                data: {
                    userId,
                    providerName: 'google_search_console',
                    accountId: 'pending', // Will be updated when user selects sites
                    accountName: 'Google Search Console',
                    encryptedAccessToken: await encryptToken(tokens.access_token),
                    encryptedRefreshToken: tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null,
                    tokenExpiresAt: expiresAt,
                    scopes: JSON.stringify(this.scopes),
                    isActive: false // User needs to select sites first
                }
            });

            console.log('✅ Google tokens saved successfully');

        } catch (error) {
            console.error('Error saving tokens:', error);
            throw error;
        }
    }

    /**
     * Fetch available Google Analytics properties and Search Console sites
     */
    async fetchGoogleAccounts(userId) {
        try {
            // Get Analytics properties
            await this.fetchAnalyticsProperties(userId);

            // Get Search Console sites
            await this.fetchSearchConsoleSites(userId);

        } catch (error) {
            console.error('Error fetching Google accounts:', error);
            // Don't throw - this is not critical for the auth flow
        }
    }

    /**
     * Fetch Google Analytics properties
     */
    async fetchAnalyticsProperties(userId) {
        try {
            const analyticsAdmin = google.analyticsadmin({
                version: 'v1beta',
                auth: this.oauth2Client
            });

            // Get accounts
            const accountsResponse = await analyticsAdmin.accounts.list();

            const properties = [];

            if (accountsResponse.data.accounts) {
                for (const account of accountsResponse.data.accounts) {
                    try {
                        // Get properties for this account
                        const propertiesResponse = await analyticsAdmin.properties.list({
                            filter: `parent:${account.name}`
                        });

                        if (propertiesResponse.data.properties) {
                            for (const property of propertiesResponse.data.properties) {
                                const propertyId = property.name.split('/').pop();
                                properties.push({
                                    accountId: propertyId,
                                    accountName: `${property.displayName} (${account.displayName})`,
                                    websiteUrl: property.websiteUrl || '',
                                    propertyName: property.displayName
                                });
                            }
                        }
                    } catch (propError) {
                        console.error(`Error fetching properties for account ${account.name}:`, propError);
                    }
                }
            }

            // Store discovered properties (optional - for UI selection)
            // You might want to create a separate table for this
            console.log(`📊 Found ${properties.length} Analytics properties`);

        } catch (error) {
            console.error('Analytics Admin API error:', error);
        }
    }

    /**
     * Fetch Google Search Console sites
     */
    async fetchSearchConsoleSites(userId) {
        try {
            const searchConsole = google.searchconsole({
                version: 'v1',
                auth: this.oauth2Client
            });

            const sitesResponse = await searchConsole.sites.list();

            const sites = [];

            if (sitesResponse.data.siteEntry) {
                for (const site of sitesResponse.data.siteEntry) {
                    sites.push({
                        siteUrl: site.siteUrl,
                        permissionLevel: site.permissionLevel
                    });
                }
            }

            console.log(`📈 Found ${sites.length} Search Console sites`);

        } catch (error) {
            console.error('Search Console API error:', error);
        }
    }

    /**
     * Refresh tokens for all Google integrations for a user
     */
    async refreshUserTokens(userId) {
        try {
            const integrations = await prisma.userIntegration.findMany({
                where: {
                    userId,
                    providerName: {
                        in: ['google_analytics', 'google_search_console']
                    },
                    isActive: true
                }
            });

            if (integrations.length === 0) {
                return {
                    success: false,
                    error: 'No active Google integrations found'
                };
            }

            // Try to refresh tokens for each integration
            const results = [];
            for (const integration of integrations) {
                try {
                    await GoogleOAuthService.refreshToken(integration);
                    results.push({ integration: integration.providerName, success: true });
                } catch (error) {
                    results.push({
                        integration: integration.providerName,
                        success: false,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;

            return {
                success: successCount > 0,
                results,
                message: `Refreshed ${successCount}/${results.length} integrations`
            };

        } catch (error) {
            console.error('Error refreshing user tokens:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Refresh expired tokens
     */
    static async refreshToken(integration) {
        try {
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_REDIRECT_URI
            );

            const refreshToken = await decryptToken(integration.encryptedRefreshToken);
            oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            const { credentials } = await oauth2Client.refreshAccessToken();

            // Update database with new tokens
            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: {
                    encryptedAccessToken: await encryptToken(credentials.access_token),
                    tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
                    lastFetchAt: new Date(),
                    lastError: null
                }
            });

            console.log('✅ Google token refreshed successfully');

        } catch (error) {
            console.error('❌ Error refreshing Google token:', error);

            // Update error in database
            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: {
                    lastError: error.message,
                    isActive: false // Deactivate if refresh fails
                }
            });

            throw error;
        }
    }

    /**
     * Check if integration exists and is valid
     */
    static async getValidIntegration(userId, providerName) {
        try {
            const integration = await prisma.userIntegration.findFirst({
                where: {
                    userId,
                    providerName,
                    isActive: true
                }
            });

            if (!integration) {
                return null;
            }

            // Check if token needs refresh
            const now = new Date();
            if (integration.tokenExpiresAt && integration.tokenExpiresAt <= now) {
                await GoogleOAuthService.refreshToken(integration);

                // Fetch updated integration
                return await prisma.userIntegration.findUnique({
                    where: { id: integration.id }
                });
            }

            return integration;

        } catch (error) {
            console.error('Error checking integration validity:', error);
            return null;
        }
    }
}

// Helper functions for encryption/decryption using proper crypto
async function encryptToken(token) {
    if (!token) return null;
    try {
        return encrypt(token);
    } catch (error) {
        console.error('Token encryption error:', error);
        throw new Error('Failed to encrypt token');
    }
}

async function decryptToken(encryptedToken) {
    if (!encryptedToken) return null;
    try {
        return decrypt(encryptedToken);
    } catch (error) {
        console.error('Token decryption error:', error);
        throw new Error('Failed to decrypt token');
    }
}

export { encryptToken, decryptToken }; 