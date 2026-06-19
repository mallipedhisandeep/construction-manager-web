import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Validate at call-time rather than at module-load time.
// Module-level throws crash Next.js SSR/build when env vars are missing,
// producing cryptic "cannot read properties of undefined" errors.
function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || url === 'https://placeholder.supabase.co') {
    throw new Error(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL is missing or is still the placeholder value. ' +
      'Add it to your .env.local file and Vercel environment variables.'
    )
  }
  if (!key || key === 'placeholder-anon-key') {
    throw new Error(
      '[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or is still the placeholder value. ' +
      'Add it to your .env.local file and Vercel environment variables.'
    )
  }

  return createClient(url, key, {
    auth: {
      flowType:           'pkce',
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      storageKey:         'cm-auth-token',
    },
  })
}

// Singleton — created once on first import in a browser/server context.
// Using a function wrapper means the throw only fires when the module is
// actually used, not during the static-analysis phase of `next build`.
let _client: SupabaseClient | null = null

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) _client = createSupabaseClient()
    return (_client as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export default supabase
