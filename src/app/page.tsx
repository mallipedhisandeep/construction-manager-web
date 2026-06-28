'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang, useTheme } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'

function Dashboard() {
  const { lang } = useLang()
  const te = lang === 'te'
  const router = useRouter()
  const [user, setUser] = useState('Admin')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ workers: 0, sites: 0, attendance: 0, suppliers: 0, contractors: 0 })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return

      const raw = u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? ''
      setUser(raw.replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Admin')

      Promise.all([
        supabase.from('workers').select('id', { count: 'exact', head: true }).eq('user_id', u.id).is('deleted_at', null),
        supabase.from('sites').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('status', 'Active').is('deleted_at', null),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('user_id', u.id).is('deleted_at', null),
        supabase.from('private_workers').select('id', { count: 'exact', head: true }).eq('user_id', u.id).is('deleted_at', null),
      ]).then(([w, s, a, su, pw]) =>
        setStats({ workers: w.count ?? 0, sites: s.count ?? 0, attendance: a.count ?? 0, suppliers: su.count ?? 0, contractors: pw.count ?? 0 })
      )
      setLoading(false)
    })
  }, [router])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="text-2xl font-black">{te ? `హలో, ${user}! 👋` : `Hello, ${user}! 👋`}</h1>
        <p className="text-sm" style={{ color: 'rgb(var(--muted))' }}>
          {te ? 'మీ నిర్మాణ వ్యాపారం గడ్డపై ఉంది' : 'Your construction business at a glance'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{ borderColor: 'rgb(var(--accent))', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <DashCard icon="👷" label={te ? 'కార్మికులు' : 'Workers'} value={stats.workers} />
          <DashCard icon="🏗️" label={te ? 'సైట్‌లు' : 'Sites'} value={stats.sites} />
          <DashCard icon="📋" label={te ? 'హాజరు' : 'Attendance'} value={stats.attendance} />
          <DashCard icon="💰" label={te ? 'సరఫరాదారులు' : 'Suppliers'} value={stats.suppliers} />
          <DashCard icon="👨" label={te ? 'ఆటవాదులు' : 'Contractors'} value={stats.contractors} />
        </div>
      )}

      <div className="space-y-2">
        <QuickLink href="/workers" icon="👷" label={te ? 'కార్మికులను నిర్వహించండి' : 'Manage Workers'} />
        <QuickLink href="/sites" icon="🏗️" label={te ? 'సైట్‌లను నిర్వహించండి' : 'Manage Sites'} />
        <QuickLink href="/attendance" icon="📋" label={te ? 'హాజరు గుర్తించండి' : 'Mark Attendance'} />
        <QuickLink href="/money" icon="💰" label={te ? 'డబ్బు ట్రాక్ చేయండి' : 'Track Money'} />
      </div>
    </div>
  )
}

const DashCard = ({ icon, label, value }: { icon: string; label: string; value: number }) => (
  <div className="card p-4 text-center cursor-pointer hover:opacity-75 transition" style={{ background: 'rgb(var(--surface2))' }}>
    <div className="text-3xl mb-1">{icon}</div>
    <p className="text-xs opacity-70">{label}</p>
    <p className="text-xl font-black">{value}</p>
  </div>
)

const QuickLink = ({ href, icon, label }: { href: string; icon: string; label: string }) => (
  <button
    onClick={() => window.location.href = href}
    className="card w-full p-4 flex items-center gap-3 hover:opacity-75 transition"
    style={{ background: 'rgb(var(--surface2))' }}>
    <span className="text-2xl">{icon}</span>
    <span className="font-bold text-sm flex-1 text-left">{label}</span>
    <span className="opacity-50">→</span>
  </button>
)

export default function Home() {
  return <Dashboard />
}
