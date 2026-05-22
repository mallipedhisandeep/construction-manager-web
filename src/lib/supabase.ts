import { createClient } from '@supabase/supabase-js'

// Use fallback during build so Next.js static analysis doesn't crash.
// Real values come from NEXT_PUBLIC_* env vars at runtime.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(url, key)
export default supabase
