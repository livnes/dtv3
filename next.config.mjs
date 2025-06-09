/** @type {import('next').NextConfig} */
const nextConfig = {
    // Images configuration for external providers
    images: {
        domains: [
            'lh3.googleusercontent.com', // Google profile images
            'graph.facebook.com',        // Facebook profile images
        ],
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },

    // Environment variables that should be available on the client
    env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    },

    // Security headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                ],
            },
        ]
    },

    // Redirects for better UX
    async redirects() {
        return [
            {
                source: '/home',
                destination: '/dashboard',
                permanent: true,
            },
            {
                source: '/index',
                destination: '/dashboard',
                permanent: true,
            },
        ]
    },

    // Webpack configuration for better builds
    webpack: (config, { isServer }) => {
        // Fixes for packages that don't work well with Next.js
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
            }
        }

        return config
    },
}

export default nextConfig
