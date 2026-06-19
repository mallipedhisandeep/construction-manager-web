// src/app/api/admin/reply/route.ts
import { NextResponse } from 'next/server'
import { requireAdmin, createAdminClient } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null) as { ticketId?: string; status?: string; reply?: string } | null
  if (!body?.ticketId || !body?.status) {
    return NextResponse.json({ error: 'ticketId and status are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('support_tickets')
    .update({ admin_reply: body.reply || null, status: body.status })
    .eq('id', body.ticketId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
