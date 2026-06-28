// src/lib/supabaseAdmin.ts
//
// SERVER-ONLY. Never import this file from a 'use client' component or
// anything that ends up in the browser bundle — it uses the service_role
// key, which bypasses every Row Level Security policy in the database.
//
// Used only by API route handlers (src/app/api/**) that have already
// verified the caller's identity via their access token.

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { rateLimit, clientIp } from '@/lib/rateLimit'

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url) throw new Error('[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL is missing')
  if (!serviceKey) throw new Error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing')

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Verifies a bearer access token (sent from the client) and returns the
// authenticated user, or null if the token is missing/invalid.
export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const admin = createAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// Returns true only if the request's bearer token belongs to the configured
// admin email. ADMIN_EMAIL must be the server-only env var (no NEXT_PUBLIC_
// prefix) — it is intentionally NOT allowed to fall back to
// NEXT_PUBLIC_ADMIN_EMAIL, because anything with that prefix is bundled
// into client-side JavaScript and is not actually private. If only the
// NEXT_PUBLIC_ variant is set, admin auth is treated as misconfigured
// rather than silently trusting a value an attacker could read from the
// page source.
//
// Also rate-limited: 20 attempts per 10 minutes per caller IP. This is the
// single highest-value route to protect against brute-force / scripted
// probing, since a successful guess here grants full platform-wide data
// access via the service role key.
export async function requireAdmin(req: Request) {
  const limit = rateLimit(`admin-auth:${clientIp(req)}`, 20, 10 * 60_000)
  if (!limit.allowed) {
    return { ok: false as const, status: 429 as const, error: `Too many attempts. Try again in ${limit.retryAfterSeconds}s.` }
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  if (!adminEmail) return { ok: false as const, status: 403 as const, error: 'Admin not configured (ADMIN_EMAIL env var missing)' }

  const user = await getUserFromRequest(req)
  if (!user) return { ok: false as const, status: 401 as const, error: 'Not authenticated' }
  if ((user.email ?? '').trim().toLowerCase() !== adminEmail) return { ok: false as const, status: 403 as const, error: 'Not authorized' }

  return { ok: true as const, user }
}
