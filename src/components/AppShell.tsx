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

    // Also subscribe to auth events (handles session restored after OAuth redirect)
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

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen" style={{background:'rgb(12,12,14)'}}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{
              background:'linear-gradient(135deg,rgba(212,140,40,0.1),rgba(212,140,40,0.04))',
              border:'1.5px solid rgba(212,140,40,0.25)',
              boxShadow:'0 0 40px rgba(212,140,40,0.12)'
            }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <text x="0" y="30" fontFamily="Georgia,serif" fontWeight="900" fontSize="28" fill="#b0b0b0">C</text>
              <text x="20" y="30" fontFamily="Georgia,serif" fontWeight="900" fontSize="26" fill="#d48c28">M</text>
            </svg>
          </div>
          <div className="absolute inset-0 rounded-3xl border-2 border-transparent animate-spin"
            style={{borderTopColor:'rgba(212,140,40,0.7)',borderRightColor:'rgba(212,140,40,0.15)',animationDuration:'1s'}}/>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-black tracking-[0.25em] uppercase" style={{color:'rgba(212,140,40,0.7)'}}>Loading</p>
          <p className="text-xs" style={{color:'rgba(255,255,255,0.2)'}}>లోడవుతోంది...</p>
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
