-- ============================================================
-- Construction Manager — Paywall Enforcement at the Database Layer
-- Run this in Supabase SQL Editor AFTER supabase_monetization.sql
-- and after the core tables (workers, attendance, sites, etc.) exist.
--
-- Without this, the trial/subscription paywall is enforced only in
-- the React client and can be bypassed by removing the overlay in
-- DevTools or calling the Supabase REST API directly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_active_access(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
      AND (
        plan = 'lifetime'
        OR (plan = 'pro' AND status = 'active')
        OR (trial_ends_at IS NOT NULL AND trial_ends_at > NOW())
      )
  )
  -- Users with no subscription row yet (e.g. mid-signup race) are not blocked.
  OR NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id);
$$;

-- RESTRICTIVE policies are AND-combined with existing PERMISSIVE policies,
-- so they narrow access without needing to know/replace each table's
-- original policy text. They block writes only; reads and deletes
-- (so a paywalled user can still view/export/clean up their own data)
-- remain governed by each table's existing policies.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workers', 'attendance', 'sites', 'site_payments',
    'suppliers', 'supplier_goods', 'supplier_payments', 'goods_orders',
    'private_workers', 'private_work', 'private_worker_payments',
    'site_agreements', 'site_floor_files', 'site_elevations'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "require_active_access_insert" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "require_active_access_insert" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (public.has_active_access(auth.uid()))', t);

    EXECUTE format(
      'DROP POLICY IF EXISTS "require_active_access_update" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "require_active_access_update" ON public.%I AS RESTRICTIVE FOR UPDATE USING (public.has_active_access(auth.uid()))', t);
  END LOOP;
END $$;

-- support_tickets is deliberately NOT gated — paywalled users must still
-- be able to file a support/billing request.
