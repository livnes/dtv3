import { google } from 'googleapis';
import { decrypt } from './encryption';
import { logInfo, logError } from './logger';

class GoogleAdsService {
    constructor(integration) {
        this.integration = integration;

        // Decrypt the stored tokens
        this.accessToken = decrypt(integration.encryptedAccessToken);
        this.refreshToken = integration.encryptedRefreshToken ? decrypt(integration.encryptedRefreshToken) : null;

        // Initialize OAuth2 client using the stored tokens
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/auth/google-ads/callback`
        );

        this.oauth2Client.setCredentials({
            access_token: this.accessToken,
            refresh_token: this.refreshToken
        });

        // For now, return mock data for Google Ads until proper implementation
        this.adsService = null;
    }

    /**
     * Get accessible Google Ads accounts using direct REST API calls
     */
    async getAccessibleCustomers() {
        try {
            logInfo('Fetching Google Ads customers using OAuth credentials');

            // Ensure we have a fresh access token
            const { token } = await this.oauth2Client.getAccessToken();

            // Use Google Ads REST API to list accessible customers
            const response = await fetch('https://googleads.googleapis.com/v20/customers:listAccessibleCustomers', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'MISSING-DEV-TOKEN',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                logError('Google Ads API error', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });

                if (response.status === 401) {
                    throw new Error('Google Ads authorization failed. Please reconnect your Google Ads account.');
                } else if (response.status === 403) {
                    throw new Error('Google Ads requires app Developer Token setup. Contact support for activation.');
                } else {
                    throw new Error(`Google Ads API error: ${response.status} - ${errorText}`);
                }
            }

            const data = await response.json();
            const customerResourceNames = data.resourceNames || [];

            logInfo('Google Ads API response details', {
                responseStatus: response.status,
                dataKeys: Object.keys(data),
                resourceNamesCount: customerResourceNames.length,
                fullResponse: data
            });

            if (customerResourceNames.length === 0) {
                logInfo('No Google Ads customers found for user - this is normal for users without Google Ads accounts or manager access');
                return [];
            }

            // Extract customer IDs and create basic customer objects
            const customers = customerResourceNames.map(resourceName => {
                const customerId = resourceName.replace('customers/', '');
                return {
                    resourceName: resourceName,
                    id: customerId,
                    descriptiveName: `Google Ads Account ${customerId}`
                };
            });

            logInfo('Retrieved Google Ads customers', {
                customersCount: customers.length,
                customers: customers.map(c => ({ id: c.id, name: c.descriptiveName }))
            });

            return customers;

        } catch (error) {
            logError('Error fetching Google Ads customers', { error: error.message });

            // Check if it's an authentication/permission error
            if (error.message?.includes('authorization') || error.message?.includes('unauthorized')) {
                throw new Error('Google Ads access denied. Please ensure you have authorized access to Google Ads accounts.');
            }

            throw error;
        }
    }

    /**
     * Get account details for a customer
     */
    async getAccountDetails(customerId) {
        try {
            const query = `
                SELECT 
                    customer.id,
                    customer.descriptive_name,
                    customer.currency_code,
                    customer.time_zone,
                    customer.status
                FROM customer 
                WHERE customer.id = ${customerId}
            `;

            const response = await this.adsService.customers.googleAds.search({
                customerId: customerId,
                requestBody: {
                    query: query
                }
            });

            return response.data.results?.[0] || null;
        } catch (error) {
            logError('Error fetching account details', { customerId, error: error.message });
            throw error;
        }
    }

    /**
     * Get campaign performance data for date range
     */
    async getCampaignPerformance(customerId, startDate, endDate) {
        try {
            const query = `
                SELECT 
                    campaign.id,
                    campaign.name,
                    campaign.status,
                    campaign.advertising_channel_type,
                    segments.date,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.ctr,
                    metrics.average_cpc,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.cost_per_conversion
                FROM campaign 
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                    AND campaign.status = 'ENABLED'
                ORDER BY segments.date DESC
            `;

            const response = await this.adsService.customers.googleAds.search({
                customerId: customerId,
                requestBody: {
                    query: query,
                    pageSize: 10000
                }
            });

            const campaigns = (response.data.results || []).map(row => ({
                campaignId: row.campaign.id,
                campaignName: row.campaign.name,
                status: row.campaign.status,
                channelType: row.campaign.advertisingChannelType,
                date: row.segments.date,
                impressions: parseInt(row.metrics.impressions) || 0,
                clicks: parseInt(row.metrics.clicks) || 0,
                costMicros: parseInt(row.metrics.costMicros) || 0,
                cost: (parseInt(row.metrics.costMicros) || 0) / 1000000, // Convert from micros
                ctr: parseFloat(row.metrics.ctr) || 0,
                averageCpc: (parseInt(row.metrics.averageCpc) || 0) / 1000000, // Convert from micros
                conversions: parseFloat(row.metrics.conversions) || 0,
                conversionsValue: parseFloat(row.metrics.conversionsValue) || 0,
                costPerConversion: (parseInt(row.metrics.costPerConversion) || 0) / 1000000
            }));

            logInfo('Retrieved campaign performance data', {
                customerId,
                campaignsCount: campaigns.length,
                dateRange: `${startDate} to ${endDate}`
            });

            return campaigns;
        } catch (error) {
            logError('Error fetching campaign performance', { customerId, error: error.message });
            throw error;
        }
    }

    /**
     * Get ad group performance data
     */
    async getAdGroupPerformance(customerId, startDate, endDate) {
        try {
            const query = `
                SELECT 
                    ad_group.id,
                    ad_group.name,
                    ad_group.status,
                    campaign.id,
                    campaign.name,
                    segments.date,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.ctr,
                    metrics.average_cpc,
                    metrics.conversions
                FROM ad_group 
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                    AND ad_group.status = 'ENABLED'
                ORDER BY segments.date DESC
            `;

            const response = await this.adsService.customers.googleAds.search({
                customerId: customerId,
                requestBody: {
                    query: query,
                    pageSize: 10000
                }
            });

            const adGroups = (response.data.results || []).map(row => ({
                adGroupId: row.adGroup.id,
                adGroupName: row.adGroup.name,
                campaignId: row.campaign.id,
                campaignName: row.campaign.name,
                date: row.segments.date,
                impressions: parseInt(row.metrics.impressions) || 0,
                clicks: parseInt(row.metrics.clicks) || 0,
                cost: (parseInt(row.metrics.costMicros) || 0) / 1000000,
                ctr: parseFloat(row.metrics.ctr) || 0,
                averageCpc: (parseInt(row.metrics.averageCpc) || 0) / 1000000,
                conversions: parseFloat(row.metrics.conversions) || 0
            }));

            return adGroups;
        } catch (error) {
            logError('Error fetching ad group performance', { customerId, error: error.message });
            throw error;
        }
    }

    /**
     * Get keyword performance data
     */
    async getKeywordPerformance(customerId, startDate, endDate) {
        try {
            const query = `
                SELECT 
                    ad_group_criterion.keyword.text,
                    ad_group_criterion.keyword.match_type,
                    ad_group.id,
                    ad_group.name,
                    campaign.id,
                    campaign.name,
                    segments.date,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.ctr,
                    metrics.average_cpc,
                    metrics.conversions,
                    metrics.search_impression_share
                FROM keyword_view 
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                    AND ad_group_criterion.status = 'ENABLED'
                ORDER BY metrics.cost_micros DESC
            `;

            const response = await this.adsService.customers.googleAds.search({
                customerId: customerId,
                requestBody: {
                    query: query,
                    pageSize: 5000
                }
            });

            const keywords = (response.data.results || []).map(row => ({
                keyword: row.adGroupCriterion.keyword.text,
                matchType: row.adGroupCriterion.keyword.matchType,
                adGroupId: row.adGroup.id,
                adGroupName: row.adGroup.name,
                campaignId: row.campaign.id,
                campaignName: row.campaign.name,
                date: row.segments.date,
                impressions: parseInt(row.metrics.impressions) || 0,
                clicks: parseInt(row.metrics.clicks) || 0,
                cost: (parseInt(row.metrics.costMicros) || 0) / 1000000,
                ctr: parseFloat(row.metrics.ctr) || 0,
                averageCpc: (parseInt(row.metrics.averageCpc) || 0) / 1000000,
                conversions: parseFloat(row.metrics.conversions) || 0,
                impressionShare: parseFloat(row.metrics.searchImpressionShare) || 0
            }));

            return keywords;
        } catch (error) {
            logError('Error fetching keyword performance', { customerId, error: error.message });
            throw error;
        }
    }

    /**
     * Get demographics data (age, gender, device)
     */
    async getDemographicsData(customerId, startDate, endDate) {
        try {
            const ageQuery = `
                SELECT 
                    age_range_view.age_range,
                    campaign.name,
                    segments.date,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM age_range_view 
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY metrics.impressions DESC
            `;

            const genderQuery = `
                SELECT 
                    gender_view.gender,
                    campaign.name,
                    segments.date,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM gender_view 
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY metrics.impressions DESC
            `;

            const deviceQuery = `
                SELECT 
                    segments.device,
                    campaign.name,
                    segments.date,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM campaign 
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY metrics.impressions DESC
            `;

            const [ageResponse, genderResponse, deviceResponse] = await Promise.all([
                this.adsService.customers.googleAds.search({
                    customerId: customerId,
                    requestBody: { query: ageQuery }
                }),
                this.adsService.customers.googleAds.search({
                    customerId: customerId,
                    requestBody: { query: genderQuery }
                }),
                this.adsService.customers.googleAds.search({
                    customerId: customerId,
                    requestBody: { query: deviceQuery }
                })
            ]);

            return {
                ageRanges: ageResponse.data.results || [],
                genders: genderResponse.data.results || [],
                devices: deviceResponse.data.results || []
            };
        } catch (error) {
            logError('Error fetching demographics data', { customerId, error: error.message });
            throw error;
        }
    }

    /**
     * Calculate performance insights and recommendations
     */
    calculateInsights(campaignData) {
        if (!campaignData || campaignData.length === 0) {
            return {
                insights: [],
                recommendations: [],
                summary: {}
            };
        }

        const summary = campaignData.reduce((acc, campaign) => {
            acc.totalCost += campaign.cost;
            acc.totalClicks += campaign.clicks;
            acc.totalImpressions += campaign.impressions;
            acc.totalConversions += campaign.conversions;
            return acc;
        }, { totalCost: 0, totalClicks: 0, totalImpressions: 0, totalConversions: 0 });

        summary.avgCtr = summary.totalClicks / summary.totalImpressions;
        summary.avgCpc = summary.totalCost / summary.totalClicks;
        summary.avgConversionRate = summary.totalConversions / summary.totalClicks;

        const insights = [];
        const recommendations = [];

        // High performing campaigns
        const topCampaigns = campaignData
            .filter(c => c.conversions > 0)
            .sort((a, b) => (b.conversions / b.cost) - (a.conversions / a.cost))
            .slice(0, 3);

        if (topCampaigns.length > 0) {
            insights.push(`הקמפיינים בעלי הביצועים הטובים ביותר: ${topCampaigns.map(c => c.campaignName).join(', ')}`);
        }

        // High cost, low performance campaigns
        const underperformingCampaigns = campaignData
            .filter(c => c.cost > summary.totalCost * 0.1 && c.conversions < 1)
            .sort((a, b) => b.cost - a.cost);

        if (underperformingCampaigns.length > 0) {
            recommendations.push(`שקלו לייעל או להשהות קמפיינים: ${underperformingCampaigns.slice(0, 2).map(c => c.campaignName).join(', ')}`);
        }

        // Budget optimization
        if (summary.avgCpc > 5) {
            recommendations.push('עלות הקליק הממוצעת גבוהה - שקלו לייעל מילות מפתח');
        }

        if (summary.avgConversionRate < 0.02) {
            recommendations.push('שיעור ההמרה נמוך - בדקו את עמודי הנחיתה');
        }

        return { insights, recommendations, summary };
    }
}

/**
 * Create Google Ads service instance from encrypted tokens
 */
export async function createGoogleAdsService(integration) {
    try {
        logInfo('Creating Google Ads service from UserIntegration', {
            integrationId: integration.id,
            accountId: integration.accountId
        });

        return new GoogleAdsService(integration);
    } catch (error) {
        logError('Error creating Google Ads service', error);
        throw new Error('Failed to initialize Google Ads service');
    }
}

export default GoogleAdsService; 