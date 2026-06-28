// src/app/api/webhooks/new-ticket/route.ts
//
// Configure this as a Supabase Database Webhook:
//   Database → Webhooks → Create a new webhook
//     Table:       support_tickets   (schema: public)
//     Events:      Insert
//     Type:        HTTP Request
//     Method:      POST
//     URL:         https://<your-domain>/api/webhooks/new-ticket
//     HTTP Headers: x-webhook-secret: <WEBHOOK_SECRET value, same as in Vercel>

import { NextResponse } from 'next/server'
import { notifyAdmin, claimWebhookEvent } from '@/lib/push'
import { rateLimit, clientIp } from '@/lib/rateLimit'

export async function POST(req: Request) {
  const limit = rateLimit(`webhook-new-ticket:${clientIp(req)}`, 30, 60_000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const secret = req.headers.get('x-webhook-secret')
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null)
  const ticket = payload?.record
  if (!ticket?.id) return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })

  const isNew = await claimWebhookEvent(`new_ticket:${ticket.id}`)
  if (!isNew) return NextResponse.json({ success: true, deduped: true })

  const preview = (ticket.message ?? '').slice(0, 100)
  await notifyAdmin({
    title: `🛟 New support request — ${ticket.subject ?? ticket.category ?? 'Other'}`,
    body:  `${ticket.user_email ?? 'A user'}: ${preview}`,
    url:   '/admin?tab=tickets',
    tag:   'new-ticket',
  })

  return NextResponse.json({ success: true })
}
