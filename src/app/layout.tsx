import type { Metadata, Viewport } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  themeColor: '#0c0c0e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  // viewportFit: cover fills the full screen on notched phones (iPhone, etc.)
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Construction Manager',
  description: 'Site and worker management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CM App',
  },
  formatDetection: { telephone: false },
  // Prevent search engines from indexing (private business app)
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Mobile-first: explicitly block desktop scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* PWA / install meta */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CM App" />

        {/* Icons */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

        {/* Theme colour for browser chrome */}
        <meta name="theme-color" content="#0c0c0e" />

        {/* Apply saved dark/light theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') || 'dark';
            document.documentElement.classList.toggle('dark', t === 'dark');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />
      </head>
      <body
        style={{ backgroundColor: 'rgb(12,12,14)', color: 'rgb(238,236,229)' }}
        className="min-h-screen"
      >
        {children}

        {/* Register service worker */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(function(reg) {
                  // Force immediate activation of new SW version
                  if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
                  reg.addEventListener('updatefound', function() {
                    var newWorker = reg.installing;
                    if (newWorker) {
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                      });
                    }
                  });
                })
                .catch(function() {});
            });
          }
        `}} />
      </body>
    </html>
  )
}
