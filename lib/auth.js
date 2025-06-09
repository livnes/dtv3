import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import prisma from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { triggerBackfill } from '@/lib/backfill'

export const authOptions = {
    adapter: PrismaAdapter(prisma),

    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: [
                        'openid',
                        'email',
                        'profile',
                        'https://www.googleapis.com/auth/analytics.readonly',
                        'https://www.googleapis.com/auth/webmasters.readonly'
                    ].join(' '),
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        }),
    ],

    session: {
        strategy: 'database',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    secret: process.env.NEXTAUTH_SECRET || 'dev-secret-key-change-in-production',

    pages: {
        signIn: '/login',
        error: '/login',
    },

    callbacks: {
        async session({ session, user }) {
            // Add user id to session
            session.user.id = user.id
            return session
        },
    },

    events: {
        async signIn({ user, account, profile, isNewUser }) {
            console.log('Sign in event:', {
                email: user.email,
                isNewUser,
                provider: account?.provider
            })

            // Create UserIntegrations after successful sign in
            if (account?.provider === 'google' && account.access_token) {
                try {
                    // Check if integrations already exist
                    const existingGA = await prisma.userIntegration.findFirst({
                        where: {
                            userId: user.id,
                            providerName: 'google_analytics',
                        },
                    })

                    const existingSC = await prisma.userIntegration.findFirst({
                        where: {
                            userId: user.id,
                            providerName: 'google_search_console',
                        },
                    })

                    // Create Google Analytics integration if it doesn't exist
                    if (!existingGA) {
                        await prisma.userIntegration.create({
                            data: {
                                userId: user.id,
                                providerName: 'google_analytics',
                                accountId: 'pending_property_selection', // Don't use Google account ID
                                encryptedAccessToken: encrypt(account.access_token),
                                encryptedRefreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
                                tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                                scopes: JSON.stringify(account.scope?.split(' ') || []),
                                isActive: true, // Auto-activate since user granted permissions
                                backfillCompleted: false, // Ensure backfill will run after property selection
                            },
                        })
                        console.log('Created Google Analytics integration for:', user.email, '- awaiting property selection')

                        // Don't trigger backfill yet - wait for property selection
                        console.log('⏳ Backfill will be triggered after Analytics property selection')
                    } else {
                        // Update existing integration with new tokens
                        await prisma.userIntegration.update({
                            where: { id: existingGA.id },
                            data: {
                                encryptedAccessToken: encrypt(account.access_token),
                                encryptedRefreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
                                tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                                scopes: JSON.stringify(account.scope?.split(' ') || []),
                                isActive: true, // Auto-activate on token refresh
                                lastError: null, // Clear any previous errors
                            },
                        })
                        console.log('Updated Google Analytics integration for:', user.email)
                    }

                    // Create Search Console integration if it doesn't exist
                    if (!existingSC) {
                        await prisma.userIntegration.create({
                            data: {
                                userId: user.id,
                                providerName: 'google_search_console',
                                accountId: 'pending_property_selection', // Don't use Google account ID
                                encryptedAccessToken: encrypt(account.access_token),
                                encryptedRefreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
                                tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                                scopes: JSON.stringify(account.scope?.split(' ') || []),
                                isActive: true, // Auto-activate since user granted permissions
                                backfillCompleted: false, // Ensure backfill will run after property selection
                            },
                        })
                        console.log('Created Search Console integration for:', user.email, '- awaiting property selection')
                    } else {
                        // Update existing integration with new tokens
                        await prisma.userIntegration.update({
                            where: { id: existingSC.id },
                            data: {
                                encryptedAccessToken: encrypt(account.access_token),
                                encryptedRefreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
                                tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                                scopes: JSON.stringify(account.scope?.split(' ') || []),
                                isActive: true, // Auto-activate on token refresh
                                lastError: null, // Clear any previous errors
                            },
                        })
                        console.log('Updated Search Console integration for:', user.email)
                    }

                } catch (error) {
                    console.error('Error creating/updating user integrations:', error)
                    // Don't throw error here to avoid breaking the sign-in process
                }
            }
        },
    },

    debug: process.env.NODE_ENV === 'development',
} 