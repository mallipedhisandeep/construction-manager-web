// POST /api/razorpay/create-order
// Creates a Razorpay order for the monthly ₹200 plan.
// Requires env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_SERVICE_ROLE_KEY

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PLAN_AMOUNT = 20000 // ₹200 in paise

export async function POST(req: Request) {
  try {
    // ── Auth via Supabase ────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Env check ────────────────────────────────────────────────────────────
    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })
    }

    // ── Create Razorpay order ────────────────────────────────────────────────
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   PLAN_AMOUNT,
        currency: 'INR',
        receipt:  `cm_${user.id.slice(0, 8)}_${Date.now()}`,
        notes:    { user_id: user.id, email: user.email, plan: 'monthly' },
      }),
    })

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text()
      console.error('[razorpay] order creation failed:', rzpRes.status, errBody)
      try {
        const parsed = JSON.parse(errBody)
        const desc = parsed?.error?.description ?? 'Failed to create order'
        return NextResponse.json({ error: desc }, { status: 500 })
      } catch {
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }
    }

    const order = await rzpRes.json()
    console.log('[razorpay] order created:', order.id)
    return NextResponse.json({
      orderId:  order.id,
      keyId,
      amount:   PLAN_AMOUNT,
      currency: 'INR',
    })
  } catch (e) {
    console.error('[razorpay] create-order error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
