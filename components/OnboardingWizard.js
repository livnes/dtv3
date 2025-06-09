'use client';

import { useState, useEffect } from 'react';

const OnboardingWizard = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        // Step 1: Contact Details
        fullName: '',
        phoneNumber: '',
        businessEmail: '',
        businessName: '',
        websiteUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        linkedinUrl: '',
        tiktokUrl: '',

        // Step 2: Goals and Marketing
        dataGoals: [],
        mainMarketingObjective: '',
        businessAge: '',
        marketingPlatforms: [],
        marketingKnowledgeLevel: '',

        // Step 3: Data Sources
        currentDataSources: [],
        crmSystem: ''
    });

    // Load existing profile data if any
    useEffect(() => {
        loadExistingProfile();
    }, []);

    const loadExistingProfile = async () => {
        try {
            const response = await fetch('/api/profile/get');
            const result = await response.json();

            if (result.success && result.profile) {
                setFormData(prev => ({
                    ...prev,
                    ...result.profile
                }));
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleMultiSelectChange = (field, option) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].includes(option)
                ? prev[field].filter(item => item !== option)
                : [...prev[field], option]
        }));
    };

    const saveStepData = async (step) => {
        setLoading(true);
        try {
            const stepData = getStepData(step);
            const response = await fetch('/api/profile/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    step,
                    data: stepData
                })
            });

            const result = await response.json();

            if (result.success) {
                if (step === 3 && result.profile.isOnboardingCompleted) {
                    onComplete?.();
                } else {
                    setCurrentStep(step + 1);
                }
            } else {
                alert(result.error || 'שגיאה בשמירת הנתונים');
            }
        } catch (error) {
            console.error('Error saving step:', error);
            alert('שגיאה בשמירת הנתונים');
        } finally {
            setLoading(false);
        }
    };

    const saveStepDataInBackground = async (step) => {
        try {
            const stepData = getStepData(step);
            const response = await fetch('/api/profile/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    step,
                    data: stepData
                })
            });

            const result = await response.json();

            if (!result.success) {
                console.error('Background save failed:', result.error);
                // Could show a subtle notification here if needed
            }
        } catch (error) {
            console.error('Background save error:', error);
            // Silent failure - don't interrupt user flow
        }
    };

    const getStepData = (step) => {
        if (step === 1) {
            return {
                fullName: formData.fullName,
                phoneNumber: formData.phoneNumber,
                businessEmail: formData.businessEmail,
                businessName: formData.businessName,
                websiteUrl: formData.websiteUrl,
                facebookUrl: formData.facebookUrl,
                instagramUrl: formData.instagramUrl,
                linkedinUrl: formData.linkedinUrl,
                tiktokUrl: formData.tiktokUrl
            };
        } else if (step === 2) {
            return {
                dataGoals: formData.dataGoals,
                mainMarketingObjective: formData.mainMarketingObjective,
                businessAge: formData.businessAge,
                marketingPlatforms: formData.marketingPlatforms,
                marketingKnowledgeLevel: formData.marketingKnowledgeLevel
            };
        } else if (step === 3) {
            return {
                currentDataSources: formData.currentDataSources,
                crmSystem: formData.crmSystem
            };
        }
    };

    const changeStep = (direction) => {
        if (direction === 1) {
            // Optimistic flow: validate → move forward → save in background
            if (isStepValid(currentStep)) {
                if (currentStep === 3) {
                    // Last step - save and complete
                    saveStepData(currentStep);
                } else {
                    // Move forward immediately and save in background
                    setCurrentStep(currentStep + 1);
                    saveStepDataInBackground(currentStep);
                }
            }
        } else if (direction === -1 && currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const isStepValid = (step) => {
        if (step === 1) {
            return formData.fullName && formData.businessName;
        } else if (step === 2) {
            return formData.dataGoals.length > 0 &&
                formData.mainMarketingObjective &&
                formData.businessAge &&
                formData.marketingKnowledgeLevel;
        } else if (step === 3) {
            return formData.currentDataSources.length > 0;
        }
        return false;
    };

    const getProgressWidth = () => {
        if (currentStep === 1) return '0%';
        if (currentStep === 2) return '50%';
        if (currentStep === 3) return '100%';
        return '0%';
    };

    return (
        <div className="onboarding-wizard">
            <div className="main-header">
                <h1 className="welcome-title">שאלון Onboarding – Data Talk</h1>
                <p className="welcome-subtitle">
                    ברוך הבא ל־<strong>Data Talk</strong> – המקום בו הנתונים שלך מתחילים לדבר!
                    נשמח להכיר אותך קצת יותר כדי שנוכל להתאים לך את הדשבורד, התובנות וההמלצות בצורה מדויקת לצרכים שלך.
                </p>
            </div>

            {/* Steps Progress */}
            <div className="steps-container">
                <div className="steps-progress">
                    <div className="steps-progress-fill" style={{ width: getProgressWidth() }}></div>
                    <div className="step-item">
                        <div className={`step-circle ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>1</div>
                        <div className={`step-label ${currentStep === 1 ? 'active' : ''}`}>פרטי התקשרות</div>
                    </div>
                    <div className="step-item">
                        <div className={`step-circle ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>2</div>
                        <div className={`step-label ${currentStep === 2 ? 'active' : ''}`}>מטרות ושיווק</div>
                    </div>
                    <div className="step-item">
                        <div className={`step-circle ${currentStep === 3 ? 'active' : ''}`}>3</div>
                        <div className={`step-label ${currentStep === 3 ? 'active' : ''}`}>מקורות נתונים</div>
                    </div>
                </div>
            </div>

            {/* Step 1: Contact Details */}
            {currentStep === 1 && (
                <div className="form-step">
                    <h2 className="step-title">
                        <span className="step-icon"><i className="fas fa-user"></i></span>
                        פרטי התקשרות
                    </h2>

                    <div className="form-group">
                        <label className="form-label" htmlFor="fullName">שם מלא:</label>
                        <input
                            type="text"
                            id="fullName"
                            name="fullName"
                            className="form-control"
                            value={formData.fullName}
                            onChange={(e) => handleInputChange('fullName', e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="phone">טלפון נייד:</label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            className="form-control"
                            value={formData.phoneNumber}
                            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                            dir="ltr"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="businessEmail">דוא״ל עסקי (אם שונה מהרגיל):</label>
                        <input
                            type="email"
                            id="businessEmail"
                            name="businessEmail"
                            className="form-control"
                            value={formData.businessEmail}
                            onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                            dir="ltr"
                            placeholder="אופציונלי"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="businessName">שם העסק:</label>
                        <input
                            type="text"
                            id="businessName"
                            name="businessName"
                            className="form-control"
                            value={formData.businessName}
                            onChange={(e) => handleInputChange('businessName', e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="website">כתובת אתר אינטרנט:</label>
                        <input
                            type="text"
                            id="website"
                            name="website"
                            className="form-control"
                            value={formData.websiteUrl}
                            onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                            dir="ltr"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">קישורים לרשתות חברתיות (אם יש):</label>
                        <div className="social-links">
                            <input
                                type="text"
                                name="facebook"
                                placeholder="פייסבוק"
                                className="form-control"
                                value={formData.facebookUrl}
                                onChange={(e) => handleInputChange('facebookUrl', e.target.value)}
                                dir="ltr"
                            />
                            <input
                                type="text"
                                name="instagram"
                                placeholder="אינסטגרם"
                                className="form-control"
                                value={formData.instagramUrl}
                                onChange={(e) => handleInputChange('instagramUrl', e.target.value)}
                                dir="ltr"
                            />
                            <input
                                type="text"
                                name="linkedin"
                                placeholder="לינקדאין"
                                className="form-control"
                                value={formData.linkedinUrl}
                                onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                                dir="ltr"
                            />
                            <input
                                type="text"
                                name="tiktok"
                                placeholder="טיקטוק"
                                className="form-control"
                                value={formData.tiktokUrl}
                                onChange={(e) => handleInputChange('tiktokUrl', e.target.value)}
                                dir="ltr"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Goals and Marketing */}
            {currentStep === 2 && (
                <div className="form-step">
                    <h2 className="step-title">
                        <span className="step-icon"><i className="fas fa-bullseye"></i></span>
                        מטרות ושיווק
                    </h2>

                    <div className="form-group">
                        <label className="form-label">מה המטרות שלך בשימוש ב־Data Talk? (ניתן לבחור יותר מתשובה אחת)</label>
                        <div className="checkbox-group">
                            {[
                                'להבין מה עובד באתר ומה לא',
                                'לשפר את אחוזי ההמרה',
                                'להבין מאיפה מגיעים הגולשים',
                                'לזהות עמודים/מוצרים מובילים',
                                'לפלח קהלים רלוונטיים',
                                'לקבל החלטות על סמך דאטה'
                            ].map((goal) => (
                                <label key={goal} className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        name="goals"
                                        value={goal}
                                        checked={formData.dataGoals.includes(goal)}
                                        onChange={() => handleMultiSelectChange('dataGoals', goal)}
                                    />
                                    {goal}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">מהי מטרת העל שלך בשיווק כרגע?</label>
                        <div className="radio-group">
                            {[
                                'להגדיל מכירות',
                                'להגדיל לידים / פניות',
                                'לשפר יחס המרה באתר',
                                'לחסוך בתקציב פרסום',
                                'לשמר לקוחות'
                            ].map((objective) => (
                                <label key={objective} className="radio-item">
                                    <input
                                        type="radio"
                                        name="mainGoal"
                                        value={objective}
                                        checked={formData.mainMarketingObjective === objective}
                                        onChange={(e) => handleInputChange('mainMarketingObjective', e.target.value)}
                                    />
                                    {objective}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">כמה זמן העסק שלך קיים?</label>
                        <div className="radio-group">
                            {[
                                'פחות משנה',
                                '1–3 שנים',
                                '3–7 שנים',
                                'מעל 7 שנים'
                            ].map((age) => (
                                <label key={age} className="radio-item">
                                    <input
                                        type="radio"
                                        name="businessAge"
                                        value={age}
                                        checked={formData.businessAge === age}
                                        onChange={(e) => handleInputChange('businessAge', e.target.value)}
                                    />
                                    {age}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">אילו פלטפורמות שיווק אתה משתמש בהן כיום?</label>
                        <div className="checkbox-group">
                            {[
                                'פרסום בגוגל (Google Ads)',
                                'פייסבוק / אינסטגרם',
                                'טיקטוק',
                                'לינקדאין',
                                'דיוור / ניוזלטרים',
                                'SEO (קידום אורגני)',
                                'מפה לאוזן'
                            ].map((platform) => (
                                <label key={platform} className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        name="marketingPlatforms"
                                        value={platform}
                                        checked={formData.marketingPlatforms.includes(platform)}
                                        onChange={() => handleMultiSelectChange('marketingPlatforms', platform)}
                                    />
                                    {platform}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">כיצד אתה מדרג את רמת הידע השיווקי שלך?</label>
                        <div className="radio-group">
                            {[
                                'אין לי ניסיון',
                                'בסיסי – מכיר מושגים כלליים',
                                'בינוני – מפרסם לבד או עם עזרה',
                                'גבוה – מנהל קמפיינים / עובד עם סוכנות'
                            ].map((level) => (
                                <label key={level} className="radio-item">
                                    <input
                                        type="radio"
                                        name="marketingKnowledge"
                                        value={level}
                                        checked={formData.marketingKnowledgeLevel === level}
                                        onChange={(e) => handleInputChange('marketingKnowledgeLevel', e.target.value)}
                                    />
                                    {level}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Data Sources */}
            {currentStep === 3 && (
                <div className="form-step">
                    <h2 className="step-title">
                        <span className="step-icon"><i className="fas fa-chart-line"></i></span>
                        מקורות נתונים
                    </h2>

                    <div className="form-group">
                        <label className="form-label">אילו מערכות וכלי מדידה יש לך כיום? (סמן את הרלוונטיות)</label>
                        <div className="checkbox-group">
                            {[
                                'Google Analytics (GA4)',
                                'Google Search Console',
                                'Google Ads',
                                'Facebook Ads / Meta',
                                'מערכת CRM',
                                'מערכות דיוור / אוטומציה',
                                'אין לי מערכות מדידה'
                            ].map((source) => (
                                <label key={source} className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        name="dataSources"
                                        value={source}
                                        checked={formData.currentDataSources.includes(source)}
                                        onChange={() => handleMultiSelectChange('currentDataSources', source)}
                                    />
                                    {source}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="crmSystem">אם יש לך CRM או מערכת דיוור, איזו? (לא חובה)</label>
                        <input
                            type="text"
                            id="crmSystem"
                            name="crmSystem"
                            className="form-control"
                            placeholder="לדוגמה: HubSpot, Salesforce, Mailchimp"
                            value={formData.crmSystem}
                            onChange={(e) => handleInputChange('crmSystem', e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="step-navigation">
                <button
                    type="button"
                    className={`btn ${currentStep === 1 ? 'btn-disabled' : 'btn-secondary'}`}
                    onClick={() => changeStep(-1)}
                    disabled={currentStep === 1}
                >
                    <i className="fas fa-arrow-right"></i>
                    הקודם
                </button>
                <button
                    type="button"
                    className={`btn ${!isStepValid(currentStep) || (currentStep === 3 && loading) ? 'btn-disabled' : 'btn-primary'}`}
                    onClick={() => changeStep(1)}
                    disabled={!isStepValid(currentStep) || (currentStep === 3 && loading)}
                >
                    {currentStep === 3 && loading ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i>
                            שומר...
                        </>
                    ) : currentStep === 3 ? (
                        <>
                            סיום
                            <i className="fas fa-check"></i>
                        </>
                    ) : (
                        <>
                            הבא
                            <i className="fas fa-arrow-left"></i>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default OnboardingWizard; 