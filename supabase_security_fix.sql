-- ============================================================
-- REVERTS the previous version of this file, which broke production.
--
-- WHAT WENT WRONG:
-- The previous version of this file revoked EXECUTE on
-- has_active_access() from the `authenticated` role, reasoning that
-- SECURITY DEFINER meant RLS policy evaluation wouldn't need that grant.
-- That reasoning was incorrect. In Postgres, EXECUTE permission is
-- checked against the role that is CALLING the function — and when a
-- RESTRICTIVE RLS policy on workers/sites/suppliers/etc invokes
-- has_active_access(auth.uid()), it does so as the `authenticated` role
-- (the role your actual logged-in users connect as via Supabase). 
-- SECURITY DEFINER only changes whose privileges the function body runs
-- WITH once execution starts — it does not waive the EXECUTE check that
-- happens before the function is allowed to run at all.
--
-- Revoking EXECUTE from `authenticated` therefore made every RLS policy
-- that calls this function fail with "permission denied for function
-- has_active_access" — which is exactly the save failures you saw across
-- workers, sites, suppliers, and contractors immediately after that
-- migration ran. This file undoes that mistake.
--
-- THE ORIGINAL SUPABASE ADVISOR WARNING:
-- "Signed-In Users Can Execute SECURITY DEFINER Functions" — this fires
-- because any logged-in user COULD call has_active_access() directly via
-- supabase.rpc() with someone else's UUID and learn whether that stranger
-- has an active subscription (a boolean, not their actual data — RLS on
-- the subscriptions table itself still blocks reading their real row).
-- This is a real but minor information disclosure. It is NOT worth
-- breaking every paywalled save in the app to close, and there is no
-- grant-based fix that closes it without also breaking RLS policy
-- evaluation, because both paths (a user's direct .rpc() call, and an RLS
-- policy's internal call) go through the exact same `authenticated` role
-- and Postgres cannot distinguish between them at the GRANT level.
--
-- If you want to close this specific advisory finding properly in the
-- future, the correct approach is to move has_active_access() out of the
-- public/exposed schema (e.g. into a separate, non-API-exposed schema)
-- so PostgREST never lists it as directly callable, while RLS policies
-- (which reference functions by schema-qualified name, not through the
-- API) continue to call it normally. That is a bigger structural change
-- and is intentionally NOT done here — this file's only job is to
-- restore working saves immediately.
--
-- Safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_active_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
      AND (
        plan = 'lifetime'
        OR (
          plan = 'pro'
          AND status = 'active'
          AND current_period_end IS NOT NULL
          AND current_period_end > NOW()
        )
        OR (trial_ends_at IS NOT NULL AND trial_ends_at > NOW())
      )
  )
  OR NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id);
$$;

-- This is the actual fix: restore EXECUTE to authenticated, which RLS
-- policy evaluation requires. Without this grant, every INSERT/UPDATE on
-- workers, sites, suppliers, attendance, goods_orders, private_workers,
-- private_work, and every other paywall-gated table fails.
GRANT EXECUTE ON FUNCTION public.has_active_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_access(UUID) TO service_role;
