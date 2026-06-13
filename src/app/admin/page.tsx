'use client'
// Admin Panel — hidden, accessed by tapping the CM logo 7 times
// Protected by NEXT_PUBLIC_ADMIN_EMAIL env var check
// Shows SaaS business metrics instead of raw table counts

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim()

interface UserRow {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
}

interface SubRow {
  user_id: string
  plan: string
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
}

interface Metrics {
  // User counts
  totalUsers: number
  newUsersThisWeek: number
  newUsersThisMonth: number

  // Engagement
  dauCount: number          // signed in today
  mauCount: number          // signed in last 30 days
  wauCount: number          // signed in last 7 days

  // Subscription breakdown
  freeUsers: number
  trialUsers: number
  proUsers: number
  lifetimeUsers: number
  expiredTrials: number     // trial_ends_at < now and plan still free → unconverted

  // Data depth (proxy for engagement quality)
  totalWorkers: number
  totalSites: number
  totalAttendance: number

  // PWA installs
  pwaInstalls: number

  // Revenue estimate (pro × ₹200)
  mrrEstimate: number
}

type Tab = 'overview' | 'users' | 'subs' | 'data' | 'info'

export default function AdminPage() {
  const router = useRouter()
  const [authed,   setAuthed]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab,      setTab]      = useState<Tab>('overview')
  const [metrics,  setMetrics]  = useState<Metrics | null>(null)
  const [users,    setUsers]    = useState<UserRow[]>([])
  const [subs,     setSubs]     = useState<SubRow[]>([])
  const [loading,  setLoading]  = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const now   = new Date()
      const today = now.toISOString().split('T')[0]
      const d7    = new Date(now.getTime() - 7  * 86400000).toISOString()
      const d30   = new Date(now.getTime() - 30 * 86400000).toISOString()
      const weekAgo  = new Date(now.getTime() - 7  * 86400000).toISOString().split('T')[0]
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

      // ── All queries in parallel ──────────────────────────────────────────
      const [
        usersRes,
        subsRes,
        workersRes,
        sitesRes,
        attRes,
        pwaRes,
      ] = await Promise.all([
        // auth.users is not accessible via anon key — use profiles/subscriptions table
        // as a user registry. Fall back to counting from workers table (each user_id = 1 user).
        // When subscriptions table exists this will give real user list.
        supabase.from('subscriptions').select('user_id,plan,status,trial_ends_at,current_period_end'),
        supabase.from('subscriptions').select('user_id,plan,status,trial_ends_at,current_period_end'),
        supabase.from('workers').select('user_id,created_at'),
        supabase.from('sites').select('user_id,created_at'),
        supabase.from('attendance').select('user_id,date').order('date',{ascending:false}),
        supabase.from('pwa_installs').select('user_id,installed_at'),
      ])

      const subsData: SubRow[] = subsRes.data ?? []
      setSubs(subsData)

      // ── Derive unique users from all data sources ────────────────────────
      // Until subscriptions table is populated, derive user set from workers table
      const allUserIds = new Set([
        ...(workersRes.data ?? []).map((r: {user_id: string}) => r.user_id),
        ...(sitesRes.data ?? []).map((r: {user_id: string}) => r.user_id),
        ...(subsData).map(r => r.user_id),
      ])
      const totalUsers = allUserIds.size

      // ── New users this week / month (from workers first record per user) ──
      const firstSeen: Record<string, string> = {}
      ;[...(workersRes.data ?? []), ...(sitesRes.data ?? [])].forEach((r: {user_id: string; created_at: string}) => {
        if (!firstSeen[r.user_id] || r.created_at < firstSeen[r.user_id]) {
          firstSeen[r.user_id] = r.created_at
        }
      })
      const newUsersThisWeek  = Object.values(firstSeen).filter(d => d >= d7).length
      const newUsersThisMonth = Object.values(firstSeen).filter(d => d >= d30).length

      // ── Engagement: users who have attendance records recently ──────────
      const attData = attRes.data ?? []
      const attByUser: Record<string, string> = {}
      attData.forEach((r: {user_id: string; date: string}) => {
        if (!attByUser[r.user_id] || r.date > attByUser[r.user_id]) attByUser[r.user_id] = r.date
      })
      const dauCount = Object.values(attByUser).filter(d => d === today).length
      const wauCount = Object.values(attByUser).filter(d => d >= weekAgo).length
      const mauCount = Object.values(attByUser).filter(d => d >= monthAgo).length

      // ── Subscription breakdown ───────────────────────────────────────────
      const freeUsers     = subsData.filter(s => s.plan === 'free' && !s.trial_ends_at).length
      const trialUsers    = subsData.filter(s => s.trial_ends_at && new Date(s.trial_ends_at) > now).length
      const proUsers      = subsData.filter(s => s.plan === 'pro' && s.status === 'active').length
      const lifetimeUsers = subsData.filter(s => s.plan === 'lifetime').length
      const expiredTrials = subsData.filter(s => s.trial_ends_at && new Date(s.trial_ends_at) <= now && s.plan === 'free').length

      // ── Revenue estimate ─────────────────────────────────────────────────
      const mrrEstimate = proUsers * 200

      // ── Data depth ───────────────────────────────────────────────────────
      const totalWorkers    = workersRes.data?.length ?? 0
      const totalSites      = sitesRes.data?.length ?? 0
      const totalAttendance = attData.length
      const pwaInstalls     = pwaRes.data?.length ?? 0

      // Build synthetic user rows for the users tab
      const userRows: UserRow[] = Array.from(allUserIds).map(id => ({
        id,
        email: subsData.find(s => s.user_id === id)?.user_id ?? id,
        created_at: firstSeen[id] ?? '',
        last_sign_in_at: attByUser[id] ?? null,
      }))
      setUsers(userRows)

      setMetrics({
        totalUsers, newUsersThisWeek, newUsersThisMonth,
        dauCount, wauCount, mauCount,
        freeUsers, trialUsers, proUsers, lifetimeUsers, expiredTrials,
        totalWorkers, totalSites, totalAttendance,
        pwaInstalls, mrrEstimate,
      })
      setLastRefresh(new Date())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (ADMIN_EMAIL && user?.email === ADMIN_EMAIL) {
        setAuthed(true)
        loadData()
      } else {
        router.replace('/')
      }
      setChecking(false)
    })
  }, [router, loadData])

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0c0e]">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!authed) return null

  const TABS: { id: Tab; label: string }[] = [
    { id:'overview', label:'📊 Overview' },
    { id:'users',    label:'👥 Users' },
    { id:'subs',     label:'💳 Plans' },
    { id:'data',     label:'🗄️ Data' },
    { id:'info',     label:'ℹ️ Info' },
  ]

  const card = (label: string, val: string | number, sub?: string, color = 'text-amber-400') => (
    <div key={label} className="bg-[#161614] border border-[#2a2a28] rounded-2xl p-4 text-center">
      <p className={`text-3xl font-black ${color}`}>{typeof val === 'number' ? val.toLocaleString() : val}</p>
      <p className="text-xs mt-1 text-[#7a7870]">{label}</p>
      {sub && <p className="text-[10px] mt-0.5 text-[#4a4a48]">{sub}</p>}
    </div>
  )

  const row = (label: string, val: string | number, color = 'text-[#dedad2]') => (
    <div key={label} className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3 flex items-center justify-between">
      <p className="text-sm text-[#7a7870]">{label}</p>
      <p className={`text-sm font-black ${color}`}>{typeof val === 'number' ? val.toLocaleString() : val}</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-16 bg-[#0c0c0e] text-[#dedad2]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 px-4 py-4 bg-[#161614] border-b border-[#2a2a28]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-black text-lg text-[#dedad2]">🔐 Admin Panel</p>
            <p className="text-xs text-[#7a7870]">
              {lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#2a2a28] text-[#7a7870] hover:opacity-80 disabled:opacity-40">
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            <button onClick={() => router.push('/')} className="text-sm font-bold text-amber-400 hover:opacity-80">
              ← Back
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 overflow-x-auto" style={{scrollbarWidth:'none'}}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition flex-shrink-0"
              style={{
                background: tab === t.id ? 'rgba(212,140,40,0.15)' : 'transparent',
                color: tab === t.id ? '#d48c28' : '#7a7870',
                border: tab === t.id ? '1px solid rgba(212,140,40,0.3)' : '1px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* ── Overview tab ────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">Users</p>
            <div className="grid grid-cols-2 gap-3">
              {card('Total Users',        metrics?.totalUsers ?? '—',        undefined,       'text-amber-400')}
              {card('New This Month',     metrics?.newUsersThisMonth ?? '—', undefined,       'text-green-400')}
              {card('New This Week',      metrics?.newUsersThisWeek ?? '—',  undefined,       'text-blue-400')}
              {card('PWA Installs',       metrics?.pwaInstalls ?? '—',       'App installed', 'text-purple-400')}
            </div>

            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Engagement</p>
            <div className="grid grid-cols-3 gap-3">
              {card('DAU',  metrics?.dauCount ?? '—', 'Active today',   'text-green-400')}
              {card('WAU',  metrics?.wauCount ?? '—', 'Last 7 days',   'text-blue-400')}
              {card('MAU',  metrics?.mauCount ?? '—', 'Last 30 days',  'text-amber-400')}
            </div>

            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Revenue</p>
            <div className="grid grid-cols-2 gap-3">
              {card('MRR (est.)', metrics ? `₹${metrics.mrrEstimate.toLocaleString()}` : '—', 'Pro × ₹200', 'text-green-400')}
              {card('Pro Users',  metrics?.proUsers ?? '—', 'Paying', 'text-amber-400')}
            </div>

            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Conversion Funnel</p>
            <div className="space-y-2">
              {[
                { label:'Total signups',    val: metrics?.totalUsers ?? 0,     color:'text-[#dedad2]' },
                { label:'On free trial',    val: metrics?.trialUsers ?? 0,     color:'text-blue-400' },
                { label:'Trial expired (not converted)', val: metrics?.expiredTrials ?? 0, color:'text-red-400' },
                { label:'Converted → Pro',  val: metrics?.proUsers ?? 0,       color:'text-green-400' },
                { label:'Lifetime access',  val: metrics?.lifetimeUsers ?? 0,  color:'text-purple-400' },
              ].map(({ label, val, color }) => {
                const pct = metrics?.totalUsers ? Math.round((val / metrics.totalUsers) * 100) : 0
                return (
                  <div key={label} className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-[#7a7870]">{label}</p>
                      <p className={`text-sm font-black ${color}`}>{val} <span className="text-[10px] font-normal text-[#4a4a48]">({pct}%)</span></p>
                    </div>
                    <div className="h-1 rounded-full bg-[#2a2a28]">
                      <div className="h-1 rounded-full bg-amber-500 transition-all" style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Users tab ───────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <>
            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">
              {users.length} registered users
            </p>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-sm text-[#7a7870] py-8">
                No users yet. The subscriptions table may not be set up.
              </p>
            ) : (
              <div className="space-y-2">
                {users.sort((a,b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).map(u => {
                  const sub = subs.find(s => s.user_id === u.id)
                  const planColor = sub?.plan === 'pro' ? 'text-amber-400' : sub?.plan === 'lifetime' ? 'text-purple-400' : 'text-[#7a7870]'
                  return (
                    <div key={u.id} className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-mono text-[#dedad2] truncate max-w-[180px]">{u.id.slice(0,8)}...</p>
                        <span className={`text-xs font-bold ${planColor}`}>{sub?.plan ?? 'no sub'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-[#4a4a48]">
                          Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '?'}
                        </p>
                        <p className="text-[10px] text-[#4a4a48]">
                          Last active {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'never'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Plans tab ───────────────────────────────────────────────────── */}
        {tab === 'subs' && (
          <>
            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">Plan Distribution</p>
            <div className="grid grid-cols-2 gap-3">
              {card('Free',     metrics?.freeUsers ?? '—',     undefined, 'text-[#7a7870]')}
              {card('Trial',    metrics?.trialUsers ?? '—',    undefined, 'text-blue-400')}
              {card('Pro',      metrics?.proUsers ?? '—',      undefined, 'text-amber-400')}
              {card('Lifetime', metrics?.lifetimeUsers ?? '—', undefined, 'text-purple-400')}
            </div>

            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Revenue Metrics</p>
            <div className="space-y-2">
              {row('MRR (estimated)',   metrics ? `₹${metrics.mrrEstimate.toLocaleString()}` : '—', 'text-green-400')}
              {row('ARR (estimated)',   metrics ? `₹${(metrics.mrrEstimate * 12).toLocaleString()}` : '—', 'text-green-400')}
              {row('ARPU',             metrics?.proUsers ? `₹200/mo` : '—', 'text-amber-400')}
              {row('Trial → Pro rate', metrics?.trialUsers || metrics?.expiredTrials
                ? `${metrics.proUsers} / ${(metrics.trialUsers ?? 0) + (metrics.expiredTrials ?? 0) + (metrics.proUsers ?? 0)} trials`
                : 'No data yet', 'text-blue-400')}
              {row('Expired trials (churn risk)', metrics?.expiredTrials ?? '—', 'text-red-400')}
            </div>

            <div className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3 mt-1">
              <p className="text-xs text-[#7a7870] mb-1">Pricing</p>
              <p className="text-sm font-bold text-[#dedad2]">₹200 / month per user</p>
              <p className="text-[10px] text-[#4a4a48] mt-0.5">1 month free trial on signup</p>
            </div>
          </>
        )}

        {/* ── Data tab ────────────────────────────────────────────────────── */}
        {tab === 'data' && (
          <>
            <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">Platform Data (all users)</p>
            <div className="grid grid-cols-2 gap-3">
              {card('Workers',    metrics?.totalWorkers ?? '—',    undefined, 'text-green-400')}
              {card('Sites',      metrics?.totalSites ?? '—',      undefined, 'text-blue-400')}
              {card('Attendance', metrics?.totalAttendance ?? '—', undefined, 'text-purple-400')}
              {card('PWA Installs', metrics?.pwaInstalls ?? '—',  undefined, 'text-amber-400')}
            </div>
            <p className="text-xs text-[#4a4a48] text-center pt-1">
              High worker + attendance counts = engaged users → less likely to churn
            </p>
          </>
        )}

        {/* ── Info tab ────────────────────────────────────────────────────── */}
        {tab === 'info' && (
          <div className="space-y-2">
            {[
              { label:'Admin Email',  val: ADMIN_EMAIL ? `${ADMIN_EMAIL.slice(0,3)}***` : '(not set)' },
              { label:'App Version',  val: 'v1.0.0' },
              { label:'Framework',    val: 'Next.js 15' },
              { label:'Database',     val: 'Supabase (PostgreSQL)' },
              { label:'Auth',         val: 'Google OAuth (PKCE)' },
              { label:'Hosting',      val: 'Vercel' },
              { label:'Pricing',      val: '₹200/mo (Free trial: 1 month)' },
              { label:'Build Date',   val: new Date().toLocaleDateString() },
            ].map(({ label, val }) => row(label, val))}

            <div className="bg-[#161614] border border-amber-500/20 rounded-xl px-4 py-3 mt-2">
              <p className="text-xs font-bold text-amber-400 mb-1">⚠️ Setup checklist</p>
              {[
                ['subscriptions table', 'Required for plan tracking'],
                ['pwa_installs table',  'Required for install tracking'],
                ['NEXT_PUBLIC_ADMIN_EMAIL', ADMIN_EMAIL ? '✓ Set' : '✗ Not set'],
                ['Razorpay integration', 'Required for billing'],
              ].map(([item, status]) => (
                <p key={item} className="text-[11px] text-[#7a7870] flex justify-between">
                  <span>{item}</span><span className="text-[#4a4a48]">{status}</span>
                </p>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
