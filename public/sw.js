// ── Construction Manager Service Worker ──────────────────────────────────────

const CACHE = 'cm-v3'

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

  // CRITICAL: Never intercept auth routes — the ?code= and session tokens
  // must reach the app fresh from the network every time.
  // Serving a cached /auth/callback or /auth/confirm breaks the PKCE exchange.
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/login'
  ) {
    e.respondWith(fetch(e.request))
    return
  }

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
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(e.request).then(cached => {
          if (cached) return cached
          if (e.request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
