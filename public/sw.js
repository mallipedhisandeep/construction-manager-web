// Construction Manager Service Worker v4
// Key fix: /auth/confirm must NEVER be served from cache.
// The ?code= query param is one-time-use. If the SW serves a cached
// version of /auth/confirm without the code, the exchange silently fails.

const CACHE = 'cm-v4'

const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // NEVER cache auth routes — one-time codes and session tokens must
  // always be fresh from the network.
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/login' ||
    url.pathname === '/signup'
  ) {
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

  // For navigation requests (page loads): always try network first
  // so users get fresh HTML. Fall back to cached version if offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(e.request, clone))
          }
          return response
        })
        .catch(() => caches.match(e.request).then(cached => cached ?? caches.match('/')))
    )
    return
  }

  // Static assets (images, icons, fonts): cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/)
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE).then(cache => cache.put(e.request, response.clone()))
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
          caches.open(CACHE).then(cache => cache.put(e.request, response.clone()))
        }
        return response
      })
      .catch(() => caches.match(e.request))
  )
})
