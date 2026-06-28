// sentry.server.config.ts
//
// Runs once per server instance (API routes, server components). Safe to
// ship before Sentry is configured — see sentry.client.config.ts for why.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? 'development',
  })
}
