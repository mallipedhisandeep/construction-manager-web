-- ============================================================
-- Patch for databases where supabase_monetization.sql was already run
-- with the old, mislabeled "Admin read all installs" policy.
-- Safe to run multiple times.
-- ============================================================

DROP POLICY IF EXISTS "Admin read all installs" ON public.pwa_installs;

CREATE POLICY IF NOT EXISTS "Users can read own installs"
  ON public.pwa_installs FOR SELECT
  USING (auth.uid() = user_id);
