// Construction Manager Service Worker v8

const swUrl   = new URL(self.location.href)
const buildId = swUrl.searchParams.get('v') || 'v8'
const CACHE   = `cm-${buildId}`

const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
]

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

// ── Web Push: admin notifications (new user / new subscription / new
// support ticket) ───────────────────────────────────────────────────────────

// Tags that represent something the admin needs to actually act on (money or
// a support request) stay on screen until dismissed, instead of vanishing
// after a few seconds like a routine reminder would.
const STICKY_TAGS = new Set([
  'new-subscription', 'new-ticket', 'payment-failed',
  'renewal-payment', 'subscription-cancelled', 'payment-failed-admin',
])

self.addEventListener('push', (e) => {
  let data = { title: 'Construction Manager', body: 'You have a new notification', url: '/admin' }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch { /* fall back to default text */ }

  const sticky = data.tag ? STICKY_TAGS.has(data.tag) : false

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      // Re-alerts (vibrate/sound) even if a notification with the same tag
      // is already showing, instead of silently swapping the text underneath.
      renotify: !!data.tag,
      requireInteraction: sticky,
      timestamp: Date.now(),
      vibrate: sticky ? [200, 100, 200] : [100],
      data: { url: data.url || '/admin' },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'dismiss') return // just close it, no navigation

  const url = e.notification.data?.url || '/admin'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // ── PASSTHROUGH — never intercept these ───────────────────────────────────

  // All external domains (only cache same-origin)
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request))
    return
  }

  // Auth pages — one-time codes must always be fresh
  if (url.pathname.startsWith('/auth/') || url.pathname === '/login') {
    e.respondWith(fetch(e.request))
    return
  }

  // Supabase API calls
  if (url.hostname.includes('supabase')) {
    e.respondWith(fetch(e.request))
    return
  }

  // Next.js API routes
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request))
    return
  }

  // ── Static assets: cache first ────────────────────────────────────────────
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

  // ── Everything else (same-origin): network first, cache fallback ──────────
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
