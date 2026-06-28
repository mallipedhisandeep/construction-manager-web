import type { Metadata, Viewport } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://construction-manager-web.vercel.app'

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
  metadataBase: new URL(SITE_URL),
  title:       'Construction Manager',
  description: 'Site and worker management for construction businesses — track workers, attendance, payments, and site expenses in one app.',
  manifest:    '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CM App' },
  formatDetection: { telephone: false },
  // This app sits entirely behind a login wall, so Open Graph tags mainly
  // matter for the rare case someone shares the /login link in a chat app
  // that generates a preview card — they're not meant to drive organic
  // search traffic (see robots.ts / sitemap.ts for why crawling is
  // intentionally disallowed past /login).
  openGraph: {
    title: 'Construction Manager',
    description: 'Site and worker management for construction businesses.',
    url: SITE_URL,
    siteName: 'Construction Manager',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Construction Manager',
    description: 'Site and worker management for construction businesses.',
  },
  robots: {
    // Mirrors robots.ts — keep both in sync if this policy ever changes.
    index: false,
    follow: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/login-bg.jpg" fetchPriority="high" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Inline theme script — runs before first paint, eliminates flash.
            Default is LIGHT mode, matching AppShell.tsx's getInitialTheme().
            Deliberately does NOT check the device's system dark-mode
            preference — every new user sees light mode first, regardless
            of their phone's OS theme setting, and switches to dark only
            via the in-app toggle. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('theme');
              var isDark = saved === 'dark';
              if (isDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.style.backgroundColor = 'rgb(12,12,15)';
                document.body && (document.body.style.backgroundColor = 'rgb(12,12,15)');
              } else {
                document.documentElement.style.backgroundColor = 'rgb(248,249,250)';
                document.body && (document.body.style.backgroundColor = 'rgb(248,249,250)');
              }
              if (!saved) localStorage.setItem('theme', 'light');
            } catch(e) {
              document.documentElement.style.backgroundColor = 'rgb(248,249,250)';
            }
          })();
        `}} />
      </head>
      <body className="min-h-screen" style={{ backgroundColor:'rgb(var(--bg))', color:'rgb(var(--text))' }}>
        <AppShell>{children}</AppShell>

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
          window.addEventListener('appinstalled', function() {
            try {
              var ua = navigator.userAgent;
              var platform = /android/i.test(ua) ? 'android' : /ipad|iphone|ipod/i.test(ua) ? 'ios' : 'desktop';
              var sessionRaw = localStorage.getItem('cm-auth-token');
              var session = sessionRaw ? JSON.parse(sessionRaw) : null;
              var accessToken = session && session.access_token;
              var userId = session && session.user && session.user.id;
              if (!accessToken || !userId) return; // RLS requires both — nothing to record if not logged in
              fetch('${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/pwa_installs', {
                method: 'POST',
                headers: {
                  'apikey': '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}',
                  'Authorization': 'Bearer ' + accessToken,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ user_id: userId, platform: platform, user_agent: ua.slice(0, 200) })
              }).catch(function(){});
            } catch(e) {}
          });
        `}} />
      </body>
    </html>
  )
}
