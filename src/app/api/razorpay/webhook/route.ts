// POST /api/razorpay/webhook
//
// Razorpay calls this URL directly (not the browser) whenever a
// subscription event happens: activated, charged (renewal succeeded),
// cancelled, halted (renewal failed repeatedly), or completed (ran out of
// total_count cycles). This is what keeps `subscriptions.current_period_end`
// moving forward automatically — no user action needed after the first
// mandate authorization.
//
// Configure in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<your-domain>/api/razorpay/webhook
//   Secret: must match RAZORPAY_WEBHOOK_SECRET in Vercel env vars
//   Events: subscription.activated, subscription.charged,
//           subscription.cancelled, subscription.completed,
//           subscription.halted

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { claimWebhookEvent, notifyUser, notifyAdmin } from '@/lib/push'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { sendEmail, subscriptionConfirmedEmail } from '@/lib/email'
import { logError, logEvent } from '@/lib/logger'
import { PRICING, type BillingCycle } from '@/lib/pricing'

const CYCLE_DAYS: Record<string, number> = { monthly: 30, yearly: 365 }

export async function POST(req: Request) {
  // Generous limit — this endpoint receives real, legitimate traffic from
  // Razorpay's own servers (every charge, every renewal). The limit exists
  // only to stop someone spamming the URL directly, not to throttle
  // Razorpay itself.
  const limit = rateLimit(`razorpay-webhook:${clientIp(req)}`, 120, 60_000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret) {
    console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  // Timing-safe comparison — a plain !== leaks timing information about
  // how many leading characters matched, which in theory helps an attacker
  // forge a valid signature byte-by-byte. timingSafeEqual takes the same
  // time regardless of where the mismatch occurs. Buffers must be equal
  // length first, or timingSafeEqual itself throws.
  const expectedBuf = Buffer.from(expected, 'hex')
  const signatureBuf = Buffer.from(signature, 'hex')
  const signatureValid =
    expectedBuf.length === signatureBuf.length &&
    crypto.timingSafeEqual(expectedBuf, signatureBuf)

  if (!signatureValid) {
    logEvent('Razorpay webhook signature mismatch', { route: 'razorpay-webhook', ip: clientIp(req) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const payload = JSON.parse(rawBody)
  const event = payload.event as string
  const sub = payload.payload?.subscription?.entity
  const subId = sub?.id

  if (!event || !subId) {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })
  }

  // Razorpay redelivers on timeout/non-2xx — every (event, subscription,
  // timestamp) combination should only be processed once.
  const eventId = `razorpay:${payload.id ?? `${event}:${subId}:${payload.created_at}`}`
  const isNew = await claimWebhookEvent(eventId)
  if (!isNew) return NextResponse.json({ success: true, deduped: true })

  const admin = createAdminClient()
  const cycle = (sub.notes?.cycle as string) ?? 'monthly'
  const userId = sub.notes?.user_id as string | undefined

  console.log('[razorpay-webhook] Event:', event, 'sub:', subId, 'user:', userId)

  switch (event) {
    case 'subscription.activated': {
      // First successful payment — mandate is now live.
      if (!userId) break
      const periodEnd = new Date(Date.now() + (CYCLE_DAYS[cycle] ?? 30) * 86400000).toISOString()
      await admin.from('subscriptions').upsert({
        user_id:              userId,
        plan:                 'pro',
        status:               'active',
        trial_ends_at:        null,
        billing_cycle:        cycle,
        razorpay_sub_id:      subId,
        razorpay_plan_id:     sub.plan_id,
        current_period_end:   periodEnd,
        cancel_at_period_end: false,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'user_id' })

      const userEmail = sub.notes?.email as string | undefined
      if (userEmail) {
        const billingCycle = (cycle as BillingCycle) in PRICING ? (cycle as BillingCycle) : 'monthly'
        const { subject, html } = subscriptionConfirmedEmail(billingCycle, PRICING[billingCycle].amountRupees)
        sendEmail({ to: userEmail, subject, html }).catch(e => logError(e, { route: 'razorpay-webhook', event, userId }))
      }

      notifyAdmin({
        title: '💰 New subscription',
        body:  `User just subscribed (${cycle})`,
        url:   '/admin?tab=subs',
        tag:   'new-subscription',
      }).catch(e => logError(e, { route: 'razorpay-webhook', event, userId }))
      break
    }

    case 'subscription.charged': {
      // A renewal payment succeeded — push current_period_end forward.
      // This is the event that makes "pay once a month" actually recur.
      if (!userId) break
      const periodEnd = new Date(Date.now() + (CYCLE_DAYS[cycle] ?? 30) * 86400000).toISOString()
      await admin.from('subscriptions').update({
        plan:                'pro',
        status:              'active',
        current_period_end:  periodEnd,
        last_reminder_sent_at: null, // reset so next cycle's reminders can fire again
        updated_at:          new Date().toISOString(),
      }).eq('razorpay_sub_id', subId)
      break
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      // Cancelled by user/admin, or ran out of total_count cycles. Their
      // data is never touched — only future access is affected, and only
      // once current_period_end (already set) actually passes.
      await admin.from('subscriptions').update({
        status:               'cancelled',
        cancel_at_period_end: true,
        updated_at:           new Date().toISOString(),
      }).eq('razorpay_sub_id', subId)
      break
    }

    case 'subscription.halted': {
      // Razorpay tried to charge the renewal and failed repeatedly (e.g.
      // card expired, insufficient funds, mandate revoked). Access lapses
      // once current_period_end passes — same outcome as a normal expiry,
      // but flagged distinctly so the UI can say "payment failed" instead
      // of "expired", and so the user knows to update their payment method.
      await admin.from('subscriptions').update({
        status:     'past_due',
        updated_at: new Date().toISOString(),
      }).eq('razorpay_sub_id', subId)

      if (userId) {
        notifyUser(userId, {
          title: '⚠️ Payment failed',
          body:  'We could not renew your subscription. Please update your payment method to keep access.',
          url:   '/subscribe',
          tag:   'payment-failed',
        }).catch(e => logError(e, { route: 'razorpay-webhook', event, userId }))
      }
      break
    }

    default:
      // Unhandled event types are fine to ignore — Razorpay sends several
      // we don't act on (e.g. subscription.pending).
      break
  }

  return NextResponse.json({ success: true })
}
