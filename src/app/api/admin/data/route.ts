// src/app/api/admin/data/route.ts
//
// Replaces the old pattern of the admin page querying Supabase directly from
// the browser with the anon key (which only ever returned the admin's own
// rows under RLS) and calling a non-existent `get_user_emails` RPC.
//
// This route verifies the caller is the configured admin server-side, then
// uses the service role key to read real, platform-wide data.

import { NextResponse } from 'next/server'
import { requireAdmin, createAdminClient } from '@/lib/supabaseAdmin'
import { fetchAll } from '@/lib/fetchAll'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()

  // Real user list + last sign-in, straight from the Auth admin API —
  // no need for a hand-written SECURITY DEFINER RPC that has to be
  // separately maintained and was never committed to this repo.
  const users: { id: string; email: string; created_at: string; last_sign_in_at: string | null }[] = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const u of data.users) {
      users.push({
        id: u.id,
        email: u.email ?? '(no email)',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      })
    }
    if (data.users.length < 1000) break
    page += 1
  }

  const [
    { data: subs, error: subsErr },
    { data: workers, error: workersErr },
    { data: sites, error: sitesErr },
    { data: attendance, error: attErr },
    { data: pwaInstalls, error: pwaErr },
    { data: tickets, error: ticketsErr },
  ] = await Promise.all([
    fetchAll(() => admin.from('subscriptions').select('user_id,plan,status,trial_ends_at,current_period_end,billing_cycle')),
    fetchAll(() => admin.from('workers').select('user_id,created_at')),
    fetchAll(() => admin.from('sites').select('user_id,created_at')),
    fetchAll(() => admin.from('attendance').select('user_id,date')),
    fetchAll(() => admin.from('pwa_installs').select('user_id,installed_at')),
    admin.from('support_tickets').select('*').order('created_at', { ascending: false }),
  ])

  const firstErr = subsErr || workersErr || sitesErr || attErr || pwaErr || ticketsErr
  if (firstErr) {
    // "permission denied for table X" here (unlike on the client) means the
    // service-role client itself isn't actually using the service role key —
    // it bypasses RLS entirely, so a permission error at this point almost
    // always means SUPABASE_SERVICE_ROLE_KEY in Vercel's env vars is missing,
    // truncated, or is actually the anon/publishable key by mistake.
    const hint = /permission denied/i.test(firstErr.message)
      ? ' This usually means SUPABASE_SERVICE_ROLE_KEY in Vercel is missing or incorrect (it must be the "service_role" secret key from Supabase → Project Settings → API, not the anon/publishable key). Update it in Vercel → Settings → Environment Variables, then redeploy.'
      : ''
    return NextResponse.json({ error: firstErr.message + hint }, { status: 500 })
  }

  return NextResponse.json({
    users,
    subs: subs ?? [],
    workers: workers ?? [],
    sites: sites ?? [],
    attendance: attendance ?? [],
    pwaInstalls: pwaInstalls ?? [],
    tickets: tickets ?? [],
  })
}
