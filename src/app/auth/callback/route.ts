// src/app/auth/callback/route.ts
//
// Google redirects here with ?code= after the user selects their account.
// This server-side route does ONE thing only: forward the code to the
// browser-side /auth/confirm page so the Supabase JS client can call
// exchangeCodeForSession() with the PKCE verifier from localStorage.
//
// It also sets a short-lived cookie with the code so that if the PWA
// opens a new tab (Android Chrome behaviour), /auth/confirm can read
// the code from the cookie as a fallback even if the URL params are lost.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // OAuth provider returned an error
  const oauthError = searchParams.get('error')
  if (oauthError) {
    const desc = searchParams.get('error_description') ?? oauthError
    console.error('[auth/callback] OAuth error:', desc)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    console.error('[auth/callback] No code received')
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Forward to the client-side confirm page so the browser can exchange
  // the code using the PKCE verifier stored in its own localStorage.
  const confirmUrl = new URL(`${origin}/auth/confirm`)
  confirmUrl.searchParams.set('code', code)
  confirmUrl.searchParams.set('next', next)

  const response = NextResponse.redirect(confirmUrl.toString())

  // Also store the code in a cookie (5-minute TTL) as a fallback for
  // Android PWA where the tab context can differ between the OAuth redirect
  // and the return. /auth/confirm reads this cookie if URL params are missing.
  response.cookies.set('cm_oauth_code', code, {
    httpOnly: false,    // must be readable by client JS
    secure: true,
    sameSite: 'lax',
    maxAge: 300,        // 5 minutes
    path: '/',
  })

  return response
}
