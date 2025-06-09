import { NextResponse } from 'next/server'

export async function middleware(request) {
    const { pathname } = request.nextUrl

    // Get the session token from cookies
    const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
        request.cookies.get('__Secure-next-auth.session-token')?.value

    // Check if user has a session
    const isAuthenticated = !!sessionToken

    // Define paths that don't require authentication
    const publicPaths = [
        '/login',
        '/api/auth',
        '/api/cron', // Allow cron job endpoints
        '/_next',
        '/favicon.ico',
        '/robots.txt',
        '/manifest.json',
    ]

    // Define paths that don't require onboarding completion
    const onboardingExemptPaths = [
        '/onboarding',
        '/api/profile',
        '/api/auth',
        '/api/cron',
        '/_next',
        '/favicon.ico',
        '/robots.txt',
        '/manifest.json',
    ]

    // Check if the current path is public
    const isPublicPath = publicPaths.some(path =>
        pathname.startsWith(path)
    )

    // If accessing a public path, allow access
    if (isPublicPath) {
        return NextResponse.next()
    }

    // If not authenticated and trying to access protected route
    if (!isAuthenticated) {
        const loginUrl = new URL('/login', request.url)

        // Add redirect parameter to return user to intended page after login
        if (pathname !== '/') {
            loginUrl.searchParams.set('callbackUrl', pathname)
        }

        return NextResponse.redirect(loginUrl)
    }

    // Check if path is exempt from onboarding requirement
    const isOnboardingExempt = onboardingExemptPaths.some(path =>
        pathname.startsWith(path)
    )

    // If authenticated but not on onboarding-exempt path, check onboarding completion
    if (isAuthenticated && !isOnboardingExempt) {
        try {
            // Create a request to check onboarding status
            const profileResponse = await fetch(new URL('/api/profile/get', request.url), {
                headers: {
                    'Cookie': request.headers.get('cookie') || ''
                }
            })

            if (profileResponse.ok) {
                const profileData = await profileResponse.json()

                // If onboarding is not completed, redirect to onboarding
                if (profileData.needsOnboarding) {
                    return NextResponse.redirect(new URL('/onboarding', request.url))
                }
            }
        } catch (error) {
            // If there's an error checking profile, allow access (graceful degradation)
            console.error('Error checking onboarding status:', error)
        }
    }

    // If authenticated and accessing root, redirect to dashboard
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Allow access to protected routes
    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (NextAuth.js routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
    ],
} 