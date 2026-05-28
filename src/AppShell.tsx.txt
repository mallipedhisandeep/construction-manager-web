'use client'
import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from './Nav'
import type { Lang } from '@/lib/strings'

type Theme = 'light' | 'dark'

interface AppCtx {
  lang:    Lang
  setLang: (l: Lang)  => void
  theme:   Theme
  toggleTheme: () => void
}

const Ctx = createContext<AppCtx>({ lang:'en', setLang:()=>{}, theme:'light', toggleTheme:()=>{} })
export const useLang  = () => useContext(Ctx)
export const useTheme = () => useContext(Ctx)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang,  setLangState]  = useState<Lang>('en')
  const [theme, setThemeState] = useState<Theme>('light')
  const [ready, setReady]      = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Restore saved preferences
    const savedLang  = localStorage.getItem('lang')
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedLang  === 'en' || savedLang  === 'te') setLangState(savedLang)
    if (savedTheme === 'dark' || savedTheme === 'light') setThemeState(savedTheme)
    // Apply theme immediately
    const t = savedTheme ?? 'light'
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setReady(true)
    })
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
    <div className="flex items-center justify-center min-h-screen" style={{background:'rgb(var(--bg))'}}>
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"/>
        <p className="text-sm" style={{color:'rgb(var(--muted))'}}>Loading...</p>
      </div>
    </div>
  )

  return (
    <Ctx.Provider value={{ lang, setLang, theme, toggleTheme }}>
      <Nav lang={lang} onToggleLang={()=>setLang(lang==='en'?'te':'en')} theme={theme} onToggleTheme={toggleTheme} />
      <main className="md:ml-56 pt-14">{children}</main>
    </Ctx.Provider>
  )
}
