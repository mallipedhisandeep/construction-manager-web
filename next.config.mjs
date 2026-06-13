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
export default nextConfig
