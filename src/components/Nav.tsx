'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lang, ts } from '@/lib/strings'

interface Props { lang: Lang; onToggleLang: () => void }

const links = [
  { href: '/',                icon: '🏠', key: 'dashboard'      as const },
  { href: '/attendance',      icon: '📅', key: 'attendance'     as const },
  { href: '/workers',         icon: '👷', key: 'workers'        as const },
  { href: '/sites',           icon: '🏗️', key: 'sites'          as const },
  { href: '/private-workers', icon: '🔧', key: 'privateWorkers' as const },
  { href: '/private-work',    icon: '📋', key: 'privateWork'    as const },
]

export default function Nav({ lang, onToggleLang }: Props) {
  const path   = usePathname()
  const router = useRouter()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ── Top bar ─────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-gradient-to-r from-orange-600 to-orange-500 shadow-lg flex items-center px-4 gap-3">
        <span className="text-xl font-black text-white tracking-tight">🏗️ {ts(lang,'appTitle')}</span>
        <div className="flex-1" />
        <button onClick={onToggleLang}
          className="bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-bold px-3 py-1 rounded-lg transition">
          {lang === 'en' ? 'తె' : 'EN'}
        </button>
        <button onClick={signOut} title={ts(lang,'signOut')}
          className="bg-white/10 hover:bg-white/20 text-white text-sm px-2.5 py-1.5 rounded-lg transition flex items-center gap-1">
          <span>🚪</span>
          <span className="hidden md:inline text-sm">{ts(lang,'signOut')}</span>
        </button>
      </header>

      {/* ── Sidebar (desktop) ───────────────────────── */}
      <nav className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-56px)] w-56 flex-col bg-white border-r border-gray-100 py-4 gap-0.5 shadow-sm z-40 overflow-y-auto">
        {links.map(l => {
          const active = path === l.href || (l.href !== '/' && path.startsWith(l.href))
          return (
            <Link key={l.href} href={l.href}
              className={`mx-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                ${active ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <span className={`text-lg transition ${active ? '' : 'grayscale opacity-70'}`}>{l.icon}</span>
              {ts(lang, l.key)}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </Link>
          )
        })}
        <div className="flex-1" />
        <button onClick={signOut}
          className="mx-2 mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition md:hidden">
          🚪 {ts(lang,'signOut')}
        </button>
      </nav>

      {/* ── Bottom nav (mobile) ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 shadow-lg z-40 safe-area-pb">
        <div className="grid grid-cols-6 h-16">
          {links.map(l => {
            const active = path === l.href || (l.href !== '/' && path.startsWith(l.href))
            return (
              <Link key={l.href} href={l.href}
                className={`flex flex-col items-center justify-center gap-0.5 transition ${active ? 'text-orange-600' : 'text-gray-400'}`}>
                <span className={`text-xl transition ${active ? '' : 'grayscale opacity-60'}`}>{l.icon}</span>
                <span className="text-[9px] font-semibold">{ts(lang, l.key).split(' ')[0]}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
