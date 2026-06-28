'use client'
// src/app/not-found.tsx
//
// Shown for any URL that doesn't match a route. Without this file, Next.js
// renders a generic unstyled error page that looks broken and unprofessional
// to anyone who lands on a bad link (shared link with a typo, old bookmark
// after a route was renamed, etc).

import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'rgb(var(--bg))' }}>
      <div className="text-6xl mb-4">🧭</div>
      <h1 className="text-xl font-black mb-2" style={{ color: 'rgb(var(--text))' }}>
        Page not found
      </h1>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'rgb(var(--muted))' }}>
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
        style={{ background: 'rgb(var(--accent))' }}>
        🏠 Go Home
      </Link>
    </div>
  )
}
