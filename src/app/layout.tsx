import type { Metadata, Viewport } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'

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
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
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
