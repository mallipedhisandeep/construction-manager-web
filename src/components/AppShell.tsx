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
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email ?? '')
      setReady(true)
    })
    const saved = localStorage.getItem('cm_lang')
    if (saved === 'en' || saved === 'te') setLang(saved)
  }, [router])

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'te' : 'en'
    setLang(next)
    localStorage.setItem('cm_lang', next)
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-2xl animate-pulse">🏗️</div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <Nav lang={lang} onToggleLang={toggleLang} />
      <main className="md:ml-60 pt-14 md:pt-0 pb-20 md:pb-6 min-h-screen bg-slate-50">
        {children}
      </main>
    </LangCtx.Provider>
  )
}
