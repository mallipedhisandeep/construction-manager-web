// sentry.client.config.ts
//
// Runs once when the app loads in the browser. Safe to ship even before
// you've created a Sentry account — Sentry.init with an empty/undefined
// DSN is effectively a no-op, it just won't send anything anywhere.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    // Don't replay every session — keeps the free tier usage low. Errors
    // are what matter here; full session replay is a nice-to-have, not
    // part of this fix.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}
