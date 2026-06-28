-- ============================================================
-- Recurring-billing + push-notification schema that the app's API routes
-- (create-subscription, webhook, cancel-subscription, cron reminders,
-- push subscribe) already depend on, but which was missing from every
-- SQL file in this repo. Without this migration, those routes will throw
-- "relation does not exist" or "column does not exist" errors in
-- production the first time they're called.
--
-- Run this AFTER supabase_core_schema.sql, supabase_monetization.sql, and
-- supabase_paywall_enforcement.sql have already been run at least once.
-- Safe to run multiple times.
-- ============================================================

-- ── 1. Recurring-billing columns on subscriptions ────────────────────────
-- current_period_end and razorpay_sub_id already exist in
-- supabase_monetization.sql — only the columns below were missing.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle         TEXT,              -- 'monthly' | 'yearly'
  ADD COLUMN IF NOT EXISTS razorpay_plan_id      TEXT,              -- Razorpay Plan ID (plan_...)
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at DATE;              -- dedupes the daily expiry-reminder cron to once/day

-- ── 2. Push subscriptions (per-user, not just admin) ─────────────────────
-- One row per device a user has tapped "Enable notifications" on.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscription" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscription"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- ============================================================
-- Note: the webhook idempotency table (webhook_events_seen) is in its
-- own file, supabase_webhook_idempotency.sql — run that one too.
-- ============================================================
