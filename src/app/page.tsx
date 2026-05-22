'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'

function Dashboard() {
  const { lang } = useLang()
  const [stats, setStats] = useState({ workers: 0, sites: 0, privateWorkers: 0 })

  useEffect(() => {
    Promise.all([
      supabase.from('workers').select('id', { count: 'exact', head: true }),
      supabase.from('sites').select('id', { count: 'exact', head: true }).eq('status','Active'),
      supabase.from('private_workers').select('id', { count: 'exact', head: true }),
    ]).then(([w, s, p]) => setStats({
      workers: w.count ?? 0, sites: s.count ?? 0, privateWorkers: p.count ?? 0
    }))
  }, [])

  const modules = [
    { title: ts(lang,'attendance'),     icon: '📅', href: '/attendance',      bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700' },
    { title: ts(lang,'workers'),        icon: '👷', href: '/workers',         bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700' },
    { title: ts(lang,'sites'),          icon: '🏗️', href: '/sites',           bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-700' },
    { title: ts(lang,'privateWorkers'), icon: '🔧', href: '/private-workers', bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-700' },
    { title: ts(lang,'privateWork'),    icon: '📋', href: '/private-work',    bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-700' },
  ]
  const router = useRouter()

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: ts(lang,'workers'),        value: stats.workers,       color: 'text-blue-600',   icon: '👷' },
          { label: ts(lang,'activeSites'),    value: stats.sites,         color: 'text-green-600',  icon: '🏗️' },
          { label: ts(lang,'privateWorkers'), value: stats.privateWorkers,color: 'text-purple-600', icon: '🔧' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>
      {/* Modules */}
      <h2 className="font-bold text-gray-700 mb-3">{ts(lang,'dashboard')}</h2>
      <div className="grid grid-cols-2 gap-3">
        {modules.map(m => (
          <button key={m.href} onClick={() => router.push(m.href)}
            className={`${m.bg} ${m.border} border rounded-xl p-5 flex flex-col items-center gap-2 hover:shadow-md transition text-left`}>
            <span className="text-3xl">{m.icon}</span>
            <span className={`font-semibold text-sm ${m.text} text-center leading-tight`}>{m.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  return <AppShell><Dashboard /></AppShell>
}
