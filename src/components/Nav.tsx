'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Lang } from '@/lib/strings'

interface Props {
  lang: Lang
  onToggleLang: () => void
  theme: 'light'|'dark'
  onToggleTheme: () => void
}

// Custom construction-site SVG logo
const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <rect width="30" height="30" rx="7" fill="rgba(255,255,255,0.2)"/>
    <rect x="3" y="20" width="24" height="3" rx="1.5" fill="white"/>
    <rect x="12.5" y="8" width="5" height="14" rx="1" fill="white"/>
    <rect x="3" y="10" width="9" height="2" rx="1" fill="rgba(255,255,255,0.7)"/>
    <rect x="18" y="10" width="9" height="2" rx="1" fill="rgba(255,255,255,0.7)"/>
    <circle cx="7" cy="25" r="2.5" fill="rgba(255,255,255,0.9)"/>
    <circle cx="23" cy="25" r="2.5" fill="rgba(255,255,255,0.9)"/>
  </svg>
)

const mainLinks = [
  { href:'/',                emoji:'🏠', en:'Dashboard',       te:'డాష్‌బోర్డ్' },
  { href:'/attendance',      emoji:'📅', en:'Attendance',       te:'హాజరు' },
  { href:'/workers',         emoji:'👷', en:'Workers',          te:'కార్మికులు' },
  { href:'/sites',           emoji:'🏗️', en:'Sites',            te:'సైట్లు' },
]
const moreLinks = [
  { href:'/suppliers',       emoji:'🏪', en:'Suppliers',        te:'సరఫరాదారులు' },
  { href:'/goods',           emoji:'📦', en:'Goods Orders',     te:'వస్తువులు' },
  { href:'/private-workers', emoji:'🔧', en:'Private Workers',  te:'ప్రైవేట్ కార్మికులు' },
  { href:'/private-work',    emoji:'📋', en:'Private Work',     te:'ప్రైవేట్ పని' },
  { href:'/money',           emoji:'💰', en:'Money Tracking',   te:'డబ్బు' },
  { href:'/reports',         emoji:'📊', en:'Reports',          te:'నివేదికలు' },
  { href:'/trash',           emoji:'🗑️', en:'Recycle Bin',      te:'చెత్తబుట్ట' },
]
const allLinks = [...mainLinks, ...moreLinks]

function label(l: typeof allLinks[0], lang: Lang) { return lang==='te' ? l.te : l.en }

export default function Nav({ lang, onToggleLang, theme, onToggleTheme }: Props) {
  const path   = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const active = (href: string) => href==='/' ? path==='/' : path.startsWith(href)

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-gradient-to-r from-orange-700 via-orange-600 to-amber-500 dark:from-orange-900 dark:via-orange-800 dark:to-orange-700 shadow-lg flex items-center px-4 gap-2.5">
        <Logo />
        <span className="font-black text-white tracking-tight flex-1 truncate text-sm md:text-base">
          {lang==='te'?'నిర్మాణ మేనేజర్':'Construction Manager'}
        </span>
        {/* Theme toggle */}
        <button onClick={onToggleTheme} title="Toggle dark mode"
          className="bg-white/15 hover:bg-white/25 text-white w-8 h-8 rounded-lg transition flex items-center justify-center text-sm">
          {theme==='dark'?'☀️':'🌙'}
        </button>
        {/* Language toggle */}
        <button onClick={onToggleLang}
          className="bg-white/20 hover:bg-white/30 border border-white/30 text-white text-xs font-black px-2 py-1 rounded-lg transition">
          {lang==='en'?'తె':'EN'}
        </button>
        {/* Sign out */}
        <button onClick={signOut} title="Sign out"
          className="bg-white/15 hover:bg-white/25 text-white w-8 h-8 rounded-lg transition flex items-center justify-center">
          🚪
        </button>
      </header>

      {/* ── Desktop sidebar ── */}
      <nav className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-56px)] w-56 flex-col py-3 z-40 overflow-y-auto border-r"
        style={{background:'rgb(var(--surface))',borderColor:'rgb(var(--border))'}}>
        <div className="px-3 space-y-0.5">
          <p className="text-[10px] font-black uppercase tracking-widest px-2 mb-2 mt-1" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'ముఖ్యమైనవి':'Main'}</p>
          {mainLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                ${active(l.href) ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50'}`}
              style={{color: active(l.href) ? undefined : 'rgb(var(--muted))'}}>
              <span className="text-base">{l.emoji}</span>
              <span>{label(l,lang)}</span>
              {active(l.href) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500"/>}
            </Link>
          ))}
          <p className="text-[10px] font-black uppercase tracking-widest px-2 mb-2 mt-4" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'కార్యకలాపాలు':'Operations'}</p>
          {moreLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                ${active(l.href) ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50'}`}
              style={{color: active(l.href) ? undefined : 'rgb(var(--muted))'}}>
              <span className="text-base">{l.emoji}</span>
              <span>{label(l,lang)}</span>
            </Link>
          ))}
        </div>
        <div className="mt-auto px-3 pb-3">
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
            🚪 <span>{lang==='te'?'లాగ్అవుట్':'Sign Out'}</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{background:'rgb(var(--surface))',borderColor:'rgb(var(--border))'}}>
        <div className="grid grid-cols-5 h-16">
          {mainLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition ${active(l.href)?'text-orange-600 dark:text-orange-400':''}`}
              style={{color: active(l.href) ? undefined : 'rgb(var(--muted))'}}>
              <span className={`text-xl ${active(l.href)?'':'grayscale opacity-60'}`}>{l.emoji}</span>
              <span className="text-[9px] font-bold">{label(l,lang).split(' ')[0]}</span>
            </Link>
          ))}
          <button onClick={()=>setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 transition"
            style={{color:'rgb(var(--muted))'}}>
            <span className="text-xl">☰</span>
            <span className="text-[9px] font-bold">{lang==='te'?'మరిన్ని':'More'}</span>
          </button>
        </div>
      </nav>

      {/* ── More drawer ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={()=>setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 shadow-2xl pb-8"
            style={{background:'rgb(var(--surface))'}} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5"/>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{color:'rgb(var(--muted))'}}>
              {lang==='te'?'అన్ని మాడ్యూల్లు':'All Modules'}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {allLinks.map(l => (
                <Link key={l.href} href={l.href} onClick={()=>setMoreOpen(false)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition
                    ${active(l.href)?'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/30':''}`}
                  style={{
                    borderColor: active(l.href) ? undefined : 'rgb(var(--border))',
                    background: active(l.href) ? undefined : 'rgb(var(--bg))'
                  }}>
                  <span className="text-2xl">{l.emoji}</span>
                  <span className="text-xs font-bold text-center leading-tight" style={{color:'rgb(var(--text))'}}>{label(l,lang)}</span>
                </Link>
              ))}
            </div>
            <button onClick={()=>{ setMoreOpen(false); signOut() }}
              className="w-full flex items-center justify-center gap-2 text-red-500 dark:text-red-400 font-semibold py-3 rounded-2xl border border-red-100 dark:border-red-900"
              style={{background:'rgb(var(--bg))'}}>
              🚪 {lang==='te'?'లాగ్అవుట్':'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
