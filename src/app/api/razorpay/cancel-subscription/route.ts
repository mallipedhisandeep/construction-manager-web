// POST /api/razorpay/cancel-subscription
//
// Lets the logged-in user cancel their own subscription. Razorpay is told
// to cancel at the end of the current billing cycle (cancel_at_cycle_end),
// so they keep access until current_period_end, exactly like any other
// SaaS — no early cutoff, no refund logic needed. The actual DB status
// update happens via the subscription.cancelled webhook event, not here,
// so the webhook stays the single source of truth.

import { NextResponse } from 'next/server'
import { getUserFromRequest, createAdminClient } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keyId     = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })

  const admin = createAdminClient()
  const { data: row, error: rowErr } = await admin
    .from('subscriptions')
    .select('razorpay_sub_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 })
  if (!row?.razorpay_sub_id) return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const rzpRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${row.razorpay_sub_id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  })

  if (!rzpRes.ok) {
    const errBody = await rzpRes.text()
    console.error('[cancel-subscription] Razorpay error:', rzpRes.status, errBody)
    return NextResponse.json({ error: 'Could not cancel subscription' }, { status: 500 })
  }

  // Optimistically flag it here too — the webhook will confirm shortly,
  // but this makes the UI feel instant rather than waiting on webhook lag.
  await admin.from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
