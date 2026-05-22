'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lang, ts } from '@/lib/strings'

interface Props { lang: Lang; onToggleLang: () => void }

export default function Nav({ lang, onToggleLang }: Props) {
  const path = usePathname()
  const router = useRouter()

  const links = [
    { href: '/',                icon: '🏠', key: 'dashboard' as const },
    { href: '/attendance',      icon: '📅', key: 'attendance' as const },
    { href: '/workers',         icon: '👷', key: 'workers' as const },
    { href: '/sites',           icon: '🏗️', key: 'sites' as const },
    { href: '/private-workers', icon: '🔧', key: 'privateWorkers' as const },
    { href: '/private-work',    icon: '📋', key: 'privateWork' as const },
  ]

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Top bar */}
      <header className="bg-orange-600 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg">🏗️ {ts(lang,'appTitle')}</span>
          <div className="flex items-center gap-2">
            <button onClick={onToggleLang}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-bold transition">
              {lang === 'en' ? 'తె' : 'EN'}
            </button>
            <button onClick={signOut}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm transition">
              {ts(lang,'signOut')}
            </button>
          </div>
        </div>
      </header>
      {/* Side nav (desktop) */}
      <nav className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-56px)] w-52 bg-white shadow-md flex-col py-4 gap-1 z-40">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition rounded-r-lg mr-2
              ${path === l.href ? 'bg-orange-50 text-orange-600 border-r-4 border-orange-500' : 'text-gray-600 hover:bg-gray-50'}`}>
            <span className="text-lg">{l.icon}</span>
            {ts(lang, l.key)}
          </Link>
        ))}
      </nav>
      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
        <div className="grid grid-cols-6 h-16">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition
                ${path === l.href ? 'text-orange-600' : 'text-gray-500'}`}>
              <span className="text-xl">{l.icon}</span>
              <span className="text-[9px] font-medium leading-tight text-center px-0.5">
                {ts(lang, l.key).split(' ')[0]}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
