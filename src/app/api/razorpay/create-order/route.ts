// POST /api/razorpay/create-order
// Creates a Razorpay order for the monthly ₹200 plan.
// Requires env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
//
// TEST-MODE BYPASS: If RAZORPAY_KEY_ID starts with "rzp_test_", we return a
// simulated order so the app is fully usable while Razorpay VKYC is pending.
// The verify route also recognises test-mode bypasses and activates the sub.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PLAN_AMOUNT = 20000 // ₹200 in paise

export async function POST(req: Request) {
  try {
    // Verify auth via Supabase
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })
    }

    // ── TEST-MODE BYPASS ──────────────────────────────────────────────────────
    // Test keys work for the Razorpay SDK checkout UI, but if your account's
    // VKYC is still pending Razorpay may reject order-creation via the API.
    // Return a synthetic order so the checkout can still be demonstrated and
    // the subscription can be activated in the DB via the verify route.
    if (keyId.startsWith('rzp_test_')) {
      const fakeOrderId = `order_TEST_${Date.now()}`
      console.log('[razorpay] test-mode bypass — synthetic order:', fakeOrderId)
      return NextResponse.json({
        orderId:  fakeOrderId,
        keyId,
        amount:   PLAN_AMOUNT,
        currency: 'INR',
        testMode: true,
      })
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Create real Razorpay order (live keys)
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:   PLAN_AMOUNT,
        currency: 'INR',
        receipt:  `cm_${user.id.slice(0, 8)}_${Date.now()}`,
        notes:    { user_id: user.id, email: user.email, plan: 'monthly' },
      }),
    })

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text()
      console.error('Razorpay order creation failed:', rzpRes.status, errBody)
      // Surface the Razorpay error description to help diagnose issues
      try {
        const parsed = JSON.parse(errBody)
        const desc = parsed?.error?.description ?? 'Failed to create order'
        return NextResponse.json({ error: desc }, { status: 500 })
      } catch {
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }
    }

    const order = await rzpRes.json()
    return NextResponse.json({ orderId: order.id, keyId, amount: PLAN_AMOUNT, currency: 'INR' })
  } catch (e) {
    console.error('create-order error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
