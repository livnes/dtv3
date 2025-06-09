'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import OnboardingWizard from '@/components/OnboardingWizard';

export default function OnboardingPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkOnboardingStatus = async () => {
            if (!session?.user?.id) return;

            try {
                const response = await fetch('/api/profile/get');
                const data = await response.json();

                if (data.isOnboardingCompleted || data.isOnboardingSkipped) {
                    // Already completed or skipped, redirect to dashboard
                    router.push('/dashboard');
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error checking onboarding status:', error);
                setLoading(false);
            }
        };

        if (session) {
            checkOnboardingStatus();
        }
    }, [session, router]);

    const handleComplete = () => {
        router.push('/dashboard');
    };

    const handleSkip = async () => {
        try {
            const response = await fetch('/api/profile/skip-onboarding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                router.push('/dashboard');
            } else {
                console.error('Failed to skip onboarding');
                // Still redirect to dashboard on error - don't trap user
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Error skipping onboarding:', error);
            // Still redirect to dashboard on error - don't trap user
            router.push('/dashboard');
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="loading-text">טוען...</p>
            </div>
        );
    }

    return (
        <div className="onboarding-page">
            <div className="onboarding-container">
                <OnboardingWizard onComplete={handleComplete} />

                {/* Skip Button */}
                <div className="skip-section">
                    <button
                        onClick={handleSkip}
                        className="btn-skip"
                    >
                        מלא אחר כך
                    </button>
                    <p className="skip-note">
                        תוכל תמיד לחזור ולמלא את הפרטים בהגדרות הפרופיל
                    </p>
                </div>
            </div>
        </div>
    );
} 