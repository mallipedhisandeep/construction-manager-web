// src/app/auth/callback/route.ts
//
// PKCE flow (flowType: 'pkce' in supabase.ts):
//
// 1. User clicks "Continue with Google" on /login
// 2. Supabase stores a code_verifier in localStorage and redirects to Google
// 3. Google authenticates the user and redirects back here with ?code=...
// 4. This route.ts forwards the code to /auth/confirm (a CLIENT-side page)
// 5. /auth/confirm calls supabase.auth.exchangeCodeForSession(code) in the
//    browser, where localStorage is accessible to verify the PKCE challenge
// 6. On success, user is redirected to the app home page
//
// WHY NOT exchange here (server-side)?
// A Next.js route.ts runs on the server — it has no access to the browser's
// localStorage where the PKCE code_verifier was stored. Calling
// exchangeCodeForSession on the server always fails. We must delegate to
// a client-side page (/auth/confirm) to do the exchange in the browser.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // Supabase/Google returned an error — show it on the login page
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  if (error) {
    console.error('[auth/callback] OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const next = searchParams.get('next') ?? '/'
  const code = searchParams.get('code')

  if (code) {
    // Forward the code to the browser-side /auth/confirm page so the
    // Supabase JS client can call exchangeCodeForSession with the
    // localStorage-stored PKCE verifier.
    return NextResponse.redirect(
      `${origin}/auth/confirm?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
    )
  }

  // No code and no error — unexpected state. Send back to login.
  console.error('[auth/callback] No code or error received from OAuth provider')
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
