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
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Construction Manager',
  description: 'Site and worker management',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CM App' },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Apply saved theme before first paint — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') || 'dark';
            document.documentElement.classList.toggle('dark', t === 'dark');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />

        {/*
          FIX: Removed background-image from <body> that was set here previously.

          The previous version set login-bg.jpg as the body background so the
          page looked correct during hydration. However this caused TWO bugs:

          1. DESKTOP LAYOUT ON FIRST LOGIN — after the session was confirmed and
             the app rendered, the body background-image (login-bg.jpg) fought
             with rgb(var(--bg)) on .page/.card elements, causing a flash of the
             wrong background and triggering a layout recalculation that made the
             app briefly appear in a desktop-like state before React settled.

          2. The body background bled through transparent areas of the app UI
             in light mode, making some sections look incorrect.

          The correct approach: login/page.tsx applies login-bg.jpg only to its
          own container. The rest of the app uses rgb(var(--bg)) from globals.css.
          The dark class applied above (before first paint) ensures no white flash.
        */}
      </head>
      <body
        className="min-h-screen"
        style={{ backgroundColor: 'rgb(12,12,15)', color: 'rgb(238,236,229)' }}
      >
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () =>
              navigator.serviceWorker.register('/sw.js').catch(() => {})
            )
          }
        `}} />
      </body>
    </html>
  )
}
