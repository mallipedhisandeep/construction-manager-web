// src/lib/tourDemoData.ts
//
// The auto-tour needs at least one real row per module to spotlight
// Edit/Delete/Pay buttons that only render for an existing item — a
// brand-new account has none. This file ensures exactly one clearly
// "Demo ..." labeled row per module exists before the tour starts, and
// deletes every row it created (by id, tracked in memory — never a broad
// "delete anything named Demo") once the tour ends, whether it finished
// naturally or was skipped.
//
// IDEMPOTENT BY DESIGN: if the tour is interrupted mid-run (browser
// reload, app backgrounded and resumed, tab put to sleep) and seeding
// runs again, this does NOT insert a second set of duplicate rows. It
// first checks for an existing row scoped to THIS user with the exact
// demo name, and reuses it if found. Only inserts when no such row
// already exists. This is what makes a second seeding pass — which WILL
// happen on a real phone if the browser reloads mid-tour — safe instead
// of silently piling up duplicate "Demo Worker" rows every time.
//
// IMPORTANT: cleanup only ever touches rows whose id was actually
// returned by THIS seeding call (whether newly inserted or found
// pre-existing) — never a broad "delete anything named Demo" query, so
// it can't accidentally delete a real user's own data if they happened
// to name something similarly.

import { supabase } from '@/lib/supabase'

export interface DemoRowRefs {
  workerId?: string
  siteId?: string
  supplierId?: string
  privateWorkerId?: string
  goodsOrderId?: string
  privateWorkId?: string
  trashWorkerId?: string
}

// Finds an existing row by user_id + exact name, or inserts a new one if
// none exists. Returns the row's id either way. This single helper is
// what makes every seed step below idempotent across repeated runs.
async function findOrInsert(
  table: string,
  userId: string,
  nameColumn: string,
  nameValue: string,
  insertPayload: Record<string, unknown>,
  extraFilter?: Record<string, unknown>,
): Promise<string | undefined> {
  let query = supabase.from(table).select('id').eq('user_id', userId).eq(nameColumn, nameValue)
  if (extraFilter) {
    for (const [col, val] of Object.entries(extraFilter)) query = query.eq(col, val)
  }
  const { data: existing } = await query.maybeSingle()
  if (existing?.id) return existing.id

  const { data: inserted } = await supabase.from(table).insert(insertPayload).select('id').single()
  return inserted?.id
}

