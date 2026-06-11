import type { Metadata, Viewport } from 'next'
import './globals.css'

// DEPLOY-3: force-dynamic opts every route out of static rendering.
// This is required here because layout.tsx injects the BUILD_ID into the
// SW registration script tag. If the layout were statically cached, every
// user would get the same stale BUILD_ID, breaking SW cache invalidation.
// To reduce Vercel serverless invocations: move the SW registration to a
// separate <Script> component in a client component and remove this export.
export const dynamic = 'force-dynamic'

// DEPLOY-2: If NEXT_PUBLIC_BUILD_ID is not set (e.g. in development or a
// Vercel preview without the env var), BUILD_ID falls back to Date.now().
// This is fine locally but will cause a new SW registration on every page
// load in development, flooding the browser's SW update mechanism.
// Set NEXT_PUBLIC_BUILD_ID in your Vercel environment (see env.example).
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString()

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
        {/* UX-1 fix: removed manual <meta name="viewport"> — Next.js 15 already injects
            one from the `export const viewport: Viewport` above. Two viewport tags
            conflict and can cause unexpected zoom/scaling on mobile. */}
        {/* Preload login bg for fast first paint on login page */}
        <link rel="preload" as="image" href="/login-bg.jpg" fetchPriority="high" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* FIX 1: system theme before first paint — check system preference if no saved value */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var saved = localStorage.getItem('theme');
            var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', isDark);
            if (!saved) localStorage.setItem('theme', isDark ? 'dark' : 'light');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />

        {/* FIX 8: NO body background-image here.
            login-bg.jpg is only set inside login/page.tsx itself.
            Previously the body had background-image:url(/login-bg.jpg)
            which bled through into every authenticated screen. */}
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
