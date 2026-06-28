// src/lib/email.ts
//
// Centralized email sending via Resend. Like logger.ts, this is safe to
// call before it's configured — if RESEND_API_KEY is missing, sendEmail()
// logs a warning and does nothing, instead of throwing and breaking the
// signup/payment flow that triggered it. Once you add RESEND_API_KEY and
// verify a sending domain in Resend, emails start going out with no other
// code changes.
//
// IMPORTANT: Resend requires verifying a sending domain (or using their
// shared onboarding domain for testing only — not for real users) before
// emails will actually deliver. See manual setup steps.

import { Resend } from 'resend'
import { logError } from '@/lib/logger'
import { PRICING } from '@/lib/pricing'

let client: Resend | null = null
function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return null
  if (!client) client = new Resend(apiKey)
  return client
}

interface SendEmailArgs {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<void> {
  const resend = getClient()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured — skipping send to', to, 'subject:', subject)
    return
  }

  const from = process.env.EMAIL_FROM?.trim()
  if (!from) {
    console.warn('[email] EMAIL_FROM not configured — skipping send')
    return
  }

  try {
    await resend.emails.send({ from, to, subject, html })
  } catch (error) {
    // Email failing to send should never break the flow that triggered it
    // (signup, payment) — log it and move on, don't throw.
    logError(error, { route: 'email', to, subject })
  }
}

// ── Email templates ──────────────────────────────────────────────────────
// Kept minimal and inline (no heavy template engine) since these are
// short transactional emails, not marketing content.

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to Construction Manager 🏗️',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>Welcome, ${escapeHtml(name)}!</h2>
        <p>Your Construction Manager account is ready. You have a 30-day free trial to try every feature — workers, sites, attendance, money tracking, and more.</p>
        <p>Open the app and add your first worker or site to get started.</p>
        <p style="color:#888;font-size:13px;margin-top:32px">— Construction Manager</p>
      </div>
    `,
  }
}

export function subscriptionConfirmedEmail(cycle: 'monthly' | 'yearly', amountRupees: number): { subject: string; html: string } {
  return {
    subject: 'Subscription confirmed ✅',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>You're subscribed!</h2>
        <p>Your ${cycle} subscription (₹${amountRupees}) is now active. Thanks for upgrading to Pro.</p>
        <p>It will auto-renew on schedule — you can cancel anytime from your Profile page, and you'll keep access until the end of your current period.</p>
        <p style="color:#888;font-size:13px;margin-top:32px">— Construction Manager</p>
      </div>
    `,
  }
}

export function trialEndingEmail(daysLeft: number): { subject: string; html: string } {
  return {
    subject: daysLeft <= 0 ? 'Your trial ends today' : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>${daysLeft <= 0 ? 'Your trial ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial`}</h2>
        <p>Subscribe now to keep using Construction Manager without interruption — ${PRICING.monthly.label_en} or ${PRICING.yearly.label_en}.</p>
        <p style="color:#888;font-size:13px;margin-top:32px">— Construction Manager</p>
      </div>
    `,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
