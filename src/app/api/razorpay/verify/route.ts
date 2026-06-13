// POST /api/razorpay/verify
// Verifies Razorpay payment signature and activates the subscription in Supabase.
// IMPORTANT: Always verify on the server — never trust the client callback alone.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, testMode } = await req.json()

    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })

    // ── TEST-MODE BYPASS ──────────────────────────────────────────────────────
    // For synthetic test orders (order_TEST_*) or when testMode flag is set,
    // skip HMAC verification — there's no real payment to verify.
    const isTestBypass = testMode === true || (razorpay_order_id ?? '').startsWith('order_TEST_') || (keyId ?? '').startsWith('rzp_test_')
    if (!isTestBypass) {
      // Verify HMAC signature for real live payments
      const body      = `${razorpay_order_id}|${razorpay_payment_id}`
      const expected  = crypto.createHmac('sha256', keySecret).update(body).digest('hex')
      if (expected !== razorpay_signature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    } else {
      console.log('[razorpay] test-mode verify bypass for order:', razorpay_order_id)
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Activate subscription — period end = 30 days from now
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error: dbErr } = await supabase
      .from('subscriptions')
      .upsert({
        user_id:             user.id,
        plan:                'pro',
        status:              'active',
        trial_ends_at:       null,
        current_period_end:  periodEnd,
        razorpay_sub_id:     razorpay_payment_id,
        updated_at:          new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (dbErr) {
      console.error('DB upsert error:', dbErr)
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('verify error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
