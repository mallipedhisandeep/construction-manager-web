// src/lib/push.ts
//
// SERVER-ONLY. Sends Web Push notifications via push_subscriptions
// (one row per device a user has enabled notifications on — any user, not
// just the admin).
//
// Uses the `web-push` package with VAPID keys (see .env — VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY / VAPID_SUBJECT). These are NOT Supabase or Razorpay
// secrets; they're a separate keypair specific to this app's push identity.

import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabaseAdmin'

let configured = false
function ensureConfigured() {
  if (configured) return
  const publicKey  = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject    = process.env.VAPID_SUBJECT?.trim() // e.g. 'mailto:you@example.com'
  if (!publicKey || !privateKey || !subject) {
    throw new Error('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not configured')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string   // where notificationclick should navigate, e.g. '/admin'
  tag?: string   // collapses rapid duplicate notifications of the same kind
}

// Sends to every device a SPECIFIC user has subscribed from. Use this for
// per-user notifications like "your subscription expires in 3 days".
export async function notifyUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    ensureConfigured()
  } catch (e) {
    console.warn('[push] Skipping push send —', (e as Error).message)
    return
  }

  const admin = createAdminClient()
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) { console.error('[push] Failed to load subscriptions:', error.message); return }
  if (!subs || subs.length === 0) return

  const body = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    url:   payload.url ?? '/',
    tag:   payload.tag,
  })

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body
      )
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        // Subscription is dead (uninstalled / expired) — clean it up so
        // future notifications don't keep failing against it.
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        console.error('[push] Send failed for subscription', s.id, e)
      }
    }
  }))
}

// Sends to the configured admin account (looked up by ADMIN_EMAIL), for
// "new signup / new subscription / new ticket" alerts.
export async function notifyAdmin(payload: PushPayload): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!adminEmail) { console.warn('[push] ADMIN_EMAIL not configured, skipping admin push'); return }

  const admin = createAdminClient()

  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) { console.error('[push] Failed to list users for admin lookup:', listErr.message); return }
  const adminUser = usersPage.users.find(u => u.email?.toLowerCase() === adminEmail)
  if (!adminUser) { console.warn('[push] No registered user found for ADMIN_EMAIL'); return }

  await notifyUser(adminUser.id, payload)
}

// Idempotency guard for webhook-driven events, which Supabase DB Webhooks
// and Razorpay webhooks may redeliver. Returns true if this is the first
// time we've seen this event id (and records it), false if already seen.
export async function claimWebhookEvent(eventId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin.from('webhook_events_seen').insert({ id: eventId })
  // Unique violation (23505) means we've already processed this exact event.
  if (error) return false
  return true
}
