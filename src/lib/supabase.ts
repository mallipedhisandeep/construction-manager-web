import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Fix: use a fixed storage key so the PKCE code_verifier written
    // before the Google redirect is found under the same key when the
    // browser returns to /auth/confirm — even in PWA/standalone mode.
    storageKey: 'cm-auth-token',
  },
})

export default supabase
