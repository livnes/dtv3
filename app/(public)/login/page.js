'use client'

import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function LoginContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

    useEffect(() => {
        // Check if user is already authenticated
        getSession().then((session) => {
            if (session) {
                router.push('/dashboard')
            }
        })
    }, [router])

    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true)
            setError('')

            const result = await signIn('google', {
                callbackUrl,
                redirect: false,
            })

            if (result?.error) {
                setError('שגיאה בהתחברות. אנא נסה שוב.')
            } else if (result?.ok) {
                router.push(callbackUrl)
            }
        } catch (error) {
            console.error('Login error:', error)
            setError('שגיאה בהתחברות. אנא נסה שוב.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)' }}>
            <div style={{ maxWidth: '480px', width: '100%', margin: '0 1rem' }}>
                {/* Login Card */}
                <div style={{ background: 'var(--background)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '3rem 2rem', boxShadow: 'var(--shadow-md)', textAlign: 'center' }}>

                    {/* Logo and Title */}
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', background: 'var(--primary-color)', borderRadius: '50%', marginBottom: '1rem' }}>
                            <i className="fas fa-chart-line" style={{ fontSize: '1.5rem', color: 'white' }}></i>
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Data Talk</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: '0', fontSize: '1rem' }}>דשבורד אנליטיקס חכם לעסקים קטנים</p>
                    </div>

                    {/* Mission Statement */}
                    <div style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                            <i className="fas fa-bullseye" style={{ color: 'var(--primary-color)', marginLeft: '0.5rem' }}></i>
                            <strong style={{ color: 'var(--text-primary)' }}>המשימה שלנו:</strong>
                        </div>
                        <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            לגרום לנתונים שלך לדבר איתך - כדי שתוכל לקבל החלטות חכמות בביטחון
                        </p>
                    </div>

                    {/* Login Instructions */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
                            <i className="fas fa-plug" style={{ color: 'var(--primary-color)', marginLeft: '0.5rem' }}></i>
                            התחבר לחשבונות שלך
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '0', fontSize: '0.9rem' }}>
                            התחבר עם Google כדי לגשת ל-Analytics ו-Search Console שלך
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flash-message flash-error" style={{ marginBottom: '2rem' }}>
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            {error}
                        </div>
                    )}

                    {/* Google Login Button */}
                    <div style={{ marginBottom: '2rem' }}>
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                width: '100%',
                                padding: '1rem 1.5rem',
                                background: '#db4437',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '12px',
                                fontWeight: '500',
                                fontSize: '1rem',
                                transition: 'all 0.2s ease',
                                boxShadow: 'var(--shadow-sm)',
                                border: 'none',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? '0.7' : '1'
                            }}
                            onMouseOver={(e) => {
                                if (!isLoading) {
                                    e.target.style.background = '#c23321';
                                    e.target.style.transform = 'translateY(-2px)';
                                    e.target.style.boxShadow = 'var(--shadow-md)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isLoading) {
                                    e.target.style.background = '#db4437';
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = 'var(--shadow-sm)';
                                }
                            }}
                        >
                            {isLoading ? (
                                <div className="loading-spinner"></div>
                            ) : (
                                <i className="fab fa-google" style={{ fontSize: '1.25rem' }}></i>
                            )}
                            {isLoading ? 'מתחבר...' : 'התחבר עם Google'}
                        </button>
                    </div>

                    {/* Features List */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h6 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>מה תקבל:</h6>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <i className="fas fa-chart-bar" style={{ color: 'var(--primary-color)', marginTop: '0.25rem', flexShrink: 0 }}></i>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Google Analytics</strong>
                                    <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>נתוני תנועה באתר</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <i className="fas fa-search" style={{ color: 'var(--primary-color)', marginTop: '0.25rem', flexShrink: 0 }}></i>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Search Console</strong>
                                    <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>נתוני SEO וחיפוש</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <i className="fab fa-facebook" style={{ color: 'var(--primary-color)', marginTop: '0.25rem', flexShrink: 0 }}></i>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Facebook Ads</strong>
                                    <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>נתוני מודעות ופרסום</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <i className="fas fa-comments" style={{ color: 'var(--primary-color)', marginTop: '0.25rem', flexShrink: 0 }}></i>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>AI בעברית</strong>
                                    <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>תובנות ברורות והמלצות</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security Note */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <i className="fas fa-shield-alt" style={{ color: '#2563eb', marginTop: '0.125rem', flexShrink: 0 }}></i>
                            <div style={{ textAlign: 'right' }}>
                                <strong style={{ color: '#1e40af', fontSize: '0.875rem' }}>בטוח ומאובטח:</strong>
                                <p style={{ margin: '0.25rem 0 0 0', color: '#1e40af', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                    אנחנו משתמשים רק בפרוטוקולי OAuth הרשמיים. לא נשמור את הסיסמאות שלך ולא נקבל גישה מלאה לחשבונות.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Process Steps */}
                <div style={{ marginTop: '1.5rem', background: 'var(--background-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
                    <h6 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        <i className="fas fa-cogs" style={{ marginLeft: '0.5rem' }}></i>
                        איך זה עובד?
                    </h6>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', textAlign: 'center' }}>
                        <div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <i className="fas fa-comments" style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}></i>
                            </div>
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>שאל בעברית</small>
                        </div>
                        <div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <i className="fas fa-brain" style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}></i>
                            </div>
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>AI מבין</small>
                        </div>
                        <div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <i className="fas fa-database" style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}></i>
                            </div>
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>משיג נתונים</small>
                        </div>
                        <div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <i className="fas fa-magic" style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}></i>
                            </div>
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>מחזיר תובנות</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="loading-spinner"></div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
} 