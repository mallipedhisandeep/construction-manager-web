'use client'
// src/app/auth/confirm/page.tsx
// Handles the ?code= exchange in the browser (for magic links / OTP).
// For Google OAuth with implicit flow, this page is never needed — the
// callback route.ts redirects straight to '/' and AppShell checks the session.

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function ConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const code = params.get('code')
    const next = params.get('next') ?? '/'

    if (!code) { router.replace('/login?error=auth_failed'); return }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error('[confirm] exchange error:', error.message)
        router.replace('/login?error=auth_failed')
      } else {
        router.replace(next)
      }
    })
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0c0c0e' }}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 border-2 border-transparent rounded-full animate-spin"
          style={{ borderTopColor: '#d48c28' }}
        />
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Signing you in…
        </p>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0c0c0e' }}>
          <div
            className="w-8 h-8 border-2 border-transparent rounded-full animate-spin"
            style={{ borderTopColor: '#d48c28' }}
          />
        </div>
      }
    >
      <ConfirmInner />
    </Suspense>
  )
}
