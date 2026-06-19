// src/lib/auth.ts
// Tiny helper — call uid() anywhere you need the current user's ID for inserts.
// Returns null if not logged in (AppShell already guards all pages, so this
// should never be null in practice — but it's safer to check than to assume).
//
// Uses getSession() (cached, no network) instead of getUser() (always network)
// for speed. The session is already verified by the server via RLS anyway.

import { supabase } from './supabase'

export async function uid(): Promise<string | null> {
  // getSession is synchronous-fast (reads from storage) — prefer it over
  // getUser() which always makes a network round-trip to Supabase Auth.
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

// Returns the full session access token, needed for Authorization headers
// when calling server-side API routes.
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}
