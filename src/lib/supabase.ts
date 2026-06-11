import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

export const supabase = createClient(url, key, {
  auth: {
    flowType:         'pkce',
    persistSession:   true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey:       'cm-auth-token',
  },
})

export default supabase
