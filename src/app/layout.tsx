import type { Metadata, Viewport } from 'next'
import './globals.css'

// DEPLOY-3: force-dynamic is required here because the SW registration
// script tag inlines BUILD_ID. Without it a cached shell would serve
// stale SW URLs after a deploy. This is intentional and necessary.
export const dynamic = 'force-dynamic'

// DEPLOY-2 FIX: Use a fixed fallback string ('dev') instead of Date.now().
// Date.now() changes on every render → new SW URL on every hot-reload → infinite
// SW update loop in development. 'dev' is stable across reloads.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'

export const viewport: Viewport = {
  themeColor:    '#0c0c0e',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
  minimumScale:  1,
  userScalable:  false,
  viewportFit:   'cover',
}

export const metadata: Metadata = {
  title:       'Construction Manager',
  description: 'Site and worker management',
  manifest:    '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CM App' },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* UX-1: No manual viewport tag — Next.js 15 injects one from the Viewport export above */}
        <link rel="preload" as="image" href="/login-bg.jpg" fetchPriority="high" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Apply saved/system theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var saved = localStorage.getItem('theme');
            var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', isDark);
            if (!saved) localStorage.setItem('theme', isDark ? 'dark' : 'light');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />
      </head>
      <body className="min-h-screen" style={{ backgroundColor:'rgb(var(--bg))', color:'rgb(var(--text))' }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js?v=${BUILD_ID}', { scope: '/' })
                .then(function(reg) {
                  if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  reg.addEventListener('updatefound', function() {
                    var nw = reg.installing;
                    if (nw) nw.addEventListener('statechange', function() {
                      if (nw.state === 'installed' && navigator.serviceWorker.controller)
                        nw.postMessage({ type: 'SKIP_WAITING' });
                    });
                  });
                }).catch(function(){});
            });
          }
        `}} />
      </body>
    </html>
  )
}
