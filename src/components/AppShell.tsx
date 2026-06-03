'use client'
import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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

// ── Splash screen — same background as the login page ────────────────────────
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
      {/* Same gradient overlay as login/page.tsx */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.45) 50%, rgba(4,3,1,0.92) 100%)',
        }}
      />

      {/* Logo + name centred */}
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
          <p
            className="text-xl font-black tracking-widest uppercase"
            style={{ color: '#e8e3d8', fontFamily: "'Syne',sans-serif", letterSpacing: '0.16em' }}
          >
            Construction
          </p>
          <p
            className="text-sm font-bold tracking-[0.32em] uppercase"
            style={{ color: 'rgba(212,140,40,0.85)', fontFamily: "'Syne',sans-serif" }}
          >
            Manager
          </p>
        </div>

        {/* Spinner */}
        <div className="mt-1 relative w-8 h-8">
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: '#d48c28',
              borderRightColor: 'rgba(212,140,40,0.2)',
              animationDuration: '0.9s',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang,  setLangState]  = useState<Lang>('en')
  const [theme, setThemeState] = useState<Theme>('dark')
  const [ready, setReady]      = useState(false)
  const router = useRouter()

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
      if (session) setReady(true)
      else router.replace('/login')
    }

    checkAndRoute()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) setReady(true)
      else { setReady(false); router.replace('/login') }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [router])

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

  // Show login-page background as splash while auth is being checked
  if (!ready) return <Splash />

  return (
    <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme }}>
      <Nav />
      <main className="pt-14 pb-16">{children}</main>
    </Ctx.Provider>
  )
}
