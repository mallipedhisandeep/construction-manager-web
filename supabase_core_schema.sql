-- ============================================================
-- Construction Manager — Core Schema (previously undocumented)
--
-- Before this file, the tables the app depends on most heavily —
-- workers, attendance, sites, private_workers, private_work,
-- private_worker_payments, support_tickets, site_agreements,
-- site_floor_files, site_elevations — existed only on the live
-- Supabase project with no CREATE TABLE/RLS in version control.
-- That meant this repo alone could not stand up a fresh project,
-- and these tables' RLS could not be reviewed.
--
-- This reconstructs them from how the application code actually
-- queries/inserts into them. If you already have these tables in
-- production with a different shape, do NOT run this blindly —
-- diff it against `supabase db dump` first.
--
-- Run this BEFORE supabase_new_tables.sql, supabase_monetization.sql,
-- supabase_paywall_enforcement.sql, supabase_attendance_balance_trigger.sql
-- and supabase_razorpay_idempotency.sql, since those reference some of
-- these tables.
-- ============================================================

-- ── workers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  gender        TEXT NOT NULL DEFAULT 'Male',
  state         TEXT NOT NULL DEFAULT 'Telangana',
  role          TEXT NOT NULL DEFAULT 'Mason',
  work_type     TEXT NOT NULL DEFAULT 'Centring',
  rate_6_6      NUMERIC NOT NULL DEFAULT 0,
  rate_10_6     NUMERIC NOT NULL DEFAULT 0,
  rate_6_10     NUMERIC NOT NULL DEFAULT 0,
  rate_6_2      NUMERIC NOT NULL DEFAULT 0,
  rate_10_2     NUMERIC NOT NULL DEFAULT 0,
  rate_2_6      NUMERIC NOT NULL DEFAULT 0,
  notes         TEXT,
  worker_status TEXT NOT NULL DEFAULT 'Active' CHECK (worker_status IN ('Active','Inactive')),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own workers" ON public.workers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workers_user_id ON public.workers(user_id);

-- ── sites ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_name         TEXT NOT NULL,
  site_name_search  TEXT GENERATED ALWAYS AS (lower(site_name)) STORED,
  location          TEXT,
  owner_name        TEXT,
  owner_phone       TEXT,
  start_date        DATE,
  budget            NUMERIC NOT NULL DEFAULT 0,
  floors_count      INTEGER NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On Hold','Completed')),
  notes             TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sites" ON public.sites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sites_user_id ON public.sites(user_id);

-- ── attendance ────────────────────────────────────────────────────────────
-- Not soft-deletable by design (it's a historical ledger; the app's Trash
-- page does not list it). balance_after is maintained automatically by
-- the trigger in supabase_attendance_balance_trigger.sql.
CREATE TABLE IF NOT EXISTS public.attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id        UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  site_id          UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  date             TIMESTAMPTZ NOT NULL,
  date_key         TEXT NOT NULL, -- 'YYYY-MM-DD', used for fast range queries
  attendance_type  TEXT NOT NULL, -- one of SHIFTS in src/lib/constants.ts
  wage             NUMERIC NOT NULL DEFAULT 0,
  advance          NUMERIC NOT NULL DEFAULT 0,
  payment_mode     TEXT NOT NULL DEFAULT 'Cash',
  balance_after    NUMERIC NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, date_key)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attendance" ON public.attendance
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_user_id   ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON public.attendance(worker_id, date_key);
CREATE INDEX IF NOT EXISTS idx_attendance_date_key  ON public.attendance(user_id, date_key);

-- ── private_workers (contractors) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.private_workers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  work_type   TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  notes       TEXT,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.private_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own private_workers" ON public.private_workers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_private_workers_user_id ON public.private_workers(user_id);

-- ── private_work (contract assignments) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.private_work (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id      UUID NOT NULL REFERENCES public.private_workers(id) ON DELETE CASCADE,
  worker_name    TEXT NOT NULL,
  work_type      TEXT NOT NULL DEFAULT '',
  site_id        UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  site_name      TEXT,
  work_date      DATE NOT NULL,
  price_charged  NUMERIC NOT NULL DEFAULT 0,
  amount_paid    NUMERIC NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'Pending',
  notes          TEXT,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.private_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own private_work" ON public.private_work
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_private_work_user_id ON public.private_work(user_id);

-- ── private_worker_payments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.private_worker_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES public.private_workers(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL DEFAULT 0,
  direction   TEXT NOT NULL, -- 'dad_to_worker' | 'worker_to_dad'
  mode        TEXT NOT NULL DEFAULT 'Cash',
  date        DATE NOT NULL,
  notes       TEXT,
  source      TEXT NOT NULL DEFAULT 'manual',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.private_worker_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own private_worker_payments" ON public.private_worker_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pwp_user_id   ON public.private_worker_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pwp_worker_id ON public.private_worker_payments(worker_id);

-- ── support_tickets ───────────────────────────────────────────────────────
-- Deliberately NOT gated by the paywall RLS in supabase_paywall_enforcement.sql
-- — users must be able to file a ticket even with an expired trial.
-- Admin reads/writes go through /api/admin/data and /api/admin/reply using
-- the service role key server-side, NOT through a client-facing RLS policy,
-- so no "admin can read everyone's tickets" policy is needed or added here.
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email   TEXT,
  category     TEXT NOT NULL DEFAULT 'general',
  subject      TEXT NOT NULL,
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  admin_reply  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);

-- ── site_agreements / site_floor_files / site_elevations ────────────────────
-- Soft-deletable (listed in the Trash page) — the actual file stays in
-- storage until permanently deleted from there.
CREATE TABLE IF NOT EXISTS public.site_agreements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL, -- storage object path, signed on read — never a public URL
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_floor_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  floor_no    INTEGER NOT NULL DEFAULT 0,
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_elevations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_agreements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_floor_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_elevations  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own site_agreements" ON public.site_agreements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own site_floor_files" ON public.site_floor_files
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own site_elevations" ON public.site_elevations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_site_agreements_site_id  ON public.site_agreements(site_id);
CREATE INDEX IF NOT EXISTS idx_site_floor_files_site_id ON public.site_floor_files(site_id);
CREATE INDEX IF NOT EXISTS idx_site_elevations_site_id  ON public.site_elevations(site_id);

-- ── Storage bucket (referenced by sites/page.tsx as BUCKET) ─────────────────
-- Run only if it doesn't already exist — adjust the size limit to match
-- MAX_FILE_BYTES in src/app/sites/page.tsx (S8 fix).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('construction-files', 'construction-files', false, 15728640)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Users manage own files in construction-files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'construction-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'construction-files' AND (storage.foldername(name))[1] = auth.uid()::text);
