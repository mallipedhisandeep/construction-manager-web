-- ============================================================
-- Standalone fix: enable uuid-ossp so saving Suppliers, Goods Orders,
-- and Site Payments stops failing with:
--   ERROR: function uuid_generate_v4() does not exist
--
-- Run this ONCE in Supabase → SQL Editor. Safe to run even if the
-- extension is already enabled (IF NOT EXISTS).
--
-- This is the minimal fix. supabase_new_tables.sql has also been
-- updated to include this line for new deployments.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
