// POST /api/razorpay/verify
// Verifies Razorpay payment signature and activates subscription in Supabase.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Always use service role — this is the only way to bypass RLS and write
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
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expected !== razorpay_signature) {
      console.warn('[verify] Signature mismatch — order:', razorpay_order_id)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log('[verify] Signature OK — payment:', razorpay_payment_id)

    // ── Upsert subscription ───────────────────────────────────────────────────
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Try with razorpay_sub_id first (column exists in schema)
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

    // If razorpay_sub_id column doesn't exist yet, retry without it
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
      // Log the full error so you can see it in Vercel logs
      console.error('[verify] DB upsert failed:', JSON.stringify(dbErr))
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
