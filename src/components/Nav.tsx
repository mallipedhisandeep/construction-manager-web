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

const mainLinks = [
  { href:'/',                emoji:'🏠', en:'Dashboard',       te:'డాష్‌బోర్డ్' },
  { href:'/attendance',      emoji:'📅', en:'Attendance',       te:'హాజరు' },
  { href:'/workers',         emoji:'👷', en:'Workers',          te:'కార్మికులు' },
  { href:'/sites',           emoji:'🏗️', en:'Sites',            te:'సైట్లు' },
]
const moreLinks = [
  { href:'/suppliers',       emoji:'🏪', en:'Suppliers',        te:'సరఫరాదారులు' },
  { href:'/goods',           emoji:'📦', en:'Goods Orders',     te:'వస్తువులు' },
  { href:'/private-workers', emoji:'🔧', en:'Contractors',      te:'కాంట్రాక్టర్లు' },
  { href:'/private-work',    emoji:'📋', en:'Contract Work',    te:'కాంట్రాక్టు పని' },
  { href:'/money',           emoji:'💰', en:'Money Tracking',   te:'డబ్బు' },
  { href:'/reports',         emoji:'📊', en:'Reports',          te:'నివేదికలు' },
  { href:'/trash',           emoji:'🗑️', en:'Recycle Bin',      te:'చెత్తబుట్ట' },
]
const allLinks = [...mainLinks, ...moreLinks]

