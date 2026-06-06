import type { Metadata, Viewport } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'

// FIX D6: SW version auto-generated from build time so each deploy
// forces users to get the new service worker immediately
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
        {/* Mobile-first: must be first tag so browser reads it before anything else */}
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* FIX P5: preload login-bg.jpg so it renders without delay on the login page */}
        <link rel="preload" as="image" href="/login-bg.jpg" fetchPriority="high" />

        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable"            content="yes" />
        <meta name="apple-mobile-web-app-capable"      content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Body background = login-bg so splash-to-login transition is seamless (Fix Issue 3) */}
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            background-image: url('/login-bg.jpg');
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;
            background-attachment: fixed;
          }
        `}} />

        {/* Apply saved theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') || 'dark';
            document.documentElement.classList.toggle('dark', t === 'dark');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />
      </head>
      <body className="min-h-screen" style={{ color:'rgb(238,236,229)' }}>
        {children}

        {/* FIX D6: pass BUILD_ID to SW so each deploy registers a new cache version */}
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
