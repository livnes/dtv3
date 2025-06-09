import { logInfo, logError } from '@/lib/logger';

/**
 * Triggers backfill for different integration types
 * @param {string} userEmail - User email for logging
 * @param {string} integrationType - Type of integration ('analytics', 'google_ads', 'facebook', 'tiktok')
 * @param {boolean} isNewIntegration - Whether this is a new integration (for logging)
 */
export async function triggerBackfill(userEmail, integrationType = 'analytics', isNewIntegration = true) {
    try {
        const actionLabel = isNewIntegration ? 'New integration backfill' : 'Refresh backfill';
        logInfo(`🔄 ${actionLabel} triggered`, {
            userEmail,
            integrationType,
            timestamp: new Date().toISOString()
        });

        // Map integration types to their respective cron endpoints
        const backfillEndpoints = {
            'analytics': '/api/cron/analytics-backfill',
            'google_ads': '/api/cron/google-ads-backfill', // Google Ads campaign data
            'search_console': '/api/cron/search-console-daily',
            'facebook': '/api/cron/facebook-backfill', // TODO: Implement
            'tiktok': '/api/cron/tiktok-backfill', // TODO: Implement
            'all': '/api/cron/analytics-backfill' // Default to analytics for now
        };

        const endpoint = backfillEndpoints[integrationType] || backfillEndpoints['analytics'];

        // Don't await - run in background to avoid blocking OAuth callback
        fetch(`${process.env.NEXTAUTH_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                logInfo(`✅ ${actionLabel} trigger sent successfully`, {
                    userEmail,
                    integrationType,
                    endpoint
                });
            } else {
                logError(`❌ ${actionLabel} trigger failed`, {
                    userEmail,
                    integrationType,
                    status: response.status,
                    endpoint
                });
            }
        }).catch(error => {
            logError(`❌ ${actionLabel} trigger request failed`, {
                userEmail,
                integrationType,
                error: error.message,
                endpoint
            });
        });

        logInfo(`📡 ${actionLabel} trigger request sent`, {
            userEmail,
            integrationType,
            endpoint
        });

    } catch (error) {
        logError(`❌ Error triggering backfill`, {
            userEmail,
            integrationType,
            error: error.message
        });
    }
}

/**
 * Triggers multiple backfill types for a user
 * @param {string} userEmail - User email for logging
 * @param {string[]} integrationTypes - Array of integration types to backfill
 * @param {boolean} isNewUser - Whether this is a new user signup
 */
export async function triggerMultipleBackfills(userEmail, integrationTypes = ['analytics'], isNewUser = false) {
    try {
        logInfo(`🚀 Multiple backfill triggered`, {
            userEmail,
            integrationTypes,
            isNewUser,
            timestamp: new Date().toISOString()
        });

        // Trigger each type with a small delay to avoid overwhelming the system
        for (let i = 0; i < integrationTypes.length; i++) {
            const integrationType = integrationTypes[i];

            // Small delay between triggers
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await triggerBackfill(userEmail, integrationType, isNewUser);
        }

        logInfo(`✅ All backfill triggers sent`, {
            userEmail,
            integrationTypes
        });

    } catch (error) {
        logError(`❌ Error triggering multiple backfills`, {
            userEmail,
            integrationTypes,
            error: error.message
        });
    }
}

/**
 * Checks if CRON_SECRET is configured
 * @returns {boolean} Whether cron secret is available
 */
export function isCronConfigured() {
    const hasSecret = !!process.env.CRON_SECRET;

    if (!hasSecret) {
        logError('⚠️ CRON_SECRET not configured - backfill triggers will fail');
    }

    return hasSecret;
}

/**
 * Helper to validate backfill prerequisites 
 * @param {string} userEmail - User email
 * @param {string} integrationType - Integration type
 * @returns {object} Validation result
 */
export function validateBackfillPrerequisites(userEmail, integrationType) {
    const errors = [];

    if (!userEmail) {
        errors.push('User email is required');
    }

    if (!integrationType) {
        errors.push('Integration type is required');
    }

    if (!process.env.NEXTAUTH_URL) {
        errors.push('NEXTAUTH_URL not configured');
    }

    if (!process.env.CRON_SECRET) {
        errors.push('CRON_SECRET not configured');
    }

    const isValid = errors.length === 0;

    if (!isValid) {
        logError('❌ Backfill prerequisites validation failed', {
            userEmail,
            integrationType,
            errors
        });
    }

    return {
        isValid,
        errors
    };
} 