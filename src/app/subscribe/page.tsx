'use client'
// /subscribe — shown when trial expires or user taps "Subscribe" from profile
// Razorpay checkout integration ready — swap TODO comments with live keys when ready

import { useEffect, useState } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function SubscribePage() {
  const { lang } = useLang()
  const te = lang === 'te'
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      // ── Razorpay integration placeholder ────────────────────────────────
      // When ready, replace this block:
      //
      // 1. Call your API route to create a Razorpay subscription:
      //    const res = await fetch('/api/create-subscription', { method:'POST' })
      //    const { subscriptionId, keyId } = await res.json()
      //
      // 2. Open Razorpay checkout:
      //    const rzp = new window.Razorpay({
      //      key: keyId,
      //      subscription_id: subscriptionId,
      //      name: 'Construction Manager',
      //      description: '₹200/month subscription',
      //      handler: async (response) => {
      //        // Verify on server via webhook — don't trust client callback alone
      //        router.push('/profile')
      //      }
      //    })
      //    rzp.open()
      //
      // ── For now: show a coming-soon message ─────────────────────────────
      alert(te
        ? 'చెల్లింపు వ్యవస్థ త్వరలో అందుబాటులోకి వస్తుంది! మీకు నోటిఫికేషన్ పంపబడుతుంది.'
        : 'Payment system coming soon! You\'ll be notified when it\'s ready.')
    } finally {
      setLoading(false)
    }
  }

  const features = te ? [
    '👷 అపరిమిత కార్మికులు',
    '📋 రోజువారీ హాజరు మేనేజ్‌మెంట్',
    '🏗️ సైట్ మేనేజ్‌మెంట్ & ఫైల్స్',
    '📦 వస్తువులు & సరఫరాదారు ట్రాకింగ్',
    '💰 ఆర్థిక నివేదికలు',
    '💬 WhatsApp రిపోర్ట్ షేరింగ్',
    '🌐 తెలుగు & ఇంగ్లీష్ మద్దతు',
    '📱 PWA - హోమ్ స్క్రీన్ యాప్',
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

  return (
    <div className="page px-4 pt-4 pb-24">

      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">⭐</div>
        <h1 className="text-2xl font-black mb-1" style={{ color:'rgb(var(--text))' }}>
          {te ? 'Construction Manager Pro' : 'Construction Manager Pro'}
        </h1>
        <p className="text-sm" style={{ color:'rgb(var(--muted))' }}>
          {te ? 'మీ నిర్మాణ వ్యాపారాన్ని నిర్వహించండి' : 'Manage your construction business'}
        </p>
      </div>

      {/* Pricing card */}
      <div className="card p-5 mb-4 text-center"
        style={{ border:'1px solid rgba(var(--accent),0.3)', background:'rgba(var(--accent),0.05)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color:'rgb(var(--accent))' }}>
          {te ? 'మాసిక ప్లాన్' : 'Monthly Plan'}
        </p>
        <div className="flex items-end justify-center gap-1 mb-1">
          <span className="text-4xl font-black" style={{ color:'rgb(var(--text))' }}>₹200</span>
          <span className="text-sm mb-1.5" style={{ color:'rgb(var(--muted))' }}>
            /{te ? 'నెల' : 'month'}
          </span>
        </div>
        <p className="text-xs" style={{ color:'rgb(var(--muted))' }}>
          {te ? '≈ రోజుకు ₹6.67 · ఎప్పుడైనా రద్దు చేయవచ్చు' : '≈ ₹6.67/day · Cancel anytime'}
        </p>
      </div>

      {/* Features list */}
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

      {/* CTA */}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="btn-primary w-full py-4 text-base font-black mb-3 disabled:opacity-50">
        {loading ? '⏳...' : (te ? '⭐ ఇప్పుడు సభ్యత్వం పొందండి — ₹200/నెల' : '⭐ Subscribe Now — ₹200/month')}
      </button>

      {userEmail && (
        <p className="text-xs text-center mb-3" style={{ color:'rgb(var(--muted))' }}>
          {te ? `${userEmail} కోసం సభ్యత్వం` : `Subscribing for ${userEmail}`}
        </p>
      )}

      <button onClick={() => router.push('/profile')}
        className="w-full py-3 text-sm text-center font-medium"
        style={{ color:'rgb(var(--muted))' }}>
        ← {te ? 'వెనక్కి వెళ్ళు' : 'Back to Profile'}
      </button>
    </div>
  )
}

export default function Subscribe() { return <AppShell><SubscribePage /></AppShell> }
