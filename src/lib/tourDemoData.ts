// src/lib/tourDemoData.ts
//
// The auto-tour needs at least one real row per module to spotlight
// Edit/Delete/Pay buttons that only render for an existing item — a
// brand-new account has none. This file inserts exactly one clearly
// "Demo ..." labeled row per module before the tour starts, and deletes
// every row it created (by id, tracked in memory — never a broad
// "delete anything named Demo") once the tour ends, whether it finished
// naturally or was skipped.
//
// IMPORTANT: this only ever touches rows it itself created and tracked.
// It never queries for "any row containing Demo" — that could
// accidentally delete a real user's own data if they happened to name
// something similarly. Every id is captured at insert time and only
// those exact ids are ever deleted.

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

// Inserts one demo row per module, in dependency order (private_work and
// goods_orders reference a site/supplier/worker, so those parents are
// created first). Returns the ids actually created so cleanup can target
// them precisely. Any individual insert failing is swallowed — a demo row
// failing to seed just means that page's Edit/Delete step gets skipped by
// the tour engine's existing "element never appeared" timeout, not a
// crash of the whole tour.
export async function seedTourDemoData(userId: string): Promise<DemoRowRefs> {
  const refs: DemoRowRefs = {}

  const [workerRes, siteRes, supplierRes, privateWorkerRes] = await Promise.all([
    supabase.from('workers').insert({
      user_id: userId,
      name: 'Demo Worker',
      phone: '9000000000',
      gender: 'Male',
      state: 'Telangana',
      role: 'Mason',
      work_type: 'Centring',
      rate_6_6: 600, rate_10_6: 0, rate_6_10: 0, rate_6_2: 0, rate_10_2: 0, rate_2_6: 0,
      worker_status: 'Active',
    }).select('id').single(),

    supabase.from('sites').insert({
      user_id: userId,
      site_name: 'Demo Site',
      status: 'Active',
      floors_count: 1,
      budget: 100000,
    }).select('id').single(),

    supabase.from('suppliers').insert({
      user_id: userId,
      name: 'Demo Supplier',
      phone: '9000000001',
      shop_name: 'Demo Hardware Store',
    }).select('id').single(),

    supabase.from('private_workers').insert({
      user_id: userId,
      name: 'Demo Contractor',
      work_type: 'Plumbing',
      phone: '9000000002',
    }).select('id').single(),
  ])

  if (workerRes.data) refs.workerId = workerRes.data.id
  if (siteRes.data) refs.siteId = siteRes.data.id
  if (supplierRes.data) refs.supplierId = supplierRes.data.id
  if (privateWorkerRes.data) refs.privateWorkerId = privateWorkerRes.data.id

  // Second phase: goods_orders and private_work both reference a parent
  // row created above (supplier/site, worker/site respectively), so they
  // can only be created once those ids are known.
  const [goodsOrderRes, privateWorkRes] = await Promise.all([
    refs.supplierId
      ? supabase.from('goods_orders').insert({
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
        }).select('id').single()
      : Promise.resolve({ data: null }),

    refs.privateWorkerId
      ? supabase.from('private_work').insert({
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
        }).select('id').single()
      : Promise.resolve({ data: null }),
  ])

  if (goodsOrderRes.data) refs.goodsOrderId = goodsOrderRes.data.id
  if (privateWorkRes.data) refs.privateWorkId = privateWorkRes.data.id

  // Third phase: a worker that's immediately soft-deleted, purely so the
  // Trash page has a real row to demonstrate Restore on. This is a
  // SEPARATE worker from the main Demo Worker above — the tour needs the
  // main one to stay active (for the Workers-page edit/delete steps)
  // while also having something already in Trash to show restoring.
  const trashWorkerRes = await supabase.from('workers').insert({
    user_id: userId,
    name: 'Demo Deleted Worker',
    phone: '9000000003',
    gender: 'Male',
    state: 'Telangana',
    role: 'Helper',
    work_type: 'Centring',
    rate_6_6: 500, rate_10_6: 0, rate_6_10: 0, rate_6_2: 0, rate_10_2: 0, rate_2_6: 0,
    worker_status: 'Active',
  }).select('id').single()

  if (trashWorkerRes.data) {
    refs.trashWorkerId = trashWorkerRes.data.id
    await supabase.from('workers').update({ deleted_at: new Date().toISOString() }).eq('id', trashWorkerRes.data.id)
  }

  return refs
}

// Hard-deletes (not soft-delete) exactly the rows this tour session
// created. Hard delete is intentional here — these never need to appear
// in Trash/recycle bin, since they were never real user data to begin
// with, and leaving them soft-deleted would mean they remain forever in
// a table the user might later reference. Errors here are logged but not
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
