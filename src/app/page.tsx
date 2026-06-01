'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'

const modules = [
  { en:'Attendance',       te:'రోజువారీ హాజరు',       emoji:'📅', href:'/attendance',      bg:'rgba(59,130,246,0.12)',  border:'rgba(59,130,246,0.3)',  dot:'#3b82f6' },
  { en:'Workers',          te:'కార్మికులు',             emoji:'👷', href:'/workers',         bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)', dot:'#10b981' },
  { en:'Sites',            te:'సైట్లు',                emoji:'🏗️', href:'/sites',           bg:'rgba(212,140,40,0.12)', border:'rgba(212,140,40,0.3)', dot:'#d48c28' },
  { en:'Contractors',      te:'కాంట్రాక్టర్లు',         emoji:'🔧', href:'/private-workers', bg:'rgba(139,92,246,0.12)', border:'rgba(139,92,246,0.3)', dot:'#8b5cf6' },
  { en:'Contract Work',    te:'కాంట్రాక్టు పని',        emoji:'📋', href:'/private-work',   bg:'rgba(6,182,212,0.12)',  border:'rgba(6,182,212,0.3)',  dot:'#06b6d4' },
  { en:'Suppliers',        te:'సరఫరాదారులు',            emoji:'🏪', href:'/suppliers',       bg:'rgba(236,72,153,0.12)', border:'rgba(236,72,153,0.3)', dot:'#ec4899' },
  { en:'Goods Orders',     te:'వస్తువుల ఆర్డర్లు',      emoji:'📦', href:'/goods',           bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)', dot:'#f59e0b' },
  { en:'Money Tracking',   te:'డబ్బు',                  emoji:'💰', href:'/money',           bg:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.3)',  dot:'#22c55e' },
  { en:'Reports',          te:'నివేదికలు',              emoji:'📊', href:'/reports',         bg:'rgba(99,102,241,0.12)', border:'rgba(99,102,241,0.3)', dot:'#6366f1' },
]

function Dashboard() {
  const { lang } = useLang()
  const router = useRouter()
  const te = lang === 'te'
  const [stats, setStats] = useState({ workers:0, activeSites:0, contractors:0, suppliers:0 })
  const [user, setUser] = useState('Admin')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? ''
      const name = email.split('@')[0]?.replace(/[._]/g,' ')?.toUpperCase() ?? 'Admin'
      setUser(name)
    })
    Promise.all([
      supabase.from('workers').select('id',{count:'exact',head:true}).is('deleted_at',null),
      supabase.from('sites').select('id',{count:'exact',head:true}).eq('status','Active').is('deleted_at',null),
      supabase.from('private_workers').select('id',{count:'exact',head:true}).is('deleted_at',null),
      supabase.from('suppliers').select('id',{count:'exact',head:true}).is('deleted_at',null),
    ]).then(([w,s,p,su]) => setStats({ workers:w.count??0, activeSites:s.count??0, contractors:p.count??0, suppliers:su.count??0 }))
  }, [])

  const statsData = [
    { v:stats.workers,     l:te?'కార్మికులు':'Workers',         e:'👷', color:'#3b82f6' },
    { v:stats.activeSites, l:te?'సైట్లు':'Active Sites',       e:'🏗️', color:'#d48c28' },
    { v:stats.contractors, l:te?'కాంట్రాక్టర్లు':'Contractors', e:'🔧', color:'#8b5cf6' },
    { v:stats.suppliers,   l:te?'సరఫరాదారులు':'Suppliers',     e:'🏪', color:'#ec4899' },
  ]

  return (
    <div className="min-h-screen" style={{background:'rgb(var(--bg))'}}>
      {/* Hero banner */}
      <div className="relative overflow-hidden px-5 pt-8 pb-20 dashboard-hero">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage:'radial-gradient(circle at 1px 1px, rgba(212,140,40,1) 1px, transparent 0)',
          backgroundSize:'32px 32px'
        }}/>
        {/* Gold accent lines */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(212,140,40,0.4),transparent)'}}/>
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(212,140,40,0.2),transparent)'}}/>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs font-semibold tracking-wide" style={{color:'rgba(212,140,40,0.7)'}}>
                {te?'తిరిగి స్వాగతం':'Welcome back'}
              </p>
              <h1 className="text-2xl font-black tracking-tight mt-0.5" style={{color:'#e8e3d8', fontFamily:"'Syne',sans-serif"}}>{user}</h1>
            </div>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
              style={{background:'rgba(212,140,40,0.1)',border:'1px solid rgba(212,140,40,0.25)'}}>
              🏗️
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            {statsData.map(s => (
              <div key={s.l} className="rounded-2xl p-3 text-center relative overflow-hidden"
                style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(212,140,40,0.15)',backdropFilter:'blur(8px)'}}>
                <div className="text-lg leading-none mb-1">{s.e}</div>
                <div className="text-xl font-black leading-none" style={{color:s.color, fontFamily:"'Syne',sans-serif"}}>{s.v}</div>
                <div className="text-[8px] mt-1 leading-tight" style={{color:'rgba(212,140,40,0.5)'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div className="px-4 -mt-10 pb-28">
        <div className="card p-4">
          <p className="section-header mb-4">{te?'అన్ని మాడ్యూల్లు':'All Modules'}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {modules.map(m => (
              <button key={m.href} onClick={() => router.push(m.href)}
                className="flex flex-col items-center gap-2.5 p-3.5 rounded-2xl transition-all active:scale-95 hover:scale-[1.02]"
                style={{background:'rgb(var(--surface2))',border:`1px solid rgb(var(--border))`}}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                  style={{background:m.bg,border:`1px solid ${m.border}`}}>
                  {m.emoji}
                </div>
                <span className="text-[10px] font-bold text-center leading-tight" style={{color:'rgb(var(--text))'}}>{te?m.te:m.en}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
export default function Home() { return <AppShell><Dashboard /></AppShell> }