const lbl = (l: typeof allLinks[0], lang: Lang) => lang==='te' ? l.te : l.en

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
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-3"
        style={{
          background: 'linear-gradient(90deg, rgb(12,12,14) 0%, rgb(18,15,8) 60%, rgb(12,12,14) 100%)',
          borderBottom: '1px solid rgba(212,140,40,0.18)',
          boxShadow: '0 1px 24px rgba(0,0,0,0.6)'
        }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{background:'linear-gradient(135deg,rgba(212,140,40,0.2),rgba(212,140,40,0.08))',border:'1px solid rgba(212,140,40,0.3)'}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <text x="0" y="13" fontFamily="Georgia,serif" fontWeight="900" fontSize="12" fill="#c0c0c0">C</text>
              <text x="9" y="13" fontFamily="Georgia,serif" fontWeight="900" fontSize="11" fill="#d48c28">M</text>
            </svg>
          </div>
          <span className="font-bold text-sm truncate" style={{color:'#ddd8cc', fontFamily:"'Syne',sans-serif", letterSpacing:'-0.01em'}}>
            {lang==='te' ? 'నిర్మాణ మేనేజర్' : 'Construction Manager'}
          </span>
        </div>

        {/* Gold underline accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{background:'linear-gradient(90deg,transparent 0%,rgba(212,140,40,0.5) 30%,rgba(212,140,40,0.5) 70%,transparent 100%)'}}/>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{background:'rgba(212,140,40,0.1)',border:'1px solid rgba(212,140,40,0.2)'}}>
            {theme==='dark'?'☀️':'🌙'}
          </button>
          <button onClick={onToggleLang}
            className="h-8 px-2 rounded-lg text-xs font-black transition-all"
            style={{background:'rgba(212,140,40,0.1)',border:'1px solid rgba(212,140,40,0.2)',color:'rgb(var(--accent))'}}>
            {lang==='en'?'తె':'EN'}
          </button>
          <button onClick={signOut}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hidden md:flex"
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgb(var(--border))'}}>
            🚪
          </button>
        </div>
      </header>

      {/* ── Desktop sidebar ── */}
      <nav className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-56px)] w-52 flex-col py-4 z-40 overflow-y-auto"
        style={{background:'rgb(var(--surface))',borderRight:'1px solid rgb(var(--border))'}}>
        <div className="px-3 space-y-0.5">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] px-2 mb-2 mt-1" style={{color:'rgb(var(--muted))'}}>
            {lang==='te'?'ముఖ్యమైనవి':'Main'}
          </p>
          {mainLinks.map(l=>(
            <Link key={l.href} href={l.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: active(l.href) ? 'rgba(212,140,40,0.12)':'transparent',
                color: active(l.href) ? 'rgb(var(--accent))':'rgb(var(--muted))',
                border: active(l.href) ? '1px solid rgba(212,140,40,0.25)':'1px solid transparent',
                fontWeight: active(l.href) ? 700:400,
              }}>
              <span className="text-base">{l.emoji}</span>
              <span>{lbl(l,lang)}</span>
              {active(l.href) && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{background:'rgb(var(--accent))'}}/>}
            </Link>
          ))}
          <p className="text-[9px] font-black uppercase tracking-[0.14em] px-2 mb-2 mt-4" style={{color:'rgb(var(--muted))'}}>
            {lang==='te'?'కార్యకలాపాలు':'Operations'}
          </p>
          {moreLinks.map(l=>(
            <Link key={l.href} href={l.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: active(l.href) ? 'rgba(212,140,40,0.12)':'transparent',
                color: active(l.href) ? 'rgb(var(--accent))':'rgb(var(--muted))',
                border: active(l.href) ? '1px solid rgba(212,140,40,0.25)':'1px solid transparent',
                fontWeight: active(l.href) ? 700:400,
              }}>
              <span className="text-base">{l.emoji}</span>
              <span>{lbl(l,lang)}</span>
            </Link>
          ))}
        </div>
        <div className="mt-auto px-3 pb-2">
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{background:'rgba(220,60,60,0.08)',border:'1px solid rgba(220,60,60,0.18)',color:'#f87171'}}>
            🚪 <span>{lang==='te'?'లాగ్అవుట్':'Sign Out'}</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background:'rgb(var(--surface))',
          borderTop:'1px solid rgba(212,140,40,0.15)',
          boxShadow:'0 -4px 24px rgba(0,0,0,0.5)',
          paddingBottom:'env(safe-area-inset-bottom)'
        }}>
        <div className="grid grid-cols-5 h-16">
          {mainLinks.map(l=>(
            <Link key={l.href} href={l.href}
              className="flex flex-col items-center justify-center gap-0.5 relative transition-all"
              style={{color: active(l.href) ? 'rgb(var(--accent))':'rgb(var(--muted))'}}>
              {active(l.href) && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{background:'rgb(var(--accent))'}}/>
              )}
              <span className={`text-xl leading-none transition-all ${active(l.href)?'scale-110':''}`}>{l.emoji}</span>
              <span className="text-[9px] font-bold">{lbl(l,lang).split(' ')[0]}</span>
            </Link>
          ))}
          <button onClick={()=>setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 transition-all"
            style={{color:'rgb(var(--muted))'}}>
            <span className="text-xl leading-none">☰</span>
            <span className="text-[9px] font-bold">{lang==='te'?'మరిన్ని':'More'}</span>
          </button>
        </div>
      </nav>

      {/* ── More drawer ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={()=>setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm"/>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl pb-8 pt-5 px-4 shadow-2xl"
            style={{background:'rgb(var(--surface))',border:'1px solid rgba(212,140,40,0.15)',borderBottom:'none'}}
            onClick={e=>e.stopPropagation()}>
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{background:'rgba(212,140,40,0.3)'}}/>
            <p className="section-header mb-3">{lang==='te'?'అన్ని మాడ్యూల్లు':'All Modules'}</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {allLinks.map(l=>(
                <Link key={l.href} href={l.href} onClick={()=>setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                  style={{
                    background: active(l.href) ? 'rgba(212,140,40,0.12)':'rgb(var(--surface2))',
                    border: `1px solid ${active(l.href)?'rgba(212,140,40,0.4)':'rgb(var(--border))'}`,
                  }}>
                  <span className="text-2xl">{l.emoji}</span>
                  <span className="text-[9px] font-bold text-center leading-tight px-0.5" style={{color:'rgb(var(--text))'}}>{lbl(l,lang)}</span>
                </Link>
              ))}
            </div>
            <button onClick={()=>{setMoreOpen(false);signOut()}}
              className="w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl transition-all"
              style={{background:'rgba(220,60,60,0.1)',border:'1px solid rgba(220,60,60,0.25)',color:'#f87171'}}>
              🚪 {lang==='te'?'లాగ్అవుట్':'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
