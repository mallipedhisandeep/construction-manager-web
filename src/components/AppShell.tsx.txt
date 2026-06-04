'use client'
import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from './Nav'
import type { Lang } from '@/lib/strings'

type Theme = 'light' | 'dark'

interface LangCtx  { lang: Lang; toggleLang: () => void }
interface ThemeCtx { theme: Theme; toggleTheme: () => void }
interface AppCtx   extends LangCtx, ThemeCtx {}

const Ctx = createContext<AppCtx>({
  lang: 'en', toggleLang: () => {},
  theme: 'dark', toggleTheme: () => {},
})

export const useLang  = (): LangCtx  => { const c = useContext(Ctx); return { lang: c.lang, toggleLang: c.toggleLang } }
export const useTheme = (): ThemeCtx => { const c = useContext(Ctx); return { theme: c.theme, toggleTheme: c.toggleTheme } }

// Auth-check routes that should NEVER show the splash.
// On these pages we're unauthenticated by design — showing the splash
// over the login page is the bug reported in Issue 2.
const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback', '/auth/confirm']

// ── Splash — only shown while verifying session on PROTECTED routes ───────────
function Splash() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/login-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.45) 50%, rgba(4,3,1,0.92) 100%)',
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg,rgba(212,140,40,0.18),rgba(212,140,40,0.06))',
            border: '1.5px solid rgba(212,140,40,0.4)',
            boxShadow: '0 0 60px rgba(212,140,40,0.18), 0 8px 40px rgba(0,0,0,0.55)',
          }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <text x="1" y="40" fontFamily="Georgia,serif" fontWeight="900" fontSize="36" fill="#cccccc">C</text>
            <text x="27" y="40" fontFamily="Georgia,serif" fontWeight="900" fontSize="34" fill="#d48c28">M</text>
          </svg>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xl font-black tracking-widest uppercase"
            style={{ color: '#e8e3d8', fontFamily: "'Syne',sans-serif", letterSpacing: '0.16em' }}>
            Construction
          </p>
          <p className="text-sm font-bold tracking-[0.32em] uppercase"
            style={{ color: 'rgba(212,140,40,0.85)', fontFamily: "'Syne',sans-serif" }}>
            Manager
          </p>
        </div>
        <div className="mt-1 relative w-8 h-8">
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: '#d48c28', borderRightColor: 'rgba(212,140,40,0.2)', animationDuration: '0.9s' }}
          />
        </div>
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang,  setLangState]  = useState<Lang>('en')
  const [theme, setThemeState] = useState<Theme>('dark')

  // ── FIX 1: Three-state auth: 'checking' | 'authed' | 'unauthed'
  // Previously: boolean `ready` caused Splash to show over the login page
  // because setReady(false) fired before router.replace('/login') completed.
  // Now: we never show Splash when on a public path.
  const [authState, setAuthState] = useState<'checking' | 'authed' | 'unauthed'>('checking')

  const router   = useRouter()
  const pathname = usePathname()

  // Is the current path a public (non-protected) route?
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // Apply saved preferences immediately (before first paint via layout.tsx
  // inline script handles dark class, but we sync state here too)
  useEffect(() => {
    const savedLang  = localStorage.getItem('lang')
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedLang === 'en' || savedLang === 'te') setLangState(savedLang)
    const t = savedTheme ?? 'dark'
    setThemeState(t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    let mounted = true

    const checkAndRoute = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (session) {
        setAuthState('authed')
      } else {
        setAuthState('unauthed')
        // Only redirect to login if we're on a protected path
        if (!isPublicPath) router.replace('/login')
      }
    }

    checkAndRoute()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) {
        setAuthState('authed')
      } else {
        setAuthState('unauthed')
        // ── FIX 2: Don't set splash state before navigation.
        // Previously `setReady(false)` + `router.replace('/login')` ran
        // together — React rendered Splash BEFORE the route changed, so
        // the Splash overlay appeared on top of the login page.
        // Now we just navigate; since isPublicPath will be true on /login,
        // Splash will never render there.
        if (!isPublicPath) router.replace('/login')
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'en' ? 'te' : 'en'
      localStorage.setItem('lang', next)
      return next
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', next)
      return next
    })
  }, [])

  // ── FIX 3: Never show Splash on public paths (login, signup, auth/*)
  // This eliminates the overlay on the login page entirely.
  // Only show Splash while checking auth on a PROTECTED route.
  if (authState === 'checking' && !isPublicPath) return <Splash />

  // If unauthed and on a protected path, show nothing (redirect is in flight)
  if (authState === 'unauthed' && !isPublicPath) return null

  return (
    <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme }}>
      {/* Nav is only rendered for authenticated app pages */}
      {authState === 'authed' && <Nav />}
      <main className={authState === 'authed' ? 'pt-14 pb-16' : ''}>
        {children}
      </main>
    </Ctx.Provider>
  )
}
