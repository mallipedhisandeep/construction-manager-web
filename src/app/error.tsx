'use client'
// Global error boundary — catches unhandled runtime errors in any route
// Shows a friendly retry screen instead of a blank white page

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console in dev; swap with Sentry/LogRocket in production
    console.error('[CM Error]', error)
  }, [error])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'rgb(12,12,14)' }}>
      <div className="text-6xl mb-4">⚙️</div>
      <h1 className="text-xl font-black text-white mb-2">Something went wrong</h1>
      <p className="text-sm mb-6 max-w-xs" style={{ color: '#7a7870' }}>
        {error?.message?.includes('fetch')
          ? 'Network error — check your connection and try again.'
          : 'An unexpected error occurred. Your data is safe.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
          style={{ background: '#d48c28' }}>
          🔄 Try Again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#dedad2' }}>
          🏠 Go Home
        </button>
      </div>
      {error?.digest && (
        <p className="text-[10px] mt-6 font-mono" style={{ color: '#4a4a48' }}>
          Error ID: {error.digest}
        </p>
      )}
    </div>
  )
}
