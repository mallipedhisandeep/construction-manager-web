-- ============================================================
-- Webhook idempotency table.
--
-- claimWebhookEvent() in src/lib/push.ts inserts a row here for every
-- webhook event processed (new signups, new support tickets, Razorpay
-- subscription events). If the same event is redelivered — which both
-- Supabase DB Webhooks and Razorpay explicitly do on timeout or non-2xx
-- response — the insert hits the PRIMARY KEY and fails, and
-- claimWebhookEvent() returns false, telling the caller "already
-- processed, skip it." This is what prevents duplicate push
-- notifications, duplicate emails, and duplicate subscription activations
-- from a single real-world event being delivered twice.
--
-- Safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_events_seen (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only server-side code (via the service role key) ever touches this
-- table — it's an internal dedupe ledger, never read or written by the
-- browser, so there is no `authenticated` grant here at all.
GRANT ALL ON public.webhook_events_seen TO service_role;

-- Old rows are only ever useful for a short window (long enough to cover
-- realistic webhook redelivery delays — minutes to low hours, not days).
-- Run this occasionally (e.g. via a monthly manual query, or wire it into
-- the existing daily cron later) to keep the table from growing forever:
--   DELETE FROM public.webhook_events_seen WHERE created_at < NOW() - INTERVAL '30 days';
