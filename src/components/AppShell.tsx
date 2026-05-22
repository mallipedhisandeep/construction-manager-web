'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from './Nav'
import type { Lang } from '@/lib/strings'

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} })
export const useLang = () => useContext(LangCtx)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setReady(true)
    })
  }, [router])

  useEffect(() => {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'te') setLang(saved)
  }, [])

  const toggleLang = () => {
    const next = lang === 'en' ? 'te' : 'en'
    setLang(next)
    localStorage.setItem('lang', next)
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent" />
    </div>
  )

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <Nav lang={lang} onToggleLang={toggleLang} />
      <main className="md:ml-52 pb-20 md:pb-4">
        {children}
      </main>
    </LangCtx.Provider>
  )
}
