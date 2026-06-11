'use client'
// auth/confirm — handles the PKCE code exchange when Supabase redirects
// to /auth/confirm?code=... (magic links, email OTP flows).

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function ConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const code = params.get('code')
    const next = params.get('next') ?? '/'

    const goHome  = () => router.replace(next)
    const goLogin = () => router.replace('/login?error=auth_failed')

    const tryFallback = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) goHome(); else goLogin()
    }

    if (!code) { tryFallback(); return }

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error) { console.warn('[confirm]', error.message); await tryFallback() }
      else if (data?.session) goHome()
      else await tryFallback()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage:    'url(/login-bg.jpg)',
        backgroundSize:     'cover',
        backgroundPosition: 'center center',
        backgroundRepeat:   'no-repeat',
      }}>
      <div className="absolute inset-0"
        style={{ background:'linear-gradient(180deg,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0.6) 55%,rgba(0,0,0,0.9) 100%)' }}/>
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor:'#d48c28', borderRightColor:'rgba(212,140,40,0.2)', animationDuration:'0.9s' }}/>
          <div className="absolute inset-1.5 rounded-full flex items-center justify-center"
            style={{ background:'rgba(212,140,40,0.08)', border:'1px solid rgba(212,140,40,0.2)' }}>
            <span className="font-black text-base" style={{ color:'#d48c28' }}>CM</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-black tracking-widest uppercase" style={{ color:'rgba(255,255,255,0.85)' }}>
            Signing you in
          </p>
          <p className="text-xs mt-1" style={{ color:'rgba(212,140,40,0.7)' }}>
            లాగిన్ అవుతోంది...
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundImage:'url(/login-bg.jpg)', backgroundSize:'cover', backgroundPosition:'center' }}>
        <div className="absolute inset-0" style={{ background:'rgba(0,0,0,0.7)' }}/>
        <div className="relative w-8 h-8 border-2 border-transparent rounded-full animate-spin"
          style={{ borderTopColor:'#d48c28' }}/>
      </div>
    }>
      <ConfirmInner />
    </Suspense>
  )
}
