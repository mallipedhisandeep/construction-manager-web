'use client'
// Global error boundary — catches unhandled runtime errors in any route
// Shows a friendly retry screen instead of a blank white page

import { useEffect } from 'react'
import { logError } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logError(error, { route: 'global-error-boundary', digest: error?.digest })
  }, [error])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'rgb(var(--bg))' }}>
      <div className="text-6xl mb-4">⚙️</div>
      <h1 className="text-xl font-black mb-2" style={{ color: 'rgb(var(--text))' }}>Something went wrong</h1>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'rgb(var(--muted))' }}>
        {error?.message?.includes('fetch')
          ? 'Network error — check your connection and try again.'
          : 'An unexpected error occurred. Your data is safe.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
          style={{ background: 'rgb(var(--accent))' }}>
          🔄 Try Again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: 'rgb(var(--surface2))', color: 'rgb(var(--text))' }}>
          🏠 Go Home
        </button>
      </div>
      {error?.digest && (
        <p className="text-[10px] mt-6 font-mono" style={{ color: 'rgb(var(--muted))' }}>
          Error ID: {error.digest}
        </p>
      )}
    </div>
  )
}
