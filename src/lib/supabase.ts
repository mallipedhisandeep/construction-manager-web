import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(url, key, {
  auth: {
    // PKCE flow: Supabase sends ?code= to /auth/callback
    // Our server-side route.ts exchanges it — no localhost redirect possible.
    flowType: 'pkce',
    // Persist session in localStorage so refresh works across page loads
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
})

export default supabase
