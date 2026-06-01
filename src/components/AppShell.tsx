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

const Ctx = createContext<AppCtx>({ lang:'en', setLang:()=>{}, theme:'dark', toggleTheme:()=>{} })
export const useLang  = () => useContext(Ctx)
export const useTheme = () => useContext(Ctx)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang,  setLangState]  = useState<Lang>('en')
  const [theme, setThemeState] = useState<Theme>('dark')
  const [ready, setReady]      = useState(false)
  const router = useRouter()

  useEffect(() => {
    const savedLang  = localStorage.getItem('lang')
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedLang  === 'en' || savedLang  === 'te') setLangState(savedLang)
    // Default to dark theme matching the app icon
    const t = savedTheme ?? 'dark'
    setThemeState(t)
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
    <div className="flex items-center justify-center min-h-screen" style={{background:'rgb(10,14,22)'}}>
      <div className="flex flex-col items-center gap-4">
        {/* Logo circle matching app icon style */}
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{background:'linear-gradient(135deg,#0f1828,#1a2540)',border:'2px solid rgba(212,140,40,0.4)',boxShadow:'0 0 30px rgba(212,140,40,0.2)'}}>
          <div style={{fontSize:'2rem',lineHeight:1}}>🏗️</div>
          {/* Spinning ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{borderTopColor:'#d48c28',borderRightColor:'rgba(212,140,40,0.3)'}}/>
        </div>
        <p className="text-sm font-medium tracking-widest uppercase" style={{color:'rgba(212,140,40,0.8)'}}>Loading...</p>
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
