'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function KeywordsForm({ sites, selectedSiteUrl: initialSiteUrl, userId }) {
    const [siteUrl, setSiteUrl] = useState(initialSiteUrl || '');
    const [dateRange, setDateRange] = useState('30days');
    const [loadingSites, setLoadingSites] = useState(false);

    const formatSiteUrl = (url) => {
        return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        // Trigger the client results component to fetch data
        window.dispatchEvent(new CustomEvent('keywords-form-submit', {
            detail: { siteUrl, dateRange }
        }));
    };

    return (
        <div className="action-controls">
            <form onSubmit={handleFormSubmit}>
                <div className="action-control-group">
                    <label className="action-control-label">אתר מ-Search Console</label>
                    {sites.length > 0 ? (
                        <select
                            className="action-select"
                            value={siteUrl}
                            onChange={(e) => setSiteUrl(e.target.value)}
                        >
                            <option value="">בחר אתר מ-Search Console</option>
                            {sites.map((site) => (
                                <option key={site.siteUrl} value={site.siteUrl}>
                                    {formatSiteUrl(site.siteUrl)}
                                    {site.permissionLevel && site.permissionLevel !== 'siteOwner' &&
                                        ` (${site.permissionLevel})`}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="action-error">
                            <p className="action-error-text">
                                לא נמצאו אתרים ב-Search Console. ודא שאתה מחובר ל-Google Search Console ב
                                <Link href="/profile/integrations" className="text-blue-600 hover:underline mx-1">
                                    דף האינגטציות
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
                    type="submit"
                    disabled={!siteUrl}
                    className={!siteUrl ? 'action-btn-disabled' : 'action-btn-primary'}
                >
                    נתח מילות מפתח
                </button>
            </form>

            {siteUrl && (
                <div className="action-card mt-4">
                    <div className="action-card-content">
                        <div className="text-sm text-gray-600">
                            אתר נבחר: <strong>{formatSiteUrl(siteUrl)}</strong>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 