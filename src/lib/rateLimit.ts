// src/lib/rateLimit.ts
//
// Minimal in-memory rate limiter. Lives in the Node process, so on Vercel
// each serverless instance has its own counters — this is NOT a distributed
// rate limiter and will not perfectly enforce a global limit across many
// concurrent instances. What it DOES do, for free, with no new
// infrastructure: stop a single client from hammering a route hundreds of
// times per minute, which is the realistic threat here (credential
// stuffing against /api routes, accidental retry loops, a misbehaving
// script). For real distributed rate limiting at scale, use Vercel's Edge
// Config + @vercel/firewall, or Upstash Redis — this is a pragmatic
// stopgap, not a claim of perfect protection.

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// Periodically forget old buckets so this Map doesn't grow forever in a
// long-lived serverless instance.
let lastSweep = Date.now()
function sweep() {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key)
  }
}

/**
 * Returns { allowed: true } if the caller is within limit, otherwise
 * { allowed: false, retryAfterSeconds }. Call once per request, before
 * doing any real work.
 *
 * @param key      Unique identifier for the caller — typically `${routeName}:${ip}`
 *                 or `${routeName}:${userId}` when the caller is authenticated.
 * @param limit    Max requests allowed within the window.
 * @param windowMs Window size in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  sweep()
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { allowed: true }
}

// Best-effort client identifier for unauthenticated routes (webhooks,
// login-adjacent endpoints). Vercel sets x-forwarded-for; falls back to a
// constant bucket if truly unavailable, which degrades to a global limit
// rather than no limit at all.
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
