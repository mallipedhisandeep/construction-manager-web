-- ============================================================
-- One-time first-login product tour tracking.
--
-- A single row per user: has_seen = true once they've completed (or
-- skipped) the auto-playing tour. The home page checks this on load —
-- if no row exists yet for the current user, the tour plays once, then
-- inserts a row so it never auto-plays again.
--
-- Safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_tour_status (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_seen   BOOLEAN NOT NULL DEFAULT true,
  seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.user_tour_status TO authenticated;

DROP POLICY IF EXISTS "Users manage own tour status" ON public.user_tour_status;
CREATE POLICY "Users manage own tour status"
  ON public.user_tour_status FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
