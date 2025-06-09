'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export default function TrafficSourcesPage() {
    const { data: session } = useSession();
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState('');
    const [dateRange, setDateRange] = useState('30days');
    const [trafficData, setTrafficData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingProperties, setLoadingProperties] = useState(true);
    const [error, setError] = useState('');

    // Fetch Analytics properties on component mount
    useEffect(() => {
        fetchProperties();
    }, []);

    // Auto-fetch traffic data when component loads
    useEffect(() => {
        if (!loadingProperties) {
            fetchTrafficData();
        }
    }, [loadingProperties, fetchTrafficData]);

    const fetchProperties = async () => {
        try {
            setLoadingProperties(true);
            setError('');

            const response = await fetch('/api/analytics/properties', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                setProperties(result.properties);
                // Auto-select first property if available
                if (result.properties.length > 0) {
                    setSelectedProperty(result.properties[0].name);
                }
            } else {
                setError(result.error || 'שגיאה בטעינת נכסי Analytics');
            }
        } catch (error) {
            console.error('Error fetching properties:', error);
            setError('שגיאה בחיבור לשרת');
        } finally {
            setLoadingProperties(false);
        }
    };

    const fetchTrafficData = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            // Build query parameters
            const params = new URLSearchParams({
                date_range: dateRange
            });

            if (selectedProperty) {
                params.append('property_id', selectedProperty);
            }

            const response = await fetch(`/api/analytics/traffic-quality-cached?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                setTrafficData(result);
            } else if (result.status === 'importing') {
                setError('הנתונים נטענים כרגע. אנא המתן מספר דקות ונסה שוב.');
            } else if (result.status === 'no_data') {
                setError('אין נתונים זמינים לטווח התאריכים הנבחר.');
            } else {
                setError(result.error || 'שגיאה בטעינת נתוני התנועה');
            }
        } catch (error) {
            console.error('Error fetching traffic data:', error);
            setError('שגיאה בחיבור לשרת');
        } finally {
            setLoading(false);
        }
    }, [dateRange, selectedProperty]);

    const formatNumber = (num) => {
        return new Intl.NumberFormat('he-IL').format(num);
    };

    const getQualityColor = (score) => {
        if (score >= 80) return 'text-green-600 bg-green-50';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    if (!session) {
        return <div className="text-center p-8">טוען...</div>;
    }

    return (
        <>
            {/* Header Section */}
            <div className="main-header">
                <h1 className="welcome-title">
                    מקורות תנועה איכותיים
                </h1>
                <p className="welcome-subtitle">
                    גלה איזה מקורות מביאים את המבקרים הכי איכותיים לאתר שלך
                </p>
            </div>

            <div className="analysis-section">

                {/* Property Selection */}
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">הגדרות ניתוח</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Property Selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                נכס Analytics
                            </label>
                            {loadingProperties ? (
                                <div className="animate-pulse bg-gray-200 h-10 rounded-md"></div>
                            ) : (
                                <select
                                    value={selectedProperty}
                                    onChange={(e) => setSelectedProperty(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">בחר נכס</option>
                                    {properties.map((property) => (
                                        <option key={property.name} value={property.name}>
                                            {property.displayName} ({property.accountName})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Date Range Selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                טווח תאריכים
                            </label>
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="7days">7 ימים אחרונים</option>
                                <option value="30days">30 ימים אחרונים</option>
                                <option value="90days">90 ימים אחרונים</option>
                            </select>
                        </div>

                        {/* Analyze Button */}
                        <div className="flex items-end">
                            <button
                                onClick={fetchTrafficData}
                                disabled={loading || loadingProperties}
                                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'טוען נתונים...' : 'הצג נתוני תנועה'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-6">
                        {error}
                    </div>
                )}

                {/* Traffic Data Display */}
                {trafficData && (
                    <div className="space-y-6">
                        {/* Cache Status */}
                        {trafficData.cache_info && (
                            <div className="bg-gray-50 rounded-lg border p-4">
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                    <span className="flex items-center">
                                        ⚡ נתונים מהירים מהמטמון
                                    </span>
                                    <span>
                                        עדכון אחרון: {new Date(trafficData.cache_info.last_updated).toLocaleString('he-IL')}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-xl font-semibold mb-4">סיכום התקופה</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {formatNumber(trafficData.total_sessions)}
                                    </div>
                                    <div className="text-sm text-gray-600">סה&quot;כ ביקורים</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                        {trafficData.traffic_sources.length}
                                    </div>
                                    <div className="text-sm text-gray-600">מקורות תנועה</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm text-gray-600">
                                        {trafficData.date_range.start_date} - {trafficData.date_range.end_date}
                                    </div>
                                    <div className="text-sm text-gray-600">טווח התאריכים</div>
                                </div>
                            </div>
                        </div>

                        {/* Traffic Sources Table */}
                        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                            <div className="p-6 border-b">
                                <h2 className="text-xl font-semibold">מקורות התנועה</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                מקור
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                ציון איכות
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                ביקורים
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                זמן ממוצע
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                שיעור נטישה
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                דפים לביקור
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {trafficData.traffic_sources.map((source, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {source.source}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {source.source_medium}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getQualityColor(source.quality_score)}`}>
                                                        {source.quality_score}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {formatNumber(source.sessions)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {source.avg_session_duration}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {source.bounce_rate}%
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {source.pages_per_session}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Insights */}
                        {trafficData.insights && (
                            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                                    🧠 תובנות מהנתונים
                                </h3>
                                <div
                                    className="text-blue-800"
                                    dangerouslySetInnerHTML={{ __html: trafficData.insights }}
                                />
                            </div>
                        )}

                        {/* Recommendations */}
                        {trafficData.recommendations && (
                            <div className="bg-green-50 rounded-lg border border-green-200 p-6">
                                <h3 className="text-lg font-semibold text-green-900 mb-3">
                                    💡 המלצות לשיפור
                                </h3>
                                <div
                                    className="text-green-800"
                                    dangerouslySetInnerHTML={{ __html: trafficData.recommendations }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
} 