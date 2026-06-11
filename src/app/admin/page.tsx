'use client'
 //Feature 3: Hidden Admin Panel
// Access: tap the CM logo in the top-left 7 times → password prompt appears
// Only the account whose email matches NEXT_PUBLIC_ADMIN_EMAIL can enter.
// This page is at /admin — not linked anywhere in the UI.


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'


const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim()

interface TableCount { name: string; count: number }

export default function AdminPage() {
  const router = useRouter()
  const [authed,   setAuthed]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab,      setTab]      = useState<'data' | 'info'>('data')
  const [counts,   setCounts]   = useState<TableCount[]>([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
   
    supabase.auth.getUser().then(({ data: { user } }) => {
      // If the env var is missing ADMIN_EMAIL is '' → this check always fails.
      if (ADMIN_EMAIL && user?.email === ADMIN_EMAIL) {
        setAuthed(true)
        loadData()
      } else {
        router.replace('/')
      }
      setChecking(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const tables = [
        'workers', 'sites', 'attendance', 'suppliers', 'goods_orders',
        'private_workers', 'private_work', 'private_worker_payments',
        'supplier_payments', 'site_payments',
      ]
      const results = await Promise.all(
        tables.map(t =>
          supabase.from(t).select('id', { count: 'exact', head: true })
            .then(({ count }) => ({ name: t, count: count ?? 0 }))
        )
      )
      setCounts(results)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0c0e]">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!authed) return null

  const totalRecords = counts.reduce((s, c) => s + c.count, 0)

  
  return (
    <div className="min-h-screen pb-16 bg-[#0c0c0e] text-[#dedad2]">
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-4 flex items-center justify-between bg-[#161614] border-b border-[#2a2a28]">
        <div>
          <p className="font-black text-lg text-[#dedad2]">🔐 Admin Panel</p>
          <p className="text-xs text-[#7a7870]">Hidden · Only visible to you</p>
        </div>
        <button onClick={() => router.push('/')} className="text-sm font-bold text-amber-400 hover:opacity-80">
          ← Back
        </button>
      </div>

      <div className="px-4 pt-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Total Records',       val: totalRecords.toLocaleString(), color: 'text-amber-400' },
            { label: 'Workers',              val: counts.find(c => c.name === 'workers')?.count ?? 0,     color: 'text-green-400' },
            { label: 'Sites',                val: counts.find(c => c.name === 'sites')?.count ?? 0,       color: 'text-blue-400' },
            { label: 'Attendance Records',   val: counts.find(c => c.name === 'attendance')?.count ?? 0,  color: 'text-purple-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-[#161614] border border-[#2a2a28] rounded-2xl p-4 text-center">
              <p className={`text-3xl font-black ${color}`}>{typeof val === 'number' ? val.toLocaleString() : val}</p>
              <p className="text-xs mt-1 text-[#7a7870]">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-[#2a2a28]">
          {([['data', '📊 Data Counts'], ['info', 'ℹ️ App Info']] as const).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-bold border-b-2 transition"
              style={{
                color: tab === t ? '#d48c28' : '#7a7870',
                borderBottomColor: tab === t ? '#d48c28' : 'transparent',
              }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'data' && (
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : counts.map(c => (
              <div key={c.name} className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[#dedad2]">{c.name.replace(/_/g, ' ')}</p>
                <span className="font-black text-lg text-amber-400">{c.count.toLocaleString()}</span>
              </div>
            ))}
            <button onClick={loadData}
              className="w-full mt-2 py-2.5 rounded-xl text-sm font-bold border border-[#2a2a28] text-[#7a7870] hover:opacity-80">
              🔄 Refresh
            </button>
          </div>
        )}

        {tab === 'info' && (
          <div className="space-y-3">
            {[
             
              { label: 'Admin Email',  val: ADMIN_EMAIL ? `${ADMIN_EMAIL.slice(0, 3)}***` : '(not configured)' },
              { label: 'App Version',  val: 'v1.0.0' },
              { label: 'Framework',    val: 'Next.js 15' },
              { label: 'Database',     val: 'Supabase (PostgreSQL)' },
              { label: 'Hosting',      val: 'Vercel' },
              { label: 'Build Time',   val: new Date().toLocaleDateString() },
            ].map(({ label, val }) => (
              <div key={label} className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-[#7a7870]">{label}</p>
                <p className="text-sm font-bold text-[#dedad2]">{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
