// sentry.edge.config.ts
//
// Runs for any code executing in the Vercel Edge runtime (middleware,
// edge-flagged API routes). This app doesn't currently use edge runtime
// routes, but Next.js's Sentry integration expects this file to exist —
// harmless no-op if nothing runs on the edge.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? 'development',
  })
}
