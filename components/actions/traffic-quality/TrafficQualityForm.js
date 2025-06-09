'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';

export default function TrafficQualityForm({ properties = [], selectedPropertyId, dateRange, userId }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [refreshing, setRefreshing] = useState(false);

    const handlePropertyChange = (newPropertyId) => {
        const params = new URLSearchParams(searchParams);
        if (newPropertyId) {
            params.set('propertyId', newPropertyId);
        } else {
            params.delete('propertyId');
        }

        startTransition(() => {
            router.push(`?${params.toString()}`);
        });
    };

    const handleDateRangeChange = (newDateRange) => {
        const params = new URLSearchParams(searchParams);
        params.set('dateRange', newDateRange);

        startTransition(() => {
            router.push(`?${params.toString()}`);
        });
    };

    const handleRefreshData = async () => {
        if (!selectedPropertyId) return;

        setRefreshing(true);
        try {
            // Call the API endpoint to fetch fresh data
            const response = await fetch(`/api/action/traffic-quality?propertyId=${selectedPropertyId}&dateRange=${dateRange}&refresh=${Date.now()}`);
            const result = await response.json();

            if (result.success || result.backfillTriggered) {
                // Force page refresh to show new data
                startTransition(() => {
                    router.refresh();
                });
            } else {
                console.error('Failed to refresh data:', result.error);
                // Still refresh the page to show any updated error messages
                startTransition(() => {
                    router.refresh();
                });
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            // Fallback to page refresh
            startTransition(() => {
                router.refresh();
            });
        } finally {
            setRefreshing(false);
        }
    };

    const handleRefreshProperties = async () => {
        setRefreshing(true);
        try {
            // Force page refresh to re-fetch properties
            startTransition(() => {
                router.refresh();
            });
        } catch (error) {
            console.error('Error refreshing properties:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const getSelectedPropertyName = () => {
        if (!selectedPropertyId) return '';
        const selectedProperty = properties.find(p => {
            const id = p.id || p.name?.split('/').pop();
            return id === selectedPropertyId || p.name === selectedPropertyId;
        });
        return selectedProperty ? selectedProperty.displayName : '';
    };

    return (
        <>
            {/* Controls */}
            <div className="action-controls">
                <div className="action-control-group">
                    <label className="action-control-label">נכס Analytics</label>
                    {properties.length > 0 ? (
                        <select
                            className="action-select"
                            value={selectedPropertyId}
                            onChange={(e) => handlePropertyChange(e.target.value)}
                            disabled={isPending}
                        >
                            <option value="">בחר נכס Analytics</option>
                            {properties.map((property) => {
                                const propertyIdOnly = property.id || property.name?.split('/').pop();
                                return (
                                    <option key={property.id || property.name} value={propertyIdOnly}>
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
                        onChange={(e) => handleDateRangeChange(e.target.value)}
                        disabled={isPending}
                    >
                        <option value="7days">7 ימים אחרונים</option>
                        <option value="30days">30 ימים אחרונים</option>
                        <option value="90days">90 ימים אחרונים</option>
                    </select>
                </div>

                <button
                    onClick={handleRefreshData}
                    disabled={isPending || refreshing || !selectedPropertyId}
                    className={isPending || refreshing || !selectedPropertyId ? 'action-btn-disabled' : 'action-btn-primary'}
                >
                    {isPending || refreshing ? 'טוען נתונים...' : 'עדכן נתונים'}
                </button>

                <button
                    onClick={handleRefreshProperties}
                    disabled={isPending || refreshing}
                    className={isPending || refreshing ? 'action-btn-disabled' : 'action-btn-secondary'}
                >
                    {isPending || refreshing ? 'טוען...' : 'רענן נכסים'}
                </button>
            </div>

            {/* Show selected property info */}
            {selectedPropertyId && (
                <div className="action-card">
                    <div className="action-card-content">
                        <div className="text-sm text-gray-600">
                            נכס נבחר: <strong>{getSelectedPropertyName()}</strong>
                            <span className="text-gray-400 mr-2">(ID: {selectedPropertyId})</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
} 