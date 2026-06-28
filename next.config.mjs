import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol:'https', hostname:'*.supabase.co', pathname:'/storage/v1/object/public/**' },
      { protocol:'https', hostname:'*.supabase.co', pathname:'/storage/v1/object/sign/**' },
      // Google profile photos
      { protocol:'https', hostname:'lh3.googleusercontent.com' },
      { protocol:'https', hostname:'*.googleusercontent.com' },
    ],
  },
  async redirects() {
    return [
      { source: '/signup', destination: '/login', permanent: true },
    ]
  },
}

// withSentryConfig is safe to apply even before Sentry is configured — it
// only actually uploads source maps and wraps build output when
// SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT are present (CI/build-time
// env vars, separate from the runtime SENTRY_DSN). Without those, this is
// effectively a no-op wrapper.
export default withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent:  true, // suppresses Sentry's build-time console output when not configured
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
