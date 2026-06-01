import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(url, key, {
  auth: {
    // 'implicit' flow: Supabase returns tokens in the URL hash (#access_token=...)
    // directly to the browser. The JS client picks them up via detectSessionInUrl.
    // This works WITHOUT @supabase/ssr or server-side cookie handling.
    //
    // 'pkce' flow was the previous setting — it sends a ?code= to route.ts, which
    // then needs to call exchangeCodeForSession using the SAME client that started
    // the flow (to verify the code_verifier). A server route.ts can't do this
    // because the verifier is in the browser's localStorage, not the server.
    // Result: exchangeCodeForSession always failed → ?error=auth_failed.
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export default supabase
