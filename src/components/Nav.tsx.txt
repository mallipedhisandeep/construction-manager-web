'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Lang, ts } from '@/lib/strings'
import { tns } from '@/lib/strings'

interface Props { lang: Lang; onToggleLang: () => void }

// Construction Manager logo SVG
const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.25"/>
    <rect x="4" y="18" width="24" height="3" rx="1.5" fill="white"/>
    <rect x="13" y="8" width="6" height="13" rx="1" fill="white"/>
    <rect x="4" y="9" width="10" height="2.5" rx="1.25" fill="white" fillOpacity="0.7"/>
    <rect x="18" y="9" width="10" height="2.5" rx="1.25" fill="white" fillOpacity="0.7"/>
    <circle cx="8" cy="24" r="3" fill="white" fillOpacity="0.9"/>
    <circle cx="24" cy="24" r="3" fill="white" fillOpacity="0.9"/>
  </svg>
)

const primaryLinks = [
  { href:'/',                emoji:'🏠', key:'dashboard'      as const },
  { href:'/attendance',      emoji:'📅', key:'attendance'     as const },
  { href:'/workers',         emoji:'👷', key:'workers'        as const },
  { href:'/sites',           emoji:'🏗️', key:'sites'          as const },
]
const secondaryLinks = [
  { href:'/suppliers',       emoji:'🏪', key:'suppliers'      as const, isNew:true },
  { href:'/goods',           emoji:'📦', key:'goods'          as const, isNew:true },
  { href:'/private-workers', emoji:'🔧', key:'privateWorkers' as const },
  { href:'/private-work',    emoji:'📋', key:'privateWork'    as const },
  { href:'/money',           emoji:'💰', key:'money'          as const, isNew:true },
  { href:'/reports',         emoji:'📊', key:'reports'        as const, isNew:true },
]
const allLinks = [...primaryLinks, ...secondaryLinks]

// For new strings not in main strings
const extraLabels: Record<string, Record<string,string>> = {
  en: { suppliers:'Suppliers', goods:'Goods', money:'Money', reports:'Reports' },
  te: { suppliers:'సరఫరాదారులు', goods:'వస్తువులు', money:'డబ్బు', reports:'నివేదికలు' },
}

function getLabel(lang: Lang, key: string): string {
  try { return ts(lang, key as any) as string } catch { return extraLabels[lang]?.[key] ?? key }
}

export default function Nav({ lang, onToggleLang }: Props) {
  const path   = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => href==='/' ? path==='/' : path.startsWith(href)

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-gradient-to-r from-orange-700 via-orange-600 to-amber-500 shadow-lg flex items-center px-4 gap-3">
        <Logo />
        <span className="font-black text-white tracking-tight text-base flex-1">
          {getLabel(lang, 'appTitle')}
        </span>
        <button onClick={onToggleLang}
          className="bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-black px-2.5 py-1 rounded-lg transition">
          {lang==='en'?'తె':'EN'}
        </button>
        <button onClick={signOut} title="Sign Out"
          className="bg-white/15 hover:bg-white/25 text-white text-sm px-2.5 py-1.5 rounded-lg transition flex items-center gap-1">
          🚪<span className="hidden md:inline text-xs">{getLabel(lang,'signOut')}</span>
        </button>
      </header>

      {/* ── Sidebar (desktop) ── */}
      <nav className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-56px)] w-56 flex-col bg-white border-r border-gray-100 py-3 z-40 overflow-y-auto shadow-sm">
        <div className="px-3 mb-2">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-1 mb-1">Main</p>
          {primaryLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition mb-0.5
                ${isActive(l.href)?'bg-orange-50 text-orange-700 font-bold':'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <span className="text-base">{l.emoji}</span>
              {getLabel(lang, l.key)}
              {isActive(l.href) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500"/>}
            </Link>
          ))}
        </div>
        <div className="px-3">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-1 mb-1 mt-2">Operations</p>
          {secondaryLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition mb-0.5
                ${isActive(l.href)?'bg-orange-50 text-orange-700 font-bold':'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <span className="text-base">{l.emoji}</span>
              {getLabel(lang, l.key)}
              {(l as any).isNew && <span className="ml-auto text-[9px] bg-green-100 text-green-600 font-black px-1.5 py-0.5 rounded-full">NEW</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* ── Bottom nav (mobile) — 5 items + More ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 shadow-xl z-40">
        <div className="grid grid-cols-5 h-16">
          {primaryLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition ${isActive(l.href)?'text-orange-600':'text-gray-400'}`}>
              <span className={`text-xl ${isActive(l.href)?'':'grayscale opacity-60'}`}>{l.emoji}</span>
              <span className="text-[9px] font-semibold">{getLabel(lang,l.key).split(' ')[0]}</span>
            </Link>
          ))}
          <button onClick={()=>setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-gray-400">
            <span className="text-xl">☰</span>
            <span className="text-[9px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* ── More drawer (mobile) ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={()=>setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5"/>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">All Modules</p>
            <div className="grid grid-cols-3 gap-3">
              {allLinks.map(l => (
                <Link key={l.href} href={l.href} onClick={()=>setMoreOpen(false)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition
                    ${isActive(l.href)?'border-orange-500 bg-orange-50':'border-gray-100 bg-gray-50'}`}>
                  <span className="text-2xl">{l.emoji}</span>
                  <span className={`text-xs font-bold text-center leading-tight ${isActive(l.href)?'text-orange-700':'text-gray-600'}`}>
                    {getLabel(lang,l.key)}
                  </span>
                  {(l as any).isNew && <span className="text-[8px] bg-green-100 text-green-600 font-black px-1.5 py-0.5 rounded-full">NEW</span>}
                </Link>
              ))}
            </div>
            <button onClick={signOut}
              className="w-full mt-4 flex items-center justify-center gap-2 text-red-500 font-semibold py-3 rounded-2xl bg-red-50 border border-red-100">
              🚪 {getLabel(lang,'signOut')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
