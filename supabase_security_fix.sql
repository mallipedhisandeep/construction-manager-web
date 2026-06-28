-- ============================================================
-- Fixes Supabase Security Advisor warning:
--   "Signed-In Users Can Execute SECURITY DEFINER Functions"
--   on public.has_active_access(p_user_id uuid)
-- ============================================================
--
-- WHY THIS WARNING FIRED, AND WHY THE NAIVE FIX IS WRONG:
--
-- has_active_access() is SECURITY DEFINER on purpose — it's called from
-- inside RESTRICTIVE RLS policies on workers/sites/attendance/etc (see
-- supabase_paywall_enforcement.sql), and those policy checks need to read
-- the subscriptions table regardless of the calling user's own RLS on
-- that table. Switching this to SECURITY INVOKER (a common "fix" for this
-- exact advisor warning) would make the function run with the CALLER's
-- privileges instead — which breaks paywall enforcement entirely, because
-- the RLS check would then try to apply the caller's own subscriptions
-- RLS recursively while evaluating the caller's own access. Do not change
-- this to SECURITY INVOKER.
--
-- THE ACTUAL ISSUE:
-- Every real call site passes auth.uid() — the caller's own ID. But
-- because the function was GRANTed to `authenticated` broadly, any
-- logged-in user could also call it directly via the Supabase client
-- with someone ELSE's UUID:
--   supabase.rpc('has_active_access', { p_user_id: 'someone-elses-uuid' })
-- and learn whether that stranger has an active subscription. It's a
-- minor information leak (a boolean, not their actual data — RLS on
-- subscriptions itself still blocks reading their row directly) but it's
-- real and the fix is straightforward: revoke direct EXECUTE access from
-- `authenticated` and `public`, while leaving it callable from inside RLS
-- policy evaluation (which runs as the table owner / postgres role, not
-- as `authenticated`, so revoking from `authenticated` does not break the
-- paywall policies that depend on it).
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

-- Revoke broad execute access — this is the actual fix for the advisor
-- warning. RLS policies that call this function still work after this,
-- because policy evaluation does not go through the `authenticated` role's
-- own grants the way a direct .rpc() call from the browser does.
REVOKE EXECUTE ON FUNCTION public.has_active_access(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_access(UUID) FROM authenticated;

-- service_role (used only by trusted server-side API routes, never the
-- browser) can still call it directly if a future feature needs to.
GRANT EXECUTE ON FUNCTION public.has_active_access(UUID) TO service_role;
