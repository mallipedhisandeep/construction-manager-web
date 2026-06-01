'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const signInWithGoogle = async () => {
    setLoading(true); setError('')
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-end pb-16 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0f00 30%, #2d1800 55%, #7c3d00 80%, #c45a00 100%)'
      }}>
      {/* Dark overlay grid pattern */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(rgba(255,165,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,165,0,0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}/>

      {/* Construction silhouette - building frame */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 400 500" className="w-full h-full opacity-20" preserveAspectRatio="xMidYMid slice">
          {/* Building skeleton */}
          <rect x="80" y="120" width="240" height="320" fill="none" stroke="#f97316" strokeWidth="2"/>
          {/* Floors */}
          {[160,200,240,280,320,360].map((y,i) => <line key={i} x1="80" y1={y} x2="320" y2={y} stroke="#f97316" strokeWidth="1.5"/>)}
          {/* Vertical columns */}
          {[130,175,225,270,310].map((x,i) => <line key={i} x1={x} y1="120" x2={x} y2="440" stroke="#f97316" strokeWidth="1.5"/>)}
          {/* Crane */}
          <line x1="300" y1="20" x2="300" y2="130" stroke="#f97316" strokeWidth="3"/>
          <line x1="200" y1="20" x2="360" y2="20" stroke="#f97316" strokeWidth="3"/>
          <line x1="240" y1="20" x2="300" y2="130" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4,3"/>
          <line x1="340" y1="20" x2="340" y2="60" stroke="#f97316" strokeWidth="2"/>
          {/* Rebar sticking up */}
          {[100,140,200,260,300].map((x,i) => <line key={i} x1={x} y1="120" x2={x} y2="80" stroke="#f97316" strokeWidth="1.5" strokeDasharray="2,4"/>)}
        </svg>
      </div>

      {/* Orange glow bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-64 opacity-30"
        style={{background:'radial-gradient(ellipse at 50% 100%, #f97316 0%, transparent 70%)'}}/>

      {/* Dot accent - top right */}
      <div className="absolute top-20 right-8 opacity-40">
        {[0,1,2,3].map(row => (
          <div key={row} className="flex gap-2 mb-2">
            {[0,1,2,3].map(col => <div key={col} className="w-1 h-1 rounded-full bg-orange-400"/>)}
          </div>
        ))}
      </div>
      {/* Dot accent - bottom left */}
      <div className="absolute bottom-48 left-6 opacity-30">
        {[0,1,2].map(row => (
          <div key={row} className="flex gap-2 mb-2">
            {[0,1,2].map(col => <div key={col} className="w-1 h-1 rounded-full bg-orange-400"/>)}
          </div>
        ))}
      </div>

      {/* Logo + Brand */}
      <div className="relative z-10 flex flex-col items-center mb-12">
        {/* CM Logo */}
        <div className="mb-6 relative">
          {/* Metallic C */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-2xl">
              {/* C letter - metallic silver */}
              <defs>
                <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d0d0d0"/>
                  <stop offset="40%" stopColor="#f5f5f5"/>
                  <stop offset="70%" stopColor="#a0a0a0"/>
                  <stop offset="100%" stopColor="#c0c0c0"/>
                </linearGradient>
                <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316"/>
                  <stop offset="50%" stopColor="#fb923c"/>
                  <stop offset="100%" stopColor="#c2410c"/>
                </linearGradient>
              </defs>
              {/* C arc */}
              <path d="M90 25 A45 45 0 1 0 90 95 L78 83 A30 30 0 1 1 78 37 Z" fill="url(#silverGrad)"/>
              {/* Building bars inside C */}
              <rect x="44" y="45" width="4" height="30" rx="1" fill="#888" opacity="0.8"/>
              <rect x="51" y="38" width="4" height="37" rx="1" fill="#aaa" opacity="0.9"/>
              <rect x="58" y="33" width="4" height="42" rx="1" fill="#999" opacity="0.85"/>
              {/* M letter - orange */}
              <text x="62" y="88" fontSize="36" fontWeight="900" fontFamily="Arial Black, sans-serif" fill="url(#orangeGrad)" letterSpacing="-1">M</text>
              {/* Crane on top of M */}
              <line x1="83" y1="55" x2="83" y2="70" stroke="#f97316" strokeWidth="2.5"/>
              <line x1="70" y1="55" x2="96" y2="55" stroke="#f97316" strokeWidth="2.5"/>
              <line x1="73" y1="55" x2="83" y2="70" stroke="#f97316" strokeWidth="1.5"/>
              <line x1="93" y1="55" x2="93" y2="62" stroke="#f97316" strokeWidth="1.5"/>
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">CONSTRUCTION</h1>
        <div className="flex items-center gap-3 mt-1">
          <div className="h-0.5 w-8 bg-orange-500"/>
          <span className="text-orange-400 font-black text-lg tracking-widest">MANAGER</span>
          <div className="h-0.5 w-8 bg-orange-500"/>
        </div>
        <p className="text-orange-300/70 text-sm mt-1 font-medium">నిర్మాణ మేనేజర్</p>
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm px-5">
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-300 rounded-2xl px-4 py-3 text-sm mb-4 text-center">
            {error}
          </div>
        )}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-2xl py-4 text-base shadow-2xl transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{boxShadow:'0 0 40px rgba(249,115,22,0.3)'}}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
          ) : (
            <svg width="22" height="22" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,19.001,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
          )}
          <span>{loading ? 'Google లోకి వెళ్తున్నారు...' : 'Continue with Google'}</span>
        </button>
        <p className="text-center text-orange-400/60 text-xs mt-4 font-medium">
          Google తో కొనసాగించండి
        </p>
      </div>
    </div>
  )
}
