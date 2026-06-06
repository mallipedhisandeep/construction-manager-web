// src/app/auth/callback/route.ts
//
// WHY THIS WAS BROKEN:
// The previous version called supabase.auth.exchangeCodeForSession(code) using
// the basic @supabase/supabase-js client. That exchange requires the SAME client
// instance that initiated the PKCE flow (it needs the verifier stored in the
// browser's localStorage). A server-side route.ts has no access to the browser's
// localStorage, so exchangeCodeForSession always failed → redirected to
// /login?error=auth_failed.
//
// THE FIX:
// Switch the OAuth flow from 'pkce' to 'implicit' on the client side (see
// supabase.ts), so Supabase returns the session tokens in the URL hash (#access_token=...)
// directly to the browser instead of sending a ?code= to the server.
// This means we no longer need server-side code exchange at all.
//
// This route.ts now only handles the edge case where Supabase sends ?code=
// (e.g. magic-link or email OTP flows). For Google OAuth with implicit flow,
// the browser-side supabase client picks up the hash tokens automatically
// via detectSessionInUrl: true.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // If there's an error param from Supabase, redirect to login with error
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  if (error) {
    console.error('[auth/callback] OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // For implicit flow: the browser handles the hash fragment directly.
  // Supabase JS client (with detectSessionInUrl:true) will read #access_token
  // from the URL automatically when this page loads in the browser.
  // We just redirect to a client page that lets Supabase JS do its work.
  const next = searchParams.get('next') ?? '/'

  // If there's a ?code= (email OTP / magic link), redirect to the
  // client-side handler page which can do the exchange in the browser.
  const code = searchParams.get('code')
  if (code) {
    // Redirect to a client page with the code so browser-side Supabase can handle it
    return NextResponse.redirect(
      `${origin}/auth/confirm?code=${code}&next=${encodeURIComponent(next)}`
    )
  }

  // Normal implicit flow: Supabase redirects here with hash tokens.
  // Browser will handle them. Just redirect to home — AppShell guards the route.
  return NextResponse.redirect(`${origin}${next}`)
}
