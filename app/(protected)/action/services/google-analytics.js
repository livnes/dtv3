// Google Analytics Service - moved from action folder to services
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export class GoogleAnalyticsService {
    constructor(credentials) {
        this.credentials = credentials;
        this.analytics = google.analyticsdata({
            version: 'v1beta',
            auth: this.credentials
        });
    }

    async getTrafficQualityData(propertyId, dateRange = '30days', comparison = null) {
        try {
            // Build date range
            const endDate = new Date();
            let startDate;

            switch (dateRange) {
                case '7days':
                    startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30days':
                    startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '90days':
                    startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            // Format property ID correctly
            const formattedPropertyId = propertyId.startsWith('properties/')
                ? propertyId
                : `properties/${propertyId}`;

            console.log(`🔍 Fetching Analytics data for property: ${formattedPropertyId}`);
            console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

            // Build the request
            const request = {
                property: formattedPropertyId,
                dateRanges: [{
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                }],
                dimensions: [
                    { name: 'sessionDefaultChannelGrouping' },  // Traffic source grouping
                    { name: 'sessionSourceMedium' }  // Detailed source/medium
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'bounceRate' },
                    { name: 'averageSessionDuration' },
                    { name: 'screenPageViewsPerSession' },
                    { name: 'conversions' }  // If goals are set up
                ],
                orderBys: [{
                    metric: { metricName: 'sessions' },
                    desc: true
                }],
                limit: 10
            };

            // Make the API call
            const response = await this.analytics.properties.runReport({
                property: formattedPropertyId,
                requestBody: request
            });

            console.log("✅ Analytics API call successful");

            // Process the response
            const trafficSources = [];

            if (response.data.rows) {
                for (const row of response.data.rows) {
                    // Extract dimension values
                    const channelGroup = row.dimensionValues[0].value;
                    const sourceMedium = row.dimensionValues[1].value;

                    // Extract metric values
                    const sessions = parseInt(row.metricValues[0].value);
                    const users = parseInt(row.metricValues[1].value);
                    const bounceRate = parseFloat(row.metricValues[2].value) * 100; // Convert to percentage
                    const avgDuration = parseFloat(row.metricValues[3].value); // In seconds
                    const pagesPerSession = parseFloat(row.metricValues[4].value);
                    const conversions = row.metricValues[5] ? parseInt(row.metricValues[5].value) : 0;

                    // Format session duration as MM:SS
                    const durationMinutes = Math.floor(avgDuration / 60);
                    const durationSeconds = Math.floor(avgDuration % 60);
                    const durationFormatted = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;

                    // Calculate quality score
                    const qualityScore = this.calculateQualityScore(
                        avgDuration, bounceRate, pagesPerSession, conversions, sessions
                    );

                    trafficSources.push({
                        source: channelGroup,
                        sourceMedium: sourceMedium,
                        sessions,
                        users,
                        avgSessionDuration: durationFormatted,
                        avgSessionDurationSeconds: avgDuration,
                        bounceRate: Math.round(bounceRate * 10) / 10,
                        pagesPerSession: Math.round(pagesPerSession * 10) / 10,
                        conversions,
                        qualityScore
                    });
                }
            }

            // Sort by quality score
            trafficSources.sort((a, b) => b.qualityScore - a.qualityScore);

            return {
                success: true,
                trafficSources,
                dateRange: {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                },
                totalSessions: trafficSources.reduce((sum, source) => sum + source.sessions, 0)
            };

        } catch (error) {
            console.error(`❌ Error fetching Analytics data: ${error}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    calculateQualityScore(avgDuration, bounceRate, pagesPerSession, conversions, sessions) {
        // Normalize session duration (max 600 seconds = 10 minutes)
        const durationScore = Math.min(avgDuration / 600, 1) * 100;

        // Bounce rate score (inverse - lower bounce rate = higher score)
        const bounceScore = Math.max(0, 100 - bounceRate);

        // Pages per session score (max 10 pages)
        const pagesScore = Math.min(pagesPerSession / 10, 1) * 100;

        // Conversion rate score
        const conversionRate = sessions > 0 ? (conversions / sessions * 100) : 0;
        const conversionScore = Math.min(conversionRate * 10, 100); // 10% conversion = 100 score

        // Weighted average
        const qualityScore = (
            durationScore * 0.3 +
            bounceScore * 0.3 +
            pagesScore * 0.2 +
            conversionScore * 0.2
        );

        return Math.round(qualityScore);
    }

    generateInsights(trafficSources, totalSessions) {
        if (!trafficSources || trafficSources.length === 0) {
            return "לא נמצאו נתונים לניתוח";
        }

        const bestSource = trafficSources[0];
        const worstSource = trafficSources[trafficSources.length - 1];
        const insights = [];

        // Best performer insight
        insights.push(`<strong>${bestSource.source}</strong> הוא מקור התנועה הכי איכותי שלך ` +
            `(ציון ${bestSource.qualityScore}) עם ${bestSource.sessions.toLocaleString()} ביקורים`);

        // Session duration insights
        if (bestSource.avgSessionDurationSeconds > 180) { // 3 minutes
            insights.push(`זמן השהייה הממוצע מ-${bestSource.source} מצוין ` +
                `(${bestSource.avgSessionDuration})`);
        }

        // Bounce rate insights
        if (bestSource.bounceRate < 30) {
            insights.push(`שיעור הנטישה מ-${bestSource.source} נמוך מאוד ` +
                `(${bestSource.bounceRate}%) - זה מעולה!`);
        }

        // Volume vs Quality insight
        const highestVolume = trafficSources.reduce((prev, current) =>
            (prev.sessions > current.sessions) ? prev : current
        );

        if (highestVolume !== bestSource) {
            insights.push(`<strong>${highestVolume.source}</strong> מביא הכי הרבה תנועה ` +
                `(${highestVolume.sessions.toLocaleString()} ביקורים) אבל לא בהכרח הכי איכותית`);
        }

        // Improvement opportunity
        if (trafficSources.length > 1 && worstSource.sessions > totalSessions * 0.1) {
            insights.push(`יש הזדמנות לשיפור ב-<strong>${worstSource.source}</strong> - ` +
                `מביא הרבה תנועה (${worstSource.sessions.toLocaleString()}) אבל עם איכות נמוכה יותר`);
        }

        return "<ul class='mb-0 mt-2'>" + insights.map(insight => `<li>${insight}</li>`).join('') + "</ul>";
    }

    generateRecommendations(trafficSources) {
        if (!trafficSources || trafficSources.length === 0) {
            return "אין מספיק נתונים להמלצות";
        }

        const recommendations = [];
        const bestSource = trafficSources[0];

        // Investment recommendation
        recommendations.push(`<strong>הגדל השקעה ב-${bestSource.source}</strong> - ` +
            `זה המקור הכי איכותי שלך`);

        // Find sources with high bounce rate
        const highBounceSources = trafficSources.filter(s => s.bounceRate > 60);
        if (highBounceSources.length > 0) {
            const sourceName = highBounceSources[0].source;
            recommendations.push(`<strong>שפר את חוויית המשתמש מ-${sourceName}</strong> - ` +
                `שיעור נטישה גבוה (${highBounceSources[0].bounceRate}%)`);
        }

        // Find sources with low pages per session
        const lowEngagement = trafficSources.filter(s => s.pagesPerSession < 2);
        if (lowEngagement.length > 0) {
            const sourceName = lowEngagement[0].source;
            recommendations.push(`<strong>שפר את התוכן עבור ${sourceName}</strong> - ` +
                `מבקרים רואים מעט דפים (${lowEngagement[0].pagesPerSession})`);
        }

        // Conversion opportunity
        const highTrafficLowConversion = trafficSources.filter(s => s.sessions > 100 && s.conversions === 0);
        if (highTrafficLowConversion.length > 0) {
            const sourceName = highTrafficLowConversion[0].source;
            recommendations.push(`<strong>הוסף מטרות המרה עבור ${sourceName}</strong> - ` +
                `תנועה גבוהה ללא מעקב המרות`);
        }

        return "<ul class='mb-0 mt-2'>" + recommendations.map(rec => `<li>${rec}</li>`).join('') + "</ul>";
    }

    // Get available Analytics properties for the user
    async getAnalyticsProperties() {
        try {
            const analytics = google.analyticsadmin('v1alpha');

            // List all Analytics accounts
            const accountsResponse = await analytics.accounts.list({
                auth: this.credentials
            });

            if (!accountsResponse.data.accounts) {
                return {
                    success: false,
                    error: 'No Analytics accounts found'
                };
            }

            const properties = [];

            // Get properties for each account
            for (const account of accountsResponse.data.accounts) {
                try {
                    const propertiesResponse = await analytics.properties.list({
                        filter: `parent:${account.name}`,
                        auth: this.credentials
                    });

                    if (propertiesResponse.data.properties) {
                        for (const property of propertiesResponse.data.properties) {
                            properties.push({
                                name: property.name,
                                displayName: property.displayName,
                                createTime: property.createTime,
                                updateTime: property.updateTime,
                                parent: account.name,
                                parentDisplayName: account.displayName,
                                currencyCode: property.currencyCode,
                                timeZone: property.timeZone,
                                websiteUrl: property.websiteUrl,
                                industryCategory: property.industryCategory
                            });
                        }
                    }
                } catch (propError) {
                    console.error(`Error fetching properties for account ${account.displayName}:`, propError);
                    // Continue with other accounts
                }
            }

            return {
                success: true,
                properties: properties.sort((a, b) => a.displayName.localeCompare(b.displayName))
            };

        } catch (error) {
            console.error('Error fetching Analytics properties:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch Analytics properties'
            };
        }
    }
}

// Helper function to create authenticated service
export async function createGoogleAnalyticsService(userId) {
    try {
        // Get user's Google integration
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId,
                providerName: 'google_analytics',
                isActive: true
            }
        });

        if (!integration) {
            throw new Error('No active Google Analytics integration found');
        }

        // Check if token needs refresh
        const now = new Date();
        if (integration.tokenExpiresAt && integration.tokenExpiresAt <= now) {
            await refreshGoogleToken(integration);
            // Fetch updated integration
            const updatedIntegration = await prisma.userIntegration.findUnique({
                where: { id: integration.id }
            });
            if (updatedIntegration) {
                integration.encryptedAccessToken = updatedIntegration.encryptedAccessToken;
                integration.tokenExpiresAt = updatedIntegration.tokenExpiresAt;
            }
        }

        // Decrypt tokens (you'll need to implement decryption)
        const accessToken = decryptToken(integration.encryptedAccessToken);
        const refreshToken = integration.encryptedRefreshToken ?
            decryptToken(integration.encryptedRefreshToken) : null;

        // Create OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
            expiry_date: integration.tokenExpiresAt?.getTime()
        });

        return new GoogleAnalyticsService(oauth2Client);

    } catch (error) {
        console.error('Error creating Google Analytics service:', error);
        throw error;
    }
}

// Token refresh functionality
async function refreshGoogleToken(integration) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const refreshToken = decryptToken(integration.encryptedRefreshToken);
        oauth2Client.setCredentials({
            refresh_token: refreshToken
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update database with new tokens
        await prisma.userIntegration.update({
            where: { id: integration.id },
            data: {
                encryptedAccessToken: encryptToken(credentials.access_token),
                tokenExpiresAt: new Date(credentials.expiry_date),
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

// Token encryption/decryption functions
function encryptToken(token) {
    if (!token) return null;
    try {
        return encrypt(token);
    } catch (error) {
        console.error('Token encryption error:', error);
        throw new Error('Failed to encrypt token');
    }
}

function decryptToken(encryptedToken) {
    if (!encryptedToken) return null;
    try {
        return decrypt(encryptedToken);
    } catch (error) {
        console.error('Token decryption error:', error);
        throw new Error('Failed to decrypt token');
    }
} 