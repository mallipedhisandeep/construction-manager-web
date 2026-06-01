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
    <div className="flex items-center justify-center min-h-screen" style={{background:'rgb(10,14,22)'}}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background:'linear-gradient(135deg,#0f1828,#1a2540)',
            border:'2px solid rgba(212,140,40,0.35)',
            boxShadow:'0 0 40px rgba(212,140,40,0.15), inset 0 0 20px rgba(0,0,0,0.5)'
          }}>
          {/* App icon inside loader circle */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="CM" width={52} height={52} style={{borderRadius:'12px',objectFit:'contain'}} />
          {/* Spinning gold ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin"
            style={{borderTopColor:'#d48c28',borderRightColor:'rgba(212,140,40,0.2)'}}/>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold tracking-[0.2em] uppercase" style={{color:'rgba(212,140,40,0.9)'}}>
            Loading
          </p>
          <p className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>
            లోడవుతోంది...
          </p>
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
