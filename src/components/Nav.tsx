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

// CM Logo matching the app icon style
const CMLogoSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="rgba(0,0,0,0.4)"/>
    {/* C letter */}
    <text x="2" y="22" fontFamily="Georgia,serif" fontWeight="900" fontSize="20" fill="silver">C</text>
    {/* M letter with gold */}
    <text x="14" y="22" fontFamily="Georgia,serif" fontWeight="900" fontSize="18" fill="#d48c28">M</text>
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
      {/* ── Top bar — dark steel with gold accent ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-2.5 shadow-lg"
        style={{
          background:'linear-gradient(90deg, #0a0e16 0%, #111827 40%, #0d1520 100%)',
          borderBottom:'1px solid rgba(212,140,40,0.3)',
          boxShadow:'0 2px 20px rgba(0,0,0,0.5)'
        }}>
        <CMLogoSVG />
        <span className="font-black tracking-tight flex-1 truncate text-sm md:text-base"
          style={{color:'#e8e8e8', letterSpacing:'0.02em'}}>
          {lang==='te'?'నిర్మాణ మేనేజర్':'Construction Manager'}
        </span>
        {/* Gold accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(212,140,40,0.6),transparent)'}}/>

        {/* Theme toggle */}
        <button onClick={onToggleTheme} title="Toggle theme"
          className="w-8 h-8 rounded-lg transition flex items-center justify-center text-sm"
          style={{background:'rgba(212,140,40,0.15)',border:'1px solid rgba(212,140,40,0.3)'}}>
          {theme==='dark'?'☀️':'🌙'}
        </button>
        {/* Language toggle */}
        <button onClick={onToggleLang}
          className="text-xs font-black px-2 py-1 rounded-lg transition"
          style={{background:'rgba(212,140,40,0.15)',border:'1px solid rgba(212,140,40,0.3)',color:'#d48c28'}}>
          {lang==='en'?'తె':'EN'}
        </button>
        {/* Sign out */}
        <button onClick={signOut} title="Sign out"
          className="w-8 h-8 rounded-lg transition flex items-center justify-center"
          style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
          🚪
        </button>
      </header>

      {/* ── Desktop sidebar ── */}
      <nav className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-56px)] w-56 flex-col py-3 z-40 overflow-y-auto"
        style={{
          background:'rgb(var(--surface))',
          borderRight:'1px solid rgb(var(--border))'
        }}>
        <div className="px-3 space-y-0.5">
          <p className="text-[10px] font-black uppercase tracking-widest px-2 mb-2 mt-1" style={{color:'rgb(var(--muted))'}}>
            {lang==='te'?'ముఖ్యమైనవి':'Main'}
          </p>
          {mainLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition`}
              style={{
                background: active(l.href) ? 'rgba(212,140,40,0.15)' : 'transparent',
                color: active(l.href) ? '#d48c28' : 'rgb(var(--muted))',
                border: active(l.href) ? '1px solid rgba(212,140,40,0.3)' : '1px solid transparent',
                fontWeight: active(l.href) ? 700 : 500,
              }}>
              <span className="text-base">{l.emoji}</span>
              <span>{label(l,lang)}</span>
              {active(l.href) && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{background:'#d48c28'}}/>}
            </Link>
          ))}
          <p className="text-[10px] font-black uppercase tracking-widest px-2 mb-2 mt-4" style={{color:'rgb(var(--muted))'}}>
            {lang==='te'?'కార్యకలాపాలు':'Operations'}
          </p>
          {moreLinks.map(l => (
            <Link key={l.href} href={l.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition"
              style={{
                background: active(l.href) ? 'rgba(212,140,40,0.15)' : 'transparent',
                color: active(l.href) ? '#d48c28' : 'rgb(var(--muted))',
                border: active(l.href) ? '1px solid rgba(212,140,40,0.3)' : '1px solid transparent',
                fontWeight: active(l.href) ? 700 : 500,
              }}>
              <span className="text-base">{l.emoji}</span>
              <span>{label(l,lang)}</span>
            </Link>
          ))}
        </div>
        <div className="mt-auto px-3 pb-3">
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 transition"
            style={{background:'rgba(185,28,28,0.1)',border:'1px solid rgba(185,28,28,0.2)'}}>
            🚪 <span>{lang==='te'?'లాగ్అవుట్':'Sign Out'}</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom nav — dark steel ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background:'rgb(var(--surface))',
          borderTop:'1px solid rgba(212,140,40,0.2)',
          boxShadow:'0 -4px 20px rgba(0,0,0,0.4)'
        }}>
        <div className="grid grid-cols-5 h-16">
          {mainLinks.map(l => (
            <Link key={l.href} href={l.href}
              className="flex flex-col items-center justify-center gap-0.5 transition"
              style={{color: active(l.href) ? '#d48c28' : 'rgb(var(--muted))'}}>
              <span className={`text-xl ${active(l.href)?'':'grayscale opacity-60'}`}>{l.emoji}</span>
              <span className="text-[9px] font-bold">{label(l,lang).split(' ')[0]}</span>
              {active(l.href) && <div className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{background:'#d48c28'}}/>}
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 shadow-2xl pb-8"
            style={{background:'rgb(var(--surface))',border:'1px solid rgba(212,140,40,0.2)',borderBottom:'none'}}
            onClick={e=>e.stopPropagation()}>
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{background:'rgba(212,140,40,0.4)'}}/>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{color:'rgb(var(--muted))'}}>
              {lang==='te'?'అన్ని మాడ్యూల్లు':'All Modules'}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {allLinks.map(l => (
                <Link key={l.href} href={l.href} onClick={()=>setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl transition"
                  style={{
                    background: active(l.href) ? 'rgba(212,140,40,0.15)' : 'rgb(var(--bg))',
                    border: `1px solid ${active(l.href) ? 'rgba(212,140,40,0.5)' : 'rgb(var(--border))'}`,
                  }}>
                  <span className="text-2xl">{l.emoji}</span>
                  <span className="text-xs font-bold text-center leading-tight" style={{color:'rgb(var(--text))'}}>{label(l,lang)}</span>
                </Link>
              ))}
            </div>
            <button onClick={()=>{ setMoreOpen(false); signOut() }}
              className="w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl"
              style={{background:'rgba(185,28,28,0.15)',border:'1px solid rgba(185,28,28,0.3)',color:'#f87171'}}>
              🚪 {lang==='te'?'లాగ్అవుట్':'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
