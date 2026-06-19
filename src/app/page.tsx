'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang, useTheme } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'

const modules = [
  { en:'Attendance',     te:'హాజరు',              emoji:'📅', href:'/attendance',      color:'#3b82f6' },
  { en:'Workers',        te:'కార్మికులు',           emoji:'👷', href:'/workers',         color:'#10b981' },
  { en:'Sites',          te:'సైట్లు',              emoji:'🏗️', href:'/sites',           color:'#f59e0b' },
  { en:'Contractors',    te:'కాంట్రాక్టర్లు',       emoji:'🔧', href:'/private-workers', color:'#8b5cf6' },
  { en:'Contract Work',  te:'కాంట్రాక్టు పని',      emoji:'📝', href:'/private-work',   color:'#06b6d4' },
  { en:'Suppliers',      te:'సరఫరాదారులు',          emoji:'🏪', href:'/suppliers',       color:'#ec4899' },
  { en:'Goods Orders',   te:'వస్తువుల ఆర్డర్లు',    emoji:'📦', href:'/goods',           color:'#f59e0b' },
  { en:'Money Tracking', te:'డబ్బు ట్రాకింగ్',       emoji:'💰', href:'/money',           color:'#22c55e' },
  { en:'Reports',        te:'నివేదికలు',            emoji:'📊', href:'/reports',         color:'#6366f1' },
]

function Dashboard() {
  const { lang }  = useLang()
  const { theme } = useTheme()
  const router    = useRouter()
  const te        = lang === 'te'
  const isDark    = theme === 'dark'

  const [stats, setStats] = useState({ workers:0, sites:0, contractors:0, suppliers:0 })
  const [user,  setUser]  = useState('Admin')

  useEffect(() => {
    // Single getUser() call — extract both name and userId from one network request
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      const raw = u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? ''
      setUser(raw.replace(/[._]/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase()) || 'Admin')
      Promise.all([
        supabase.from('workers').select('id',{count:'exact',head:true}).eq('user_id',u.id).is('deleted_at',null),
        supabase.from('sites').select('id',{count:'exact',head:true}).eq('user_id',u.id).eq('status','Active').is('deleted_at',null),
        supabase.from('private_workers').select('id',{count:'exact',head:true}).eq('user_id',u.id).is('deleted_at',null),
        supabase.from('suppliers').select('id',{count:'exact',head:true}).eq('user_id',u.id).is('deleted_at',null),
      ]).then(([w,s,p,su]) => setStats({ workers:w.count??0, sites:s.count??0, contractors:p.count??0, suppliers:su.count??0 }))
    })
  }, [])

  const statsData = [
    { v:stats.workers,     l:te?'కార్మికులు':'Workers',         color:'#3b82f6' },
    { v:stats.sites,       l:te?'సైట్లు':'Active Sites',       color:'#f59e0b' },
    { v:stats.contractors, l:te?'కాంట్రాక్టర్లు':'Contractors', color:'#8b5cf6' },
    { v:stats.suppliers,   l:te?'సరఫరాదారులు':'Suppliers',     color:'#ec4899' },
  ]

  // Hero: navy blue in light, near-black in dark
  const heroBg = isDark
    ? 'linear-gradient(145deg, #0c0c0f 0%, #1a1200 50%, #150e00 100%)'
    : 'linear-gradient(145deg, #1e3a5f 0%, #1a3352 60%, #0f2033 100%)'

  return (
    <div className="min-h-screen" style={{background:'rgb(var(--bg))'}}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-8 pb-6" style={{background: heroBg}}>
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage:'radial-gradient(circle at 1px 1px, rgba(255,255,255,1) 1px, transparent 0)',
          backgroundSize:'28px 28px'
        }}/>
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(234,88,12,0.5),transparent)'}}/>

        <div className="relative z-10">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{color:'rgba(234,88,12,0.8)'}}>
            {te ? 'తిరిగి స్వాగతం' : 'Welcome back'}
          </p>
          <h1 className="text-2xl font-black tracking-tight text-white" style={{fontFamily:"'Syne',sans-serif"}}>
            {user}
          </h1>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2.5 mt-5">
            {statsData.map(s => (
              <div key={s.l} className="rounded-2xl p-3 text-center"
                style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)'}}>
                <div className="text-xl font-black" style={{color:s.color, fontFamily:"'Syne',sans-serif"}}>{s.v}</div>
                <div className="text-[10px] mt-0.5 font-medium" style={{color:'rgba(255,255,255,0.5)'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Module grid ──────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-24">
        <p className="section-header mb-3">
          {te ? 'మాడ్యూల్లు' : 'Modules'}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {modules.map(m => (
            <button key={m.href} onClick={() => router.push(m.href)}
              className="card-hover flex flex-col items-center gap-2.5 p-4 text-center transition-all active:scale-95">
              {/* Coloured icon bubble */}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{background:`${m.color}18`, border:`1.5px solid ${m.color}35`}}>
                {m.emoji}
              </div>
              <span className="text-xs font-semibold leading-tight" style={{color:'rgb(var(--text))'}}>
                {te ? m.te : m.en}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Home() { return <Dashboard /> }
