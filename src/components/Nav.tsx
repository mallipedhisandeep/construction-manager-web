'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang, useTheme } from '@/components/AppShell'
import { ts } from '@/lib/strings'

const NAV = [
  { href:'/',                emoji:'🏠', key:'home'           as const },
  { href:'/workers',         emoji:'👷', key:'workers'        as const },
  { href:'/attendance',      emoji:'📋', key:'attendance'     as const },
  { href:'/sites',           emoji:'🏗️', key:'sites'          as const },
  { href:'/suppliers',       emoji:'🏪', key:'suppliers'      as const },
  { href:'/goods',           emoji:'📦', key:'goods'          as const },
  { href:'/money',           emoji:'💰', key:'money'          as const },
  { href:'/private-workers', emoji:'🔧', key:'privateWorkers' as const },
  { href:'/private-work',    emoji:'📝', key:'privateWork'    as const },
  { href:'/reports',         emoji:'📊', key:'reports'        as const },
  { href:'/profile',         emoji:'👤', key:'profile'        as const },
  { href:'/trash',           emoji:'🗑️', key:'trash'          as const },
]

const BOTTOM_NAV = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[8]]

export default function Nav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  // Feature 3: 7-tap admin trigger on the CM logo
  const tapCount = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleLogoTap = () => {
    tapCount.current += 1
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => { tapCount.current = 0 }, 1500)
    if (tapCount.current >= 7) {
      tapCount.current = 0
      router.push('/admin')
    }
  }

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  const signOut = async () => {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4"
        style={{background:'rgb(var(--surface))', borderBottom:'1px solid rgb(var(--border))'}}>
        {/* Feature 3: 7-tap on logo to open admin */}
        <button onClick={handleLogoTap} className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
            style={{background:'rgba(var(--accent),0.12)'}}>🏗️</div>
          <span className="font-bold text-sm" style={{color:'rgb(var(--text))'}}>{ts(lang,'appName')}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={toggleLang}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition"
            style={{background:'rgb(var(--surface2))', borderColor:'rgb(var(--border))', color:'rgb(var(--text))'}}>
            {lang === 'en' ? 'తె' : 'EN'}
          </button>
          <button onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition"
            style={{background:'rgb(var(--surface2))'}}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition"
            style={{background:'rgb(var(--surface2))', color:'rgb(var(--text))'}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="3"    width="14" height="1.5" rx="0.75"/>
              <rect x="1" y="7.25" width="14" height="1.5" rx="0.75"/>
              <rect x="1" y="11.5" width="10" height="1.5" rx="0.75"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex"
        style={{background:'rgb(var(--surface))', borderTop:'1px solid rgb(var(--border))', height:'56px'}}>
        {BOTTOM_NAV.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative"
              style={{color: active ? 'rgb(var(--accent))' : 'rgb(var(--muted))'}}>
              <span className="text-lg leading-none">{item.emoji}</span>
              <span className="text-[10px] font-semibold">{ts(lang, item.key)}</span>
              {active && <div className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{background:'rgb(var(--accent))'}}/>}
            </Link>
          )
        })}
      </nav>

      {/* ── Drawer ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}/>
          <div className="w-72 h-full flex flex-col overflow-y-auto shadow-2xl"
            style={{background:'rgb(var(--surface))'}}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{borderBottom:'1px solid rgb(var(--border))'}}>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏗️</span>
                <span className="font-bold text-sm" style={{color:'rgb(var(--text))'}}>{ts(lang,'appName')}</span>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-medium transition"
                style={{background:'rgb(var(--surface2))', color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="flex-1 py-2">
              {NAV.map(item => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className="flex items-center gap-3 mx-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: active ? 'rgba(var(--accent),0.1)' : 'transparent',
                      color: active ? 'rgb(var(--accent))' : 'rgb(var(--text))',
                    }}>
                    <span className="text-lg w-6 text-center flex-shrink-0">{item.emoji}</span>
                    <span className="text-sm font-medium flex-1">{ts(lang, item.key)}</span>
                    {active && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:'rgb(var(--accent))'}}/>}
                  </Link>
                )
              })}
            </div>
            <div className="p-4 space-y-2" style={{borderTop:'1px solid rgb(var(--border))'}}>
              <button onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition"
                style={{background:'rgb(var(--surface2))', color:'rgb(var(--text))'}}>
                <span className="text-base">{theme==='dark'?'☀️':'🌙'}</span>
                <span>{theme==='dark' ? ts(lang,'lightMode') : ts(lang,'darkMode')}</span>
              </button>
              <button onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition"
                style={{background:'rgba(185,28,28,0.08)', color:'#b91c1c', border:'1px solid rgba(185,28,28,0.15)'}}>
                <span className="text-base">🚪</span>
                <span>{ts(lang,'signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
