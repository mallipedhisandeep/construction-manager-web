'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'

function Dashboard() {
  const { lang } = useLang()
  const router   = useRouter()
  const [stats, setStats] = useState({ workers: 0, activeSites: 0, contractors: 0 })
  const [user, setUser]   = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user?.email?.split('@')[0]?.toUpperCase() ?? 'Admin')
    })
    Promise.all([
      supabase.from('workers').select('id',       { count:'exact', head:true }),
      supabase.from('sites').select('id',         { count:'exact', head:true }).eq('status','Active'),
      supabase.from('private_workers').select('id',{ count:'exact', head:true }),
    ]).then(([w,s,p]) => setStats({ workers: w.count??0, activeSites: s.count??0, contractors: p.count??0 }))
  }, [])

  const modules = [
    { key:'attendance'    as const, icon:'📅', href:'/attendance',      bg:'from-orange-500 to-amber-500'   },
    { key:'workers'       as const, icon:'👷', href:'/workers',         bg:'from-blue-500 to-cyan-500'      },
    { key:'sites'         as const, icon:'🏗️', href:'/sites',           bg:'from-green-500 to-emerald-500'  },
    { key:'privateWorkers'as const, icon:'🔧', href:'/private-workers', bg:'from-purple-500 to-violet-500'  },
    { key:'privateWork'   as const, icon:'📋', href:'/private-work',    bg:'from-teal-500 to-cyan-600'      },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 pt-8 pb-12 px-5">
        <p className="text-orange-100 text-sm font-medium">{ts(lang,'welcome')}</p>
        <h1 className="text-white text-2xl font-black mt-0.5">{user}</h1>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { label: ts(lang,'workers'),        val: stats.workers,      icon:'👷' },
            { label: ts(lang,'activeSites'),    val: stats.activeSites,  icon:'🏗️' },
            { label: ts(lang,'privateWorkers'), val: stats.contractors,  icon:'🔧' },
          ].map(s => (
            <div key={s.label} className="bg-white/20 backdrop-blur rounded-2xl p-3 text-white text-center">
              <div className="text-2xl mb-0.5">{s.icon}</div>
              <div className="text-2xl font-black">{s.val}</div>
              <div className="text-xs text-orange-100 leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Module grid */}
      <div className="px-4 -mt-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-4 px-1">Modules</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-24">
          {modules.map(m => (
            <button key={m.href} onClick={() => router.push(m.href)}
              className="card p-5 flex flex-col items-center gap-3 hover:shadow-md active:scale-95 transition-all text-left group">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.bg} flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform`}>
                {m.icon}
              </div>
              <span className="text-sm font-bold text-gray-700 text-center leading-tight">{ts(lang,m.key)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Home() { return <AppShell><Dashboard /></AppShell> }
