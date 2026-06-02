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
        {/* MUST be first — before any script or style — so browser locks
            mobile layout before it parses anything else.
            This prevents the desktop-width flash on PWA first load. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') || 'dark';
            document.documentElement.classList.toggle('dark', t === 'dark');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />
      </head>
      <body style={{ backgroundColor: 'rgb(18,18,20)', color: 'rgb(238,236,229)' }} className="min-h-screen">
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
          }
        `}} />
      </body>
    </html>
  )
}
