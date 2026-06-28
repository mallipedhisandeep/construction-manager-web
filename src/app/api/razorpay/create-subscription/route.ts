// POST /api/razorpay/create-subscription
//
// Creates a Razorpay Subscription (recurring auto-billing), not a one-time
// Order. The user authorizes a payment mandate once via Razorpay Checkout;
// after that, Razorpay automatically charges them every billing cycle and
// notifies us via /api/razorpay/webhook — we never need to ask them to pay
// again manually.

import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabaseAdmin'
import { PRICING, type BillingCycle } from '@/lib/pricing'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Keyed by user, not IP — this prevents one account from spamming
    // Razorpay subscription-creation calls (each one is a real API call
    // against your Razorpay account and could rack up rate-limit issues
    // or look like abuse from Razorpay's side too).
    const limit = rateLimit(`create-subscription:${user.id}`, 5, 60_000)
    if (!limit.allowed) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${limit.retryAfterSeconds}s.` }, { status: 429 })
    }

    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })
    }

    const body = await req.json().catch(() => null)
    const cycle = body?.cycle as BillingCycle | undefined
    if (!cycle || !PRICING[cycle]) {
      return NextResponse.json({ error: 'Invalid or missing billing cycle' }, { status: 400 })
    }
    const planId = PRICING[cycle].planId

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

    // total_count: how many cycles to bill before the subscription
    // auto-completes. 120 monthly cycles = 10 years; 20 yearly cycles =
    // 20 years — effectively "indefinite" without literally being infinite
    // (Razorpay requires a finite total_count).
    const totalCount = cycle === 'monthly' ? 120 : 20

    const rzpRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id:      planId,
        total_count:  totalCount,
        customer_notify: 1,
        notes: { user_id: user.id, email: user.email ?? '', cycle },
      }),
    })

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text()
      console.error('[create-subscription] Razorpay error:', rzpRes.status, errBody)
      try {
        const parsed = JSON.parse(errBody)
        return NextResponse.json({ error: parsed?.error?.description ?? 'Failed to create subscription' }, { status: 500 })
      } catch {
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
      }
    }

    const sub = await rzpRes.json()
    console.log('[create-subscription] Created:', sub.id, 'for user', user.id, 'cycle', cycle)

    return NextResponse.json({
      subscriptionId: sub.id,   // sub_...
      keyId,
      cycle,
    })
  } catch (e) {
    console.error('[create-subscription] Unexpected error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
