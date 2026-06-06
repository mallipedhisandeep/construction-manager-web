/** @type {import('next').NextConfig} */
const nextConfig = {
  // FIX D2/S3: Enable type checking and lint in production builds.
  // The 46 missing string keys, undefined toast types, and missing
  // user_id filters were all hidden by these flags being true.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}
export default nextConfig
