-- Run this in Supabase SQL Editor to check for leftover demo rows from
-- interrupted tour test runs (safe, read-only — just SELECT, no DELETE)
SELECT 'workers' as table_name, id, name, created_at FROM public.workers WHERE name LIKE 'Demo%'
UNION ALL
SELECT 'sites', id, site_name, created_at FROM public.sites WHERE site_name LIKE 'Demo%'
UNION ALL
SELECT 'suppliers', id, name, created_at FROM public.suppliers WHERE name LIKE 'Demo%'
UNION ALL
SELECT 'private_workers', id, name, created_at FROM public.private_workers WHERE name LIKE 'Demo%'
ORDER BY created_at DESC;
