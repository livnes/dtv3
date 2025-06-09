'use client';

import { useState, useEffect, useCallback } from 'react';

export default function KeywordsClientResults({ selectedSiteUrl, dateRange: initialDateRange, userId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [siteUrl, setSiteUrl] = useState(selectedSiteUrl);
    const [dateRange, setDateRange] = useState(initialDateRange);

    const fetchData = useCallback(async () => {
        if (!siteUrl) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/action/keywords?siteUrl=${encodeURIComponent(siteUrl)}&dateRange=${dateRange}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'שגיאה בטעינת נתוני מילות חיפוש');
            }

            setData(result.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [siteUrl, dateRange]);

    // Listen for form submission events
    useEffect(() => {
        const handleFormSubmit = (event) => {
            setSiteUrl(event.detail.siteUrl);
            setDateRange(event.detail.dateRange);
        };

        window.addEventListener('keywords-form-submit', handleFormSubmit);
        return () => window.removeEventListener('keywords-form-submit', handleFormSubmit);
    }, []);

    // Auto-fetch data when parameters change
    useEffect(() => {
        if (siteUrl) {
            fetchData();
        }
    }, [siteUrl, dateRange, fetchData]);

    const getScoreClass = (score) => {
        if (score >= 70) return 'action-score-high';
        if (score >= 40) return 'action-score-medium';
        return 'action-score-low';
    };

    const getMetricClass = (score) => {
        if (score >= 70) return 'action-metric-high';
        if (score >= 40) return 'action-metric-medium';
        return 'action-metric-low';
    };

    const getPotentialClass = (potential) => {
        if (!potential || typeof potential !== 'string') return 'action-metric-low';
        if (potential.includes('גבוה')) return 'action-metric-high';
        if (potential.includes('בינוני')) return 'action-metric-medium';
        return 'action-metric-low';
    };

    const renderInsightItem = (item) => {
        return (
            <div key={item.type} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start space-x-3 space-x-reverse">
                    <div className="flex-shrink-0">
                        <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">{item.title}</h4>
                        <p className="text-gray-700 text-sm mb-3">{item.message}</p>

                        {/* Additional context for specific insight types */}
                        {item.type === 'overview' && (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="text-center p-2 bg-white rounded">
                                    <div className="text-lg font-bold text-blue-600">{item.value?.toLocaleString()}</div>
                                    <div className="text-xs text-blue-500">קליקים</div>
                                </div>
                                <div className="text-center p-2 bg-white rounded">
                                    <div className="text-lg font-bold text-green-600">{item.averageCtr}%</div>
                                    <div className="text-xs text-green-500">CTR</div>
                                </div>
                            </div>
                        )}

                        {item.type === 'top_keyword' && (
                            <div className="bg-white rounded p-2 mt-2">
                                <span className="font-medium text-blue-800">&ldquo;{item.keyword}&rdquo;</span>
                                <div className="text-xs text-gray-600 mt-1">
                                    📍 דירוג {item.position?.toFixed(1)} | 🎯 CTR {item.ctr}%
                                </div>
                            </div>
                        )}

                        {item.keywords && Array.isArray(item.keywords) && (
                            <div className="text-sm text-gray-600 mt-2">
                                <strong>מילות מפתח:</strong> {item.keywords.slice(0, 3).join(', ')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderRecommendationItem = (item) => {
        const priorityStyles = {
            high: 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200',
            medium: 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200',
            low: 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
        };

        const priorityLabels = {
            high: 'עדיפות גבוהה',
            medium: 'עדיפות בינונית',
            low: 'עדיפות נמוכה'
        };

        return (
            <div key={item.type} className={`rounded-lg border p-4 hover:shadow-md transition-shadow ${priorityStyles[item.priority] || priorityStyles.medium}`}>
                <div className="flex items-start space-x-3 space-x-reverse">
                    <div className="flex-shrink-0">
                        <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{item.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${item.priority === 'high' ? 'bg-red-100 text-red-800' :
                                item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                {priorityLabels[item.priority] || 'בינוני'}
                            </span>
                        </div>
                        <p className="text-gray-700 text-sm mb-3">{item.description}</p>

                        {/* Keyword-specific details */}
                        {item.keyword && (
                            <div className="bg-white bg-opacity-60 rounded p-3 mt-3">
                                <div className="font-medium text-gray-800 mb-2">מילת מפתח: &ldquo;{item.keyword}&rdquo;</div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                    {item.clicks && <div>👆 {item.clicks} קליקים</div>}
                                    {item.position && <div>📍 דירוג {item.position.toFixed(1)}</div>}
                                    {item.impressions && <div>👁️ {item.impressions.toLocaleString()} הצגות</div>}
                                    {item.ctr && <div>🎯 CTR {item.ctr}%</div>}
                                </div>
                            </div>
                        )}

                        {item.action && (
                            <div className="mt-3 p-2 bg-white bg-opacity-60 rounded">
                                <div className="text-sm">
                                    <strong>פעולה מומלצת:</strong>
                                    <span className="mr-2 text-blue-600">
                                        {item.action === 'strengthen_content' ? 'חזק תוכן קיים' :
                                            item.action === 'improve_content' ? 'שפר תוכן' :
                                                item.action === 'optimize_titles' ? 'אופטם כותרות' :
                                                    item.action === 'boost_ranking' ? 'דחף דירוג' :
                                                        item.action === 'expand_content' ? 'הרחב תוכן' : item.action}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="action-loading">
                <div className="action-loading-spinner"></div>
                <span className="action-loading-text">טוען נתוני מילות חיפוש...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="action-error">
                <h3 className="action-error-title">שגיאה</h3>
                <p className="action-error-text">{error}</p>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <>
            {/* Summary Cards */}
            <div className="action-summary-grid">
                <div className="action-summary-card">
                    <div className="action-summary-title">סך הכל קליקים</div>
                    <div className="action-summary-value">{data.summary?.totalClicks?.toLocaleString() || 0}</div>
                </div>
                <div className="action-summary-card">
                    <div className="action-summary-title">סך הכל הצגות</div>
                    <div className="action-summary-value">{data.summary?.totalImpressions?.toLocaleString() || 0}</div>
                </div>
                <div className="action-summary-card">
                    <div className="action-summary-title">CTR ממוצע</div>
                    <div className="action-summary-value">{data.summary?.averageCtr}%</div>
                </div>
                <div className="action-summary-card">
                    <div className="action-summary-title">מילות חיפוש</div>
                    <div className="action-summary-value">{data.keywords?.length || 0}</div>
                </div>
            </div>

            {/* AI Insights & Recommendations - Display prominently */}
            {((data.insights && data.insights.items) || (data.recommendations && data.recommendations.items)) && (
                <div className="mb-8">
                    <div className="action-card">
                        <div className="action-card-header bg-gradient-to-r from-purple-500 to-blue-600 text-white">
                            <div className="flex items-center space-x-3 space-x-reverse">
                                <span className="text-2xl">🤖</span>
                                <div>
                                    <h2 className="text-xl font-bold">תובנות AI מתקדמות</h2>
                                    <p className="text-purple-100 text-sm">
                                        ניתוח אוטומטי של ביצועי מילות המפתח והמלצות לשיפור
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="action-card-content">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Insights Section */}
                                {data.insights && data.insights.items && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                                            <span className="text-xl mr-2">💡</span>
                                            תובנות חכמות ({data.insights.items.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {data.insights.items.map(renderInsightItem)}
                                        </div>
                                    </div>
                                )}

                                {/* Recommendations Section */}
                                {data.recommendations && data.recommendations.items && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                                            <span className="text-xl mr-2">🚀</span>
                                            המלצות לפעולה ({data.recommendations.items.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {data.recommendations.items.map(renderRecommendationItem)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Keywords Table */}
            {data.keywords && data.keywords.length > 0 && (
                <div className="action-card">
                    <div className="action-card-header">
                        <h2 className="action-card-title">📊 מילות החיפוש המובילות</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            מיון לפי מספר קליקים | ציוני איכות מחושבים בעזרת AI
                        </p>
                    </div>
                    <div className="action-card-content">
                        <div className="action-table-container">
                            <table className="action-table">
                                <thead className="action-table-header">
                                    <tr>
                                        <th className="action-table-header-cell">פוטנציאל תנועה</th>
                                        <th className="action-table-header-cell">ציון איכות</th>
                                        <th className="action-table-header-cell">דירוג ממוצע</th>
                                        <th className="action-table-header-cell">CTR</th>
                                        <th className="action-table-header-cell">הצגות</th>
                                        <th className="action-table-header-cell">קליקים</th>
                                        <th className="action-table-header-cell">מילת חיפוש</th>
                                    </tr>
                                </thead>
                                <tbody className="action-table-body">
                                    {data.keywords.map((keyword, index) => (
                                        <tr key={index} className="action-table-row">
                                            <td className="action-table-cell">
                                                <span className={`action-metric ${getPotentialClass(keyword.trafficPotential)}`}>
                                                    {keyword.trafficPotential}
                                                </span>
                                            </td>
                                            <td className="action-table-cell">
                                                <div className={`action-score ${getScoreClass(keyword.qualityScore)}`}>
                                                    {keyword.qualityScore}
                                                </div>
                                            </td>
                                            <td className="action-table-cell">
                                                <span className={`action-metric ${getMetricClass(Math.max(0, 100 - keyword.position * 10))}`}>
                                                    {keyword.position}
                                                </span>
                                            </td>
                                            <td className="action-table-cell">
                                                <span className={`action-metric ${getMetricClass(keyword.ctr * 20)}`}>
                                                    {keyword.ctr}%
                                                </span>
                                            </td>
                                            <td className="action-table-cell">{keyword.impressions.toLocaleString()}</td>
                                            <td className="action-table-cell">{keyword.clicks.toLocaleString()}</td>
                                            <td className="action-table-cell">
                                                <div className="font-medium text-blue-600">
                                                    {keyword.keyword}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
} 