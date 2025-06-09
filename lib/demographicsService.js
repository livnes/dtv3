import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { decrypt } from '@/lib/encryption';

class DemographicsService {
    async getDemographicData(userId, propertyId, options = {}) {
        try {
            // Get user's Google Analytics credentials
            const integration = await prisma.userIntegration.findFirst({
                where: {
                    userId: userId,
                    providerName: 'google_analytics',
                    isActive: true
                }
            });

            if (!integration) {
                throw new Error('Google Analytics integration not found');
            }

            // Decrypt tokens
            const accessToken = decrypt(integration.encryptedAccessToken);
            const refreshToken = integration.encryptedRefreshToken ?
                decrypt(integration.encryptedRefreshToken) : null;

            // Initialize Google Analytics
            const auth = new google.auth.OAuth2();
            auth.setCredentials({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            const analyticsData = google.analyticsdata('v1beta');

            // Demographic data requests
            const requests = [
                this.getAgeData(analyticsData, auth, propertyId, options),
                this.getGenderData(analyticsData, auth, propertyId, options),
                this.getDeviceData(analyticsData, auth, propertyId, options),
                this.getLocationData(analyticsData, auth, propertyId, options)
            ];

            const [ageData, genderData, deviceData, locationData] = await Promise.all(requests);

            return {
                age: ageData,
                gender: genderData,
                device: deviceData,
                location: locationData,
                summary: this.generateSummary(ageData, genderData, deviceData, locationData)
            };

        } catch (error) {
            logger.error('Error in getDemographicData:', error);
            throw error;
        }
    }

    async getAgeData(analyticsData, auth, propertyId, options) {
        try {
            const response = await analyticsData.properties.runReport({
                auth,
                property: `properties/${propertyId}`,
                requestBody: {
                    dateRanges: [{
                        startDate: options.startDate || '30daysAgo',
                        endDate: options.endDate || 'today'
                    }],
                    dimensions: [{ name: 'userAgeBracket' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'users' },
                        { name: 'conversions' }
                    ],
                    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
                }
            });

            return this.processAgeData(response.data);
        } catch (error) {
            logger.error('Error fetching age data:', error);
            return { error: error.message };
        }
    }

    async getGenderData(analyticsData, auth, propertyId, options) {
        try {
            const response = await analyticsData.properties.runReport({
                auth,
                property: `properties/${propertyId}`,
                requestBody: {
                    dateRanges: [{
                        startDate: options.startDate || '30daysAgo',
                        endDate: options.endDate || 'today'
                    }],
                    dimensions: [{ name: 'userGender' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'users' },
                        { name: 'conversions' }
                    ]
                }
            });

            return this.processGenderData(response.data);
        } catch (error) {
            logger.error('Error fetching gender data:', error);
            return { error: error.message };
        }
    }

    async getDeviceData(analyticsData, auth, propertyId, options) {
        try {
            const response = await analyticsData.properties.runReport({
                auth,
                property: `properties/${propertyId}`,
                requestBody: {
                    dateRanges: [{
                        startDate: options.startDate || '30daysAgo',
                        endDate: options.endDate || 'today'
                    }],
                    dimensions: [{ name: 'deviceCategory' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'users' },
                        { name: 'bounceRate' },
                        { name: 'averageSessionDuration' }
                    ]
                }
            });

            return this.processDeviceData(response.data);
        } catch (error) {
            logger.error('Error fetching device data:', error);
            return { error: error.message };
        }
    }

    async getLocationData(analyticsData, auth, propertyId, options) {
        try {
            const response = await analyticsData.properties.runReport({
                auth,
                property: `properties/${propertyId}`,
                requestBody: {
                    dateRanges: [{
                        startDate: options.startDate || '30daysAgo',
                        endDate: options.endDate || 'today'
                    }],
                    dimensions: [{ name: 'country' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'users' }
                    ],
                    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                    limit: 10
                }
            });

            return this.processLocationData(response.data);
        } catch (error) {
            logger.error('Error fetching location data:', error);
            return { error: error.message };
        }
    }

    processAgeData(data) {
        if (!data.rows) return [];

        return data.rows.map(row => ({
            age: row.dimensionValues[0].value,
            sessions: parseInt(row.metricValues[0].value),
            users: parseInt(row.metricValues[1].value),
            conversions: parseInt(row.metricValues[2].value)
        }));
    }

    processGenderData(data) {
        if (!data.rows) return [];

        return data.rows.map(row => ({
            gender: row.dimensionValues[0].value,
            sessions: parseInt(row.metricValues[0].value),
            users: parseInt(row.metricValues[1].value),
            conversions: parseInt(row.metricValues[2].value)
        }));
    }

    processDeviceData(data) {
        if (!data.rows) return [];

        return data.rows.map(row => ({
            device: row.dimensionValues[0].value,
            sessions: parseInt(row.metricValues[0].value),
            users: parseInt(row.metricValues[1].value),
            bounceRate: parseFloat(row.metricValues[2].value),
            avgSessionDuration: parseFloat(row.metricValues[3].value)
        }));
    }

    processLocationData(data) {
        if (!data.rows) return [];

        return data.rows.map(row => ({
            country: row.dimensionValues[0].value,
            sessions: parseInt(row.metricValues[0].value),
            users: parseInt(row.metricValues[1].value)
        }));
    }

    generateSummary(ageData, genderData, deviceData, locationData) {
        const summary = {
            topAge: ageData[0]?.age || 'N/A',
            topGender: genderData[0]?.gender || 'N/A',
            topDevice: deviceData[0]?.device || 'N/A',
            topCountry: locationData[0]?.country || 'N/A'
        };

        return summary;
    }
}

const demographicsService = new DemographicsService();
export default demographicsService; 