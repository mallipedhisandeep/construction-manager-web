// src/app/api/webhooks/new-user/route.ts
//
// Configure this as a Supabase Database Webhook:
//   Database → Webhooks → Create a new webhook
//     Table:       auth.users   (schema: auth)
//     Events:      Insert
//     Type:        HTTP Request
//     Method:      POST
//     URL:         https://<your-domain>/api/webhooks/new-user
//     HTTP Headers: x-webhook-secret: <WEBHOOK_SECRET value, same as in Vercel>
//
// Supabase DB Webhooks send the new row as { type, table, record, ... }.
// This route is intentionally NOT behind requireAdmin (Supabase's webhook
// caller isn't a logged-in user) — instead it's protected by a shared
// secret header that only Supabase and you know.

import { NextResponse } from 'next/server'
import { notifyAdmin, claimWebhookEvent } from '@/lib/push'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { sendEmail, welcomeEmail } from '@/lib/email'
import { logError } from '@/lib/logger'

export async function POST(req: Request) {
  // Rate-limit BEFORE checking the secret — this is what actually slows
  // down someone trying to brute-force WEBHOOK_SECRET by guessing.
  const limit = rateLimit(`webhook-new-user:${clientIp(req)}`, 30, 60_000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const secret = req.headers.get('x-webhook-secret')
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null)
  const newUser = payload?.record
  if (!newUser?.id) return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })

  // Supabase DB Webhooks redeliver on timeout/error — dedupe so the same
  // signup never sends two push notifications or two welcome emails.
  const isNew = await claimWebhookEvent(`new_user:${newUser.id}`)
  if (!isNew) return NextResponse.json({ success: true, deduped: true })

  try {
    await notifyAdmin({
      title: '👤 New user signed up',
      body:  newUser.email ?? 'A new account was just created',
      url:   '/admin?tab=users',
      tag:   'new-user',
    })

    if (newUser.email) {
      const name = newUser.raw_user_meta_data?.full_name ?? newUser.email.split('@')[0]
      const { subject, html } = welcomeEmail(name)
      await sendEmail({ to: newUser.email, subject, html })
    }
  } catch (error) {
    logError(error, { route: 'webhooks/new-user', userId: newUser.id })
  }

  return NextResponse.json({ success: true })
}
