// Construction Manager Service Worker v7

// Derive cache name from query string so it changes with each deploy
const swUrl   = new URL(self.location.href)
const buildId = swUrl.searchParams.get('v') || 'v7'
const CACHE   = `cm-${buildId}`

// Files to precache — kept minimal so a single missing file
// doesn't abort the entire SW install.
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
]

// Install: cache essential files individually so one failure doesn't
// block the whole install (unlike cache.addAll which is all-or-nothing).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] precache failed:', url, err))
        )
      )
    }).then(() => self.skipWaiting())
  )
})

// Activate: delete all old caches
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

  // Never intercept auth pages — one-time codes must always be fresh
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

  // Static assets (_next/static, images, fonts): cache first
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
        }).catch(() => caches.match(e.request))
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
      .catch(async () => {
        const cached = await caches.match(e.request)
        if (cached) return cached
        const offlinePage = await caches.match('/offline.html')
        return offlinePage ?? new Response('Offline — please reconnect', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      })
  )
})
