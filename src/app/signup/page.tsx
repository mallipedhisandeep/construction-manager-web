'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'form' | 'otp'

export default function SignupPage() {
  const [step,        setStep]        = useState<Step>('form')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [otp,         setOtp]         = useState(['','','','','','']) // 6 digits
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const inputRefs = useRef<(HTMLInputElement|null)[]>([])
  const router = useRouter()

  // ── Step 1: Send OTP ────────────────────────────────────────────
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Minimum 6 characters for password'); return }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password })
      if (err) { setError(err.message); return }
      // If session returned immediately = email confirm disabled → go straight to app
      if (data.session) { router.push('/'); return }
      // OTP sent → show OTP step
      setStep('otp')
      startResendTimer()
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  // ── Step 2: Verify OTP ──────────────────────────────────────────
  // FIX: Use 'email' type which works for both OTP token and signup confirmation
  const verifyOtp = async () => {
    const code = otp.join('')
    if (code.length < 6) { setError('Please enter all 6 digits'); return }
    setError(''); setLoading(true)
    try {
      // Try 'email' type first (works when Supabase sends OTP token)
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })
      if (err) {
        // Fallback: try 'signup' type
        const { error: err2 } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'signup',
        })
        if (err2) {
          setError('Wrong OTP or expired. Check email and try again.')
          return
        }
      }
      router.push('/')
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally { setLoading(false) }
  }

  // ── Resend OTP ──────────────────────────────────────────────────
  const resendOtp = async () => {
    if (resendTimer > 0) return
    setError(''); setLoading(true)
    try {
      // FIX: resend with correct type
      await supabase.auth.resend({ type: 'signup', email })
      setOtp(['','','','','',''])
      inputRefs.current[0]?.focus()
      startResendTimer()
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Resend failed')
    } finally { setLoading(false) }
  }

  const startResendTimer = () => {
    setResendTimer(60)
    const t = setInterval(() => {
      setResendTimer(prev => { if (prev <= 1) { clearInterval(t); return 0 } return prev - 1 })
    }, 1000)
  }

  // ── OTP box handlers ────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[index] = digit; setOtp(next)
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
  }
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (pasted.length > 0) {
      const next = [...otp]
      pasted.split('').forEach((d, i) => { if (i < 6) next[i] = d })
      setOtp(next)
      inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
    e.preventDefault()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏗️</div>
          <h1 className="text-2xl font-black text-white">Construction Manager</h1>
          <p className="text-orange-100 text-sm mt-1">నిర్మాణ మేనేజర్</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">

          {/* ── STEP 1: Form ── */}
          {step === 'form' && (
            <>
              <h2 className="text-xl font-black mb-1">Create Account</h2>
              <p className="text-gray-400 text-sm mb-5">A 6-digit OTP will be sent to your email</p>
              <form onSubmit={sendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="Min 6 characters" />
                    <button type="button" onClick={()=>setShowPw(!showPw)}
                      className="absolute right-3 top-2.5 text-gray-400 text-sm">{showPw?'🙈':'👁️'}</button>
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
                  {loading ? '⏳ Sending OTP...' : 'Send OTP to Email →'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-4">
                Already have an account?{' '}
                <Link href="/login" className="text-orange-600 font-semibold hover:underline">Sign In</Link>
              </p>
            </>
          )}

          {/* ── STEP 2: OTP Entry ── */}
          {step === 'otp' && (
            <>
              <button onClick={()=>{ setStep('form'); setError(''); setOtp(['','','','','','']) }}
                className="text-gray-400 text-sm mb-4 flex items-center gap-1 hover:text-gray-600">
                ← Back
              </button>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="text-xl font-black text-gray-800">Enter OTP</h2>
                <p className="text-gray-400 text-sm mt-1">We sent a 6-digit code to</p>
                <p className="text-orange-600 font-bold text-sm mt-0.5 break-all">{email}</p>
              </div>

              {/* 6 OTP boxes */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input key={i} ref={el => { inputRefs.current[i] = el }}
                    type="tel" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-11 h-13 text-center text-xl font-black border-2 rounded-xl focus:outline-none transition
                      ${digit ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-gray-50 text-gray-800'}
                      focus:border-orange-400`}
                    style={{ height: '52px' }}
                  />
                ))}
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2.5 text-sm mb-4 text-center">{error}</div>}

              <button onClick={verifyOtp} disabled={loading || otp.join('').length < 6}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 font-semibold disabled:opacity-50 transition mb-3">
                {loading ? '⏳ Verifying...' : '✓ Verify & Create Account'}
              </button>

              <div className="text-center mb-3">
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-400">Resend in <span className="font-bold text-orange-500">{resendTimer}s</span></p>
                ) : (
                  <button onClick={resendOtp} disabled={loading}
                    className="text-sm text-orange-600 font-semibold hover:underline disabled:opacity-50">
                    Resend OTP
                  </button>
                )}
              </div>
              <p className="text-center text-xs text-gray-400">Check spam folder if not received</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
