// src/app/api/webhooks/new-install/route.ts
//
// Configure this as a Supabase Database Webhook:
//   Database → Webhooks → Create a new webhook
//     Table:       pwa_installs   (schema: public)
//     Events:      Insert
//     Type:        HTTP Request
//     Method:      POST
//     URL:         https://<your-domain>/api/webhooks/new-install
//     HTTP Headers: x-webhook-secret: <WEBHOOK_SECRET value, same as in Vercel>
//
// Supabase DB Webhooks send the new row as { type, table, record, ... }.
// This route is intentionally NOT behind requireAdmin (Supabase's webhook
// caller isn't a logged-in user) — instead it's protected by a shared
// secret header that only Supabase and you know. Mirrors new-user/route.ts.

import { NextResponse } from 'next/server'
import { notifyAdmin, claimWebhookEvent } from '@/lib/push'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { logError } from '@/lib/logger'

export async function POST(req: Request) {
  const limit = rateLimit(`webhook-new-install:${clientIp(req)}`, 30, 60_000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const secret = req.headers.get('x-webhook-secret')
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null)
  const install = payload?.record
  if (!install?.id) return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })

  // Supabase DB Webhooks redeliver on timeout/error — dedupe so the same
  // install row never sends two push notifications.
  const isNew = await claimWebhookEvent(`new_install:${install.id}`)
  if (!isNew) return NextResponse.json({ success: true, deduped: true })

  try {
    const platform = install.platform ? install.platform : 'unknown device'
    await notifyAdmin({
      title: '📲 App installed',
      body:  `A user just installed the app (${platform})`,
      url:   '/admin?tab=users',
      tag:   'new-install',
    })
  } catch (error) {
    logError(error, { route: 'webhooks/new-install', userId: install.user_id })
  }

  return NextResponse.json({ success: true })
}
