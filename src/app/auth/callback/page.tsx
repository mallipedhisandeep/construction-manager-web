// src/app/auth/callback/page.tsx
// This page handles the CLIENT-SIDE token exchange (hash fragment flow).
// Some OAuth flows return tokens in the URL hash (#access_token=...) 
// instead of as a query param. This page catches those.
'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    if (error) {
      router.replace('/login?error=auth_failed')
      return
    }

    // Give Supabase a moment to pick up the session from the URL hash,
    // then check if we have a valid session
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace('/')
      } else {
        // Try listening for the auth state change (hash flow)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            subscription.unsubscribe()
            router.replace('/')
          }
        })
        // Fallback after 5s
        setTimeout(() => {
          subscription.unsubscribe()
          router.replace('/login?error=auth_failed')
        }, 5000)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [router, error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{background:'linear-gradient(160deg, #0a0e16 0%, #111827 100%)'}}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background:'linear-gradient(135deg,#0f1828,#1a2540)',
            border:'2px solid rgba(212,140,40,0.4)',
            boxShadow:'0 0 30px rgba(212,140,40,0.2)'
          }}>
          <span style={{fontSize:'2rem',lineHeight:1}}>🏗️</span>
          <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{borderTopColor:'#d48c28',borderRightColor:'rgba(212,140,40,0.25)'}}/>
        </div>
        <p className="text-sm font-bold tracking-widest uppercase"
          style={{color:'rgba(212,140,40,0.9)', letterSpacing:'0.15em'}}>
          Signing you in...
        </p>
        <p className="text-xs" style={{color:'rgba(255,255,255,0.35)'}}>
          లాగిన్ అవుతోంది...
        </p>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{background:'#0a0e16'}}>
        <div className="w-8 h-8 border-2 border-transparent rounded-full animate-spin"
          style={{borderTopColor:'#d48c28'}}/>
      </div>
    }>
      <CallbackInner />
    </Suspense>
  )
}
