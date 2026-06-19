// POST /api/razorpay/verify
// Verifies a Razorpay payment and activates the subscription in Supabase.
//
// Hardened against replay: a single valid order_id/payment_id/signature
// triple can no longer be resent to extend a subscription indefinitely or
// to activate Pro on a different account. Three checks now run before any
// subscription is written:
//   1. HMAC signature matches (as before)
//   2. The payment is independently confirmed as "captured" directly with
//      Razorpay's API, and its order belongs to the calling user
//      (order.notes.user_id === authenticated user.id)
//   3. This exact razorpay_payment_id has never been redeemed before
//      (enforced by a primary-key insert into razorpay_redemptions —
//      a second attempt fails atomically, even under concurrent requests)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const PLAN_AMOUNT = 20000 // ₹200 in paise — must match create-order

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[verify] Missing SUPABASE env vars')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      console.error('[verify] Auth failed:', authErr?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    // ── Verify HMAC-SHA256 signature ──────────────────────────────────────────
    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret || !keyId) return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expected !== razorpay_signature) {
      console.warn('[verify] Signature mismatch — order:', razorpay_order_id)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // ── Idempotency: claim this payment_id before doing anything else.
    // Primary-key insert fails atomically if it was already redeemed,
    // even under concurrent/duplicate requests for the same payment. ──────────
    const { error: claimErr } = await supabase
      .from('razorpay_redemptions')
      .insert({ razorpay_payment_id, user_id: user.id })

    if (claimErr) {
      // Unique violation (23505) = this payment was already redeemed once.
      console.warn('[verify] Payment already redeemed or claim failed:', razorpay_payment_id, claimErr.code)
      return NextResponse.json({ error: 'This payment has already been processed' }, { status: 409 })
    }

    // ── Independently confirm the payment with Razorpay's API — never trust
    // the client's word alone that a payment succeeded. ────────────────────────
    const rzpAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

    const [orderRes, paymentRes] = await Promise.all([
      fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` },
      }),
      fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` },
      }),
    ])

    if (!orderRes.ok || !paymentRes.ok) {
      console.error('[verify] Failed to fetch order/payment from Razorpay')
      return NextResponse.json({ error: 'Could not verify payment with Razorpay' }, { status: 502 })
    }

    const order   = await orderRes.json()
    const payment = await paymentRes.json()

    // Ownership: the order must have been created for this exact user.
    if (order?.notes?.user_id !== user.id) {
      console.error('[verify] Order/user mismatch:', order?.notes?.user_id, 'vs', user.id)
      return NextResponse.json({ error: 'This payment does not belong to your account' }, { status: 403 })
    }

    // Payment must actually be captured, for the order we just checked, and
    // for the expected amount/currency.
    if (
      payment.status !== 'captured' ||
      payment.order_id !== razorpay_order_id ||
      payment.amount !== PLAN_AMOUNT ||
      payment.currency !== 'INR'
    ) {
      console.error('[verify] Payment not valid for activation:', JSON.stringify(payment))
      return NextResponse.json({ error: 'Payment was not successfully captured' }, { status: 400 })
    }

    // ── Upsert subscription ───────────────────────────────────────────────────
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let { error: dbErr } = await supabase
      .from('subscriptions')
      .upsert({
        user_id:            user.id,
        plan:               'pro',
        status:             'active',
        trial_ends_at:      null,
        current_period_end: periodEnd,
        razorpay_sub_id:    razorpay_payment_id,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (dbErr && dbErr.message?.includes('razorpay_sub_id')) {
      console.warn('[verify] razorpay_sub_id column missing, retrying without it')
      const retry = await supabase
        .from('subscriptions')
        .upsert({
          user_id:            user.id,
          plan:               'pro',
          status:             'active',
          trial_ends_at:      null,
          current_period_end: periodEnd,
          updated_at:         new Date().toISOString(),
        }, { onConflict: 'user_id' })
      dbErr = retry.error
    }

    if (dbErr) {
      console.error('[verify] DB upsert failed:', JSON.stringify(dbErr))
      // Roll back the idempotency claim so a genuine retry isn't permanently blocked.
      await supabase.from('razorpay_redemptions').delete().eq('razorpay_payment_id', razorpay_payment_id)
      return NextResponse.json(
        { error: `DB error: ${dbErr.message ?? dbErr.code ?? 'unknown'}` },
        { status: 500 }
      )
    }

    console.log('[verify] Subscription activated for user:', user.id)
    return NextResponse.json({ success: true })

  } catch (e) {
    console.error('[verify] Unexpected error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
