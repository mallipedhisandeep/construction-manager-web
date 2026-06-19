// src/lib/supabaseAdmin.ts
//
// SERVER-ONLY. Never import this file from a 'use client' component or
// anything that ends up in the browser bundle — it uses the service_role
// key, which bypasses every Row Level Security policy in the database.
//
// Used only by API route handlers (src/app/api/**) that have already
// verified the caller's identity via their access token.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
// admin email. ADMIN_EMAIL is a server-only env var (no NEXT_PUBLIC_ prefix)
// so it is never present in client-side JavaScript.
export async function requireAdmin(req: Request) {
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim()
  if (!adminEmail) return { ok: false as const, status: 403 as const, error: 'Admin not configured' }

  const user = await getUserFromRequest(req)
  if (!user) return { ok: false as const, status: 401 as const, error: 'Not authenticated' }
  if (user.email !== adminEmail) return { ok: false as const, status: 403 as const, error: 'Not authorized' }

  return { ok: true as const, user }
}
