import type { Metadata } from 'next'
import './globals.css'

// Prevent Next.js from pre-rendering any page at build time.
// All pages need auth + Supabase, so they must render on demand.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Construction Manager',
  description: 'Site and worker management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
