import Link from 'next/link';

async function triggerOAuthFlow() {
    'use server';

    // This would be handled by a form submission to the OAuth endpoint
    // For now, we'll redirect to the OAuth URL
}

export default function GoogleAuthServerAction({ userId, initialData }) {
    const integrationStatus = initialData?.integrationStatus;

    return (
        <div className="action-container action-rtl">
            <div className="action-header">
                <h1 className="action-title">התחברות לחשבון Google</h1>
                <p className="action-description">
                    התחבר לחשבון Google שלך כדי לגשת לנתוני Analytics ו-Search Console
                </p>
            </div>

            {/* Integration Status */}
            {integrationStatus?.isConnected ? (
                <div className="action-card">
                    <div className="action-card-content">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">✅ מחובר בהצלחה</h3>
                                <p className="text-gray-600">החשבון שלך מחובר ל-Google Analytics ו-Search Console</p>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Link
                                href="/action/traffic-quality"
                                className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <h4 className="font-medium text-blue-900">📊 ניתוח איכות תנועה</h4>
                                <p className="text-sm text-blue-700 mt-1">גלה מאיפה מגיעה התנועה הכי איכותית</p>
                            </Link>

                            <Link
                                href="/action/keywords"
                                className="block p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                            >
                                <h4 className="font-medium text-green-900">🔍 ניתוח מילות מפתח</h4>
                                <p className="text-sm text-green-700 mt-1">בדוק את ביצועי מילות המפתח שלך</p>
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="action-card">
                        <div className="action-card-content">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 הוראות התקנה</h3>
                            <div className="prose prose-sm max-w-none text-gray-700">
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>לחץ על &quot;התחבר לחשבון Google&quot; כדי להתחיל בתהליך ההזדהות</li>
                                    <li>אשר את ההרשאות עבור Google Analytics ו-Search Console</li>
                                    <li>תועבר בחזרה לדף זה לאחר הזדהות מוצלחת</li>
                                    <li>לאחר החיבור, תוכל לגשת לניתוח איכות תנועה ותובנות מילות מפתח</li>
                                </ol>

                                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                    <h4 className="font-medium text-blue-900 mb-2">הרשאות נדרשות:</h4>
                                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                                        <li>Google Analytics: גישת קריאה לנתוני Analytics שלך</li>
                                        <li>Google Search Console: גישת קריאה לנתוני Search Console שלך</li>
                                        <li>פרופיל: מידע בסיסי על הפרופיל לזיהוי החשבון</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/api/auth/signin/google"
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            התחבר לחשבון Google
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
} 