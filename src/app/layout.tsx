import type { Metadata, Viewport } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'

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
        <link rel="preload" as="image" href="/login-bg.jpg" fetchPriority="high" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/*
          Inline theme script runs BEFORE first paint — eliminates white flash.
          Sets the correct dark/light class and background-color instantly.
          No React, no hydration delay.
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('theme');
              var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (isDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.style.backgroundColor = 'rgb(12,12,15)';
                document.body && (document.body.style.backgroundColor = 'rgb(12,12,15)');
              } else {
                document.documentElement.style.backgroundColor = 'rgb(248,249,250)';
                document.body && (document.body.style.backgroundColor = 'rgb(248,249,250)');
              }
              if (!saved) localStorage.setItem('theme', isDark ? 'dark' : 'light');
            } catch(e) {
              document.documentElement.classList.add('dark');
              document.documentElement.style.backgroundColor = 'rgb(12,12,15)';
            }
          })();
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
          window.addEventListener('appinstalled', function() {
            try {
              var ua = navigator.userAgent;
              var platform = /android/i.test(ua) ? 'android' : /ipad|iphone|ipod/i.test(ua) ? 'ios' : 'desktop';
              fetch('${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/pwa_installs', {
                method: 'POST',
                headers: {
                  'apikey': '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}',
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ platform: platform, user_agent: ua.slice(0, 200) })
              }).catch(function(){});
            } catch(e) {}
          });
        `}} />
      </body>
    </html>
  )
}
