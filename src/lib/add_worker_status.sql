-- Feature 4: Add worker_status column to workers table
-- Run in Supabase → SQL Editor → Run

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS worker_status TEXT NOT NULL DEFAULT 'Active'
  CHECK (worker_status IN ('Active', 'Inactive'));

-- All existing workers become Active by default
UPDATE workers SET worker_status = 'Active' WHERE worker_status IS NULL;
