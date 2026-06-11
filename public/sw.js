// Construction Manager Service Worker v6
// PWA-1 fix: cache name is now versioned via the SW query string (?v=BUILD_ID)
//            so each deploy gets a fresh cache name derived from the build ID.
//            The BUILD_ID is injected by layout.tsx as /sw.js?v=<id>.
//            We extract it here so the CACHE name changes on each deploy.
// PWA-2 fix: offline fallback now returns /offline.html instead of plain text.

// Derive cache name from query string so it changes with each deploy
const swUrl   = new URL(self.location.href)
const buildId = swUrl.searchParams.get('v') || 'v6'
const CACHE   = `cm-${buildId}`

const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html',   // PWA-2: cache the offline page at install time
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
        // PWA-1 fix: delete ALL old cm-* caches, not just ones != CACHE
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
      .catch(async () => {
        const cached = await caches.match(e.request)
        if (cached) return cached
        // PWA-2 fix: return the proper offline HTML page, not a plain text "Offline"
        const offlinePage = await caches.match('/offline.html')
        return offlinePage ?? new Response('Offline', { status: 503 })
      })
  )
})
