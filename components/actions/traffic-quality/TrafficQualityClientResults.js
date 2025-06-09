'use client';

import { useState, useEffect, useCallback } from 'react';
import TrafficQualityResults from './TrafficQualityResults';

export default function TrafficQualityClientResults({ selectedPropertyId, dateRange, userId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);


    const fetchData = useCallback(async () => {
        if (!selectedPropertyId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/action/traffic-quality?propertyId=${selectedPropertyId}&dateRange=${dateRange}`);
            const result = await response.json();

            if (result.success) {
                setData(result);
            } else {
                if (result.backfillTriggered) {
                    setError({
                        message: result.message,
                        shouldRetry: true,
                        backfillTriggered: true
                    });
                } else {
                    setError({ message: result.error });
                }
            }
        } catch (err) {
            console.error('Error fetching traffic data:', err);
            setError({ message: 'שגיאה בטעינת הנתונים' });
        } finally {
            setLoading(false);
        }
    }, [selectedPropertyId, dateRange]);

    // Fetch data when property or date range changes
    useEffect(() => {
        if (selectedPropertyId) {
            fetchData();
        } else {
            setData(null);
            setError(null);
        }
    }, [selectedPropertyId, dateRange, fetchData]);


    if (!selectedPropertyId) {
        return (
            <div className="action-card">
                <div className="action-card-content">
                    <p className="text-gray-600 text-center">
                        בחר נכס Analytics כדי לראות ניתוח איכות התנועה
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="action-loading">
                <div className="action-loading-spinner"></div>
                <span className="action-loading-text">טוען נתוני איכות תנועה...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="action-error">
                <h3 className="action-error-title">שגיאה</h3>
                <p className="action-error-text">{error.message}</p>

                {error.backfillTriggered && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-800">
                            <p className="font-medium mb-2">🔄 מתחיל בתהליך יבוא נתונים</p>
                            <p>התהליך עשוי לקחת כמה דקות. לחץ על &quot;עדכן נתונים&quot; בעוד 2-3 דקות.</p>
                            <button
                                onClick={fetchData}
                                className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                            >
                                בדוק שוב
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <TrafficQualityResults
            data={data}
            selectedPropertyId={selectedPropertyId}
            dateRange={dateRange}
        />
    );
} 