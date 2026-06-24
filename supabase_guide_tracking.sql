-- Track which users have seen the full app guide
CREATE TABLE IF NOT EXISTS public.user_guide_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_lang 'en' | 'te' NOT NULL DEFAULT 'en',
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  show_again BOOLEAN NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE ON public.user_guide_status TO authenticated;

CREATE POLICY "Users manage own guide status" ON public.user_guide_status
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
