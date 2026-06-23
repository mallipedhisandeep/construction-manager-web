// src/app/api/admin/push/vapid-key/route.ts
//
// Returns the VAPID public key needed for the browser to call
// pushManager.subscribe({ applicationServerKey: ... }). The public key is
// safe to expose — only the private key (kept server-side in VAPID_PRIVATE_KEY)
// can actually sign push messages.

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) return NextResponse.json({ error: 'VAPID_PUBLIC_KEY not configured' }, { status: 503 })

  return NextResponse.json({ publicKey })
}
