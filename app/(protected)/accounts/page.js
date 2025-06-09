'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function AccountsPage() {
    const { data: session } = useSession();
    const [analyticsAccounts, setAnalyticsAccounts] = useState([]);
    const [searchConsoleAccounts, setSearchConsoleAccounts] = useState([]);
    const [facebookAccounts, setFacebookAccounts] = useState([]);
    const [googleConnected, setGoogleConnected] = useState(false);
    const [facebookConnected, setFacebookConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(null);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (session?.user) {
            fetchAccounts();
        }
    }, [session]);

    const fetchAccounts = async () => {
        try {
            setLoading(true);

            // Mock data that matches the original Flask template structure
            setGoogleConnected(true);
            setFacebookConnected(false);

            setAnalyticsAccounts([
                {
                    id: 1,
                    account_name: 'פרי גנך - GA4',
                    account_id: '360741272',
                    website_url: 'https://perigann.co.il',
                    is_active: true
                },
                {
                    id: 2,
                    account_name: 'אתר נוסף - GA4',
                    account_id: '123456789',
                    website_url: 'https://example.co.il',
                    is_active: false
                }
            ]);

            setSearchConsoleAccounts([
                {
                    id: 3,
                    account_name: 'Google Search Console',
                    account_id: 'sc-1',
                    website_url: 'https://perigann.co.il',
                    is_active: true
                }
            ]);

            setFacebookAccounts([
                {
                    id: 4,
                    account_name: 'Facebook Business Account',
                    account_id: 'fb-1',
                    is_active: false
                }
            ]);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAccount = async (accountId) => {
        try {
            setToggling(accountId);

            // Simulate API call
            setTimeout(() => {
                // Update the account's active status
                setAnalyticsAccounts(prev =>
                    prev.map(acc =>
                        acc.id === accountId
                            ? { ...acc, is_active: !acc.is_active }
                            : acc
                    )
                );
                setSearchConsoleAccounts(prev =>
                    prev.map(acc =>
                        acc.id === accountId
                            ? { ...acc, is_active: !acc.is_active }
                            : acc
                    )
                );
                setFacebookAccounts(prev =>
                    prev.map(acc =>
                        acc.id === accountId
                            ? { ...acc, is_active: !acc.is_active }
                            : acc
                    )
                );
                setToggling(null);
                setMessage({ type: 'success', text: 'סטטוס החשבון עודכן בהצלחה' });
                setTimeout(() => setMessage(null), 3000);
            }, 1000);
        } catch (error) {
            console.error('Error toggling account:', error);
            setMessage({ type: 'error', text: 'שגיאה בעדכון החשבון' });
            setToggling(null);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const reconnectGoogle = () => {
        if (confirm('האם אתה בטוח שברצונך להתחבר מחדש לGoogle?')) {
            window.location.href = '/api/auth/google';
        }
    };

    const reconnectFacebook = () => {
        if (confirm('האם אתה בטוח שברצונך להתחבר מחדש לFacebook?')) {
            window.location.href = '/api/auth/facebook';
        }
    };

    const refreshAccounts = () => {
        setLoading(true);
        fetchAccounts();
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">טוען חשבונות...</p>
            </div>
        );
    }

    return (
        <>
            {/* Flash Messages */}
            {message && (
                <div className="flash-messages">
                    <div className={`flash-message ${message.type}`}>
                        <i className={`fas fa-${message.type === 'error' ? 'exclamation-triangle' : message.type === 'warning' ? 'exclamation-circle' : message.type === 'info' ? 'info-circle' : 'check-circle'} me-2`}></i>
                        {message.text}
                        <button
                            type="button"
                            onClick={() => setMessage(null)}
                            className="flash-close"
                        >×</button>
                    </div>
                </div>
            )}

            {/* Main Header */}
            <div className="main-header">
                <h1 className="welcome-title">ניהול חשבונות</h1>
                <p className="welcome-subtitle">בחר את החשבונות שברצונך לחבר לדשבורד שלך</p>
            </div>

            {/* Account Management Section */}
            <div className="analysis-section">
                {/* Action Header */}
                <div className="action-header">
                    <div className="action-header-content">
                        <h3>חיבור חשבונות</h3>
                        <p>חבר את חשבונות Google ו-Facebook כדי להתחיל לקבל תובנות</p>
                    </div>
                    <button onClick={refreshAccounts} className="btn btn-outline">
                        <i className="fas fa-sync"></i>
                        רענן חשבונות
                    </button>
                </div>

                {/* Connection Status Cards */}
                <div className="cards-grid">
                    {/* Google Services Card */}
                    <div className="insight-card">
                        <div className="platform-header">
                            <div className="platform-brand">
                                <div className="platform-icon google">
                                    <i className="fab fa-google"></i>
                                </div>
                                <div className="platform-details">
                                    <h6>Google Services</h6>
                                    <p>Analytics & Search Console</p>
                                </div>
                            </div>

                            {googleConnected ? (
                                <span className="status-badge connected">
                                    <i className="fas fa-check"></i>מחובר
                                </span>
                            ) : (
                                <span className="status-badge disconnected">
                                    <i className="fas fa-times"></i>לא מחובר
                                </span>
                            )}
                        </div>

                        {!googleConnected ? (
                            <>
                                <div className="warning-box">
                                    <p className="warning-text">
                                        <i className="fas fa-exclamation-triangle"></i>
                                        יש להתחבר לGoogle כדי לנהל חשבונות Analytics ו-Search Console
                                    </p>
                                </div>
                                <button
                                    onClick={() => window.location.href = '/api/auth/google'}
                                    className="btn btn-google button-full-width"
                                >
                                    <i className="fab fa-google"></i>
                                    התחבר לGoogle
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <div className="stat-number">{analyticsAccounts.length}</div>
                                        <div className="stat-label">Analytics</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-number">{searchConsoleAccounts.length}</div>
                                        <div className="stat-label">Search Console</div>
                                    </div>
                                </div>
                                <button onClick={reconnectGoogle} className="btn btn-secondary button-full-width">
                                    <i className="fas fa-sync"></i>
                                    חבר מחדש
                                </button>
                            </>
                        )}
                    </div>

                    {/* Facebook Services Card */}
                    <div className="insight-card">
                        <div className="platform-header">
                            <div className="platform-brand">
                                <div className="platform-icon facebook">
                                    <i className="fab fa-facebook"></i>
                                </div>
                                <div className="platform-details">
                                    <h6>Facebook Ads</h6>
                                    <p>מודעות ופרסום</p>
                                </div>
                            </div>

                            {facebookConnected ? (
                                <span className="status-badge connected">
                                    <i className="fas fa-check"></i>מחובר
                                </span>
                            ) : (
                                <span className="status-badge neutral">
                                    <i className="fas fa-times"></i>לא מחובר
                                </span>
                            )}
                        </div>

                        {googleConnected ? (
                            !facebookConnected ? (
                                <button
                                    onClick={() => window.location.href = '/api/auth/facebook'}
                                    className="btn btn-facebook button-full-width"
                                >
                                    <i className="fab fa-facebook"></i>
                                    התחבר לFacebook Ads
                                </button>
                            ) : (
                                <>
                                    <div className="account-stats">
                                        <div className="account-stats-number">{facebookAccounts.length}</div>
                                        <div className="account-stats-label">Facebook Accounts</div>
                                    </div>
                                    <button onClick={reconnectFacebook} className="btn btn-secondary button-full-width">
                                        <i className="fas fa-sync"></i>
                                        חבר מחדש
                                    </button>
                                </>
                            )
                        ) : (
                            <p className="not-available-message">
                                דורש התחברות לGoogle קודם
                            </p>
                        )}
                    </div>
                </div>

                {/* Connected Accounts */}
                {googleConnected && (analyticsAccounts.length > 0 || searchConsoleAccounts.length > 0) && (
                    <div className="results-container">
                        <div className="results-header">
                            <i className="fas fa-link"></i>
                            <h3>חשבונות מחוברים</h3>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            {/* Analytics Accounts */}
                            {analyticsAccounts.length > 0 && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <h6 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <i className="fas fa-chart-bar" style={{ color: 'var(--primary-color)' }}></i>
                                        Google Analytics Properties
                                    </h6>
                                    <div className="account-grid">
                                        {analyticsAccounts.map((account) => (
                                            <div key={account.id} className="account-item">
                                                <div className="account-info">
                                                    <h6>{account.account_name}</h6>
                                                    {account.website_url && (
                                                        <p className="account-url">
                                                            <i className="fas fa-globe"></i>
                                                            {account.website_url}
                                                        </p>
                                                    )}
                                                    <p className="account-meta">Property ID: {account.account_id}</p>
                                                </div>
                                                <div className="account-controls">
                                                    <span className={`account-status-badge ${account.is_active ? 'active' : 'inactive'}`}>
                                                        <i className={`fas fa-${account.is_active ? 'check' : 'pause'}`}></i>
                                                        {account.is_active ? 'פעיל' : 'מושבת'}
                                                    </span>
                                                    <label className="toggle-switch">
                                                        <input
                                                            type="checkbox"
                                                            checked={account.is_active}
                                                            onChange={() => toggleAccount(account.id)}
                                                            disabled={toggling === account.id}
                                                        />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Search Console Accounts */}
                            {searchConsoleAccounts.length > 0 && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <h6 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <i className="fas fa-search" style={{ color: 'var(--primary-color)' }}></i>
                                        Google Search Console Sites
                                    </h6>
                                    <div className="account-grid">
                                        {searchConsoleAccounts.map((account) => (
                                            <div key={account.id} className="account-item">
                                                <div className="account-info">
                                                    <h6>{account.website_url}</h6>
                                                    <p className="account-meta">{account.account_name}</p>
                                                </div>
                                                <div className="account-controls">
                                                    <span className={`account-status-badge ${account.is_active ? 'active' : 'inactive'}`}>
                                                        <i className={`fas fa-${account.is_active ? 'check' : 'pause'}`}></i>
                                                        {account.is_active ? 'פעיל' : 'מושבת'}
                                                    </span>
                                                    <label className="toggle-switch">
                                                        <input
                                                            type="checkbox"
                                                            checked={account.is_active}
                                                            onChange={() => toggleAccount(account.id)}
                                                            disabled={toggling === account.id}
                                                        />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* No Accounts Message */}
                {googleConnected && analyticsAccounts.length === 0 && searchConsoleAccounts.length === 0 && (
                    <div className="results-container" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <i className="fas fa-exclamation-circle" style={{ fontSize: '3rem', color: '#f59e0b', marginBottom: '1rem' }}></i>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>לא נמצאו חשבונות</h4>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                            לא מצאנו חשבונות Analytics או Search Console המשויכים לחשבון Google שלך.<br />
                            ודא שיש לך גישה לחשבונות אלה ונסה לרענן.
                        </p>
                        <button onClick={refreshAccounts} className="btn btn-primary">
                            <i className="fas fa-sync"></i>
                            רענן שוב
                        </button>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <a href="/dashboard" className="btn btn-secondary" style={{ marginLeft: '1rem', textDecoration: 'none' }}>
                        <i className="fas fa-arrow-right"></i>
                        חזור לדשבורד
                    </a>
                    {(analyticsAccounts.some(acc => acc.is_active) || searchConsoleAccounts.some(acc => acc.is_active)) && (
                        <a href="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                            <i className="fas fa-comments"></i>
                            התחל לשאול שאלות
                        </a>
                    )}
                </div>
            </div>
        </>
    );
} 