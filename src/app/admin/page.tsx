'use client'
// Feature 3: Hidden Admin Panel
// Access: tap the CM logo in the top-left 7 times → password prompt appears
// Only your Google account email can enter.
// This page is at /admin — not linked anywhere in the UI.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ── Replace with your actual Google account email ──────────────────────────
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'mallipedhisandeep@gmail.com'

interface UserRow { id: string; email: string; created_at: string; last_sign_in_at: string }
interface TableCount { name: string; count: number }

export default function AdminPage() {
  const router = useRouter()
  const [authed,    setAuthed]    = useState(false)
  const [checking,  setChecking]  = useState(true)
  const [users,     setUsers]     = useState<UserRow[]>([])
  const [counts,    setCounts]    = useState<TableCount[]>([])
  const [loading,   setLoading]   = useState(false)
  const [tab,       setTab]       = useState<'users'|'data'|'info'>('users')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === ADMIN_EMAIL) {
        setAuthed(true)
        loadData()
      } else {
        // Not admin — redirect to home silently
        router.replace('/')
      }
      setChecking(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const tables = ['workers','sites','attendance','suppliers','goods_orders','private_workers','private_work','private_worker_payments','supplier_payments','site_payments']
      const results = await Promise.all(
        tables.map(t => supabase.from(t).select('id',{count:'exact',head:true}).then(({ count }) => ({ name: t, count: count ?? 0 })))
      )
      setCounts(results)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'rgb(var(--bg))'}}>
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
    </div>
  )

  if (!authed) return null

  const totalRecords = counts.reduce((s, c) => s + c.count, 0)

  return (
    <div className="min-h-screen pb-16" style={{background:'rgb(var(--bg))'}}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-4 flex items-center justify-between"
        style={{background:'rgb(var(--surface))',borderBottom:'1px solid rgb(var(--border))'}}>
        <div>
          <p className="font-black text-lg" style={{color:'rgb(var(--text))'}}>🔐 Admin Panel</p>
          <p className="text-xs" style={{color:'rgb(var(--muted))'}}>Hidden · Only visible to you</p>
        </div>
        <button onClick={() => router.push('/')}
          className="btn-ghost btn-sm">← Back</button>
      </div>

      <div className="px-4 pt-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card p-4 text-center">
            <p className="text-3xl font-black" style={{color:'rgb(var(--accent))'}}>{totalRecords.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{color:'rgb(var(--muted))'}}>Total Records</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-black text-green-500">{counts.find(c=>c.name==='workers')?.count ?? 0}</p>
            <p className="text-xs mt-1" style={{color:'rgb(var(--muted))'}}>Workers</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-black text-blue-500">{counts.find(c=>c.name==='sites')?.count ?? 0}</p>
            <p className="text-xs mt-1" style={{color:'rgb(var(--muted))'}}>Sites</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-black text-purple-500">{counts.find(c=>c.name==='attendance')?.count ?? 0}</p>
            <p className="text-xs mt-1" style={{color:'rgb(var(--muted))'}}>Attendance Records</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b" style={{borderColor:'rgb(var(--border))'}}>
          {([['data','📊 Data Counts'],['info','ℹ️ App Info']] as const).map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-bold border-b-2 transition"
              style={{
                color: tab===t ? 'rgb(var(--accent))' : 'rgb(var(--muted))',
                borderBottomColor: tab===t ? 'rgb(var(--accent))' : 'transparent',
              }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'data' && (
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
              </div>
            ) : counts.map(c => (
              <div key={c.name} className="card px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-medium" style={{color:'rgb(var(--text))'}}>{c.name.replace(/_/g,' ')}</p>
                <span className="font-black text-lg" style={{color:'rgb(var(--accent))'}}>{c.count.toLocaleString()}</span>
              </div>
            ))}
            <button onClick={loadData} className="btn-ghost w-full mt-2">🔄 Refresh</button>
          </div>
        )}

        {tab === 'info' && (
          <div className="space-y-3">
            {[
              { label:'Admin Email',   val: ADMIN_EMAIL },
              { label:'App Version',   val: 'v1.0.0' },
              { label:'Framework',     val: 'Next.js 15' },
              { label:'Database',      val: 'Supabase (PostgreSQL)' },
              { label:'Hosting',       val: 'Vercel' },
              { label:'Build Time',    val: new Date().toLocaleDateString() },
            ].map(({ label, val }) => (
              <div key={label} className="card px-4 py-3 flex items-center justify-between">
                <p className="text-sm" style={{color:'rgb(var(--muted))'}}>{label}</p>
                <p className="text-sm font-bold" style={{color:'rgb(var(--text))'}}>{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
