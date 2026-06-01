'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'

function Dashboard() {
  const { lang } = useLang()
  const router = useRouter()
  const [stats, setStats] = useState({ workers:0, activeSites:0, contractors:0, suppliers:0 })
  const [user, setUser] = useState('Admin')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user?.email?.split('@')[0]?.toUpperCase() ?? 'Admin'))
    Promise.all([
      supabase.from('workers').select('id',{count:'exact',head:true}).is('deleted_at',null),
      supabase.from('sites').select('id',{count:'exact',head:true}).eq('status','Active').is('deleted_at',null),
      supabase.from('private_workers').select('id',{count:'exact',head:true}).is('deleted_at',null),
      supabase.from('suppliers').select('id',{count:'exact',head:true}).is('deleted_at',null),
    ]).then(([w,s,p,su]) => setStats({ workers:w.count??0, activeSites:s.count??0, contractors:p.count??0, suppliers:su.count??0 }))
  }, [])

  const modules = [
    { label: lang==='te'?'రోజువారీ హాజరు':'Daily Attendance', emoji:'📅', href:'/attendance', color:'#3b82f6' },
    { label: lang==='te'?'కార్మికులు':'Workers',             emoji:'👷', href:'/workers',    color:'#10b981' },
    { label: lang==='te'?'సైట్లు':'Sites',                   emoji:'🏗️', href:'/sites',      color:'#d48c28' },
    { label: lang==='te'?'ప్రైవేట్ కార్మికులు':'Private Workers', emoji:'🔧', href:'/private-workers', color:'#8b5cf6' },
    { label: lang==='te'?'ప్రైవేట్ పని':'Private Work',       emoji:'📋', href:'/private-work',    color:'#06b6d4' },
    { label: lang==='te'?'సరఫరాదారులు':'Suppliers',          emoji:'🏪', href:'/suppliers',  color:'#ec4899' },
    { label: lang==='te'?'వస్తువుల ఆర్డర్లు':'Goods Orders', emoji:'📦', href:'/goods',      color:'#f59e0b' },
    { label: lang==='te'?'డబ్బు':'Money Tracking',            emoji:'💰', href:'/money',      color:'#22c55e' },
    { label: lang==='te'?'నివేదికలు':'Reports',               emoji:'📊', href:'/reports',    color:'#6366f1' },
  ]

  const statsData = [
    { v:stats.workers,      l: lang==='te'?'కార్మికులు':'Workers',      e:'👷' },
    { v:stats.activeSites,  l: lang==='te'?'సైట్లు':'Sites',            e:'🏗️' },
    { v:stats.contractors,  l: lang==='te'?'కాంట్రాక్టర్లు':'Contractors', e:'🔧' },
    { v:stats.suppliers,    l: lang==='te'?'సరఫరాదారులు':'Suppliers',   e:'🏪' },
  ]

  return (
    <div className="min-h-screen" style={{background:'rgb(var(--bg))'}}>
      {/* Hero — dark steel gradient with gold accent */}
      <div className="px-5 pt-8 pb-16 relative overflow-hidden"
        style={{
          background:'linear-gradient(160deg, #0a0e16 0%, #111827 50%, #0d1520 100%)',
          borderBottom:'1px solid rgba(212,140,40,0.2)'
        }}>
        {/* Subtle gold grid decoration */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage:'linear-gradient(rgba(212,140,40,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(212,140,40,0.5) 1px, transparent 1px)',
          backgroundSize:'40px 40px'
        }}/>
        <div className="relative z-10">
          <p className="text-sm font-medium" style={{color:'rgba(212,140,40,0.7)'}}>
            {lang==='te'?'తిరిగి స్వాగతం':'Welcome back'}
          </p>
          <h1 className="text-2xl font-black tracking-tight mt-0.5" style={{color:'#e8e8e8'}}>{user}</h1>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            {statsData.map(s => (
              <div key={s.l} className="rounded-2xl p-3 text-center backdrop-blur-sm"
                style={{background:'rgba(212,140,40,0.08)',border:'1px solid rgba(212,140,40,0.2)'}}>
                <div className="text-xl">{s.e}</div>
                <div className="text-xl font-black" style={{color:'#d48c28'}}>{s.v}</div>
                <div className="text-[9px] mt-0.5 leading-tight" style={{color:'rgba(212,140,40,0.6)'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div className="px-4 -mt-8 pb-28">
        <div className="card p-4 mb-4">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{color:'rgb(var(--muted))'}}>
            {lang==='te'?'అన్ని మాడ్యూల్లు':'All Modules'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {modules.map(m => (
              <button key={m.href} onClick={()=>router.push(m.href)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:scale-105 active:scale-95 transition-all"
                style={{background:'rgb(var(--bg))',border:'1px solid rgb(var(--border))'}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{background:`${m.color}20`,border:`1px solid ${m.color}40`}}>
                  {m.emoji}
                </div>
                <span className="text-xs font-bold text-center leading-tight" style={{color:'rgb(var(--text))'}}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
export default function Home() { return <AppShell><Dashboard /></AppShell> }
