'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [error,    setError]    = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const router = useRouter()

  // ── Email + Password sign-in ──────────────────────────────
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message.includes('Invalid') || error.message.includes('credentials')
        ? 'Wrong email or password. / తప్పు ఇమెయిల్ లేదా పాస్‌వర్డ్'
        : error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  // ── Google OAuth sign-in ──────────────────────────────────
  const signInWithGoogle = async () => {
    setGLoading(true); setError('')
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
    if (error) {
      setError(error.message)
      setGLoading(false)
    }
    // On success, browser navigates away to Google — no need to setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏗️</div>
          <h1 className="text-2xl font-black text-white">Construction Manager</h1>
          <p className="text-orange-100 text-sm mt-1">నిర్మాణ మేనేజర్</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-black text-gray-800">Sign In / లాగిన్</h2>
            <p className="text-gray-400 text-sm mt-0.5">Choose your sign-in method</p>
          </div>

          {/* Google button */}
          <button
            onClick={signInWithGoogle}
            disabled={gLoading || loading}
            className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gLoading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,19.001,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
            )}
            {gLoading ? 'Redirecting to Google...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email/password form */}
          <form onSubmit={signIn} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Email / ఇమెయిల్
              </label>
              <input
                type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                placeholder="you@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Password / పాస్‌వర్డ్
              </label>
              <div className="relative">
                <input
                  type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button type="button" onClick={()=>setShowPw(!showPw)}
                  className="absolute right-3 top-2.5 text-gray-400 text-sm"
                >{showPw?'🙈':'👁️'}</button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading||gLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 font-semibold disabled:opacity-50 transition"
            >
              {loading ? '⏳ Signing in...' : 'Sign In / లాగిన్ చేయి'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-orange-600 font-semibold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
