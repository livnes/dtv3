'use client';

import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [userProfile, setUserProfile] = useState(null);
    const [integrations, setIntegrations] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: '',
        phoneNumber: '',
        businessEmail: '',
        businessName: '',
        websiteUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        linkedinUrl: '',
        tiktokUrl: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!session?.user?.id) return;

            try {
                // Fetch profile data
                const profileResponse = await fetch('/api/profile/get');
                const profileData = await profileResponse.json();
                setUserProfile(profileData);

                // Initialize edit form with existing data
                if (profileData.profile) {
                    setEditForm({
                        fullName: profileData.profile.fullName || '',
                        phoneNumber: profileData.profile.phoneNumber || '',
                        businessEmail: profileData.profile.businessEmail || '',
                        businessName: profileData.profile.businessName || '',
                        websiteUrl: profileData.profile.websiteUrl || '',
                        facebookUrl: profileData.profile.facebookUrl || '',
                        instagramUrl: profileData.profile.instagramUrl || '',
                        linkedinUrl: profileData.profile.linkedinUrl || '',
                        tiktokUrl: profileData.profile.tiktokUrl || ''
                    });
                }

                // Fetch integrations data
                const integrationsResponse = await fetch('/api/integrations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const integrationsData = await integrationsResponse.json();
                setIntegrations(integrationsData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (session) {
            fetchData();
        }
    }, [session]);

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
        if (!isEditing && userProfile.profile) {
            // Reset form to current data
            setEditForm({
                fullName: userProfile.profile.fullName || '',
                phoneNumber: userProfile.profile.phoneNumber || '',
                businessEmail: userProfile.profile.businessEmail || '',
                businessName: userProfile.profile.businessName || '',
                websiteUrl: userProfile.profile.websiteUrl || '',
                facebookUrl: userProfile.profile.facebookUrl || '',
                instagramUrl: userProfile.profile.instagramUrl || '',
                linkedinUrl: userProfile.profile.linkedinUrl || '',
                tiktokUrl: userProfile.profile.tiktokUrl || ''
            });
        }
    };

    const handleInputChange = (field, value) => {
        setEditForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/profile/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editForm)
            });

            if (response.ok) {
                // Refresh profile data
                const profileResponse = await fetch('/api/profile/get');
                const updatedProfileData = await profileResponse.json();
                setUserProfile(updatedProfileData);
                setIsEditing(false);
            } else {
                alert('שגיאה בשמירת הנתונים');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('שגיאה בשמירת הנתונים');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
            signOut({ callbackUrl: '/login' });
        }
    };

    const handleDeleteAccount = () => {
        if (confirm('האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו לא ניתנת לביטול!')) {
            if (confirm('בטוח? כל הנתונים והחיבורים שלך יימחקו לצמיתות!')) {
                alert('פונקציונליות מחיקת חשבון תתווסף בגרסה הבאה. נכון לעכשיו, אתה יכול לפנות לתמיכה.');
            }
        }
    };

    const formatHebrewDate = (dateString) => {
        if (!dateString) return 'לא זמין';
        const date = new Date(dateString);
        return date.toLocaleDateString('he-IL');
    };

    const getConnectionsCount = () => {
        if (!integrations?.integrations) return 0;
        return (integrations.integrations.analytics?.length || 0) +
            (integrations.integrations.searchConsole?.length || 0);
    };

    const isGoogleConnected = () => {
        if (!integrations?.integrations) return false;
        return ((integrations.integrations.analytics?.length || 0) +
            (integrations.integrations.searchConsole?.length || 0)) > 0;
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">טוען...</p>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {/* Profile Header */}
            <header className="profile-header">
                <h1 className="profile-title">הפרופיל שלי</h1>
                <p className="profile-subtitle">ניהול פרטים אישיים והגדרות חשבון</p>
            </header>

            {/* Profile Overview */}
            <section className="profile-overview-card">
                <div className="user-info-section">
                    <div className="profile-avatar">
                        {session?.user?.name ? session.user.name[0].toUpperCase() : 'U'}
                    </div>

                    <div className="user-details">
                        <h2 className="user-name">
                            {userProfile?.profile?.fullName || session?.user?.name || 'משתמש'}
                        </h2>
                        <p className="user-email">{session?.user?.email}</p>
                        <div className="status-badges">
                            <span className="status-badge status-badge-verified">
                                <i className="fas fa-check"></i>
                                משתמש מאומת
                            </span>
                            <span className="status-badge status-badge-member">
                                <i className="fas fa-calendar"></i>
                                חבר מאז {formatHebrewDate(session?.user?.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content Grid */}
            <div className="content-grid">

                {/* Account Information */}
                <section className="info-card">
                    <header className="card-header">
                        <i className={`fas fa-info-circle card-icon`}></i>
                        <h3 className="card-title">פרטי חשבון</h3>
                    </header>

                    <div className="details-list">
                        <div className="detail-item">
                            <label className="detail-label">שם מלא:</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.fullName}
                                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                                    className="detail-input"
                                    placeholder="הכנס שם מלא"
                                />
                            ) : (
                                <div className="detail-value">
                                    {userProfile?.profile?.fullName || session?.user?.name || 'לא זמין'}
                                </div>
                            )}
                        </div>

                        <div className="detail-item">
                            <label className="detail-label">כתובת אימייל:</label>
                            <div className="detail-value">{session?.user?.email}</div>
                        </div>

                        <div className="detail-item">
                            <label className="detail-label">טלפון:</label>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={editForm.phoneNumber}
                                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                    className="detail-input"
                                    placeholder="הכנס מספר טלפון"
                                />
                            ) : (
                                <div className="detail-value">
                                    {userProfile?.profile?.phoneNumber || 'לא זמין'}
                                </div>
                            )}
                        </div>

                        <div className="detail-item">
                            <label className="detail-label">אימייל עסקי:</label>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={editForm.businessEmail}
                                    onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                                    className="detail-input"
                                    placeholder="הכנס אימייל עסקי"
                                />
                            ) : (
                                <div className="detail-value">
                                    {userProfile?.profile?.businessEmail || 'לא זמין'}
                                </div>
                            )}
                        </div>

                        <div className="detail-item">
                            <label className="detail-label">תאריך הצטרפות:</label>
                            <div className="detail-value">
                                {formatHebrewDate(session?.user?.createdAt)}
                            </div>
                        </div>
                    </div>

                    <div className="edit-controls">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="save-button"
                                >
                                    {isSaving ? 'שומר...' : 'שמור'}
                                </button>
                                <button
                                    onClick={handleEditToggle}
                                    className="cancel-button"
                                >
                                    ביטול
                                </button>
                            </>
                        ) : (
                            <button onClick={handleEditToggle} className="edit-button">
                                <i className="fas fa-edit"></i>
                                ערוך פרטים
                            </button>
                        )}
                    </div>
                </section>

                {/* Business Information */}
                <section className="info-card">
                    <header className="card-header">
                        <i className={`fas fa-building card-icon`}></i>
                        <h3 className="card-title">פרטי עסק</h3>
                    </header>

                    <div className="details-list">
                        <div className="detail-item">
                            <label className="detail-label">שם העסק:</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.businessName}
                                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                                    className="detail-input"
                                    placeholder="הכנס שם העסק"
                                />
                            ) : (
                                <div className="detail-value">
                                    {userProfile?.profile?.businessName || 'לא זמין'}
                                </div>
                            )}
                        </div>

                        <div className="detail-item">
                            <label className="detail-label">אתר אינטרנט:</label>
                            {isEditing ? (
                                <input
                                    type="url"
                                    value={editForm.websiteUrl}
                                    onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                                    className="detail-input"
                                    placeholder="https://example.com"
                                />
                            ) : (
                                <div className="detail-value">
                                    {userProfile?.profile?.websiteUrl ? (
                                        <a href={userProfile.profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            {userProfile.profile.websiteUrl}
                                        </a>
                                    ) : 'לא זמין'}
                                </div>
                            )}
                        </div>

                        <div className="detail-item">
                            <label className="detail-label">פייסבוק:</label>
                            {isEditing ? (
                                <input
                                    type="url"
                                    value={editForm.facebookUrl}
                                    onChange={(e) => handleInputChange('facebookUrl', e.target.value)}
                                    className="detail-input"
                                    placeholder="https://facebook.com/yourpage"
                                />
                            ) : (
                                <div className="detail-value">
                                    {userProfile?.profile?.facebookUrl ? (
                                        <a href={userProfile.profile.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            {userProfile.profile.facebookUrl}
                                        </a>
                                    ) : 'לא זמין'}
                                </div>
                            )}
                        </div>

                        <div className="detail-item">
                            <label className="detail-label">אינסטגרם:</label>
                            {isEditing ? (
                                <input
                                    type="url"
                                    value={editForm.instagramUrl}
                                    onChange={(e) => handleInputChange('instagramUrl', e.target.value)}
                                    className="detail-input"
                                    placeholder="https://instagram.com/yourpage"
                                />
                            ) : (
                                <div className="detail-value">
                                    {userProfile?.profile?.instagramUrl ? (
                                        <a href={userProfile.profile.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            {userProfile.profile.instagramUrl}
                                        </a>
                                    ) : 'לא זמין'}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Statistics Section */}
            <section className="info-card" style={{ marginBottom: '2rem' }}>
                <header className="card-header">
                    <i className={`fas fa-chart-line card-icon`}></i>
                    <h3 className="card-title">סטטיסטיקות חשבון</h3>
                </header>

                <div className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-value">פעיל</div>
                        <div className="stat-label">סטטוס חשבון</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">{getConnectionsCount()}</div>
                        <div className="stat-label">חיבורים פעילים</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">
                            {userProfile?.isOnboardingCompleted ? 'הושלם' : 'לא הושלם'}
                        </div>
                        <div className="stat-label">הכשרה</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">
                            {formatHebrewDate(session?.user?.createdAt)}
                        </div>
                        <div className="stat-label">תאריך הצטרפות</div>
                    </div>
                </div>
            </section>

            {/* Connected Services */}
            <section className="services-card">
                <header className="section-header">
                    <i className={`fas fa-link section-icon`}></i>
                    <h3 className="section-title">שירותים מחוברים</h3>
                </header>

                <div className="services-list">
                    <div className="service-item">
                        <div className="service-info">
                            <div className="service-icon" style={{ background: '#db4437' }}>
                                <i className="fab fa-google"></i>
                            </div>
                            <div className="service-details">
                                <h4 className="service-name">Google Services</h4>
                                <p className="service-description">Analytics & Search Console</p>
                            </div>
                        </div>
                        <span className={`service-status ${isGoogleConnected() ? 'service-status-connected' : 'service-status-disconnected'}`}>
                            <i className={`fas ${isGoogleConnected() ? 'fa-check' : 'fa-times'}`}></i>
                            {isGoogleConnected() ? 'מחובר' : 'לא מחובר'}
                        </span>
                    </div>

                    <div className="service-item">
                        <div className="service-info">
                            <div className="service-icon" style={{ background: '#1877f2' }}>
                                <i className="fab fa-facebook"></i>
                            </div>
                            <div className="service-details">
                                <h4 className="service-name">Facebook Ads</h4>
                                <p className="service-description">מודעות ופרסום</p>
                            </div>
                        </div>
                        <span className="service-status service-status-disconnected">
                            <i className="fas fa-times"></i>
                            לא מחובר
                        </span>
                    </div>
                </div>
            </section>

            {/* Account Actions */}
            <section className="actions-card">
                <header className="section-header">
                    <i className={`fas fa-cogs section-icon`}></i>
                    <h3 className="section-title">פעולות חשבון</h3>
                </header>

                <div className="actions-grid">
                    <Link href="/dashboard" className="action-button action-button-primary">
                        <i className="fas fa-tachometer-alt"></i>
                        חזור לדשבורד
                    </Link>

                    <Link href="/profile/integrations" className="action-button action-button-outline">
                        <i className="fas fa-link"></i>
                        ניהול חיבורים
                    </Link>

                    <Link href="/onboarding" className="action-button action-button-secondary">
                        <i className="fas fa-user-edit"></i>
                        הכשרה מחדש
                    </Link>

                    <button onClick={handleLogout} className="action-button action-button-secondary">
                        <i className="fas fa-sign-out-alt"></i>
                        התנתק
                    </button>
                </div>

                {/* Danger Zone */}
                <div className="danger-zone">
                    <h4 className="danger-title">
                        <i className="fas fa-exclamation-triangle"></i>
                        אזור מסוכן
                    </h4>
                    <p className="danger-description">
                        פעולות אלו יסירו את כל הנתונים שלך ולא ניתן לבטל אותן. אנא שקול היטב לפני ביצוע פעולות אלה.
                    </p>
                    <button onClick={handleDeleteAccount} className="danger-button">
                        <i className="fas fa-trash"></i>
                        מחק חשבון
                    </button>
                </div>
            </section>
        </div>
    );
} 