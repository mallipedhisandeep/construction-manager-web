'use client'
import { useEffect, useState } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Razorpay types
declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => { open(): void }
  }
}
interface RazorpayOptions {
  key: string
  order_id: string
  name: string
  description: string
  prefill: { name?: string; email?: string; contact?: string }
  theme: { color: string }
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void
  modal?: { ondismiss?: () => void }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function SubscribePage() {
  const { lang } = useLang()
  const te = lang === 'te'
  const router = useRouter()
  const [loading,    setLoading]    = useState(false)
  const [status,     setStatus]     = useState<'idle'|'success'|'error'|'not_configured'>('idle')
  const [userInfo,   setUserInfo]   = useState<{ name:string; email:string } | null>(null)
  const [currentSub, setCurrentSub] = useState<{ plan:string; trial_ends_at:string|null; current_period_end:string|null } | null>(null)
  const [isTestMode, setIsTestMode] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''
      setUserInfo({ name, email: user.email ?? '' })
      // Load current sub
      supabase.from('subscriptions')
        .select('plan,status,trial_ends_at,current_period_end')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setCurrentSub(data) })
    })
  }, [])

  const handleSubscribe = async () => {
    setLoading(true)
    setStatus('idle')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // Load Razorpay script
      const loaded = await loadRazorpayScript()
      if (!loaded) { setStatus('error'); setLoading(false); return }

      // Create order on server
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'PAYMENT_NOT_CONFIGURED') {
          setStatus('not_configured')
        } else {
          setStatus('error')
        }
        setLoading(false)
        return
      }

      const { orderId, keyId, amount, currency, testMode } = data
      if (testMode) setIsTestMode(true)

      // ── TEST-MODE BYPASS ──────────────────────────────────────────────────
      // When the server returns testMode:true (rzp_test_ key + VKYC pending),
      // skip the Razorpay UI entirely and directly activate the subscription.
      if (testMode) {
        const verRes = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            razorpay_order_id:   orderId,
            razorpay_payment_id: `pay_TEST_${Date.now()}`,
            razorpay_signature:  'test_bypass',
            testMode:            true,
          }),
        })
        if (verRes.ok) {
          setStatus('success')
          setTimeout(() => router.push('/profile'), 2500)
        } else {
          setStatus('error')
        }
        setLoading(false)
        return
      }
      // ─────────────────────────────────────────────────────────────────────

      const rzp = new window.Razorpay({
        key:         keyId,
        order_id:    orderId,
        name:        'Construction Manager',
        description: '₹200/month — All Features',
        prefill:     { name: userInfo?.name, email: userInfo?.email },
        theme:       { color: '#d48c28' },
        modal:       { ondismiss: () => setLoading(false) },
        handler: async (response) => {
          // Verify on server
          const verRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(response),
          })
          if (verRes.ok) {
            setStatus('success')
            setTimeout(() => router.push('/profile'), 2500)
          } else {
            setStatus('error')
          }
          setLoading(false)
        },
      })
      rzp.open()
      // don't setLoading(false) here — wait for handler or ondismiss
    } catch (e) {
      console.error(e)
      setStatus('error')
      setLoading(false)
    }
  }

  const features = te ? [
    '👷 అపరిమిత కార్మికులు',
    '📋 రోజువారీ హాజరు మేనేజ్‌మెంట్',
    '🏗️ సైట్ మేనేజ్‌మెంట్ & ఫైల్స్',
    '📦 వస్తువులు & సరఫరాదారు ట్రాకింగ్',
    '💰 ఆర్థిక నివేదికలు & P&L',
    '💬 WhatsApp హాజరు షేరింగ్',
    '🌐 తెలుగు & ఇంగ్లీష్ మద్దతు',
    '📱 PWA — హోమ్ స్క్రీన్ యాప్',
  ] : [
    '👷 Unlimited workers',
    '📋 Daily attendance management',
    '🏗️ Site management & file storage',
    '📦 Goods & supplier tracking',
    '💰 Financial reports & P&L',
    '💬 WhatsApp attendance sharing',
    '🌐 Telugu & English support',
    '📱 PWA — install as home screen app',
  ]

  // Trial badge
  const trialEnd = currentSub?.trial_ends_at
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86400000))
    : null

  if (status === 'success') {
    return (
      <div className="page flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-black mb-2" style={{ color:'rgb(var(--text))' }}>
          {te ? 'సభ్యత్వం విజయవంతం!' : 'Subscription Activated!'}
        </h1>
        <p className="text-sm mb-6" style={{ color:'rgb(var(--muted))' }}>
          {te ? 'ప్రొఫైల్ పేజీకి తీసుకెళ్తున్నాం...' : 'Taking you to your profile...'}
        </p>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor:'rgb(var(--accent))', borderTopColor:'transparent' }} />
      </div>
    )
  }

  return (
    <div className="page px-4 pt-4 pb-24">

      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">⭐</div>
        <h1 className="text-2xl font-black mb-1" style={{ color:'rgb(var(--text))' }}>
          Construction Manager Pro
        </h1>
        <p className="text-sm" style={{ color:'rgb(var(--muted))' }}>
          {te ? 'మీ నిర్మాణ వ్యాపారాన్ని నిర్వహించండి' : 'Manage your construction business'}
        </p>
        {trialDaysLeft !== null && trialDaysLeft > 0 && (
          <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background:'rgba(var(--accent),0.12)', color:'rgb(var(--accent))' }}>
            🎁 {te ? `ట్రయల్ ${trialDaysLeft} రోజులు మిగిలాయి` : `${trialDaysLeft} trial days left`}
          </div>
        )}
      </div>

      {/* Pricing card */}
      <div className="card p-5 mb-4 text-center"
        style={{ border:'1px solid rgba(var(--accent),0.3)', background:'rgba(var(--accent),0.05)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color:'rgb(var(--accent))' }}>
          {te ? 'మాసిక ప్లాన్' : 'Monthly Plan'}
        </p>
        <div className="flex items-end justify-center gap-1 mb-1">
          <span className="text-4xl font-black" style={{ color:'rgb(var(--text))' }}>₹200</span>
          <span className="text-sm mb-1.5" style={{ color:'rgb(var(--muted))' }}>/{te ? 'నెల' : 'month'}</span>
        </div>
        <p className="text-xs" style={{ color:'rgb(var(--muted))' }}>
          {te ? '≈ రోజుకు ₹6.67 · ఎప్పుడైనా రద్దు చేయవచ్చు' : '≈ ₹6.67/day · Cancel anytime'}
        </p>
      </div>

      {/* Features */}
      <div className="card p-4 mb-5">
        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color:'rgb(var(--muted))' }}>
          {te ? 'అన్నీ ఇందులో ఉన్నాయి' : "Everything's included"}
        </p>
        <div className="space-y-2">
          {features.map(f => (
            <div key={f} className="flex items-center gap-2.5">
              <span className="text-green-500 font-black text-sm flex-shrink-0">✓</span>
              <p className="text-sm" style={{ color:'rgb(var(--text))' }}>{f}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status messages */}
      {/* Test-mode info — shown when server detects rzp_test_ key */}
      {isTestMode && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ background:'rgba(59,130,246,0.1)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.2)' }}>
          🧪 <strong>{te ? 'టెస్ట్ మోడ్:' : 'Test Mode:'}</strong>{' '}
          {te
            ? 'VKYC పెండింగ్ ఉంది. చెల్లింపు లేకుండా సభ్యత్వం యాక్టివేట్ అవుతుంది.'
            : 'VKYC pending — subscription will activate without real payment.'}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm font-semibold"
          style={{ background:'rgba(220,38,38,0.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,0.2)' }}>
          {te ? 'చెల్లింపు విఫలమైంది. మళ్ళీ ప్రయత్నించండి.' : 'Payment failed. Please try again.'}
        </div>
      )}
      {status === 'not_configured' && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm font-semibold"
          style={{ background:'rgba(var(--accent),0.1)', color:'rgb(var(--accent))', border:'1px solid rgba(var(--accent),0.2)' }}>
          {te
            ? 'చెల్లింపు వ్యవస్థ త్వరలో అందుబాటులోకి వస్తుంది! Razorpay కీలు కాన్ఫిగర్ చేయాల్సి ఉంది.'
            : 'Payment coming soon! Razorpay keys need to be configured in environment variables.'}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="btn-primary w-full py-4 text-base font-black mb-3 disabled:opacity-50">
        {loading
          ? (te ? '⏳ ప్రాసెస్ అవుతోంది...' : '⏳ Processing...')
          : (te ? '⭐ ఇప్పుడు సభ్యత్వం పొందండి — ₹200/నెల' : '⭐ Subscribe Now — ₹200/month')}
      </button>

      {userInfo?.email && (
        <p className="text-xs text-center mb-3" style={{ color:'rgb(var(--muted))' }}>
          {te ? `${userInfo.email} కోసం సభ్యత్వం` : `Subscribing for ${userInfo.email}`}
        </p>
      )}

      <div className="flex items-center gap-2 justify-center mb-4">
        <span className="text-lg">🔒</span>
        <p className="text-xs" style={{ color:'rgb(var(--muted))' }}>
          {te ? 'Razorpay ద్వారా సురక్షిత చెల్లింపు' : 'Secured by Razorpay · UPI, Cards, Net Banking'}
        </p>
      </div>

      <button onClick={() => router.push('/profile')}
        className="w-full py-3 text-sm text-center font-medium"
        style={{ color:'rgb(var(--muted))' }}>
        ← {te ? 'వెనక్కి వెళ్ళు' : 'Back to Profile'}
      </button>
    </div>
  )
}

export default function Subscribe() { return <AppShell><SubscribePage /></AppShell> }
