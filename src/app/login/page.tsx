'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const router = useRouter()

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Wrong email or password. / తప్పు ఇమెయిల్ లేదా పాస్‌వర్డ్'); setLoading(false) }
    else router.push('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏗️</div>
          <h1 className="text-2xl font-bold text-white">Construction Manager</h1>
          <p className="text-orange-100 text-sm mt-1">నిర్మాణ మేనేజర్</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold mb-1">Sign In / లాగిన్</h2>
          <p className="text-gray-400 text-sm mb-5">Enter your credentials</p>
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email / ఇమెయిల్</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password / పాస్‌వర్డ్</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-2.5 text-gray-400 text-sm">{showPw ? '🙈' : '👁️'}</button>
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-orange-600 text-white rounded-lg py-3 font-semibold hover:bg-orange-700 disabled:opacity-50 transition">
              {loading ? '⏳ Loading...' : 'Sign In / లాగిన్ చేయి'}
            </button>
          </form>
          {/* FIX: Added signup link */}
          <p className="text-center text-sm text-gray-500 mt-4">
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
