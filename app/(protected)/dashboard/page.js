'use client';

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function DashboardPage() {
    const { data: session, status } = useSession()
    const [analyticsIntegrations, setAnalyticsIntegrations] = useState([])
    const [searchConsoleIntegrations, setSearchConsoleIntegrations] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (session?.user?.email) {
            fetchIntegrations()
        }
    }, [session])

    const fetchIntegrations = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/integrations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            const data = await response.json()

            if (data.success) {
                setAnalyticsIntegrations(data.integrations.analytics || [])
                setSearchConsoleIntegrations(data.integrations.searchConsole || [])
            }
        } catch (error) {
            console.error('Error fetching integrations:', error)
        } finally {
            setLoading(false)
        }
    }

    const performSearch = () => {
        const query = searchQuery.trim();
        if (!query) return;

        // Find matching action
        const quickActions = document.querySelectorAll('.action-pill');
        const matchingAction = Array.from(quickActions).find(pill => {
            const description = pill.getAttribute('data-description');
            return description && (description.includes(query) || query.includes(description.substring(0, 20)));
        });

        if (matchingAction && matchingAction.href && matchingAction.href !== '#') {
            window.location.href = matchingAction.href;
        } else {
            showComingSoon('חיפוש מתקדם');
        }
    }

    const handleSearchInput = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        // Highlight matching pills
        const quickActions = document.querySelectorAll('.action-pill');
        quickActions.forEach(pill => {
            const text = pill.textContent.toLowerCase();
            if (query && text.includes(query.toLowerCase())) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }

    // Coming soon function
    const showComingSoon = (feature) => {
        // Create and show a nice modal or toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 50%;
            transform: translateX(50%);
            background: var(--primary-color);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: var(--shadow-md);
            z-index: 9999;
            font-weight: 500;
            animation: slideDown 0.3s ease;
        `;
        toast.innerHTML = `
            <i class="fas fa-info-circle" style="margin-left: 0.5rem;"></i>
            ${feature} יהיה זמין בקרוב!
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateX(50%) translateY(-100%); opacity: 0; }
                to { transform: translateX(50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    };

    if (status === 'loading') {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">טוען...</p>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="loading-container">
                <h3>לא מחובר</h3>
                <p>אנא התחבר כדי לגשת לדשבורד</p>
            </div>
        )
    }

    return (
        <>
            {/* Header Section */}
            <div className="main-header">
                <h1 className="welcome-title">
                    שלום {session.user.name}!
                </h1>
                <p className="welcome-subtitle">
                    איך אפשר לעזור לך לקבל החלטה חכמה היום?
                </p>
            </div>

            {/* Search Section */}
            <div className="search-section">
                <div className="search-container">
                    <input
                        type="text"
                        className="search-input"
                        value={searchQuery}
                        onChange={handleSearchInput}
                        placeholder="בחר ניתוח או הקלד מה אתה רוצה לבדוק..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                performSearch();
                            }
                        }}
                        autoComplete="off"
                    />
                    <button className="search-submit" onClick={performSearch}>
                        <i className="fas fa-paper-plane"></i>
                    </button>
                </div>

                {/* Quick Actions Pills */}
                <div className="quick-actions" id="quickActions">
                    {/* Active Actions */}
                    <Link href="/action/traffic-quality" className="action-pill" data-description="ניתוח מעמיק של מקורות התנועה שמביאים את המבקרים הכי איכותיים לאתר שלך">
                        <i className="fas fa-trophy"></i>
                        מקורות תנועה איכותיים
                    </Link>

                    <Link href="/actions/keywords" className="action-pill" data-description="גלה איזו מילת חיפוש מביאה לך הכי הרבה תנועה מגוגל ואיך לשפר את הדירוג">
                        <i className="fas fa-search"></i>
                        מילות חיפוש מובילות
                    </Link>

                    {/* Coming Soon Actions */}
                    <div className="action-pill" data-description="ניתוח תשואה על השקעה - איזה ערוץ פרסום מחזיר לך הכי הרבה כסף" onClick={() => showComingSoon('ROI Analysis')}>
                        <i className="fas fa-dollar-sign"></i>
                        ניתוח ROI
                    </div>

                    <div className="action-pill" data-description="ניתוח משפך המרות - איפה אתה מאבד כסף במשפך המכירות" onClick={() => showComingSoon('Conversion Funnel')}>
                        <i className="fas fa-funnel-dollar"></i>
                        משפך המרות
                    </div>

                    <div className="action-pill" data-description="אופטימיזציה תקציבית - איך לחלק את התקציב הפרסומי כדי למקסם רווחים" onClick={() => showComingSoon('Budget Optimization')}>
                        <i className="fas fa-chart-pie"></i>
                        אופטימיזציה תקציבית
                    </div>

                    <div className="action-pill" data-description="ניתוח ביצועי קמפיינים - איך הקמפיינים שלך מבצעים בפייסבוק וגוגל" onClick={() => showComingSoon('Campaign Analysis')}>
                        <i className="fas fa-bullhorn"></i>
                        ביצועי קמפיינים
                    </div>

                    <div className="action-pill" data-description="ניתוח טרנדים בתחום שלך - מה החם עכשיו בענף" onClick={() => showComingSoon('Industry Trends')}>
                        <i className="fas fa-trending-up"></i>
                        טרנדים בתחום
                    </div>

                    <div className="action-pill" data-description="ניתוח תוכן - איזה תוכן מעניין הכי הרבה מבקרים ומביא המרות" onClick={() => showComingSoon('Content Performance')}>
                        <i className="fas fa-newspaper"></i>
                        ביצועי תוכן
                    </div>
                </div>
            </div>

            {/* Recent Analysis Results (if any) */}
            {/* This section would be populated when there are recent results */}

            {/* Getting Started Section (for new users) */}
            {(!loading && !analyticsIntegrations.length && !searchConsoleIntegrations.length) && (
                <div className="analysis-section">
                    <div className="results-container" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <i className="fas fa-rocket" style={{ fontSize: '3rem', color: 'var(--primary-color)', marginBottom: '1rem' }}></i>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>בוא נתחיל!</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                            כדי להתחיל לקבל תובנות על הנתונים שלך, חבר את חשבונות Google Analytics ו-Search Console
                        </p>
                        <Link href="/accounts" className="btn btn-primary">
                            <i className="fas fa-link"></i>
                            חבר חשבונות
                        </Link>
                    </div>
                </div>
            )}

            {/* Quick Stats Overview (if accounts connected) */}
            {(!loading && (analyticsIntegrations.length > 0 || searchConsoleIntegrations.length > 0)) && (
                <div className="analysis-section">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

                        {analyticsIntegrations.length > 0 && (
                            <div className="insight-card" style={{ textAlign: 'center' }}>
                                <h6 style={{ justifyContent: 'center' }}>
                                    <i className="fas fa-chart-bar" style={{ color: 'var(--primary-color)' }}></i>
                                    Google Analytics
                                </h6>
                                <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)', margin: '0.5rem 0' }}>{analyticsIntegrations.length}</p>
                                <p style={{ margin: '0' }}>{analyticsIntegrations.length === 1 ? 'חשבון מחובר' : 'חשבונות מחוברים'}</p>
                            </div>
                        )}

                        {searchConsoleIntegrations.length > 0 && (
                            <div className="insight-card" style={{ textAlign: 'center' }}>
                                <h6 style={{ justifyContent: 'center' }}>
                                    <i className="fas fa-search" style={{ color: 'var(--primary-color)' }}></i>
                                    Search Console
                                </h6>
                                <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)', margin: '0.5rem 0' }}>{searchConsoleIntegrations.length}</p>
                                <p style={{ margin: '0' }}>{searchConsoleIntegrations.length === 1 ? 'אתר מחובר' : 'אתרים מחוברים'}</p>
                            </div>
                        )}

                        <div className="insight-card" style={{ textAlign: 'center' }}>
                            <h6 style={{ justifyContent: 'center' }}>
                                <i className="fas fa-chart-line" style={{ color: 'var(--primary-color)' }}></i>
                                ניתוחים זמינים
                            </h6>
                            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)', margin: '0.5rem 0' }}>2</p>
                            <p style={{ margin: '0' }}>ניתוחים מוכנים לשימוש</p>
                        </div>

                        <div className="insight-card" style={{ textAlign: 'center' }}>
                            <h6 style={{ justifyContent: 'center' }}>
                                <i className="fas fa-clock" style={{ color: 'var(--primary-color)' }}></i>
                                עדכון אחרון
                            </h6>
                            <p style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--primary-color)', margin: '0.5rem 0' }}>עכשיו</p>
                            <p style={{ margin: '0' }}>נתונים מעודכנים</p>
                        </div>
                    </div>

                    {/* Quick Actions Suggestion */}
                    <div className="results-container">
                        <div className="results-header">
                            <i className="fas fa-lightbulb"></i>
                            <h3>מה כדאי לבדוק היום?</h3>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                    <h6 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>🏆 בדוק את מקורות התנועה האיכותיים</h6>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>גלה איזה ערוץ מביא לך את המבקרים הכי מעורבים ובעלי ערך</p>
                                    <Link href="/analytics/traffic-sources" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>התחל ניתוח</Link>
                                </div>

                                <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                    <h6 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>🔍 מילות החיפוש הכי חזקות שלך</h6>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>בדוק איזה מילות מפתח מביאות הכי הרבה תנועה ואיך לשפר</p>
                                    <Link href="/analytics/search-keywords" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>התחל ניתוח</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
} 