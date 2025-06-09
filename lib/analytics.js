import { google } from 'googleapis';
import { decrypt } from './encryption.js';
import prisma from './prisma.js';

export class AnalyticsService {
    constructor(credentials) {
        this.credentials = credentials;
        // Google Analytics Data API v1 (GA4)
        this.analytics = google.analyticsdata({ version: 'v1beta', auth: credentials });
        // Google Analytics Admin API for property listing
        this.analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: credentials });
    }

    static async fromUser(userId) {
        // Get user's Google Analytics integration
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: userId,
                providerName: 'google_analytics'
            }
        });

        if (!integration) {
            throw new Error('No Google Analytics integration found');
        }

        // Activate the integration if it's not already active
        if (!integration.isActive) {
            await prisma.userIntegration.update({
                where: { id: integration.id },
                data: { isActive: true }
            });
        }

        // Decrypt the tokens
        const accessToken = decrypt(integration.encryptedAccessToken);
        const refreshToken = integration.encryptedRefreshToken ? decrypt(integration.encryptedRefreshToken) : null;

        // Create OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
            expiry_date: integration.tokenExpiresAt?.getTime()
        });

        return new AnalyticsService(oauth2Client);
    }

    async getProperties() {
        try {
            const response = await this.analyticsAdmin.accounts.list();
            const accounts = response.data.accounts || [];

            const properties = [];

            for (const account of accounts) {
                try {
                    const propertiesResponse = await this.analyticsAdmin.properties.list({
                        filter: `parent:${account.name}`
                    });

                    const accountProperties = propertiesResponse.data.properties || [];
                    properties.push(...accountProperties.map(prop => ({
                        ...prop,
                        accountName: account.displayName
                    })));
                } catch (error) {
                    console.warn(`Failed to fetch properties for account ${account.name}:`, error.message);
                }
            }

            return {
                success: true,
                properties: properties
            };
        } catch (error) {
            console.error('Error fetching Analytics properties:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getTrafficQualityData(propertyId, dateRange = '30days', comparison = null) {
        try {
            // Build date range
            const endDate = new Date();
            let startDate = new Date();

            switch (dateRange) {
                case '7days':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '30days':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case '90days':
                    startDate.setDate(endDate.getDate() - 90);
                    break;
                default:
                    startDate.setDate(endDate.getDate() - 30);
            }

            // Format property ID correctly
            if (!propertyId.startsWith('properties/')) {
                propertyId = `properties/${propertyId}`;
            }

            // Build the request
            const request = {
                property: propertyId,
                dateRanges: [{
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                }],
                dimensions: [
                    { name: 'sessionDefaultChannelGrouping' },
                    { name: 'sessionSourceMedium' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'bounceRate' },
                    { name: 'averageSessionDuration' },
                    { name: 'screenPageViewsPerSession' },
                    { name: 'conversions' }
                ],
                orderBys: [{
                    metric: { metricName: 'sessions' },
                    desc: true
                }],
                limit: 10
            };

            console.log(`🔍 Fetching Analytics data for property: ${propertyId}`);
            console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

            // Make the API call
            const response = await this.analytics.properties.runReport({
                property: propertyId,
                requestBody: request
            });

            console.log('✅ Analytics API call successful');

            // Process the response
            const trafficSources = [];

            if (response.data.rows) {
                for (const row of response.data.rows) {
                    // Extract dimension values
                    const channelGroup = row.dimensionValues[0].value;
                    const sourceMedium = row.dimensionValues[1].value;

                    // Extract metric values
                    const metrics = row.metricValues;
                    const sessions = parseInt(metrics[0].value);
                    const users = parseInt(metrics[1].value);
                    const bounceRate = parseFloat(metrics[2].value) * 100; // Convert to percentage
                    const avgDuration = parseFloat(metrics[3].value); // In seconds
                    const pagesPerSession = parseFloat(metrics[4].value);
                    const conversions = metrics[5] ? parseInt(metrics[5].value) : 0;

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
                        source_medium: sourceMedium,
                        sessions: sessions,
                        users: users,
                        avg_session_duration: durationFormatted,
                        avg_session_duration_seconds: avgDuration,
                        bounce_rate: Math.round(bounceRate * 10) / 10,
                        pages_per_session: Math.round(pagesPerSession * 10) / 10,
                        conversions: conversions,
                        quality_score: qualityScore
                    });
                }
            }

            // Sort by quality score
            trafficSources.sort((a, b) => b.quality_score - a.quality_score);

            return {
                success: true,
                traffic_sources: trafficSources,
                date_range: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                },
                total_sessions: trafficSources.reduce((sum, source) => sum + source.sessions, 0)
            };

        } catch (error) {
            console.error('❌ Error fetching Analytics data:', error);
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
            `(ציון ${bestSource.quality_score}) עם ${bestSource.sessions.toLocaleString()} ביקורים`);

        // Session duration insights
        if (bestSource.avg_session_duration_seconds > 180) { // 3 minutes
            insights.push(`זמן השהייה הממוצע מ-${bestSource.source} מצוין ` +
                `(${bestSource.avg_session_duration})`);
        }

        // Bounce rate insights
        if (bestSource.bounce_rate < 30) {
            insights.push(`שיעור הנטישה מ-${bestSource.source} נמוך מאוד ` +
                `(${bestSource.bounce_rate}%) - זה מעולה!`);
        }

        // Volume vs Quality insight
        const highestVolume = trafficSources.reduce((max, source) =>
            source.sessions > max.sessions ? source : max
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

        return "<ul class='mb-0 mt-2'>" + insights.map(insight => `<li>${insight}</li>`).join("") + "</ul>";
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
        const highBounceSources = trafficSources.filter(s => s.bounce_rate > 60);
        if (highBounceSources.length > 0) {
            const sourceName = highBounceSources[0].source;
            recommendations.push(`<strong>שפר את חוויית המשתמש מ-${sourceName}</strong> - ` +
                `שיעור נטישה גבוה (${highBounceSources[0].bounce_rate}%)`);
        }

        // Find sources with low pages per session
        const lowEngagement = trafficSources.filter(s => s.pages_per_session < 2);
        if (lowEngagement.length > 0) {
            const sourceName = lowEngagement[0].source;
            recommendations.push(`<strong>שפר את התוכן עבור ${sourceName}</strong> - ` +
                `מבקרים רואים מעט דפים (${lowEngagement[0].pages_per_session})`);
        }

        // Conversion opportunity
        const highTrafficLowConversion = trafficSources.filter(s =>
            s.sessions > 100 && s.conversions === 0
        );
        if (highTrafficLowConversion.length > 0) {
            const sourceName = highTrafficLowConversion[0].source;
            recommendations.push(`<strong>הוסף מטרות המרה עבור ${sourceName}</strong> - ` +
                `תנועה גבוהה ללא מעקב המרות`);
        }

        return "<ul class='mb-0 mt-2'>" + recommendations.map(rec => `<li>${rec}</li>`).join("") + "</ul>";
    }
} 