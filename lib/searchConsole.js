import { google } from 'googleapis';
import { decrypt } from './encryption';
import { logInfo, logError } from './logger';

class SearchConsoleService {
    constructor(integration) {
        this.integration = integration;

        // Decrypt the stored tokens
        this.accessToken = decrypt(integration.encryptedAccessToken);
        this.refreshToken = integration.encryptedRefreshToken ? decrypt(integration.encryptedRefreshToken) : null;

        // Initialize OAuth2 client
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
        );

        this.oauth2Client.setCredentials({
            access_token: this.accessToken,
            refresh_token: this.refreshToken
        });

        // Initialize Search Console API
        this.searchConsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Get list of verified sites/properties
     */
    async getSites() {
        try {
            const response = await this.searchConsole.sites.list();

            logInfo('Retrieved Search Console sites', {
                sitesCount: response.data.siteEntry?.length || 0
            });

            return response.data.siteEntry || [];
        } catch (error) {
            logError('Error fetching Search Console sites', error);
            throw new Error(`Failed to fetch sites: ${error.message}`);
        }
    }

    /**
     * Get search analytics data for a site
     */
    async getSearchAnalytics(siteUrl, startDate, endDate, options = {}) {
        try {
            const {
                dimensions = ['query', 'page'],
                dimensionFilterGroups = [],
                rowLimit = 1000,
                startRow = 0
            } = options;

            const request = {
                siteUrl: siteUrl,
                requestBody: {
                    startDate: startDate,
                    endDate: endDate,
                    dimensions: dimensions,
                    dimensionFilterGroups: dimensionFilterGroups,
                    rowLimit: rowLimit,
                    startRow: startRow
                }
            };

            const response = await this.searchConsole.searchanalytics.query(request);

            logInfo('Retrieved Search Console analytics', {
                siteUrl,
                rowsCount: response.data.rows?.length || 0,
                dateRange: `${startDate} to ${endDate}`
            });

            return response.data.rows || [];
        } catch (error) {
            logError('Error fetching Search Console analytics', { siteUrl, error: error.message });
            throw error;
        }
    }

    /**
     * Get top performing keywords
     */
    async getTopKeywords(siteUrl, startDate, endDate, limit = 100) {
        try {
            const keywords = await this.getSearchAnalytics(siteUrl, startDate, endDate, {
                dimensions: ['query'],
                rowLimit: limit
            });

            return keywords.map(row => ({
                keyword: row.keys[0],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0
            })).sort((a, b) => b.clicks - a.clicks);

        } catch (error) {
            logError('Error fetching top keywords', { siteUrl, error: error.message });
            throw error;
        }
    }

    /**
     * Get top performing pages
     */
    async getTopPages(siteUrl, startDate, endDate, limit = 100) {
        try {
            const pages = await this.getSearchAnalytics(siteUrl, startDate, endDate, {
                dimensions: ['page'],
                rowLimit: limit
            });

            return pages.map(row => ({
                page: row.keys[0],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0
            })).sort((a, b) => b.clicks - a.clicks);

        } catch (error) {
            logError('Error fetching top pages', { siteUrl, error: error.message });
            throw error;
        }
    }

    /**
     * Get search performance by device type
     */
    async getDevicePerformance(siteUrl, startDate, endDate) {
        try {
            const devices = await this.getSearchAnalytics(siteUrl, startDate, endDate, {
                dimensions: ['device']
            });

            return devices.map(row => ({
                device: row.keys[0],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0
            }));

        } catch (error) {
            logError('Error fetching device performance', { siteUrl, error: error.message });
            throw error;
        }
    }

    /**
     * Get search performance by country
     */
    async getCountryPerformance(siteUrl, startDate, endDate) {
        try {
            const countries = await this.getSearchAnalytics(siteUrl, startDate, endDate, {
                dimensions: ['country'],
                rowLimit: 50
            });

            return countries.map(row => ({
                country: row.keys[0],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0
            })).sort((a, b) => b.clicks - a.clicks);

        } catch (error) {
            logError('Error fetching country performance', { siteUrl, error: error.message });
            throw error;
        }
    }

