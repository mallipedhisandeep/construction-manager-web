// Construction Manager Service Worker v5
// Fix: install event must NOT pre-cache '/' — that's a dynamic Next.js
// page and fetching it during SW install can fail/hang, which causes
// the entire SW installation to fail silently (the "Installing..." bug).

const CACHE = 'cm-v5'

// Only cache truly static files that are guaranteed to exist
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // Never intercept auth — one-time codes must be fresh
  if (url.pathname.startsWith('/auth/') || url.pathname === '/login') {
    e.respondWith(fetch(e.request))
    return
  }

  // Never cache Supabase API calls
  if (url.hostname.includes('supabase')) {
    e.respondWith(fetch(e.request))
    return
  }

  // Never cache Next.js API routes
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request))
    return
  }

  // Static assets: cache first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/)
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, response.clone()))
          }
          return response
        })
      })
    )
    return
  }

  // Everything else: network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, response.clone()))
        }
        return response
      })
      .catch(() => caches.match(e.request)
        .then(cached => cached ?? new Response('Offline', { status: 503 }))
      )
  )
})
