-- Fix: has_active_access should not be executable by all authenticated users
-- Change SECURITY DEFINER to only admin can call, or use RLS policies instead

DROP FUNCTION IF EXISTS public.has_active_access(UUID);

CREATE FUNCTION public.has_active_access(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY INVOKER STABLE AS $$
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

-- Only allow authenticated users to call it on their own user_id
GRANT EXECUTE ON FUNCTION public.has_active_access(UUID) TO authenticated;
