-- ============================================================
-- Razorpay payment idempotency — prevents replaying a single valid
-- order_id/payment_id/signature triple to activate or extend a
-- subscription more than once.
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.razorpay_redemptions (
  razorpay_payment_id TEXT PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.razorpay_redemptions ENABLE ROW LEVEL SECURITY;

-- No client-facing policies — only the service role (server-side
-- /api/razorpay/verify route) ever reads or writes this table.

CREATE INDEX IF NOT EXISTS idx_razorpay_redemptions_user_id
  ON public.razorpay_redemptions(user_id);
