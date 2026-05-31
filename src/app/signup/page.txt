'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  // ── Google OAuth (easiest — no email confirm needed) ──────
  const signUpWithGoogle = async () => {
    setGLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) { setError(error.message); setGLoading(false) }
  }

  // ── Email + Password sign-up ──────────────────────────────
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match / పాస్‌వర్డ్లు సరిపోలలేదు'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else setSuccess(true)
  }

  // ── Success screen ────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-xl font-black text-gray-800 mb-2">Check Your Email</h2>
        <p className="text-gray-500 text-sm mb-2">
          We sent a confirmation link to <strong>{email}</strong>
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Click the link in the email to activate your account, then sign in.
          <br/>
          <span className="text-orange-500">Tip: check your spam/junk folder too.</span>
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
          <strong>Not getting the email?</strong> Ask your admin to disable email confirmation in Supabase → Authentication → Settings.
        </div>
        <Link href="/login"
          className="block w-full bg-orange-600 text-white rounded-xl py-3 font-semibold text-center hover:bg-orange-700 transition">
          Go to Sign In
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏗️</div>
          <h1 className="text-2xl font-black text-white">Construction Manager</h1>
          <p className="text-orange-100 text-sm mt-1">కొత్త ఖాతా తయారు చేయి</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-black text-gray-800">Create Account</h2>
            <p className="text-gray-400 text-sm mt-0.5">Sign up to get started</p>
          </div>

          {/* Google — recommended */}
          <button
            onClick={signUpWithGoogle}
            disabled={gLoading || loading}
            className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl py-3 transition disabled:opacity-50"
          >
            {gLoading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,19.001,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
            )}
            {gLoading ? 'Redirecting...' : 'Sign up with Google (Recommended)'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">OR with email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={signUp} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                placeholder="you@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                  required minLength={8} placeholder="Min 8 characters"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-2.5 text-gray-400 text-sm">{showPw?'🙈':'👁️'}</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required
                placeholder="Repeat password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading||gLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 font-semibold disabled:opacity-50 transition">
              {loading ? '⏳ Creating...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-orange-600 font-semibold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
