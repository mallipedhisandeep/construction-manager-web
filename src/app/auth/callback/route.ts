// src/app/auth/callback/route.ts
// This handles the SERVER-SIDE OAuth callback from Supabase.
// Supabase redirects here with ?code=... after Google sign-in.
// We exchange the code for a session, then redirect to the app.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Use the actual request origin (works on Vercel, custom domain, etc.)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send back to login with error flag
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
