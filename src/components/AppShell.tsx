'use client'
import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from './Nav'
import type { Lang } from '@/lib/strings'

type Theme = 'light' | 'dark'

interface AppCtx {
  lang: Lang
  setLang: (l: Lang) => void
  theme: Theme
  toggleTheme: () => void
}

const Ctx = createContext<AppCtx>({ lang:'en', setLang:()=>{}, theme:'dark', toggleTheme:()=>{} })
export const useLang  = () => useContext(Ctx)
export const useTheme = () => useContext(Ctx)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang,  setLangState]  = useState<Lang>('en')
  const [theme, setThemeState] = useState<Theme>('dark')
  const [ready, setReady]      = useState(false)
  const router   = useRouter()
  const pathname = usePathname()

  // Apply saved theme immediately
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

  // Auth guard — listen for session changes in real time
  useEffect(() => {
    let mounted = true

    const checkAndRoute = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session) {
        setReady(true)
      } else {
        router.replace('/login')
      }
    }

    checkAndRoute()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) {
        setReady(true)
      } else {
        setReady(false)
        router.replace('/login')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  const setLang = useCallback((l: Lang) => {
    setLangState(l); localStorage.setItem('lang', l)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', next)
      return next
    })
  }, [])

  // Show the same background as the login page while checking auth,
  // so there is no jarring flash — it looks like a natural splash screen.
  if (!ready) return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: 'url(/login-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Same gradient overlay as login page */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 50%, rgba(4,3,1,0.94) 100%)',
        }}
      />
      {/* CM Logo + spinner */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg,rgba(212,140,40,0.15),rgba(212,140,40,0.05))',
              border: '1.5px solid rgba(212,140,40,0.35)',
              boxShadow: '0 0 60px rgba(212,140,40,0.18)',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <text x="0" y="36" fontFamily="Georgia,serif" fontWeight="900" fontSize="34" fill="#b0b0b0">C</text>
              <text x="24" y="36" fontFamily="Georgia,serif" fontWeight="900" fontSize="32" fill="#d48c28">M</text>
            </svg>
          </div>
          <div
            className="absolute inset-0 rounded-3xl border-2 border-transparent animate-spin"
            style={{
              borderTopColor: 'rgba(212,140,40,0.8)',
              borderRightColor: 'rgba(212,140,40,0.15)',
              animationDuration: '1s',
            }}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-black tracking-[0.25em] uppercase" style={{ color: 'rgba(212,140,40,0.85)' }}>
            Construction Manager
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>లోడవుతోంది...</p>
        </div>
      </div>
    </div>
  )

  return (
    <Ctx.Provider value={{ lang, setLang, theme, toggleTheme }}>
      <Nav
        lang={lang}
        onToggleLang={() => setLang(lang === 'en' ? 'te' : 'en')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="md:ml-56 pt-14">{children}</main>
    </Ctx.Provider>
  )
}
