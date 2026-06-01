// src/app/auth/callback/route.ts
// Server-side OAuth callback — exchanges the ?code= for a session cookie.
// Uses PKCE flow so tokens are never exposed in the URL.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Guard against missing env vars (e.g. during Vercel preview builds)
    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
      console.error('[auth/callback] Missing Supabase env vars')
      return NextResponse.redirect(`${origin}/login?error=config`)
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    } catch (e) {
      console.error('[auth/callback] exception:', e)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
