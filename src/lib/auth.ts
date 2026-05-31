// src/lib/auth.ts
// Tiny helper — call uid() anywhere you need the current user's ID for inserts.
// Returns null if not logged in (AppShell already guards all pages, so this
// should never be null in practice — but it's safer to check than to assume).

import { supabase } from './supabase'

export async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
