'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)
  const router = useRouter()

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else setSuccess(true)
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-black text-gray-800 mb-2">Account Created!</h2>
        <p className="text-gray-500 text-sm mb-6">Check your email to confirm your account, then sign in.</p>
        <Link href="/login" className="block w-full bg-orange-600 text-white rounded-xl py-3 font-semibold text-center hover:bg-orange-700">
          Go to Sign In
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏗️</div>
          <h1 className="text-2xl font-black text-white">Construction Manager</h1>
          <p className="text-orange-100 text-sm mt-1">Create your account</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-black mb-1">Sign Up</h2>
          <p className="text-gray-400 text-sm mb-5">Free account — your data stays private</p>
          <form onSubmit={signUp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Min 8 characters" />
                <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-2.5 text-gray-400 text-sm">{showPw?'🙈':'👁️'}</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Repeat password" />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2.5 text-sm">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 font-semibold disabled:opacity-50 transition">
              {loading ? '⏳ Creating Account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-orange-600 font-semibold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
