'use client'
// src/app/auth/confirm/page.tsx
//
// Runs in the BROWSER. Exchanges the ?code= for a Supabase session.
//
// PWA/Android fix:
//   Android Chrome opens OAuth in a NEW Custom Tab. When it redirects back,
//   the PWA (standalone) context restarts — localStorage may be cleared or
//   the PKCE verifier may be missing because it was written in the Custom Tab.
//
//   Our fix has two layers:
//   1. storageKey: 'cm-auth-token' in supabase.ts ensures the verifier key
//      is consistent across all contexts (PWA + browser tab).
//   2. If exchangeCodeForSession fails anyway, we check for an existing
//      session (Supabase sometimes completes it automatically) and redirect
//      to the app if found. Otherwise we fall back to /login.
//
//   The code is also stored in a cookie by route.ts (cm_oauth_code) as a
//   backup in case URL params are stripped by the browser on PWA re-launch.

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Read a cookie by name
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

// Delete a cookie
function deleteCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/`
}

function ConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    // Get code from URL params first, fallback to cookie (PWA re-launch)
    const urlCode = params.get('code')
    const cookieCode = getCookie('cm_oauth_code')
    const code = urlCode ?? cookieCode
    const next = params.get('next') ?? '/'

    // Clean up the cookie immediately so it's not reused
    if (cookieCode) deleteCookie('cm_oauth_code')

    const goHome = () => router.replace(next)
    const goLogin = () => router.replace('/login?error=auth_failed')

    const trySessionFallback = async () => {
      // Maybe Supabase already handled the session via detectSessionInUrl
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { goHome() } else { goLogin() }
    }

    if (!code) {
      // No code anywhere — check if already signed in
      trySessionFallback()
      return
    }

    // Try to exchange the code
    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error) {
        console.warn('[confirm] exchangeCodeForSession failed:', error.message)
        // PKCE verifier missing (common in Android PWA) — use fallback
        await trySessionFallback()
      } else if (data?.session) {
        goHome()
      } else {
        await trySessionFallback()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0c0c0e' }}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: '#d48c28',
              borderRightColor: 'rgba(212,140,40,0.2)',
              animationDuration: '0.9s',
            }}
          />
          <div
            className="absolute inset-2 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(212,140,40,0.06)', border: '1px solid rgba(212,140,40,0.15)' }}
          >
            <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
              <text x="0" y="26" fontFamily="Georgia,serif" fontWeight="900" fontSize="18" fill="#b0b0b0">C</text>
              <text x="16" y="26" fontFamily="Georgia,serif" fontWeight="900" fontSize="17" fill="#d48c28">M</text>
            </svg>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(212,140,40,0.7)' }}>
            Signing you in
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            లాగిన్ అవుతోంది...
          </p>
        </div>
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
