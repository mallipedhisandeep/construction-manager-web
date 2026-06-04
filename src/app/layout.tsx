import type { Metadata } from 'next'
// NOTE: Do NOT export `viewport` from here — Next.js App Router generates a
// <meta name="viewport"> tag from the `viewport` export automatically.
// Having BOTH the export AND a manual <meta name="viewport"> in <head> produces
// TWO viewport tags in the rendered HTML. Chrome on Android PWA picks the wrong
// one (falls back to the legacy 980px-wide desktop viewport) on first paint,
// making the app look like a desktop layout. A manual refresh clears it because
// the browser re-parses the corrected DOM. Removing the export and keeping only
// ONE manual viewport tag in <head> fixes the issue permanently.
import './globals.css'

export const dynamic = 'force-dynamic'

// Only metadata here — no viewport export (see note above)
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Single authoritative viewport tag.
          This is the ONLY viewport declaration — the `viewport` Next.js export
          has been removed above to prevent a duplicate tag being injected.
          Duplicate viewport tags cause Android Chrome / PWA to use the legacy
          980px desktop viewport on first load, making the app appear in desktop
          layout until the user refreshes.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* PWA + Apple meta */}
        <meta name="theme-color" content="#0c0c0e" />
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
