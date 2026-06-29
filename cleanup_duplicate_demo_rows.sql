-- Safe, exact-id cleanup for the duplicate demo rows created during
-- testing before the idempotency fix. Each DELETE targets one specific
-- id from your SQL Editor output — nothing broad, nothing pattern-based.
-- Review the ids below against your own output before running.

DELETE FROM public.workers WHERE id = 'dd48d801-6fd9-4107-bc5b-a97c450b6619'; -- Demo Deleted Worker (batch 2)
DELETE FROM public.suppliers WHERE id = '0f32e262-4d51-4650-814e-067bfe454c78'; -- Demo Supplier (batch 2)
DELETE FROM public.workers WHERE id = '65ac65da-7018-40fb-8e4a-dfadd7b6680c'; -- Demo Worker (batch 2)
DELETE FROM public.private_workers WHERE id = 'b9810b7b-d9d1-4f34-ac91-ab0e18ebae8c'; -- Demo Contractor (batch 2)
DELETE FROM public.sites WHERE id = '74b93979-5501-411e-8ff5-a86eaaf91420'; -- Demo Site (batch 2)
DELETE FROM public.workers WHERE id = '9d157afe-c7c1-4816-ae60-4ca0221dc7b7'; -- Demo Deleted Worker (batch 1)
DELETE FROM public.suppliers WHERE id = '101bb4a5-bec1-4a74-baea-11abbfe96c7a'; -- Demo Supplier (batch 1)
DELETE FROM public.sites WHERE id = '30dd5665-ab77-4d01-93e4-3ce74be57aac'; -- Demo Site (batch 1)
DELETE FROM public.private_workers WHERE id = '9850fdc2-4fe3-480c-a2fa-d0af0e69fb45'; -- Demo Contractor (batch 1)
DELETE FROM public.workers WHERE id = 'dde8fa3e-1993-4a2e-bcbf-513c125b4d93'; -- Demo Worker (batch 1)

-- After running, re-run check_for_leftover_demo_rows.sql — it should
-- return zero rows.
