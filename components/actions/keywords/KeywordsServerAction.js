import KeywordsForm from './KeywordsForm';
import KeywordsClientResults from './KeywordsClientResults';
import Link from 'next/link';

export default function KeywordsServerAction({ userId, initialData }) {
    const sites = initialData?.sites?.sites || [];
    const selectedSiteUrl = sites.length > 0 ? sites[0].siteUrl : '';
    const hasIntegration = initialData?.sites?.success;

    // AI Demo Data
    const keywordsData = initialData?.keywordsData;
    const insights = initialData?.insights;
    const recommendations = initialData?.recommendations;
    const demoSite = initialData?.demoSite;

    return (
        <div className="action-container action-rtl">
            <div className="action-header">
                <h1 className="action-title">🔍 ניתוח מילות מפתח מבוסס AI</h1>
                <p className="action-description">
                    גלה את מילות המפתח הכי יעילות עבור האתר שלך וקבל המלצות אישיות מ-AI לשיפור SEO
                </p>
            </div>

            {/* Connection Status */}
            {!hasIntegration && (
                <div className="action-error mb-6">
                    <div className="flex items-center">
                        <span className="text-xl mr-2">⚠️</span>
                        <div>
                            <h3 className="action-error-title">נדרש חיבור ל-Google Search Console</h3>
                            <p className="action-error-text">
                                כדי לקבל תובנות מתקדמות על מילות המפתח שלך, יש להתחבר ל-Google Search Console
                            </p>
                            <div className="mt-3">
                                <Link href="/action/google-auth" className="action-btn-primary inline-block">
                                    התחבר עכשיו 🚀
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Section */}
            {hasIntegration && (
                <div className="mb-6">
                    <div className="action-card">
                        <div className="action-card-header">
                            <h2 className="action-card-title">🎯 בחר אתר לניתוח מתקדם</h2>
                            <p className="text-sm text-gray-600">בחר אתר מרשימת האתרים המחוברים ל-Search Console</p>
                        </div>
                        <div className="action-card-content">
                            <KeywordsForm
                                sites={sites}
                                selectedSiteUrl={selectedSiteUrl}
                                userId={userId}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Results */}
            {hasIntegration && (
                <KeywordsClientResults
                    selectedSiteUrl={selectedSiteUrl}
                    dateRange="30days"
                    userId={userId}
                />
            )}

            {/* Feature Preview for non-connected users */}
            {!hasIntegration && (
                <div className="space-y-6">
                    <div className="action-card">
                        <div className="action-card-header">
                            <h2 className="action-card-title">🤖 תובנות AI שתקבל לאחר החיבור</h2>
                        </div>
                        <div className="action-card-content">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="text-2xl mb-2">📊</div>
                                    <h3 className="font-semibold text-blue-900 mb-2">ניתוח ביצועים</h3>
                                    <p className="text-sm text-blue-800">
                                        ניתוח מתקדם של ביצועי מילות המפתח שלך עם ציוני איכות ופוטנציאל תנועה
                                    </p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div className="text-2xl mb-2">💡</div>
                                    <h3 className="font-semibold text-green-900 mb-2">המלצות חכמות</h3>
                                    <p className="text-sm text-green-800">
                                        המלצות מותאמות אישית לשיפור דירוגים ו-CTR מבוססות על נתוני האתר שלך
                                    </p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="text-2xl mb-2">🚀</div>
                                    <h3 className="font-semibold text-purple-900 mb-2">הזדמנויות זהב</h3>
                                    <p className="text-sm text-purple-800">
                                        זיהוי מילות מפתח עם פוטנציאל גבוה לשיפור מהיר בדירוגים
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="action-card">
                        <div className="action-card-header">
                            <h2 className="action-card-title">📈 דוגמה לתוצאות שתקבל</h2>
                        </div>
                        <div className="action-card-content">
                            <div className="space-y-4">
                                <div className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">תיקון מחשבים ירושלים</span>
                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">ציון 87</span>
                                    </div>
                                    <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div>🔍 1,250 הצגות</div>
                                        <div>👆 85 קליקים</div>
                                        <div>📍 דירוג 3.2</div>
                                        <div>💎 פוטנציאל גבוה</div>
                                    </div>
                                </div>
                                <div className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">שירות מחשבים</span>
                                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">ציון 62</span>
                                    </div>
                                    <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div>🔍 890 הצגות</div>
                                        <div>👆 23 קליקים</div>
                                        <div>📍 דירוג 8.7</div>
                                        <div>⚡ צריך שיפור</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 