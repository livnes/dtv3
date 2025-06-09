export default function TrafficQualityResults({ data, selectedPropertyId, dateRange, properties }) {
    if (!data || !selectedPropertyId) {
        return null;
    }

    if (!data.success) {
        return (
            <div className="action-error">
                <h3 className="action-error-title">שגיאה</h3>
                <p className="action-error-text">{data.error || 'שגיאה בטעינת הנתונים'}</p>
            </div>
        );
    }

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

    return (
        <>
            {/* Summary Cards */}
            <div className="action-summary-grid">
                <div className="action-summary-card">
                    <div className="action-summary-title">סך הכל ביקורים</div>
                    <div className="action-summary-value">{data.data?.totalSessions?.toLocaleString() || 0}</div>
                </div>
                <div className="action-summary-card">
                    <div className="action-summary-title">מקורות תנועה</div>
                    <div className="action-summary-value">{data.data?.trafficSources?.length || 0}</div>
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
                        {data.data?.trafficSources?.[0]?.source || 'לא זמין'}
                    </div>
                </div>
            </div>

            {/* Traffic Sources Table */}
            {data.data?.trafficSources && data.data.trafficSources.length > 0 && (
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
                                    {data.data.trafficSources.map((source, index) => (
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
            {data.data?.insights && (
                <div className="action-insights">
                    <h3 className="action-insights-title">
                        💡 תובנות מהנתונים
                    </h3>
                    <div className="action-insights-content">
                        {data.data.insights.summary && (
                            <div className="mb-4 text-gray-600 text-sm">
                                {data.data.insights.summary}
                            </div>
                        )}
                        {data.data.insights.items && data.data.insights.items.length > 0 ? (
                            <div className="space-y-3">
                                {data.data.insights.items.map((insight, index) => (
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
            {data.data?.recommendations && (
                <div className="action-recommendations">
                    <h3 className="action-recommendations-title">
                        🎯 המלצות לפעולה
                    </h3>
                    <div className="action-recommendations-content">
                        {data.data.recommendations.summary && (
                            <div className="mb-4 text-gray-600 text-sm">
                                {data.data.recommendations.summary}
                            </div>
                        )}
                        {data.data.recommendations.items && data.data.recommendations.items.length > 0 ? (
                            <div className="space-y-3">
                                {data.data.recommendations.items.map((recommendation, index) => (
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
    );
} 