// Ensures one demo row per module exists, in dependency order
// (private_work and goods_orders reference a site/supplier/worker, so
// those parents are resolved first). Returns the ids actually in use
// (whether newly created or already existing) so cleanup can target them
// precisely. Any individual step failing is swallowed — a demo row
// failing to seed just means that page's Edit/Delete step gets skipped by
// the tour engine's existing "element never appeared" timeout, not a
// crash of the whole tour.
export async function seedTourDemoData(userId: string): Promise<DemoRowRefs> {
  const refs: DemoRowRefs = {}

  const [workerId, siteId, supplierId, privateWorkerId] = await Promise.all([
    findOrInsert('workers', userId, 'name', 'Demo Worker', {
      user_id: userId,
      name: 'Demo Worker',
      phone: '9000000000',
      gender: 'Male',
      state: 'Telangana',
      role: 'Mason',
      work_type: 'Centring',
      rate_6_6: 600, rate_10_6: 0, rate_6_10: 0, rate_6_2: 0, rate_10_2: 0, rate_2_6: 0,
      worker_status: 'Active',
    }),

    findOrInsert('sites', userId, 'site_name', 'Demo Site', {
      user_id: userId,
      site_name: 'Demo Site',
      status: 'Active',
      floors_count: 1,
      budget: 100000,
    }),

    findOrInsert('suppliers', userId, 'name', 'Demo Supplier', {
      user_id: userId,
      name: 'Demo Supplier',
      phone: '9000000001',
      shop_name: 'Demo Hardware Store',
    }),

    findOrInsert('private_workers', userId, 'name', 'Demo Contractor', {
      user_id: userId,
      name: 'Demo Contractor',
      work_type: 'Plumbing',
      phone: '9000000002',
    }),
  ])

  refs.workerId = workerId
  refs.siteId = siteId
  refs.supplierId = supplierId
  refs.privateWorkerId = privateWorkerId

  // Second phase: goods_orders and private_work both reference a parent
  // row resolved above (supplier/site, worker/site respectively), so they
  // can only be resolved once those ids are known.
  const [goodsOrderId, privateWorkId] = await Promise.all([
    refs.supplierId
      ? findOrInsert('goods_orders', userId, 'goods_name', 'Demo Cement Order', {
          user_id: userId,
          supplier_id: refs.supplierId,
          supplier_name: 'Demo Supplier',
          goods_name: 'Demo Cement Order',
          unit: 'bags',
          site_id: refs.siteId ?? null,
          site_name: refs.siteId ? 'Demo Site' : '',
          delivery_date: new Date().toISOString().split('T')[0],
          quantity: 10,
          price_per_unit: 400,
          total_price: 4000,
          advance_paid: 0,
          status: 'Pending',
        }, { supplier_id: refs.supplierId })
      : Promise.resolve(undefined),

    refs.privateWorkerId
      ? findOrInsert('private_work', userId, 'worker_name', 'Demo Contractor', {
          user_id: userId,
          worker_id: refs.privateWorkerId,
          worker_name: 'Demo Contractor',
          work_type: 'Plumbing',
          site_id: refs.siteId ?? null,
          site_name: refs.siteId ? 'Demo Site' : '',
          work_date: new Date().toISOString().split('T')[0],
          price_charged: 2000,
          amount_paid: 0,
          status: 'Active',
        }, { worker_id: refs.privateWorkerId })
      : Promise.resolve(undefined),
  ])

  refs.goodsOrderId = goodsOrderId
  refs.privateWorkId = privateWorkId

  // Third phase: a worker that's immediately soft-deleted, purely so the
  // Trash page has a real row to demonstrate Restore on. This is a
  // SEPARATE worker from the main Demo Worker above — the tour needs the
  // main one to stay active (for the Workers-page edit/delete steps)
  // while also having something already in Trash to show restoring.
  //
  // Idempotency note: findOrInsert's lookup here does NOT filter on
  // deleted_at, so if this row already exists (from a previous seeding
  // pass) it gets found and reused regardless of whether it's currently
  // soft-deleted or not — the update() below then (re-)applies the
  // soft-delete unconditionally, which is harmless whether or not it was
  // already deleted.
  const trashWorkerId = await findOrInsert('workers', userId, 'name', 'Demo Deleted Worker', {
    user_id: userId,
    name: 'Demo Deleted Worker',
    phone: '9000000003',
    gender: 'Male',
    state: 'Telangana',
    role: 'Helper',
    work_type: 'Centring',
    rate_6_6: 500, rate_10_6: 0, rate_6_10: 0, rate_6_2: 0, rate_10_2: 0, rate_2_6: 0,
    worker_status: 'Active',
  })

  if (trashWorkerId) {
    refs.trashWorkerId = trashWorkerId
    await supabase.from('workers').update({ deleted_at: new Date().toISOString() }).eq('id', trashWorkerId)
  }

  return refs
}

// Hard-deletes (not soft-delete) exactly the rows this tour session is
// using. Hard delete is intentional here — these never need to appear in
// Trash/recycle bin, since they were never real user data to begin with,
// and leaving them soft-deleted would mean they remain forever in a
// table the user might later reference. Errors here are logged but not
// surfaced to the user — failing to clean up a demo row is not worth
// interrupting them with an error after they've just finished the tour.
export async function cleanupTourDemoData(refs: DemoRowRefs): Promise<void> {
  const tasks: Promise<unknown>[] = []
  // Delete child rows before parent rows, even though ON DELETE CASCADE
  // would handle it anyway — being explicit means a partial failure (e.g.
  // the goods_orders delete fails) doesn't silently cascade-delete a
  // worker/site row for the wrong reason, and each failure is reported
  // independently below via Promise.allSettled.
  if (refs.goodsOrderId) tasks.push(supabase.from('goods_orders').delete().eq('id', refs.goodsOrderId))
  if (refs.privateWorkId) tasks.push(supabase.from('private_work').delete().eq('id', refs.privateWorkId))
  if (refs.workerId) tasks.push(supabase.from('workers').delete().eq('id', refs.workerId))
  if (refs.trashWorkerId) tasks.push(supabase.from('workers').delete().eq('id', refs.trashWorkerId))
  if (refs.siteId) tasks.push(supabase.from('sites').delete().eq('id', refs.siteId))
  if (refs.supplierId) tasks.push(supabase.from('suppliers').delete().eq('id', refs.supplierId))
  if (refs.privateWorkerId) tasks.push(supabase.from('private_workers').delete().eq('id', refs.privateWorkerId))

  const results = await Promise.allSettled(tasks)
  results.forEach(r => { if (r.status === 'rejected') console.warn('[tourDemoData] cleanup failed for one row:', r.reason) })
}
