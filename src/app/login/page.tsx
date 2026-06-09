'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function LoginInner() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') setError('Sign-in failed. Please try again.')
    if (searchParams.get('error') === 'config') setError('Configuration error. Contact support.')
  }, [searchParams])

  const signIn = async () => {
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) { setError(error.message); setLoading(false) }
    } catch { setError('Something went wrong. Try again.'); setLoading(false) }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-end relative overflow-hidden"
      style={{
        backgroundImage:    'url(/login-bg.jpg)',
        backgroundSize:     'cover',
        backgroundPosition: 'center center',
        backgroundRepeat:   'no-repeat',
        paddingBottom:      'max(56px, env(safe-area-inset-bottom, 56px))',
      }}>
      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{background:'linear-gradient(180deg,rgba(0,0,0,0.0) 0%,rgba(0,0,0,0.15) 40%,rgba(4,3,1,0.96) 100%)'}}/>

      {/* Bottom sign-in area only — NO icon, NO title, NO subtitle */}
      <div className="relative z-10 w-full max-w-sm px-6">
        {error && (
          <div className="mb-5 px-4 py-3 rounded-2xl text-sm text-center"
            style={{background:'rgba(185,28,28,0.35)',border:'1px solid rgba(239,68,68,0.4)',color:'#fca5a5'}}>
            {error}
          </div>
        )}
        <button onClick={signIn} disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-bold rounded-2xl py-4 text-[15px] transition-all active:scale-[0.98] disabled:opacity-60 select-none"
          style={{boxShadow:'0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)'}}>
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin"/>
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
          )}
          <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
        </button>
        <p className="text-center text-xs mt-4 select-none" style={{color:'rgba(255,255,255,0.28)'}}>
          Google తో కొనసాగించండి
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{backgroundImage:'url(/login-bg.jpg)',backgroundSize:'cover',backgroundPosition:'center'}}>
        <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.6)'}}/>
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}
