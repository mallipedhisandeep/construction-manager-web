// src/app/api/push/vapid-key/route.ts
//
// Returns the VAPID public key needed for the browser to call
// pushManager.subscribe({ applicationServerKey: ... }). Available to any
// logged-in user — the public key is safe to expose (only the private key,
// kept server-side, can actually sign push messages).

import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) return NextResponse.json({ error: 'VAPID_PUBLIC_KEY not configured' }, { status: 503 })

  return NextResponse.json({ publicKey })
}
