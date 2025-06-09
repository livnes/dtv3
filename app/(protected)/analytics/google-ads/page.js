'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function GoogleAdsAnalytics() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [performanceData, setPerformanceData] = useState(null);
    const [dateRange, setDateRange] = useState(30);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        if (selectedAccount) {
            fetchPerformanceData();
        }
    }, [selectedAccount, dateRange, fetchPerformanceData]);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/analytics/google-ads-accounts');
            const data = await response.json();

            if (data.success && data.accounts.length > 0) {
                setAccounts(data.accounts);
                setSelectedAccount(data.accounts[0].customerId);
            } else {
                setError(data.error || 'לא נמצאו חשבונות Google Ads');
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            setError('שגיאה בטעינת חשבונות');
        } finally {
            setLoading(false);
        }
    };

    const fetchPerformanceData = useCallback(async () => {
        if (!selectedAccount) return;

        try {
            setLoading(true);
            const response = await fetch(
                `/api/analytics/google-ads-performance?customerId=${selectedAccount}&days=${dateRange}`
            );
            const data = await response.json();

            if (data.success) {
                setPerformanceData(data.data);
            } else {
                setError(data.error || 'שגיאה בטעינת נתוני ביצועים');
            }
        } catch (error) {
            console.error('Error fetching performance data:', error);
            setError('שגיאה בטעינת נתוני ביצועים');
        } finally {
            setLoading(false);
        }
    }, [selectedAccount, dateRange]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('he-IL', {
            style: 'currency',
            currency: 'ILS',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('he-IL').format(num);
    };

    const formatPercentage = (num) => {
        return `${(num * 100).toFixed(2)}%`;
    };

    if (loading && !performanceData) {
        return (
            <div className="min-h-screen bg-gray-50" dir="rtl">
                <div className="container mx-auto px-6 py-8">
                    <div className="flex items-center justify-center min-h-96">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">טוען נתוני Google Ads...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50" dir="rtl">
                <div className="container mx-auto px-6 py-8">
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                        <div className="mb-4">
                            <i className="fas fa-exclamation-triangle text-red-500 text-4xl"></i>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">שגיאה בטעינת נתונים</h2>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <button
                            onClick={() => router.push('/profile/integrations')}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            חזור להגדרות חיבורים
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            <i className="fab fa-google text-red-500 ml-3"></i>
                            ניתוח Google Ads
                        </h1>
                        <p className="text-gray-600">ביצועי קמפיינים ומודעות משולמות</p>
                    </div>

                    <div className="flex gap-4">
                        {/* Account Selector */}
                        <select
                            value={selectedAccount || ''}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            {accounts.map(account => (
                                <option key={account.customerId} value={account.customerId}>
                                    {account.name}
                                </option>
                            ))}
                        </select>

                        {/* Date Range Selector */}
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(parseInt(e.target.value))}
                            className="bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={7}>7 ימים אחרונים</option>
                            <option value={30}>30 ימים אחרונים</option>
                            <option value={90}>90 ימים אחרונים</option>
                        </select>
                    </div>
                </div>

                {performanceData && (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">סך הוצאות</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {formatCurrency(performanceData.summary.totalCost)}
                                        </p>
                                    </div>
                                    <div className="bg-red-100 p-3 rounded-full">
                                        <i className="fas fa-shekel-sign text-red-600"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">סך קליקים</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {formatNumber(performanceData.summary.totalClicks)}
                                        </p>
                                    </div>
                                    <div className="bg-blue-100 p-3 rounded-full">
                                        <i className="fas fa-mouse-pointer text-blue-600"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">CTR ממוצע</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {formatPercentage(performanceData.summary.avgCtr)}
                                        </p>
                                    </div>
                                    <div className="bg-green-100 p-3 rounded-full">
                                        <i className="fas fa-percentage text-green-600"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">המרות</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {formatNumber(performanceData.summary.totalConversions)}
                                        </p>
                                    </div>
                                    <div className="bg-purple-100 p-3 rounded-full">
                                        <i className="fas fa-bullseye text-purple-600"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Campaigns Performance Table */}
                        <div className="bg-white rounded-lg shadow-sm mb-8">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900">קמפיינים מובילים</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                שם קמפיין
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                הוצאה
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                קליקים
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                CTR
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                CPC
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                המרות
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {performanceData.campaigns.map((campaign, index) => (
                                            <tr key={campaign.campaignId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {campaign.campaignName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatCurrency(campaign.cost)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatNumber(campaign.clicks)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {campaign.ctr.toFixed(2)}%
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatCurrency(campaign.cpc)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatNumber(campaign.conversions)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Insights and Recommendations */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Insights */}
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                    <i className="fas fa-lightbulb text-yellow-500 ml-2"></i>
                                    תובנות
                                </h3>
                                {performanceData.insights.length > 0 ? (
                                    <ul className="space-y-3">
                                        {performanceData.insights.map((insight, index) => (
                                            <li key={index} className="flex items-start">
                                                <i className="fas fa-check-circle text-green-500 ml-2 mt-1"></i>
                                                <span className="text-gray-700">{insight}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500">אין תובנות זמינות</p>
                                )}
                            </div>

                            {/* Recommendations */}
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                    <i className="fas fa-rocket text-blue-500 ml-2"></i>
                                    המלצות לשיפור
                                </h3>
                                {performanceData.recommendations.length > 0 ? (
                                    <ul className="space-y-3">
                                        {performanceData.recommendations.map((recommendation, index) => (
                                            <li key={index} className="flex items-start">
                                                <i className="fas fa-arrow-up text-blue-500 ml-2 mt-1"></i>
                                                <span className="text-gray-700">{recommendation}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500">אין המלצות זמינות</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
} 