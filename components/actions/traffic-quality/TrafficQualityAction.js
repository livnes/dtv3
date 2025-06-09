'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function TrafficQualityAction() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [propertyId, setPropertyId] = useState('');
    const [dateRange, setDateRange] = useState('30days');
    const [properties, setProperties] = useState([]);
    const [loadingProperties, setLoadingProperties] = useState(true);

    // Fetch available Analytics properties on component mount
    useEffect(() => {
        fetchProperties();
    }, [fetchProperties]);

    // Auto-fetch data when property or date range changes
    useEffect(() => {
        if (propertyId) {
            const timeoutId = setTimeout(() => {
                fetchData();
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [propertyId, dateRange, fetchData]);

    const fetchProperties = useCallback(async () => {
        setLoadingProperties(true);
        setError(null);
        try {
            console.log('🔍 Fetching Analytics properties...');
            const response = await fetch('/api/action/analytics-properties');
            const result = await response.json();

            console.log('📊 Properties response:', { status: response.status, result });

            if (response.ok && result.success) {
                setProperties(result.data || []);
                console.log(`✅ Found ${result.data?.length || 0} Analytics properties`);

                // Auto-select first property if available
                if (result.data && result.data.length > 0 && !propertyId) {
                    const firstProperty = result.data[0];
                    const extractedId = firstProperty.name.split('/').pop(); // Extract ID from "properties/123456789"
                    setPropertyId(extractedId);
                    console.log(`🎯 Auto-selected property: ${firstProperty.displayName} (${extractedId})`);
                }
            } else {
                console.error('❌ Failed to fetch properties:', result.error);
                setError(`שגיאה בטעינת נכסי Analytics: ${result.error}`);
                setProperties([]);
            }
        } catch (err) {
            console.error('❌ Error fetching properties:', err);
            setError(`שגיאה בתקשורת: ${err.message}`);
            setProperties([]);
        } finally {
            setLoadingProperties(false);
        }
    }, [propertyId]);

    const fetchData = useCallback(async () => {
        if (!propertyId) {
            setError('יש לבחור נכס Analytics');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Format property ID correctly for API
            const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
            const response = await fetch(`/api/action/traffic-quality?propertyId=${encodeURIComponent(formattedPropertyId)}&dateRange=${dateRange}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'שגיאה בטעינת הנתונים');
            }

            setData(result.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [propertyId, dateRange]);

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

    const getPriorityClass = (priority) => {
        switch (priority) {
            case 'high': return 'bg-red-50 border-red-200 text-red-800';
            case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'low': return 'bg-green-50 border-green-200 text-green-800';
            default: return 'bg-gray-50 border-gray-200 text-gray-800';
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'excellent': return 'text-green-600';
            case 'good': return 'text-blue-600';
            case 'fair': return 'text-yellow-600';
            case 'poor': return 'text-red-600';
            case 'warning': return 'text-orange-600';
            case 'needs_improvement': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getSelectedPropertyName = () => {
        if (!propertyId) return '';
        const selectedProperty = properties.find(p => {
            const id = p.name.split('/').pop();
            return id === propertyId || p.name === propertyId;
        });
        return selectedProperty ? selectedProperty.displayName : '';
    };

    return (
        <div className="action-container action-rtl">
            <div className="action-header">
                <h1 className="action-title">ניתוח איכות תנועה - Google Analytics</h1>
                <p className="action-description">
                    גלה מאיפה מגיעה התנועה הכי איכותית לאתר שלך וקבל המלצות לשיפור
                </p>
            </div>

            {/* Controls */}
            <div className="action-controls">
                <div className="action-control-group">
                    <label className="action-control-label">נכס Analytics</label>
                    {loadingProperties ? (
                        <div className="action-select bg-gray-100">
                            <span className="text-gray-500">טוען נכסים...</span>
                        </div>
                    ) : properties.length > 0 ? (
                        <select
                            className="action-select"
                            value={propertyId}
                            onChange={(e) => setPropertyId(e.target.value)}
                        >
                            <option value="">בחר נכס Analytics</option>
                            {properties.map((property) => {
                                const propertyIdOnly = property.name.split('/').pop();
                                return (
                                    <option key={property.name} value={propertyIdOnly}>
                                        {property.displayName} {property.websiteUrl && `(${property.websiteUrl})`}
                                    </option>
                                );
                            })}
                        </select>
                    ) : (
                        <div className="action-error">
                            <p className="action-error-text">
                                לא נמצאו נכסי Analytics. ודא שאתה מחובר ל-Google Analytics ב
                                <Link href="/profile/integrations" className="text-blue-600 hover:underline mx-1">
                                    דף האינטגרציות
                                </Link>
                                או
                                <Link href="/action/google-auth" className="text-blue-600 hover:underline mr-1">
                                    התחבר כאן
                                </Link>
                            </p>
                        </div>
                    )}
                </div>
                <div className="action-control-group">
                    <label className="action-control-label">טווח תאריכים</label>
                    <select
                        className="action-select"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="7days">7 ימים אחרונים</option>
                        <option value="30days">30 ימים אחרונים</option>
                        <option value="90days">90 ימים אחרונים</option>
                    </select>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading || !propertyId || loadingProperties}
                    className={loading || !propertyId || loadingProperties ? 'action-btn-disabled' : 'action-btn-primary'}
                >
                    {loading ? 'טוען נתונים...' : 'עדכן נתונים'}
                </button>
                <button
                    onClick={fetchProperties}
                    disabled={loadingProperties}
                    className={loadingProperties ? 'action-btn-disabled' : 'action-btn-secondary'}
                >
                    {loadingProperties ? 'טוען...' : 'רענן נכסים'}
                </button>
            </div>

            {/* Show selected property info */}
            {propertyId && !loadingProperties && (
                <div className="action-card">
                    <div className="action-card-content">
                        <div className="text-sm text-gray-600">
                            נכס נבחר: <strong>{getSelectedPropertyName()}</strong>
                            <span className="text-gray-400 mr-2">(ID: {propertyId})</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="action-error">
                    <h3 className="action-error-title">שגיאה</h3>
                    <p className="action-error-text">{error}</p>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="action-loading">
                    <div className="action-loading-spinner"></div>
                    <span className="action-loading-text">טוען נתוני איכות תנועה...</span>
                </div>
            )}

            {/* Results */}
            {data && !loading && (
                <>
                    {/* Summary Cards */}
                    <div className="action-summary-grid">
                        <div className="action-summary-card">
                            <div className="action-summary-title">סך הכל ביקורים</div>
                            <div className="action-summary-value">{data.totalSessions?.toLocaleString() || 0}</div>
                        </div>
                        <div className="action-summary-card">
                            <div className="action-summary-title">מקורות תנועה</div>
                            <div className="action-summary-value">{data.trafficSources?.length || 0}</div>
                        </div>
                        <div className="action-summary-card">
                            <div className="action-summary-title">תקופה</div>
                            <div className="action-summary-value">
                                {dateRange === '7days' ? '7 ימים' :
                                    dateRange === '30days' ? '30 ימים' : '90 ימים'}
                            </div>
                        </div>
                        <div className="action-summary-card">
                            <div className="action-summary-title">מקור מוביל</div>
                            <div className="action-summary-value">
                                {data.trafficSources?.[0]?.source || 'לא זמין'}
                            </div>
                        </div>
                    </div>

                    {/* Traffic Sources Table */}
                    {data.trafficSources && data.trafficSources.length > 0 && (
                        <div className="action-card">
                            <div className="action-card-header">
                                <h2 className="action-card-title">מקורות תנועה לפי איכות</h2>
                            </div>
                            <div className="action-card-content">
                                <div className="action-table-container">
                                    <table className="action-table">
                                        <thead className="action-table-header">
                                            <tr>
                                                <th className="action-table-header-cell">ציון איכות</th>
                                                <th className="action-table-header-cell">המרות</th>
                                                <th className="action-table-header-cell">דפים/ביקור</th>
                                                <th className="action-table-header-cell">שיעור נטישה</th>
                                                <th className="action-table-header-cell">משך ביקור</th>
                                                <th className="action-table-header-cell">משתמשים</th>
                                                <th className="action-table-header-cell">ביקורים</th>
                                                <th className="action-table-header-cell">מקור התנועה</th>
                                            </tr>
                                        </thead>
                                        <tbody className="action-table-body">
                                            {data.trafficSources.map((source, index) => (
                                                <tr key={index} className="action-table-row">
                                                    <td className="action-table-cell">
                                                        <div className={`action-score ${getScoreClass(source.qualityScore)}`}>
                                                            {source.qualityScore}
                                                        </div>
                                                    </td>
                                                    <td className="action-table-cell">{source.conversions}</td>
                                                    <td className="action-table-cell">{source.pagesPerSession}</td>
                                                    <td className="action-table-cell">
                                                        <span className={`action-metric ${getMetricClass(100 - source.bounceRate)}`}>
                                                            {source.bounceRate}%
                                                        </span>
                                                    </td>
                                                    <td className="action-table-cell">{source.avgSessionDuration}</td>
                                                    <td className="action-table-cell">{source.users.toLocaleString()}</td>
                                                    <td className="action-table-cell">{source.sessions.toLocaleString()}</td>
                                                    <td className="action-table-cell">
                                                        <div>
                                                            <div className="font-medium">{source.source}</div>
                                                            <div className="text-sm text-gray-500">{source.sourceMedium}</div>
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

                    {/* Insights - FIXED: Now properly renders JSON */}
                    {data.insights && (
                        <div className="action-insights">
                            <h3 className="action-insights-title">
                                💡 תובנות מהנתונים
                            </h3>
                            <div className="action-insights-content">
                                {data.insights.summary && (
                                    <div className="mb-4 text-gray-600 text-sm">
                                        {data.insights.summary}
                                    </div>
                                )}
                                {data.insights.items && data.insights.items.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.insights.items.map((insight, index) => (
                                            <div key={index} className="flex items-start space-x-3 space-x-reverse p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <span className="text-xl">{insight.icon}</span>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-blue-900 mb-1">
                                                        {insight.title}
                                                    </div>
                                                    <div className={`text-sm ${getStatusClass(insight.status || 'default')}`}>
                                                        {insight.message}
                                                    </div>
                                                    {/* Additional data visualization */}
                                                    {insight.type === 'overview' && insight.value && (
                                                        <div className="mt-2 text-xs text-gray-500">
                                                            {insight.value.toLocaleString()} {insight.metric} ב{insight.period}
                                                        </div>
                                                    )}
                                                    {insight.type === 'top_source' && (
                                                        <div className="mt-2 flex space-x-4 space-x-reverse text-xs text-gray-600">
                                                            <span>ציון: {insight.qualityScore}</span>
                                                            <span>אחוז: {insight.percentage}%</span>
                                                            <span>ביקורים: {insight.sessions?.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {insight.type === 'conversions' && (
                                                        <div className="mt-2 flex space-x-4 space-x-reverse text-xs text-gray-600">
                                                            <span>המרות: {insight.totalConversions}</span>
                                                            <span>שיעור מקור מוביל: {insight.bestSourceRate}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500">אין תובנות זמינות</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Recommendations - FIXED: Now properly renders JSON */}
                    {data.recommendations && (
                        <div className="action-recommendations">
                            <h3 className="action-recommendations-title">
                                🎯 המלצות לפעולה
                            </h3>
                            <div className="action-recommendations-content">
                                {data.recommendations.summary && (
                                    <div className="mb-4 text-gray-600 text-sm">
                                        {data.recommendations.summary}
                                    </div>
                                )}
                                {data.recommendations.items && data.recommendations.items.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.recommendations.items.map((recommendation, index) => (
                                            <div key={index} className={`p-4 rounded-lg border ${getPriorityClass(recommendation.priority)}`}>
                                                <div className="flex items-start space-x-3 space-x-reverse">
                                                    <span className="text-xl">{recommendation.icon}</span>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-semibold">
                                                                {recommendation.title}
                                                            </div>
                                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${recommendation.priority === 'high' ? 'bg-red-100 text-red-800' :
                                                                recommendation.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-green-100 text-green-800'
                                                                }`}>
                                                                {recommendation.priority === 'high' ? 'עדיפות גבוהה' :
                                                                    recommendation.priority === 'medium' ? 'עדיפות בינונית' :
                                                                        'עדיפות נמוכה'}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm mb-2">
                                                            {recommendation.description}
                                                        </div>
                                                        {/* Additional recommendation data */}
                                                        {recommendation.type === 'optimize' && (
                                                            <div className="text-xs text-gray-600 mt-2">
                                                                ציון נוכחי: {recommendation.qualityScore} |
                                                                ביקורים: {recommendation.sessions?.toLocaleString()}
                                                            </div>
                                                        )}
                                                        {recommendation.type === 'bounce_rate' && (
                                                            <div className="text-xs text-gray-600 mt-2">
                                                                שיעור נטישה: {recommendation.bounceRate}% |
                                                                ביקורים: {recommendation.sessions?.toLocaleString()}
                                                            </div>
                                                        )}
                                                        {recommendation.type === 'tracking' && recommendation.sources && (
                                                            <div className="text-xs text-gray-600 mt-2">
                                                                מקורות ללא מעקב: {recommendation.sources.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500">אין המלצות זמינות</p>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
} 