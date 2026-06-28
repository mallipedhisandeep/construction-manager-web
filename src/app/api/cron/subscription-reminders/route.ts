// GET /api/cron/subscription-reminders
//
// Triggered daily by Vercel Cron (see vercel.json). Finds every user
// (trial or paid) whose access expires within the next 3 days and sends
// them one push reminder per day until either they renew or it expires.
//
// Protected by CRON_SECRET — Vercel Cron sends this automatically as a
// Bearer token when the route is configured under "crons" in vercel.json;
// this guards against anyone else triggering mass notifications by hitting
// the URL directly.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { notifyUser } from '@/lib/push'
import { sendEmail, trialEndingEmail } from '@/lib/email'
import { logError } from '@/lib/logger'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const in3Days = new Date(Date.now() + 3 * 86400000).toISOString()
  const now = new Date().toISOString()

  // Anyone (trial OR paid) whose relevant expiry falls within the next 3
  // days, who hasn't already gotten today's reminder, and who hasn't
  // cancelled outright.
  const { data: rows, error } = await admin
    .from('subscriptions')
    .select('user_id, plan, status, trial_ends_at, current_period_end, last_reminder_sent_at')
    .neq('plan', 'lifetime')
    .neq('status', 'cancelled')
    .or(`and(plan.eq.trial,trial_ends_at.lte.${in3Days},trial_ends_at.gt.${now}),and(plan.eq.pro,current_period_end.lte.${in3Days},current_period_end.gt.${now})`)

  if (error) {
    logError(error, { route: 'cron/subscription-reminders' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  for (const row of rows ?? []) {
    if (row.last_reminder_sent_at === today) continue // already reminded today

    const expiresAt = row.plan === 'trial' ? row.trial_ends_at : row.current_period_end
    const daysLeft = Math.max(0, Math.ceil((new Date(expiresAt!).getTime() - Date.now()) / 86400000))
    const what = row.plan === 'trial' ? 'free trial' : 'subscription'

    await notifyUser(row.user_id, {
      title: daysLeft <= 0 ? `⏰ Your ${what} ends today` : `⏰ Your ${what} ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      body:  row.plan === 'trial'
        ? 'Subscribe now to keep using Construction Manager without interruption.'
        : 'Your next renewal is coming up. Make sure your payment method is up to date.',
      url:   '/subscribe',
      tag:   'expiry-reminder',
    })

    // Email is a best-effort companion to the push notification, not a
    // hard dependency — if it fails (or isn't configured yet), the push
    // above has already gone out, and the loop should keep going for the
    // remaining users rather than abort on one email failure.
    try {
      const { data: userData } = await admin.auth.admin.getUserById(row.user_id)
      const email = userData?.user?.email
      if (email) {
        const { subject, html } = trialEndingEmail(daysLeft)
        await sendEmail({ to: email, subject, html })
      }
    } catch (e) {
      logError(e, { route: 'cron/subscription-reminders', userId: row.user_id })
    }

    await admin.from('subscriptions')
      .update({ last_reminder_sent_at: today })
      .eq('user_id', row.user_id)

    sent++
  }

  return NextResponse.json({ success: true, checked: rows?.length ?? 0, sent })
}
