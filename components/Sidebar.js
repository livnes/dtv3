'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    if (!session) return null;

    const navigation = [
        {
            name: 'דשבורד',
            href: '/dashboard',
            icon: 'fas fa-home'
        },
        {
            name: 'מקורות תנועה',
            href: '/analytics/traffic-sources',
            icon: 'fas fa-chart-bar'
        },
        {
            name: 'Google Ads',
            href: '/analytics/google-ads',
            icon: 'fab fa-google text-red-500'
        },
        {
            name: 'מילות חיפוש',
            href: '/analytics/search-keywords',
            icon: 'fas fa-search'
        },
        {
            name: 'חשבונות',
            href: '/accounts',
            icon: 'fas fa-link'
        },
        {
            name: 'פרופיל',
            href: '/profile',
            icon: 'fas fa-user'
        },
        {
            name: 'שאלון הכרות',
            href: '/onboarding',
            icon: 'fas fa-clipboard-list'
        },
        {
            name: 'התחברויות',
            href: '/profile/integrations',
            icon: 'fas fa-cog'
        }
    ];

    const isActive = (href) => {
        return pathname === href || pathname.startsWith(href + '/');
    };

    const handleSignOut = () => {
        signOut({ callbackUrl: '/login' });
    };

    return (
        <>
            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Mobile menu button */}
            <button
                className="fixed top-4 right-4 z-50 md:hidden bg-white p-2 rounded-md shadow-md"
                onClick={() => setIsMobileOpen(!isMobileOpen)}
            >
                <i className="fas fa-bars text-xl"></i>
            </button>

            {/* Sidebar */}
            <div className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
                {/* Header */}
                <div className="sidebar-header">
                    <Link href="/dashboard" className="sidebar-logo">
                        <i className="fas fa-chart-line"></i>
                        <span>Data Talk</span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <ul>
                        {navigation.map((item) => (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={isActive(item.href) ? 'active' : ''}
                                    onClick={() => setIsMobileOpen(false)}
                                >
                                    <i className={item.icon}></i>
                                    <span>{item.name}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* User Info */}
                <div className="sidebar-user">
                    <div className="user-info">
                        {session.user.image ? (
                            <Image
                                src={session.user.image}
                                alt={session.user.name || 'User avatar'}
                                width={40}
                                height={40}
                                className="user-avatar"
                                style={{ borderRadius: '50%' }}
                            />
                        ) : (
                            <div className="user-avatar">
                                {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
                            </div>
                        )}
                        <div className="user-details">
                            <h6>{session.user.name}</h6>
                            <p>{session.user.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full mt-2 flex items-center gap-2 p-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.875rem',
                            color: 'var(--text-muted)',
                            justifyContent: 'flex-start'
                        }}
                    >
                        <i className="fas fa-sign-out-alt"></i>
                        התנתק
                    </button>
                </div>
            </div>
        </>
    );
} 