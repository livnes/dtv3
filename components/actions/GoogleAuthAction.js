'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function GoogleAuthAction({ userId, error, setError }) {
    const [integrationStatus, setIntegrationStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [analyticsProperties, setAnalyticsProperties] = useState([]);
    const [searchConsoleSites, setSearchConsoleSites] = useState([]);
    const router = useRouter();

    useEffect(() => {
        fetchIntegrationStatus();
    }, [fetchIntegrationStatus]);

    const fetchIntegrationStatus = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/action/google-status');
            const result = await response.json();

            if (result.success) {
                setIntegrationStatus(result.data);
                if (result.data.isConnected) {
                    await fetchGoogleData();
                }
            } else {
                setError(result.error || 'Failed to fetch integration status');
            }
        } catch (err) {
            console.error('Error fetching integration status:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [setError]);

    const fetchGoogleData = async () => {
        try {
            const [analyticsRes, searchConsoleRes] = await Promise.all([
                fetch('/api/action/analytics-properties'),
                fetch('/api/action/search-console-sites')
            ]);

            const analyticsResult = await analyticsRes.json();
            const searchConsoleResult = await searchConsoleRes.json();

            if (analyticsResult.success) {
                setAnalyticsProperties(analyticsResult.data);
            }

            if (searchConsoleResult.success) {
                setSearchConsoleSites(searchConsoleResult.data);
            }
        } catch (err) {
            console.error('Error fetching Google data:', err);
        }
    };

    const initiateGoogleAuth = async () => {
        setConnecting(true);
        setError(null);

        try {
            // Store the current URL to redirect back after auth
            sessionStorage.setItem('auth_redirect_url', window.location.href);

            // Redirect to Google OAuth
            window.location.href = '/api/action/google-auth';
        } catch (err) {
            console.error('Error initiating Google auth:', err);
            setError(err.message);
            setConnecting(false);
        }
    };

    const disconnectGoogle = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/action/google-disconnect', {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                setIntegrationStatus(null);
                setAnalyticsProperties([]);
                setSearchConsoleSites([]);
            } else {
                setError(result.error || 'Failed to disconnect Google account');
            }
        } catch (err) {
            console.error('Error disconnecting Google:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const refreshConnection = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/action/google-refresh', {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                await fetchIntegrationStatus();
            } else {
                setError(result.error || 'Failed to refresh connection');
            }
        } catch (err) {
            console.error('Error refreshing connection:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString() + ' ' +
            new Date(dateString).toLocaleTimeString();
    };

    const getStatusBadge = (isConnected, hasError) => {
        if (hasError) {
            return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Error</span>;
        }
        if (isConnected) {
            return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Connected</span>;
        }
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Disconnected</span>;
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🔐 Google API Integration
                </h2>
                <p className="text-gray-600">
                    Connect your Google Analytics and Search Console accounts to access advanced SEO and traffic analysis features.
                </p>
            </div>

            {/* Connection Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h3>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                        <span className="text-gray-600">Checking connection status...</span>
                    </div>
                ) : integrationStatus ? (
                    <div className="space-y-4">
                        {/* Overall Status */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <h4 className="font-medium text-gray-900">Google Account</h4>
                                <p className="text-sm text-gray-600">
                                    {integrationStatus.userEmail || 'Connected'}
                                </p>
                            </div>
                            <div className="flex items-center space-x-3">
                                {getStatusBadge(integrationStatus.isConnected, integrationStatus.hasError)}
                                <span className="text-sm text-gray-500">
                                    Last updated: {formatDate(integrationStatus.lastUpdated)}
                                </span>
                            </div>
                        </div>

                        {/* Service Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Analytics Status */}
                            <div className="p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium text-gray-900">📊 Google Analytics</h5>
                                    {getStatusBadge(
                                        integrationStatus.analyticsConnected,
                                        integrationStatus.analyticsError
                                    )}
                                </div>
                                <p className="text-sm text-gray-600">
                                    {integrationStatus.analyticsConnected
                                        ? `${analyticsProperties.length} properties available`
                                        : 'Not connected'
                                    }
                                </p>
                                {integrationStatus.analyticsError && (
                                    <p className="text-xs text-red-600 mt-1">
                                        {integrationStatus.analyticsError}
                                    </p>
                                )}
                            </div>

                            {/* Search Console Status */}
                            <div className="p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium text-gray-900">🔍 Search Console</h5>
                                    {getStatusBadge(
                                        integrationStatus.searchConsoleConnected,
                                        integrationStatus.searchConsoleError
                                    )}
                                </div>
                                <p className="text-sm text-gray-600">
                                    {integrationStatus.searchConsoleConnected
                                        ? `${searchConsoleSites.length} sites available`
                                        : 'Not connected'
                                    }
                                </p>
                                {integrationStatus.searchConsoleError && (
                                    <p className="text-xs text-red-600 mt-1">
                                        {integrationStatus.searchConsoleError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-4 pt-4">
                            {integrationStatus.isConnected ? (
                                <>
                                    <button
                                        onClick={refreshConnection}
                                        disabled={loading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {loading ? 'Refreshing...' : 'Refresh Connection'}
                                    </button>
                                    <button
                                        onClick={disconnectGoogle}
                                        disabled={loading}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {loading ? 'Disconnecting...' : 'Disconnect'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={initiateGoogleAuth}
                                    disabled={connecting}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {connecting ? 'Connecting...' : 'Connect Google Account'}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="mb-4">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <p className="text-gray-600 mb-4">No Google account connected</p>
                        <button
                            onClick={initiateGoogleAuth}
                            disabled={connecting}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {connecting ? 'Connecting...' : 'Connect Google Account'}
                        </button>
                    </div>
                )}
            </div>

            {/* Analytics Properties */}
            {analyticsProperties.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Available Analytics Properties</h3>
                    <div className="space-y-3">
                        {analyticsProperties.map((property, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">{property.displayName}</h4>
                                    <p className="text-sm text-gray-600">ID: {property.name}</p>
                                    {property.websiteUrl && (
                                        <p className="text-sm text-blue-600">{property.websiteUrl}</p>
                                    )}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {property.createTime && formatDate(property.createTime)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search Console Sites */}
            {searchConsoleSites.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Available Search Console Sites</h3>
                    <div className="space-y-3">
                        {searchConsoleSites.map((site, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">{site.siteUrl}</h4>
                                    <div className="flex items-center mt-1">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${site.permissionLevel === 'siteOwner' ? 'bg-green-100 text-green-800' :
                                            site.permissionLevel === 'siteFullUser' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {site.permissionLevel}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Setup Instructions */}
            {!integrationStatus?.isConnected && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Setup Instructions</h3>
                    <div className="prose prose-sm max-w-none text-gray-700">
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Click &quot;Connect Google Account&quot; to start the OAuth flow</li>
                            <li>Grant permissions for Google Analytics and Search Console</li>
                            <li>You&apos;ll be redirected back to this page after successful authentication</li>
                            <li>Once connected, you can access traffic quality analysis and keyword insights</li>
                        </ol>

                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Required Permissions:</h4>
                            <ul className="list-disc list-inside space-y-1 text-blue-800">
                                <li>Google Analytics: Read access to your Analytics data</li>
                                <li>Google Search Console: Read access to your Search Console data</li>
                                <li>Profile: Basic profile information for account identification</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 