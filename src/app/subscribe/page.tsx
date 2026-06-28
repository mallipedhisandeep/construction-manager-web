'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PRICING } from '@/lib/pricing'

declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => { open(): void }
  }
}
interface RazorpayOptions {
  key: string
  subscription_id: string
  name: string
  description: string
  prefill: { name?: string; email?: string }
  theme: { color: string }
  handler: () => void
  modal?: { ondismiss?: () => void }
}

const RZP_URL = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) { resolve(true); return }
    const existing = document.getElementById('rzp-script') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load',  () => resolve(!!window.Razorpay))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.id    = 'rzp-script'
    s.src   = RZP_URL
    s.async = false
    s.onload  = () => resolve(!!window.Razorpay)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

type Cycle = 'monthly' | 'yearly'

function SubscribePage() {
  const { lang } = useLang()
  const te = lang === 'te'
  const router = useRouter()

  const [cycle,      setCycle]      = useState<Cycle>('monthly')
  const [loading,    setLoading]    = useState(false)
  const [status,     setStatus]     = useState<'idle' | 'success' | 'error' | 'not_configured'>('idle')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [userInfo,   setUserInfo]   = useState<{ name: string; email: string } | null>(null)
  const [currentSub, setCurrentSub] = useState<{
    plan: string; status: string; trial_ends_at: string | null; current_period_end: string | null
  } | null>(null)

  useEffect(() => {
    loadRazorpay()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''
      setUserInfo({ name, email: user.email ?? '' })
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
    setErrorMsg('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const ready = await loadRazorpay()
      if (!ready) {
        setErrorMsg('Could not load payment SDK. Please check your internet connection and try again.')
        setStatus('error')
        setLoading(false)
        return
      }

      // Create a recurring Razorpay Subscription (not a one-time order).
      const res = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle }),
      })

      let body: Record<string, string> = {}
      try { body = await res.json() } catch { /* empty */ }

      if (!res.ok) {
        setStatus(body.error === 'PAYMENT_NOT_CONFIGURED' ? 'not_configured' : 'error')
        setErrorMsg(body.error ?? `Server error ${res.status}`)
        setLoading(false)
        return
      }

      const { subscriptionId, keyId } = body

      const rzp = new window.Razorpay({
        key:              keyId,
        subscription_id:  subscriptionId,
        name:             'Construction Manager',
        description:      cycle === 'monthly' ? `₹${PRICING.monthly.amountRupees}/month — All Features` : `₹${PRICING.yearly.amountRupees}/year — All Features`,
        prefill:          { name: userInfo?.name ?? '', email: userInfo?.email ?? '' },
        theme:            { color: '#d48c28' },

        // The mandate authorization itself is confirmed here, but the
        // actual subscription activation (and writing to our DB) happens
        // via the /api/razorpay/webhook subscription.activated event —
        // that's the source of truth, not this client-side handler. We
        // just show a success screen and let the webhook catch up
        // (usually within a second or two).
        handler: () => {
          setStatus('success')
          setTimeout(() => router.push('/profile'), 3000)
          setLoading(false)
        },

        modal: { ondismiss: () => setLoading(false) },
      })

      rzp.open()

    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
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

  const trialEnd = currentSub?.trial_ends_at
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86400000))
    : null

  const isPastDue = currentSub?.status === 'past_due'

  if (status === 'success') {
    return (
      <div className="page flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-black mb-2" style={{ color: 'rgb(var(--text))' }}>
          {te ? 'సభ్యత్వం విజయవంతం!' : 'Subscription Activated!'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'rgb(var(--muted))' }}>
          {te ? 'ప్రొఫైల్ పేజీకి తీసుకెళ్తున్నాం...' : 'Redirecting to your profile...'}
        </p>
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: 'rgb(var(--accent))', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="page px-4 pt-4 pb-24">

      <div className="text-center mb-6">
        <div className="text-5xl mb-3">⭐</div>
        <h1 className="text-2xl font-black mb-1" style={{ color: 'rgb(var(--text))' }}>
          Construction Manager Pro
        </h1>
        <p className="text-sm" style={{ color: 'rgb(var(--muted))' }}>
          {te ? 'మీ నిర్మాణ వ్యాపారాన్ని నిర్వహించండి' : 'Manage your construction business'}
        </p>
        {trialDaysLeft !== null && trialDaysLeft > 0 && (
          <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(var(--accent),0.12)', color: 'rgb(var(--accent))' }}>
            🎁 {te ? `ట్రయల్ ${trialDaysLeft} రోజులు మిగిలాయి` : `${trialDaysLeft} trial days left`}
          </div>
        )}
        {isPastDue && (
          <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
            ⚠️ {te ? 'చివరి చెల్లింపు విఫలమైంది' : 'Last payment failed — please renew'}
          </div>
        )}
      </div>

      {/* Plan toggle */}
      <div className="flex items-center gap-1.5 mb-2">
      </div>
      <div className="flex gap-2 mb-4 p-1 rounded-2xl" style={{ background: 'rgb(var(--surface2))' }}>
        <button onClick={() => setCycle('monthly')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: cycle === 'monthly' ? 'rgb(var(--accent))' : 'transparent',
            color:      cycle === 'monthly' ? '#fff' : 'rgb(var(--text))',
          }}>
          {te ? 'మాసిక' : 'Monthly'}
        </button>
        <button onClick={() => setCycle('yearly')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative"
          style={{
            background: cycle === 'yearly' ? 'rgb(var(--accent))' : 'transparent',
            color:      cycle === 'yearly' ? '#fff' : 'rgb(var(--text))',
          }}>
          {te ? 'వార్షిక' : 'Yearly'}
          <span className="absolute -top-2 -right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: '#4caf50', color: '#fff' }}>
            {te ? 'ఆదా' : 'SAVE 13%'}
          </span>
        </button>
      </div>

      <div className="card p-5 mb-4 text-center"
        style={{ border: '1px solid rgba(var(--accent),0.3)', background: 'rgba(var(--accent),0.05)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgb(var(--accent))' }}>
          {cycle === 'monthly' ? (te ? 'మాసిక ప్లాన్' : 'Monthly Plan') : (te ? 'వార్షిక ప్లాన్' : 'Yearly Plan')}
        </p>
        <div className="flex items-end justify-center gap-1 mb-1">
          <span className="text-4xl font-black" style={{ color: 'rgb(var(--text))' }}>
            {cycle === 'monthly' ? `₹${PRICING.monthly.amountRupees}` : `₹${PRICING.yearly.amountRupees}`}
          </span>
          <span className="text-sm mb-1.5" style={{ color: 'rgb(var(--muted))' }}>
            /{cycle === 'monthly' ? (te ? 'నెల' : 'month') : (te ? 'సంవత్సరం' : 'year')}
          </span>
        </div>
        <p className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
          {cycle === 'monthly'
            ? (te ? '≈ రోజుకు ₹8 · ఆటో-రెన్యూవల్, ఎప్పుడైనా రద్దు చేయవచ్చు' : '≈ ₹8/day · Auto-renews monthly, cancel anytime')
            : (te ? '≈ నెలకు ₹208 · ఆటో-రెన్యూవల్, ఎప్పుడైనా రద్దు చేయవచ్చు' : '≈ ₹208/month · Auto-renews yearly, cancel anytime')}
        </p>
      </div>

      <div className="card p-4 mb-5">
        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'rgb(var(--muted))' }}>
          {te ? 'అన్నీ ఇందులో ఉన్నాయి' : "Everything's included"}
        </p>
        <div className="space-y-2">
          {features.map(f => (
            <div key={f} className="flex items-center gap-2.5">
              <span className="text-green-500 font-black text-sm flex-shrink-0">✓</span>
              <p className="text-sm" style={{ color: 'rgb(var(--text))' }}>{f}</p>
            </div>
          ))}
        </div>
      </div>

      {status === 'error' && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm font-semibold"
          style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}>
          ❌ {errorMsg || (te ? 'చెల్లింపు విఫలమైంది. మళ్ళీ ప్రయత్నించండి.' : 'Payment failed. Please try again.')}
        </div>
      )}
      {status === 'not_configured' && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm font-semibold"
          style={{ background: 'rgba(var(--accent),0.1)', color: 'rgb(var(--accent))', border: '1px solid rgba(var(--accent),0.2)' }}>
          {te ? 'చెల్లింపు వ్యవస్థ కాన్ఫిగర్ కాలేదు.' : 'Payment not configured. Contact support.'}
        </div>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="btn-primary w-full py-4 text-base font-black mb-3 disabled:opacity-50">
        {loading
          ? (te ? '⏳ ప్రాసెస్ అవుతోంది...' : '⏳ Processing...')
          : (te
              ? `⭐ ఇప్పుడు సభ్యత్వం పొందండి — ${cycle === 'monthly' ? `₹${PRICING.monthly.amountRupees}/నెల` : `₹${PRICING.yearly.amountRupees}/సంవత్సరం`}`
              : `⭐ Subscribe Now — ${cycle === 'monthly' ? `₹${PRICING.monthly.amountRupees}/month` : `₹${PRICING.yearly.amountRupees}/year`}`)}
      </button>

      {userInfo?.email && (
        <p className="text-xs text-center mb-3" style={{ color: 'rgb(var(--muted))' }}>
          {te ? `${userInfo.email} కోసం సభ్యత్వం` : `Subscribing for ${userInfo.email}`}
        </p>
      )}

      <div className="flex items-center gap-2 justify-center mb-4">
        <span className="text-lg">🔒</span>
        <p className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
          {te ? 'Razorpay ద్వారా సురక్షిత చెల్లింపు' : 'Secured by Razorpay · UPI, Cards, Net Banking'}
        </p>
      </div>

      <button onClick={() => router.push('/profile')}
        className="w-full py-3 text-sm text-center font-medium"
        style={{ color: 'rgb(var(--muted))' }}>
        ← {te ? 'వెనక్కి వెళ్ళు' : 'Back to Profile'}
      </button>
    </div>
  )
}

export default function Subscribe() { return <SubscribePage /> }
