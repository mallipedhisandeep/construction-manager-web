// ── Construction Manager Service Worker ──────────────────────────────────────
// FIX: Pre-cache the app shell on install so the app loads offline.
// Previously the install event was empty — nothing was ever cached,
// so the offline fallback always failed.

const CACHE = 'cm-v2'

// These are the core files that make the app shell work offline.
// Next.js serves the page HTML from '/' and its JS/CSS bundles automatically.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install: pre-cache app shell ─────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ── Activate: clear old caches ───────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first for API calls, cache-first for static assets ────────
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // Always go network-first for Supabase API calls — never serve stale data
  if (url.hostname.includes('supabase')) {
    e.respondWith(fetch(e.request))
    return
  }

  // For Next.js API routes, always use network
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request))
    return
  }

  // For everything else: try network first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache fresh successful responses
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
        }
        return response
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(e.request).then(cached => {
          if (cached) return cached
          // If it's a navigation request and nothing cached, serve the app shell
          if (e.request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
