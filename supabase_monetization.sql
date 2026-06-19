-- ============================================================
-- Construction Manager — Monetization & Analytics Tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Subscriptions ─────────────────────────────────────────────────────────
-- Stores plan info per user. The app checks this table to decide access level.
-- For lifetime/exempt users, set plan = 'lifetime' manually.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL DEFAULT 'free'   CHECK (plan IN ('free','trial','pro','lifetime')),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','past_due','expired')),
  trial_ends_at         TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  razorpay_sub_id       TEXT,           -- filled once Razorpay is integrated
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS: users can read only their own row; only service role can write
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Admin/service role insert/update handled server-side (no client policy needed)

-- ── 2. PWA Installs ──────────────────────────────────────────────────────────
-- Logged from the browser's 'appinstalled' event via a lightweight API route.

CREATE TABLE IF NOT EXISTS public.pwa_installs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent   TEXT,
  platform     TEXT          -- 'android' | 'ios' | 'desktop'
);

ALTER TABLE public.pwa_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own install"
  ON public.pwa_installs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- NOTE: real admin-wide reads now go through /api/admin/data using the
-- service_role key server-side (see src/lib/supabaseAdmin.ts), which
-- bypasses RLS entirely for the verified admin only. This client-facing
-- policy intentionally stays scoped to the user's own rows.
CREATE POLICY "Users can read own installs"
  ON public.pwa_installs FOR SELECT
  USING (auth.uid() = user_id);

-- ── 3. Trigger: auto-create free subscription on new user signup ─────────────
-- Runs server-side so every new signup gets a subscription row automatically.
-- trial_ends_at = 30 days from now.

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trial',
    'active',
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- ── 4. Lifetime access: grant to specific emails ─────────────────────────────
-- Run these UPDATE statements manually for your father and uncle
-- after they have signed up. Replace the emails below.

-- UPDATE public.subscriptions
--   SET plan = 'lifetime', status = 'active', trial_ends_at = NULL, current_period_end = NULL
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'fathers.email@gmail.com');

-- UPDATE public.subscriptions
--   SET plan = 'lifetime', status = 'active', trial_ends_at = NULL, current_period_end = NULL
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'uncles.email@gmail.com');

-- ── 5. Helpful indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan    ON public.subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_pwa_installs_user_id  ON public.pwa_installs(user_id);
