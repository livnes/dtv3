// Google Search Console Service - moved to services folder
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export class GoogleSearchConsoleService {
    constructor(credentials) {
        this.credentials = credentials;
        this.searchConsole = google.searchconsole({
            version: 'v1',
            auth: this.credentials
        });
    }

    async getTopSearchKeywords(siteUrl, dateRange = '30days') {
        try {
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

            const request = {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                dimensions: ['query'],
                rowLimit: 20,
                startRow: 0
            };

            console.log(`🔍 Fetching Search Console data for site: ${siteUrl}`);

            const response = await this.searchConsole.searchanalytics.query({
                siteUrl: siteUrl,
                requestBody: request
            });

            console.log("✅ Search Console API call successful");

            const keywordsData = [];
            let totalClicks = 0;
            let totalImpressions = 0;

            if (response.data.rows) {
                for (const row of response.data.rows) {
                    const keyword = row.keys[0];
                    const clicks = row.clicks;
                    const impressions = row.impressions;
                    const ctr = row.ctr * 100;
                    const position = row.position;

                    totalClicks += clicks;
                    totalImpressions += impressions;

                    const qualityScore = this.calculateKeywordQualityScore(
                        clicks, impressions, ctr, position
                    );

                    keywordsData.push({
                        keyword,
                        clicks,
                        impressions,
                        ctr: Math.round(ctr * 100) / 100,
                        position: Math.round(position * 10) / 10,
                        qualityScore,
                        trafficPotential: this.calculateTrafficPotential(impressions, position, ctr)
                    });
                }
            }

            keywordsData.sort((a, b) => b.clicks - a.clicks);

            return {
                success: true,
                keywords: keywordsData,
                dateRange: {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                },
                summary: {
                    totalClicks,
                    totalImpressions,
                    averageCtr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions * 100) * 100) / 100 : 0,
                    totalKeywords: keywordsData.length
                }
            };

        } catch (error) {
            console.error(`❌ Error fetching Search Console data: ${error}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    calculateKeywordQualityScore(clicks, impressions, ctr, position) {
        const ctrScore = Math.min(ctr * 5, 100);
        const positionScore = Math.max(0, 110 - (position * 10));
        const clickScore = clicks > 0 ? Math.min((clicks / 1000) * 100, 100) : 0;
        const impressionScore = impressions > 0 ? Math.min((impressions / 10000) * 100, 100) : 0;

        const qualityScore = (
            ctrScore * 0.4 +
            positionScore * 0.3 +
            clickScore * 0.2 +
            impressionScore * 0.1
        );

        return Math.round(qualityScore);
    }

    calculateTrafficPotential(impressions, position, currentCtr) {
        const potentialCtr = 25.0;

        if (position <= 3) {
            return "מיצוי מלא";
        } else {
            const potentialClicks = impressions * (potentialCtr / 100);
            const currentClicks = impressions * (currentCtr / 100);
            const additionalPotential = Math.max(0, potentialClicks - currentClicks);

            if (additionalPotential < 10) {
                return "פוטנציאל נמוך";
            } else if (additionalPotential < 100) {
                return `פוטנציאל בינוני (+${Math.floor(additionalPotential)})`;
            } else {
                return `פוטנציאל גבוה (+${Math.floor(additionalPotential)})`;
            }
        }
    }

    generateInsights(keywordsData, summary) {
        if (!keywordsData || keywordsData.length === 0) {
            return {
                summary: 'לא נמצאו נתונים לניתוח',
                items: []
            };
        }

        const insights = [];
        const topKeyword = keywordsData[0];
        const dateText = '30 הימים האחרונים'; // You can make this dynamic based on dateRange

        // Overall performance insight
        insights.push({
            type: 'overview',
            icon: '🔍',
            title: 'ביצועים כלליים',
            message: `האתר שלך קיבל ${summary.totalClicks.toLocaleString()} קליקים מ-${summary.totalImpressions.toLocaleString()} הצגות ב${dateText}`,
            value: summary.totalClicks,
            metric: 'קליקים',
            period: dateText,
            totalImpressions: summary.totalImpressions,
            averageCtr: summary.averageCtr
        });

        // Top keyword insight
        insights.push({
            type: 'top_keyword',
            icon: '🏆',
            title: 'מילת חיפוש מובילה',
            message: `'${topKeyword.keyword}' מביאה הכי הרבה תנועה עם ${topKeyword.clicks.toLocaleString()} קליקים`,
            keyword: topKeyword.keyword,
            clicks: topKeyword.clicks,
            position: topKeyword.position,
            ctr: topKeyword.ctr
        });

        // Position insights
        if (topKeyword.position <= 3) {
            insights.push({
                type: 'position',
                icon: '🥇',
                title: 'דירוג מעולה',
                message: `האתר שלך מדורג במקום ${topKeyword.position.toFixed(1)} עבור '${topKeyword.keyword}' - מעולה!`,
                keyword: topKeyword.keyword,
                position: topKeyword.position,
                status: 'excellent'
            });
        } else if (topKeyword.position <= 10) {
            insights.push({
                type: 'position',
                icon: '📈',
                title: 'הזדמנות לשיפור',
                message: `האתר שלך מדורג במקום ${topKeyword.position.toFixed(1)} עבור '${topKeyword.keyword}' - יש מקום לשיפור`,
                keyword: topKeyword.keyword,
                position: topKeyword.position,
                status: 'needs_improvement'
            });
        } else {
            insights.push({
                type: 'position',
                icon: '⚠️',
                title: 'דירוג נמוך',
                message: `האתר שלך מדורג במקום ${topKeyword.position.toFixed(1)} עבור '${topKeyword.keyword}' - צריך אופטימיזציה`,
                keyword: topKeyword.keyword,
                position: topKeyword.position,
                status: 'poor'
            });
        }

        // CTR insights
        const highCtrKeywords = keywordsData.filter(k => k.ctr > 5);
        if (highCtrKeywords.length > 0) {
            insights.push({
                type: 'ctr',
                icon: '✨',
                title: 'CTR גבוה',
                message: `יש לך ${highCtrKeywords.length} מילות חיפוש עם CTR גבוה (מעל 5%) - זה מצוין!`,
                keywordsCount: highCtrKeywords.length,
                keywords: highCtrKeywords.map(k => k.keyword),
                status: 'excellent'
            });
        }

        // Low hanging fruit
        const highImpressionsLowPosition = keywordsData.filter(k => k.impressions > 1000 && k.position > 10);
        if (highImpressionsLowPosition.length > 0) {
            insights.push({
                type: 'opportunity',
                icon: '💎',
                title: 'הזדמנות זהב',
                message: `יש ${highImpressionsLowPosition.length} מילות חיפוש עם הרבה impressions אבל דירוג נמוך - הזדמנות זהב לשיפור!`,
                keywordsCount: highImpressionsLowPosition.length,
                keywords: highImpressionsLowPosition.slice(0, 3).map(k => ({ keyword: k.keyword, position: k.position, impressions: k.impressions })),
                status: 'opportunity'
            });
        }

        return {
            summary: `נותחו ${keywordsData.length} מילות חיפוש עם ${summary.totalClicks.toLocaleString()} קליקים`,
            items: insights
        };
    }

    generateRecommendations(keywordsData, summary) {
        if (!keywordsData || keywordsData.length === 0) {
            return {
                summary: 'אין מספיק נתונים להמלצות',
                items: []
            };
        }

        const recommendations = [];
        const topKeyword = keywordsData[0];

        // Priority 1: Focus on top performer
        recommendations.push({
            priority: 'high',
            type: 'content_optimization',
            icon: '💪',
            title: 'חזק את המילה הטובה ביותר',
            description: `המשך לחזק את התוכן עבור '${topKeyword.keyword}' - זו מילת החיפוש הכי מניבה שלך`,
            keyword: topKeyword.keyword,
            clicks: topKeyword.clicks,
            position: topKeyword.position,
            action: 'strengthen_content'
        });

        // Priority 2: Low hanging fruit opportunities
        const opportunities = keywordsData.filter(k =>
            k.impressions > 500 && k.position > 5 && k.position <= 20
        );
        if (opportunities.length > 0) {
            const keyword = opportunities[0];
            recommendations.push({
                priority: 'medium',
                type: 'position_improvement',
                icon: '📈',
                title: 'שיפור דירוג קל',
                description: `שפר דירוג עבור '${keyword.keyword}' - כרגע במקום ${keyword.position.toFixed(1)} עם הרבה פוטנציאל`,
                keyword: keyword.keyword,
                position: keyword.position,
                impressions: keyword.impressions,
                action: 'improve_content'
            });
        }

        // Priority 3: CTR optimization
        const lowCtrKeywords = keywordsData.filter(k => k.impressions > 1000 && k.ctr < 2);
        if (lowCtrKeywords.length > 0) {
            const keyword = lowCtrKeywords[0];
            recommendations.push({
                priority: 'medium',
                type: 'ctr_optimization',
                icon: '📝',
                title: 'שיפור CTR',
                description: `שפר את הTitle וMeta Description עבור '${keyword.keyword}' - CTR נמוך למרות הרבה הצגות`,
                keyword: keyword.keyword,
                ctr: keyword.ctr,
                impressions: keyword.impressions,
                action: 'optimize_titles'
            });
        }

        // Priority 4: Push to first page
        const positions4To10 = keywordsData.filter(k => k.position >= 4 && k.position <= 10);
        if (positions4To10.length > 0) {
            const keyword = positions4To10[0];
            recommendations.push({
                priority: 'medium',
                type: 'first_page',
                icon: '🚀',
                title: 'דחיפה לעמוד הראשון',
                description: `דחף את '${keyword.keyword}' לעמוד הראשון - כרגע במקום ${keyword.position.toFixed(1)}`,
                keyword: keyword.keyword,
                position: keyword.position,
                clicks: keyword.clicks,
                action: 'boost_ranking'
            });
        }

        // Priority 5: Content gap analysis
        if (keywordsData.length < 50) {
            recommendations.push({
                priority: 'low',
                type: 'content_expansion',
                icon: '📚',
                title: 'הרחבת תוכן',
                description: `הרחב את היקף מילות החיפוש - יש לך רק ${keywordsData.length} מילות חיפוש פעילות`,
                currentKeywords: keywordsData.length,
                action: 'expand_content'
            });
        }

        return {
            summary: `${recommendations.length} המלצות לשיפור ביצועי החיפוש`,
            items: recommendations
        };
    }

    async getSearchConsoleSites() {
        try {
            const response = await this.searchConsole.sites.list();

            const sites = [];
            if (response.data.siteEntry) {
                for (const site of response.data.siteEntry) {
                    sites.push({
                        siteUrl: site.siteUrl,
                        permissionLevel: site.permissionLevel
                    });
                }
            }

            return {
                success: true,
                sites
            };

        } catch (error) {
            console.error(`❌ Error fetching Search Console sites: ${error}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Helper function to create authenticated service
export async function createGoogleSearchConsoleService(userId) {
    try {
        // Get user's Google integration
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId,
                providerName: 'google_search_console',
                isActive: true
            }
        });

        if (!integration) {
            throw new Error('No active Google Search Console integration found');
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

        return new GoogleSearchConsoleService(oauth2Client);

    } catch (error) {
        console.error('Error creating Google Search Console service:', error);
        throw error;
    }
}

// Token refresh functionality (reused from analytics service)
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