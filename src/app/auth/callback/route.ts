// src/app/auth/callback/route.ts
//
// This route handles the server-side leg of the OAuth redirect.
// The Supabase client is configured with flowType: 'pkce' (see src/lib/supabase.ts).
//
// PKCE flow:
//   1. User clicks "Sign in with Google" → Supabase redirects to Google.
//   2. Google redirects back to /auth/callback?code=<authorization_code>.
//   3. This route receives the code and forwards it to /auth/confirm, where
//      the browser-side Supabase client calls exchangeCodeForSession(code).
//      (The PKCE verifier is in the browser's localStorage, so the exchange
//       MUST happen in the browser, not in this server route.)
//   4. On success, the user is redirected to the app home page.
//
// SEC-4 / INCON-3 fix: removed misleading comments about implicit flow.
// The client config uses flowType:'pkce' and this route is written for PKCE.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  if (error) {
    console.error('[auth/callback] OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const next = searchParams.get('next') ?? '/'
  const code = searchParams.get('code')

  if (code) {
    // Forward to the client-side confirm page which can do the PKCE exchange
    // in the browser (where the code verifier is stored in localStorage).
    return NextResponse.redirect(
      `${origin}/auth/confirm?code=${code}&next=${encodeURIComponent(next)}`
    )
  }

  // No code — redirect to home; AppShell will handle auth state.
  return NextResponse.redirect(`${origin}${next}`)
}
