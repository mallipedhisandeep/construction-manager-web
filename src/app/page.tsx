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
    { label:'Daily Attendance', emoji:'📅', href:'/attendance', grad:'from-orange-500 to-amber-400' },
    { label:'Workers',          emoji:'👷', href:'/workers',    grad:'from-blue-500 to-cyan-400' },
    { label:'Sites',            emoji:'🏗️', href:'/sites',      grad:'from-green-500 to-emerald-400' },
    { label:'Private Workers',  emoji:'🔧', href:'/private-workers', grad:'from-purple-500 to-violet-400' },
    { label:'Private Work',     emoji:'📋', href:'/private-work',    grad:'from-teal-500 to-cyan-500' },
    { label:'Suppliers',        emoji:'🏪', href:'/suppliers',  grad:'from-pink-500 to-rose-400' },
    { label:'Goods Orders',     emoji:'📦', href:'/goods',      grad:'from-amber-500 to-yellow-400' },
    { label:'Money Tracking',   emoji:'💰', href:'/money',      grad:'from-emerald-500 to-green-400' },
    { label:'Reports',          emoji:'📊', href:'/reports',    grad:'from-indigo-500 to-blue-400' },
  ]

  return (
    <div className="min-h-screen" style={{background:'linear-gradient(180deg, #f97316 0%, #fed7aa 35%, #f8fafc 55%)'}}>
      {/* Hero */}
      <div className="px-5 pt-8 pb-16">
        <p className="text-orange-100 text-sm font-medium">Welcome back</p>
        <h1 className="text-white text-2xl font-black tracking-tight mt-0.5">{user}</h1>
        <div className="grid grid-cols-4 gap-2 mt-5">
          {[
            { v:stats.workers,      l:'Workers',    e:'👷' },
            { v:stats.activeSites,  l:'Sites',      e:'🏗️' },
            { v:stats.contractors,  l:'Contractors',e:'🔧' },
            { v:stats.suppliers,    l:'Suppliers',  e:'🏪' },
          ].map(s => (
            <div key={s.l} className="bg-white/20 backdrop-blur rounded-2xl p-3 text-center">
              <div className="text-xl">{s.e}</div>
              <div className="text-xl font-black text-white">{s.v}</div>
              <div className="text-[9px] text-orange-100 mt-0.5 leading-tight">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Module grid */}
      <div className="px-4 -mt-8 pb-28">
        <div className="card p-4 mb-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">All Modules</p>
          <div className="grid grid-cols-3 gap-3">
            {modules.map(m => (
              <button key={m.href} onClick={()=>router.push(m.href)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:scale-105 active:scale-95 transition-all bg-gray-50 hover:bg-gray-100 relative">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.grad} flex items-center justify-center text-2xl shadow-sm`}>
                  {m.emoji}
                </div>
                <span className="text-xs font-bold text-gray-700 text-center leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
export default function Home() { return <AppShell><Dashboard /></AppShell> }
