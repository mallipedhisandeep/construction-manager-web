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

const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback', '/auth/confirm']

function Splash() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundImage:'url(/login-bg.jpg)', backgroundSize:'cover', backgroundPosition:'center center', backgroundRepeat:'no-repeat' }}>
      <div className="absolute inset-0"
        style={{ background:'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.45) 50%, rgba(4,3,1,0.92) 100%)' }}/>
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ background:'linear-gradient(135deg,rgba(212,140,40,0.18),rgba(212,140,40,0.06))', border:'1.5px solid rgba(212,140,40,0.4)', boxShadow:'0 0 60px rgba(212,140,40,0.18), 0 8px 40px rgba(0,0,0,0.55)' }}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <text x="1" y="40" fontFamily="Georgia,serif" fontWeight="900" fontSize="36" fill="#cccccc">C</text>
            <text x="27" y="40" fontFamily="Georgia,serif" fontWeight="900" fontSize="34" fill="#d48c28">M</text>
          </svg>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xl font-black tracking-widest uppercase" style={{ color:'#e8e3d8', letterSpacing:'0.16em' }}>Construction</p>
          <p className="text-sm font-bold tracking-[0.32em] uppercase" style={{ color:'rgba(212,140,40,0.85)' }}>Manager</p>
        </div>
        <div className="mt-1 relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor:'#d48c28', borderRightColor:'rgba(212,140,40,0.2)', animationDuration:'0.9s' }}/>
        </div>
      </div>
    </div>
  )
}

// FIX 1: detect system theme on first install
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
    // No saved preference — follow device system theme
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch {}
  return 'dark'
}

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'te') return saved
  } catch {}
  return 'en'
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang,      setLangState]  = useState<Lang>('en')
  const [theme,     setThemeState] = useState<Theme>('dark')
  const [authState, setAuthState]  = useState<'checking'|'authed'|'unauthed'>('checking')
  const [hydrated,  setHydrated]   = useState(false)

  const router   = useRouter()
  const pathname = usePathname()
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // FIX 1: init theme + lang from system/localStorage on mount
  useEffect(() => {
    const t = getInitialTheme()
    const l = getInitialLang()
    setThemeState(t)
    setLangState(l)
    document.documentElement.classList.toggle('dark', t === 'dark')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme, hydrated])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session) { setAuthState('authed') }
      else { setAuthState('unauthed'); if (!isPublicPath) router.replace('/login') }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) { setAuthState('authed') }
      else { setAuthState('unauthed'); if (!isPublicPath) router.replace('/login') }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (authState === 'checking' && !isPublicPath) return <Splash />
  if (authState === 'unauthed' && !isPublicPath) return null

  return (
    <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme }}>
      {authState === 'authed' && <Nav />}
      <main className={authState === 'authed' ? 'pt-14 pb-16' : ''}>
        {children}
      </main>
    </Ctx.Provider>
  )
}
