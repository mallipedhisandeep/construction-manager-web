import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(url, key, {
  auth: {
    // 'pkce' flow: Supabase stores a code_verifier in localStorage when the
    // OAuth redirect begins. Google sends back a ?code= to /auth/callback.
    // route.ts forwards that code to /auth/confirm (a client-side page).
    // The browser-side Supabase client calls exchangeCodeForSession(code),
    // which works because the verifier is available in localStorage.
    //
    // 'implicit' flow was broken: Google has deprecated returning tokens in
    // the URL hash. It always sends ?code= now, but with implicit flow no
    // PKCE verifier is stored, so exchangeCodeForSession fails every time.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export default supabase
