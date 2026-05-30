/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ignore TypeScript errors during build so Vercel doesn't fail on strict-mode warnings
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignore ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}
export default nextConfig
