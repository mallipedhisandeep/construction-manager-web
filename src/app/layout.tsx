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

        {/* Theme init before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') || 'dark';
            document.documentElement.classList.toggle('dark', t === 'dark');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />

        {/*
          ISSUE 3 FIX — Splash screen background
          The black flash + icon splash happens because:
          1. The browser shows the PWA splash (from manifest: background_color + icon)
          2. Then React hydrates and renders the login page
          There is no way to change the PWA OS-level splash screen via code alone —
          it always comes from manifest.json's background_color and icons.

          The fix has two parts:
          A) manifest.json background_color → use a dark colour that matches the
             bottom edge of login-bg.jpg (already set to #0c0c0e — keep it).
          B) The <body> gets the login-bg.jpg as its background immediately via
             CSS so as soon as React renders ANYTHING, the image is already there.
             This eliminates the white/plain flash between splash and login page.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            background-image: url('/login-bg.jpg');
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;
            background-attachment: fixed;
          }
        `}} />
      </head>
      <body
        className="min-h-screen"
        style={{ color: 'rgb(238,236,229)' }}
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
