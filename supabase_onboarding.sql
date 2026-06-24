CREATE TABLE IF NOT EXISTS public.user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  step INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.user_onboarding TO authenticated;

DROP POLICY IF EXISTS "Users manage own onboarding" ON public.user_onboarding;
CREATE POLICY "Users manage own onboarding"
  ON public.user_onboarding FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
