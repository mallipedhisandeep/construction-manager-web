// src/lib/logger.ts
//
// Centralized error logging. Wraps Sentry so every API route reports
// failures somewhere durable and searchable instead of a console.error
// line that vanishes when the Vercel function log window expires.
//
// IMPORTANT: this is safe to import and call even before Sentry is set up.
// If SENTRY_DSN isn't configured, logError() falls back to console.error
// so nothing breaks and no route needs an if-check around it — once you
// add SENTRY_DSN to Vercel, errors automatically start flowing to Sentry
// with zero code changes elsewhere.

import * as Sentry from '@sentry/nextjs'

let initialized = false
function ensureInit() {
  if (initialized) return
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return // not configured yet — logError() will fall back to console
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1, // 10% of requests get full performance tracing — keeps free-tier usage low
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  })
  initialized = true
}

interface LogContext {
  route?: string
  userId?: string
  [key: string]: unknown
}

// Call this in a catch block, or anywhere an error happens that you want
// recorded. Always also keep your existing console.error — this adds to
// it, it doesn't replace the need to see something in local dev logs too.
export function logError(error: unknown, context?: LogContext) {
  console.error(`[${context?.route ?? 'app'}]`, error, context ?? '')

  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return // Sentry not configured — console.error above is the only record, by design

  ensureInit()
  Sentry.captureException(error, { extra: context })
}

// For non-error events worth tracking (e.g. "webhook signature failed
// repeatedly", "rate limit hit") that aren't exceptions but are still
// worth being able to search for later.
export function logEvent(message: string, context?: LogContext) {
  console.warn(`[${context?.route ?? 'app'}]`, message, context ?? '')

  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return

  ensureInit()
  Sentry.captureMessage(message, { level: 'warning', extra: context })
}
