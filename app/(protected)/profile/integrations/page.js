'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePropertiesStore } from '@/lib/store';

export default function IntegrationsPage() {
    const { data: session, status } = useSession();
    const [integrations, setIntegrations] = useState({
        analytics: [],
        searchConsole: [],
        googleAds: []
    });
    const [analyticsAccounts, setAnalyticsAccounts] = useState([]);
    const [searchConsoleAccounts, setSearchConsoleAccounts] = useState([]);
    const [facebookAccounts, setFacebookAccounts] = useState([]);
    const [dataQuality, setDataQuality] = useState(null);
    const [serverBackfillStatus, setServerBackfillStatus] = useState({});
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [toggling, setToggling] = useState(null);
    const [message, setMessage] = useState(null);
    const [backfilling, setBackfilling] = useState(null);
    const [backfillStatus, setBackfillStatus] = useState({});

    const [flashMessage, setFlashMessage] = useState('');
    const [selectedSearchConsoleSite, setSelectedSearchConsoleSite] = useState('');
    const [selectedAnalyticsProperty, setSelectedAnalyticsProperty] = useState('');
    const [selectedGoogleAdsCustomer, setSelectedGoogleAdsCustomer] = useState('');
    const [discoveringProperties, setDiscoveringProperties] = useState(false);
    const [discoveryAttempted, setDiscoveryAttempted] = useState({
        analytics: false,
        searchConsole: false,
        googleAds: false
    });

    // Zustand store for properties cache
    const {
        properties,
        setProperties,
        getPropertyName,
        getPropertyById,
        isCacheFresh,
        setLoading: setPropertiesLoading
    } = usePropertiesStore();

    useEffect(() => {
        if (session?.user?.email) {
            fetchIntegrations();
        }
    }, [session, fetchIntegrations]);

    useEffect(() => {
        // Check URL parameters for success/error messages
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const error = urlParams.get('error');

        if (success === 'google_ads_connected') {
            setMessage({ type: 'success', text: 'Google Ads חובר בהצלחה!' });
            window.history.replaceState({}, '', '/profile/integrations');
        } else if (success === 'google_connected') {
            setMessage({ type: 'success', text: 'התחברת בהצלחה ל-Google Analytics ו-Search Console! לחץ על "רענן נכסים" כדי לראות את הנכסים הזמינים.' });
            window.history.replaceState({}, '', '/profile/integrations');
        } else if (error) {
            const errorMessages = {
                oauth_failed: 'שגיאה בתהליך ההתחברות',
                oauth_denied: 'ההתחברות נדחתה או בוטלה',
                missing_code: 'קוד אימות חסר מהשרת',
                invalid_state: 'מצב אימות לא תקין - נסה שוב',
                callback_failed: 'שגיאה כללית בתהליך האימות',
                invalid_grant: 'קוד האימות לא תקין או פג תוקפו - נסה התחברות מחדש',
                timeout: 'פסק זמן בתהליך ההתחברות - נסה שוב',
                token_exchange_failed: 'שגיאה בקבלת אסימון גישה מגוגל',
                unexpected_error: 'שגיאה לא צפויה - נסה שוב או צור קשר עם התמיכה'
            };
            setMessage({ type: 'error', text: errorMessages[error] || 'שגיאה לא ידועה: ' + error });
            window.history.replaceState({}, '', '/profile/integrations');
        }

        if (success || error) {
            setTimeout(() => setMessage(null), 5000);
        }
    }, []);

    const fetchProperties = async () => {
        if (isCacheFresh()) {
            console.log('🔄 Using cached properties');
            return;
        }

        try {
            setPropertiesLoading(true);
            const response = await fetch('/api/analytics/discover-properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.success) {
                setProperties(data.properties);
                console.log('✅ Properties cached:', data.properties.length);
            }
        } catch (error) {
            console.error('Error fetching properties:', error);
        } finally {
            setPropertiesLoading(false);
        }
    };

    const fetchIntegrations = useCallback(async () => {
        try {
            setLoading(true);
            console.log('📊 Fetching integrations...');

            const response = await fetch('/api/integrations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                console.log('🔍 Raw integrations data:', data.integrations);
                console.log('🔍 Analytics properties:', data.integrations?.analytics?.length || 0);

                setIntegrations(data.integrations || {
                    analytics: [],
                    searchConsole: [],
                    googleAds: []
                });
                setDataQuality(data.dataQuality);
                setServerBackfillStatus(data.backfillStatus || {});

                // ✅ NO AUTO-SYNC to prevent infinite loops - only manual sync via refresh button

                // Auto-select ONLY if there's exactly 1 property (no choice needed)
                if (data.integrations.analytics?.length === 1 && !selectedAnalyticsProperty) {
                    const singleAnalytics = data.integrations.analytics[0];
                    if (singleAnalytics.id) {
                        setSelectedAnalyticsProperty(singleAnalytics.id);
                    }
                }
                if (data.integrations.searchConsole?.length === 1 && !selectedSearchConsoleSite) {
                    const singleSearchConsole = data.integrations.searchConsole[0];
                    if (singleSearchConsole.accountId) {
                        setSelectedSearchConsoleSite(singleSearchConsole.accountId);
                    }
                }
                if (data.integrations.googleAds?.length === 1 && !selectedGoogleAdsCustomer) {
                    const singleGoogleAds = data.integrations.googleAds[0];
                    if (singleGoogleAds.accountId) {
                        setSelectedGoogleAdsCustomer(singleGoogleAds.accountId);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching integrations:', error);
            setFlashMessage('שגיאה בטעינת הנתונים');
        } finally {
            setLoading(false);
        }
    }, [selectedAnalyticsProperty, selectedSearchConsoleSite, selectedGoogleAdsCustomer]);

    // Always sync properties with Google Analytics to stay up to date
    const shouldSyncProperties = (integrations) => {
        const hasAnalytics = integrations.analytics && integrations.analytics.length > 0;
        const hasSearchConsole = integrations.searchConsole && integrations.searchConsole.length > 0;

        // Always sync if we have any Google integrations - this ensures we stay current
        const shouldSync = hasAnalytics || hasSearchConsole;

        console.log('🔄 Property sync check:', {
            shouldSync,
            hasAnalytics,
            hasSearchConsole,
            analyticsCount: integrations.analytics?.length || 0,
            searchConsoleCount: integrations.searchConsole?.length || 0,
            discoveryAttempted
        });

        return shouldSync;
    };

    // Sync properties with all Google services (MANUAL ONLY)
    const autoDiscoverProperties = async () => {
        try {
            setDiscoveringProperties(true);
            console.log('🔄 Starting manual property sync...');

            const response = await fetch('/api/integrations/discover-properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                console.log('✅ Properties synced with Google services:', data.results);

                // Always re-fetch to show latest state after manual sync
                console.log('📝 Manual sync completed, refreshing integrations...');
                setTimeout(() => {
                    fetchIntegrations();
                }, 1000);
            } else {
                console.error('❌ Property sync failed:', data.error);
                setFlashMessage(`שגיאה בסנכרון: ${data.error}`);
            }
        } catch (error) {
            console.error('❌ Property sync error:', error);
            setFlashMessage(`שגיאה בסנכרון נכסים: ${error.message}`);
        } finally {
            setDiscoveringProperties(false);
        }
    };

    // const fetchAccounts = async () => {
    //     // Simulate fetching account data - replace with real API calls
    //     try {
    //         // Mock data that matches the original template structure
    //         setAnalyticsAccounts([
    //             {
    //                 id: 1,
    //                 account_name: 'פרי גנך - GA4',
    //                 account_id: '360741272',
    //                 website_url: 'https://perigann.co.il',
    //                 is_active: true
    //             },
    //             {
    //                 id: 2,
    //                 account_name: 'אתר נוסף - GA4',
    //                 account_id: '123456789',
    //                 website_url: 'https://example.co.il',
    //                 is_active: false
    //             }
    //         ]);

    //         setSearchConsoleAccounts([
    //             {
    //                 id: 3,
    //                 account_name: 'Google Search Console',
    //                 account_id: 'sc-1',
    //                 website_url: 'https://perigann.co.il',
    //                 is_active: true
    //             }
    //         ]);

    //         setFacebookAccounts([
    //             {
    //                 id: 4,
    //                 account_name: 'Facebook Business Account',
    //                 account_id: 'fb-1',
    //                 is_active: false
    //             }
    //         ]);
    //     } catch (error) {
    //         console.error('Error fetching accounts:', error);
    //     }
    // };

    const runDataQualityCheck = async () => {
        try {
            setChecking(true);
            const response = await fetch('/api/integrations/quality-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.success) {
                setDataQuality(data.dataQuality);
                setMessage({ type: 'success', text: 'בדיקת איכות הושלמה בהצלחה' });
            }
        } catch (error) {
            console.error('Error running quality check:', error);
            setMessage({ type: 'error', text: 'שגיאה בבדיקת איכות הנתונים' });
        } finally {
            setChecking(false);
        }
    };

    const connectPlatform = async (platform) => {
        // Prevent double-clicking during OAuth flow
        if (toggling === platform) {
            console.log('🚫 Preventing double-click for platform:', platform);
            return;
        }

        setToggling(platform);
        console.log('🔗 Connecting to platform:', platform);

        if (platform === 'analytics') {
            // Redirect to Google Analytics specific OAuth
            window.location.href = '/api/auth/google-analytics';
        } else if (platform === 'searchConsole') {
            // Redirect to Google Search Console specific OAuth
            window.location.href = '/api/auth/google-search-console';
        } else if (platform === 'googleAds') {
            // Redirect to Google Ads OAuth
            window.location.href = '/api/auth/google-ads';
        } else {
            // For other platforms, show coming soon message
            setTimeout(() => {
                setToggling(null);
                setFlashMessage('התחברות ל' + platform + ' בקרוב...');
            }, 1000);
        }
    };

    const toggleAccount = async (integrationId) => {
        try {
            setToggling(integrationId);

            // Find which provider this integration belongs to
            const allIntegrations = [
                ...integrations.analytics.map(i => ({ ...i, providerName: 'google_analytics' })),
                ...integrations.searchConsole.map(i => ({ ...i, providerName: 'google_search_console' })),
                ...integrations.googleAds.map(i => ({ ...i, providerName: 'google_ads' }))
            ];

            const integration = allIntegrations.find(int => int.id === integrationId);

            if (!integration) {
                throw new Error('Integration not found');
            }

            const response = await fetch('/api/integrations/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: integration.providerName,
                    action: 'toggle'
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({
                    type: 'success',
                    text: data.message || 'סטטוס החשבון עודכן בהצלחה'
                });

                // Refresh integrations to get updated data from database
                await fetchIntegrations();
            } else {
                setMessage({
                    type: 'error',
                    text: data.error || 'שגיאה בעדכון החשבון'
                });
            }
        } catch (error) {
            console.error('Error toggling account:', error);
            setMessage({
                type: 'error',
                text: 'שגיאה בעדכון החשבון'
            });
        } finally {
            setToggling(null);
        }
    };

    const reconnectGoogle = () => {
        if (confirm('האם אתה בטוח שברצונך להתחבר מחדש לGoogle?')) {
            window.location.href = '/api/auth/google';
        }
    };

    const reconnectFacebook = () => {
        if (confirm('האם אתה בטוח שברצונך להתחבר מחדש לFacebook?')) {
            window.location.href = '/api/auth/facebook';
        }
    };

    const connectGoogleAds = () => {
        setToggling('googleAds');
        window.location.href = '/api/auth/google-ads';
    };

    // Handle Analytics property selection and activation
    const handleAnalyticsPropertyChange = async (integrationId) => {
        if (!integrationId) {
            setSelectedAnalyticsProperty('');
            return;
        }

        try {
            setSelectedAnalyticsProperty(integrationId);

            // Activate the selected property
            const response = await fetch('/api/integrations/activate-property', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    integrationId: integrationId,
                    providerName: 'google_analytics'
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({
                    type: 'success',
                    text: `נכס Analytics הופעל: ${data.integration.propertyName}`
                });

                // Refresh integrations to show updated active state
                await fetchIntegrations();
            } else {
                setMessage({ type: 'error', text: data.error || 'שגיאה בהפעלת הנכס' });
            }
        } catch (error) {
            console.error('Error activating Analytics property:', error);
            setMessage({ type: 'error', text: 'שגיאה בהפעלת נכס Analytics' });
        }
    };

    const refreshAccounts = async () => {
        setFlashMessage('מרענן חשבונות...');

        // Reset discovery flags to allow fresh sync
        setDiscoveryAttempted({
            analytics: false,
            searchConsole: false,
            googleAds: false
        });

        // Force a fresh sync
        await autoDiscoverProperties();

        setFlashMessage('החשבונות עודכנו בהצלחה');
    };

    const disconnectService = async (providerName, integrationId = null) => {
        try {
            setToggling(providerName);

            const confirmMessage = integrationId
                ? 'האם אתה בטוח שברצונך לנתק את הנכס הזה?'
                : 'האם אתה בטוח שברצונך לנתק את כל ההתחברויות לשירות הזה?';

            if (!confirm(confirmMessage)) {
                setToggling(null);
                return;
            }

            console.log('🔌 Disconnecting service:', { providerName, integrationId });

            const response = await fetch('/api/integrations/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providerName,
                    integrationId
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({
                    type: 'success',
                    text: data.message
                });

                // Refresh integrations to reflect changes
                await fetchIntegrations();

                // Clear selections if disconnecting that service
                if (providerName === 'google_analytics') {
                    setSelectedAnalyticsProperty('');
                } else if (providerName === 'google_search_console') {
                    setSelectedSearchConsoleSite('');
                } else if (providerName === 'google_ads') {
                    setSelectedGoogleAdsCustomer('');
                }
            } else {
                setMessage({
                    type: 'error',
                    text: data.error || 'שגיאה בניתוק השירות'
                });
            }
        } catch (error) {
            console.error('Error disconnecting service:', error);
            setMessage({
                type: 'error',
                text: 'שגיאה בניתוק השירות'
            });
        } finally {
            setToggling(null);
        }
    };





    if (status === 'loading' || loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">טוען נתוני התחברויות...</p>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="loading-container">
                <h3>לא מחובר</h3>
                <p>אנא התחבר כדי לנהל את ההתחברויות</p>
            </div>
        );
    }

    const totalAnalytics = integrations.analytics?.length || 0;
    const totalSearchConsole = integrations.searchConsole?.length || 0;
    const totalGoogleAds = integrations.googleAds?.length || 0;

    return (
        <div className="main-content px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="main-header text-center sm:text-right">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">ניהול חיבורים</h1>
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto sm:mx-0">
                    חבר את כל הפלטפורמות שלך למערכת אחת מרכזית
                </p>
            </div>

            {/* Flash Message */}
            {flashMessage && (
                <div className="mb-6">
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between">
                        <span className="text-sm sm:text-base">{flashMessage}</span>
                        <button
                            className="text-blue-600 hover:text-blue-800 text-xl font-bold ml-4"
                            onClick={() => setFlashMessage('')}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="mb-8">
                {/* Connection Platform Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">

                    {/* TikTok for Business */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-100 gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-gray-800 to-black rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
                                    <i className="fab fa-tiktok text-lg sm:text-xl"></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h6 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 truncate">TikTok for Business</h6>
                                    <p className="text-xs sm:text-sm text-gray-600">מדיה חברתית וחדשות</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">
                                לא מחובר ✕
                            </div>
                        </div>
                        <div className="p-4 sm:p-6">
                            <div className="text-center py-4 sm:py-8">
                                <button
                                    className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-gray-800 to-black hover:from-gray-900 hover:to-gray-800 text-white text-sm sm:text-base font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 w-full sm:w-auto"
                                    onClick={() => handleConnect('tiktok')}
                                >
                                    <i className="fab fa-tiktok"></i>
                                    <span className="hidden sm:inline">התחבר ל-TikTok Ads</span>
                                    <span className="sm:hidden">התחבר</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Facebook Ads */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-100 gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
                                    <i className="fab fa-facebook-f text-lg sm:text-xl"></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h6 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 truncate">Facebook Ads</h6>
                                    <p className="text-xs sm:text-sm text-gray-600">מדיה חברתית ופרסום</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">
                                לא מחובר ✕
                            </div>
                        </div>
                        <div className="p-4 sm:p-6">
                            <div className="text-center py-4 sm:py-8">
                                <button
                                    className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm sm:text-base font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 w-full sm:w-auto"
                                    onClick={() => handleConnect('facebook')}
                                >
                                    <i className="fab fa-facebook-f"></i>
                                    <span className="hidden sm:inline">התחבר ל-Facebook Ads</span>
                                    <span className="sm:hidden">התחבר</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Google Analytics */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-100 gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
                                    <i className="fas fa-chart-bar text-lg sm:text-xl"></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h6 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 truncate">Google Analytics</h6>
                                    <p className="text-xs sm:text-sm text-gray-600">ניתוח תנועה ומדדים</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${totalAnalytics > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                {totalAnalytics > 0 ? 'מחובר ✓' : 'לא מחובר ✕'}
                            </div>
                        </div>

                        <div className="p-4 sm:p-6">
                            {totalAnalytics > 0 ? (
                                <>
                                    {/* Property Selection */}
                                    <div className="mb-4 sm:mb-6">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">בחר נכס לניתוח</label>
                                        {discoveringProperties ? (
                                            <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                מגלה נכסי Analytics...
                                            </div>
                                        ) : integrations.analytics.length === 0 ? (
                                            <div className="p-3 bg-gray-100 text-gray-500 rounded-lg border border-gray-200">
                                                לא נמצאו נכסי Analytics
                                            </div>
                                        ) : (
                                            <select
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                value={selectedAnalyticsProperty}
                                                onChange={(e) => handleAnalyticsPropertyChange(e.target.value)}
                                            >
                                                <option value="">בחר נכס Analytics</option>
                                                {integrations.analytics.map((property, index) => {
                                                    const displayName = property.propertyName || property.accountName || `נכס ${index + 1}`;
                                                    const isActive = property.isActive;

                                                    return (
                                                        <option
                                                            key={property.id || index}
                                                            value={property.id}
                                                        >
                                                            {isActive ? '✓ ' : ''}{displayName} ({property.accountId})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        )}
                                    </div>

                                    {/* Connected Accounts */}
                                    <div className="mb-6">
                                        <h6 className="text-lg font-semibold text-gray-800 mb-4">חשבונות מחוברים ({totalAnalytics})</h6>

                                        {/* Debug info - remove this after fixing */}
                                        {process.env.NODE_ENV === 'development' && (
                                            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                                <strong>Debug:</strong> Analytics array length: {integrations.analytics?.length || 0}
                                                <br />
                                                Data: {JSON.stringify(integrations.analytics?.map(a => ({ id: a.id, name: a.propertyName || a.accountName, accountId: a.accountId })) || [], null, 2)}
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {integrations.analytics.map((account, index) => (
                                                <div key={account.id || index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200 hover:shadow-lg hover:border-orange-300 transition-all duration-200 hover:transform hover:scale-[1.02] gap-3 sm:gap-4">
                                                    <div className="flex-1 w-full sm:w-auto">
                                                        <div className="font-semibold text-sm sm:text-base text-gray-900 mb-1 flex items-center gap-2">
                                                            <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0"></div>
                                                            <span className="truncate">{account.propertyName || account.accountName || `חשבון ${index + 1}`}</span>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                                                            <span className="bg-white px-2 py-1 rounded shadow-sm text-xs font-mono break-all sm:break-normal">ID: {account.accountId}</span>
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium shadow-sm ${account.isActive
                                                                ? 'bg-green-100 text-green-800 border border-green-200'
                                                                : 'bg-gray-100 text-gray-800 border border-gray-200'
                                                                }`}>
                                                                {account.isActive ? '✓ פעיל' : '○ לא פעיל'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center self-end sm:self-auto">
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={account.isActive || false}
                                                                onChange={() => toggleAccount(account.id)}
                                                                disabled={toggling === account.id}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-9 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-red-500 shadow-md"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm sm:text-base rounded-lg transition-colors disabled:opacity-50"
                                            onClick={refreshAccounts}
                                            disabled={discoveringProperties}
                                        >
                                            <span className="hidden sm:inline">{discoveringProperties ? '🔄 מרענן...' : '🔄 רענן חשבונות'}</span>
                                            <span className="sm:hidden">{discoveringProperties ? '🔄' : '🔄'}</span>
                                        </button>

                                        <button
                                            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-red-100 hover:bg-red-200 text-red-700 text-sm sm:text-base rounded-lg transition-colors disabled:opacity-50"
                                            onClick={() => disconnectService('google_analytics')}
                                            disabled={toggling === 'google_analytics'}
                                        >
                                            <span className="hidden sm:inline">{toggling === 'google_analytics' ? '🔌 מנתק...' : '🔌 נתק שירות'}</span>
                                            <span className="sm:hidden">🔌</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4 sm:py-8">
                                    <button
                                        className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm sm:text-base font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 w-full sm:w-auto"
                                        onClick={() => connectPlatform('analytics')}
                                        disabled={toggling === 'analytics'}
                                    >
                                        <i className="fab fa-google"></i>
                                        <span className="hidden sm:inline">{toggling === 'analytics' ? 'מתחבר...' : 'התחבר ל-Google Analytics'}</span>
                                        <span className="sm:hidden">{toggling === 'analytics' ? 'מתחבר...' : 'התחבר'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Google Search Console */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white shadow-md">
                                    <i className="fas fa-search text-xl"></i>
                                </div>
                                <div>
                                    <h6 className="text-lg font-semibold text-gray-900">Google Search Console</h6>
                                    <p className="text-sm text-gray-600">SEO וביצועי חיפוש</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${totalSearchConsole > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                {totalSearchConsole > 0 ? 'מחובר ✓' : 'לא מחובר ✕'}
                            </div>
                        </div>

                        <div className="p-6">
                            {totalSearchConsole > 0 ? (
                                <>
                                    {/* Website Selection */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">בחר אתר לניתוח</label>
                                        {discoveringProperties ? (
                                            <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                מגלה אתרי Search Console...
                                            </div>
                                        ) : integrations.searchConsole.length === 0 ? (
                                            <div className="p-3 bg-gray-100 text-gray-500 rounded-lg border border-gray-200">
                                                לא נמצאו אתרים מאומתים
                                            </div>
                                        ) : (
                                            <select
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                value={selectedSearchConsoleSite}
                                                onChange={(e) => setSelectedSearchConsoleSite(e.target.value)}
                                            >
                                                <option value="">בחר אתר מ-Search Console</option>
                                                {integrations.searchConsole.map((site, index) => {
                                                    const displayName = site.propertyName || site.accountName || site.accountId;
                                                    const isValid = site.accountId && !site.accountId.includes('pending') && !site.accountId.includes('no_');

                                                    return (
                                                        <option
                                                            key={site.id || index}
                                                            value={site.accountId}
                                                            disabled={!isValid}
                                                        >
                                                            {isValid ? displayName : `❌ ${displayName}`}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        )}
                                    </div>

                                    {/* Connected Sites */}
                                    <div className="mb-6">
                                        <h6 className="text-lg font-semibold text-gray-800 mb-4">אתרים מחוברים ({totalSearchConsole})</h6>
                                        <div className="space-y-3">
                                            {integrations.searchConsole.map((site, index) => (
                                                <div key={site.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900 mb-1">
                                                            {site.propertyName || site.accountName || `אתר ${index + 1}`}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                                            <span className="truncate max-w-xs">{site.accountId}</span>
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${site.isActive
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {site.isActive ? 'פעיל' : 'לא פעיל'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={site.isActive || false}
                                                                onChange={() => toggleAccount(site.id)}
                                                                disabled={toggling === site.id}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                                            onClick={refreshAccounts}
                                        >
                                            🔄 רענן אתרים
                                        </button>

                                        <button
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                                            onClick={() => disconnectService('google_search_console')}
                                            disabled={toggling === 'google_search_console'}
                                        >
                                            {toggling === 'google_search_console' ? '🔌 מנתק...' : '🔌 נתק שירות'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <button
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                        onClick={() => connectPlatform('searchConsole')}
                                        disabled={toggling === 'searchConsole'}
                                    >
                                        <i className="fab fa-google"></i>
                                        {toggling === 'searchConsole' ? 'מתחבר...' : 'התחבר ל-Search Console'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Google Ads */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center text-white shadow-md">
                                    <i className="fas fa-ad text-xl"></i>
                                </div>
                                <div>
                                    <h6 className="text-lg font-semibold text-gray-900">Google Ads</h6>
                                    <p className="text-sm text-gray-600">פרסום ממומן וקמפיינים</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${totalGoogleAds > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                {totalGoogleAds > 0 ? 'מחובר ✓' : 'לא מחובר ✕'}
                            </div>
                        </div>

                        <div className="p-6">
                            {totalGoogleAds > 0 ? (
                                <>
                                    {/* Customer Selection */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">בחר חשבון לניתוח</label>
                                        <select
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                            value={selectedGoogleAdsCustomer}
                                            onChange={(e) => setSelectedGoogleAdsCustomer(e.target.value)}
                                        >
                                            <option value="">בחר חשבון Google Ads</option>
                                            {integrations.googleAds.map((customer, index) => (
                                                <option key={customer.id || index} value={customer.accountId}>
                                                    {customer.propertyName || customer.accountName || `חשבון ${index + 1}`} ({customer.accountId})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Connected Accounts */}
                                    <div className="mb-6">
                                        <h6 className="text-lg font-semibold text-gray-800 mb-4">חשבונות מחוברים ({totalGoogleAds})</h6>
                                        <div className="space-y-3">
                                            {integrations.googleAds.map((account, index) => (
                                                <div key={account.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900 mb-1">
                                                            {account.propertyName || account.accountName || `חשבון ${index + 1}`}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                                            <span>ID: {account.accountId}</span>
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${account.isActive
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {account.isActive ? 'פעיל' : 'לא פעיל'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={account.isActive || false}
                                                                onChange={() => toggleAccount(account.id)}
                                                                disabled={toggling === account.id}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                                            onClick={refreshAccounts}
                                        >
                                            🔄 רענן חשבונות
                                        </button>

                                        <button
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                                            onClick={() => disconnectService('google_ads')}
                                            disabled={toggling === 'google_ads'}
                                        >
                                            {toggling === 'google_ads' ? '🔌 מנתק...' : '🔌 נתק שירות'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <button
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                        onClick={() => connectPlatform('googleAds')}
                                        disabled={toggling === 'googleAds'}
                                    >
                                        <i className="fab fa-google"></i>
                                        {toggling === 'googleAds' ? 'מתחבר...' : 'התחבר ל-Google Ads'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* No Connections Message */}
                {totalAnalytics === 0 && totalSearchConsole === 0 && totalGoogleAds === 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                                <i className="fas fa-plug text-3xl text-white"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-4">אין חיבורים פעילים</h3>
                            <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                                התחבר לפלטפורמות הפרסום והניתוח שלך כדי להתחיל לקבל תובנות מתקדמות
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                                <button
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                    onClick={() => connectPlatform('analytics')}
                                >
                                    <i className="fas fa-chart-bar"></i>
                                    Google Analytics
                                </button>
                                <button
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                    onClick={() => connectPlatform('searchConsole')}
                                >
                                    <i className="fas fa-search"></i>
                                    Search Console
                                </button>
                                <button
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                    onClick={() => connectPlatform('googleAds')}
                                >
                                    <i className="fab fa-google"></i>
                                    Google Ads
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
}