    /**
     * Get keyword details with page performance
     */
    async getKeywordDetails(siteUrl, keyword, startDate, endDate) {
        try {
            const dimensionFilterGroups = [{
                filters: [{
                    dimension: 'query',
                    operator: 'equals',
                    expression: keyword
                }]
            }];

            const keywordData = await this.getSearchAnalytics(siteUrl, startDate, endDate, {
                dimensions: ['query', 'page'],
                dimensionFilterGroups: dimensionFilterGroups,
                rowLimit: 100
            });

            return keywordData.map(row => ({
                keyword: row.keys[0],
                page: row.keys[1],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0
            }));

        } catch (error) {
            logError('Error fetching keyword details', { siteUrl, keyword, error: error.message });
            throw error;
        }
    }

    /**
     * Generate SEO insights and recommendations
     */
    generateInsights(keywords, pages, summary) {
        const insights = [];
        const recommendations = [];

        if (!keywords || keywords.length === 0) {
            return { insights: [], recommendations: [] };
        }

        // High performing keywords
        const topKeywords = keywords.slice(0, 5);
        if (topKeywords.length > 0) {
            insights.push(`מילות המפתח המובילות: ${topKeywords.map(k => k.keyword).join(', ')}`);
        }

        // Low CTR keywords with high impressions
        const lowCtrKeywords = keywords.filter(k => k.impressions > 100 && k.ctr < 0.05);
        if (lowCtrKeywords.length > 0) {
            recommendations.push(`שפרו כותרות ותיאורים עבור ${lowCtrKeywords.length} מילות מפתח עם CTR נמוך`);
        }

        // Keywords with low position but high impressions
        const improvableKeywords = keywords.filter(k => k.impressions > 50 && k.position > 10);
        if (improvableKeywords.length > 0) {
            recommendations.push(`התמקדו בשיפור תוכן עבור ${improvableKeywords.length} מילות מפתח בעמדות 10+`);
        }

        // High position keywords with low CTR
        const highPositionLowCtr = keywords.filter(k => k.position <= 5 && k.ctr < 0.1);
        if (highPositionLowCtr.length > 0) {
            recommendations.push(`שפרו כותרות עבור מילות מפתח בעמדות 1-5 עם CTR נמוך`);
        }

        // Overall performance insights
        if (summary) {
            const avgPosition = summary.avgPosition || 0;
            const avgCtr = summary.avgCtr || 0;

            if (avgPosition > 15) {
                recommendations.push('דירוג כללי נמוך - התמקדו ביצירת תוכן איכותי יותר');
            }

            if (avgCtr < 0.05) {
                recommendations.push('CTR כללי נמוך - שפרו כותרות ותיאורים בתוצאות החיפוש');
            }
        }

        return { insights, recommendations };
    }

    /**
     * Calculate performance summary
     */
    calculateSummary(keywords) {
        if (!keywords || keywords.length === 0) {
            return {
                totalClicks: 0,
                totalImpressions: 0,
                avgCtr: 0,
                avgPosition: 0,
                keywordsCount: 0
            };
        }

        const summary = keywords.reduce((acc, keyword) => {
            acc.totalClicks += keyword.clicks;
            acc.totalImpressions += keyword.impressions;
            acc.totalPosition += keyword.position;
            return acc;
        }, { totalClicks: 0, totalImpressions: 0, totalPosition: 0 });

        return {
            totalClicks: summary.totalClicks,
            totalImpressions: summary.totalImpressions,
            avgCtr: summary.totalImpressions > 0 ? summary.totalClicks / summary.totalImpressions : 0,
            avgPosition: keywords.length > 0 ? summary.totalPosition / keywords.length : 0,
            keywordsCount: keywords.length
        };
    }
}

/**
 * Create Search Console service instance from encrypted tokens
 */
export async function createSearchConsoleService(integration) {
    try {
        logInfo('Creating Search Console service from UserIntegration', {
            integrationId: integration.id,
            accountId: integration.accountId
        });

        return new SearchConsoleService(integration);
    } catch (error) {
        logError('Error creating Search Console service', error);
        throw new Error('Failed to initialize Search Console service');
    }
}

export default SearchConsoleService; 