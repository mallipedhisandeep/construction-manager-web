'use client'
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
  totalUsers: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  dauCount: number
  mauCount: number
  wauCount: number
  freeUsers: number
  trialUsers: number
  proUsers: number
  lifetimeUsers: number
  expiredTrials: number
  totalWorkers: number
  totalSites: number
  totalAttendance: number
  pwaInstalls: number
  mrrEstimate: number
}

type Tab = 'overview' | 'users' | 'subs' | 'data' | 'info'

export default function AdminPage() {
  const router = useRouter()
  const [authed,      setAuthed]      = useState(false)
  const [checking,    setChecking]    = useState(true)
  const [tab,         setTab]         = useState<Tab>('overview')
  const [metrics,     setMetrics]     = useState<Metrics | null>(null)
  const [users,       setUsers]       = useState<UserRow[]>([])
  const [subs,        setSubs]        = useState<SubRow[]>([])
  const [loading,     setLoading]     = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const now      = new Date()
      const today    = now.toISOString().split('T')[0]
      const d7       = new Date(now.getTime() - 7  * 86400000).toISOString()
      const d30      = new Date(now.getTime() - 30 * 86400000).toISOString()
      const weekAgo  = new Date(now.getTime() - 7  * 86400000).toISOString().split('T')[0]
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

      const [emailsRes, subsRes, workersRes, sitesRes, attRes, pwaRes] = await Promise.all([
        // Use the SECURITY DEFINER function to get real emails
        supabase.rpc('get_user_emails'),
        supabase.from('subscriptions').select('user_id,plan,status,trial_ends_at,current_period_end'),
        supabase.from('workers').select('user_id,created_at'),
        supabase.from('sites').select('user_id,created_at'),
        supabase.from('attendance').select('user_id,date').order('date', { ascending: false }),
        supabase.from('pwa_installs').select('user_id,installed_at'),
      ])

      const subsData: SubRow[]  = subsRes.data   ?? []
      const emailData: UserRow[] = emailsRes.data ?? []
      setSubs(subsData)

      // Build user rows with real emails
      const userMap: Record<string, UserRow> = {}
      emailData.forEach((u: UserRow) => { userMap[u.id] = u })

      // Fill in any users not yet in auth.users result (edge case)
      const allIds = new Set([
        ...emailData.map(u => u.id),
        ...(workersRes.data ?? []).map((r: { user_id: string }) => r.user_id),
        ...(sitesRes.data  ?? []).map((r: { user_id: string }) => r.user_id),
        ...subsData.map(s => s.user_id),
      ])

      const firstSeen: Record<string, string> = {}
      ;[...(workersRes.data ?? []), ...(sitesRes.data ?? [])].forEach((r: { user_id: string; created_at: string }) => {
        if (!firstSeen[r.user_id] || r.created_at < firstSeen[r.user_id])
          firstSeen[r.user_id] = r.created_at
      })

      const attByUser: Record<string, string> = {}
      ;(attRes.data ?? []).forEach((r: { user_id: string; date: string }) => {
        if (!attByUser[r.user_id] || r.date > attByUser[r.user_id]) attByUser[r.user_id] = r.date
      })

      const userRows: UserRow[] = Array.from(allIds).map(id => ({
        id,
        email:            userMap[id]?.email ?? '(email unavailable)',
        created_at:       userMap[id]?.created_at ?? firstSeen[id] ?? '',
        last_sign_in_at:  userMap[id]?.last_sign_in_at ?? attByUser[id] ?? null,
      }))
      setUsers(userRows)

      const totalUsers        = allIds.size
      const newUsersThisWeek  = Object.values(firstSeen).filter(d => d >= d7).length
      const newUsersThisMonth = Object.values(firstSeen).filter(d => d >= d30).length
      const dauCount          = Object.values(attByUser).filter(d => d === today).length
      const wauCount          = Object.values(attByUser).filter(d => d >= weekAgo).length
      const mauCount          = Object.values(attByUser).filter(d => d >= monthAgo).length
      const freeUsers         = subsData.filter(s => s.plan === 'free' && !s.trial_ends_at).length
      const trialUsers        = subsData.filter(s => s.trial_ends_at && new Date(s.trial_ends_at) > now).length
      const proUsers          = subsData.filter(s => s.plan === 'pro' && s.status === 'active').length
      const lifetimeUsers     = subsData.filter(s => s.plan === 'lifetime').length
      const expiredTrials     = subsData.filter(s => s.trial_ends_at && new Date(s.trial_ends_at) <= now && s.plan === 'free').length

      setMetrics({
        totalUsers, newUsersThisWeek, newUsersThisMonth,
        dauCount, wauCount, mauCount,
        freeUsers, trialUsers, proUsers, lifetimeUsers, expiredTrials,
        totalWorkers:    workersRes.data?.length ?? 0,
        totalSites:      sitesRes.data?.length   ?? 0,
        totalAttendance: attRes.data?.length      ?? 0,
        pwaInstalls:     pwaRes.data?.length      ?? 0,
        mrrEstimate:     proUsers * 200,
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
    { id: 'overview', label: '📊 Overview' },
    { id: 'users',    label: '👥 Users' },
    { id: 'subs',     label: '💳 Plans' },
    { id: 'data',     label: '🗄️ Data' },
    { id: 'info',     label: 'ℹ️ Info' },
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

  const planColor = (plan: string) =>
    plan === 'pro'      ? 'text-amber-400' :
    plan === 'lifetime' ? 'text-purple-400' :
    plan === 'trial'    ? 'text-blue-400' : 'text-[#7a7870]'

  const planBadgeBg = (plan: string) =>
    plan === 'pro'      ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
    plan === 'lifetime' ? 'bg-purple-400/10 text-purple-400 border-purple-400/20' :
    plan === 'trial'    ? 'bg-blue-400/10 text-blue-400 border-blue-400/20' :
                          'bg-[#2a2a28] text-[#7a7870] border-[#3a3a38]'

  return (
    <div className="min-h-screen pb-16 bg-[#0c0c0e] text-[#dedad2]">

      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-4 bg-[#161614] border-b border-[#2a2a28]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-black text-lg text-[#dedad2]">🔐 Admin Panel</p>
            <p className="text-xs text-[#7a7870]">
              {lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadData} disabled={loading}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#2a2a28] text-[#7a7870] hover:opacity-80 disabled:opacity-40">
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            <button onClick={() => router.push('/')} className="text-sm font-bold text-amber-400 hover:opacity-80">
              ← Back
            </button>
          </div>
        </div>
        <div className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition flex-shrink-0"
              style={{
                background: tab === t.id ? 'rgba(212,140,40,0.15)' : 'transparent',
                color:      tab === t.id ? '#d48c28' : '#7a7870',
                border:     tab === t.id ? '1px solid rgba(212,140,40,0.3)' : '1px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* Overview */}
        {tab === 'overview' && (<>
          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">Users</p>
          <div className="grid grid-cols-2 gap-3">
            {card('Total Users',    metrics?.totalUsers        ?? '—', undefined,       'text-amber-400')}
            {card('New This Month', metrics?.newUsersThisMonth ?? '—', undefined,       'text-green-400')}
            {card('New This Week',  metrics?.newUsersThisWeek  ?? '—', undefined,       'text-blue-400')}
            {card('PWA Installs',   metrics?.pwaInstalls       ?? '—', 'App installed', 'text-purple-400')}
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Engagement</p>
          <div className="grid grid-cols-3 gap-3">
            {card('DAU', metrics?.dauCount ?? '—', 'Active today',  'text-green-400')}
            {card('WAU', metrics?.wauCount ?? '—', 'Last 7 days',  'text-blue-400')}
            {card('MAU', metrics?.mauCount ?? '—', 'Last 30 days', 'text-amber-400')}
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Revenue</p>
          <div className="grid grid-cols-2 gap-3">
            {card('MRR (est.)', metrics ? `₹${metrics.mrrEstimate.toLocaleString()}` : '—', 'Pro × ₹200', 'text-green-400')}
            {card('Pro Users',  metrics?.proUsers ?? '—', 'Paying', 'text-amber-400')}
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Conversion Funnel</p>
          <div className="space-y-2">
            {[
              { label: 'Total signups',              val: metrics?.totalUsers    ?? 0, color: 'text-[#dedad2]' },
              { label: 'On free trial',              val: metrics?.trialUsers    ?? 0, color: 'text-blue-400' },
              { label: 'Trial expired (not converted)', val: metrics?.expiredTrials ?? 0, color: 'text-red-400' },
              { label: 'Converted → Pro',            val: metrics?.proUsers      ?? 0, color: 'text-green-400' },
              { label: 'Lifetime access',            val: metrics?.lifetimeUsers ?? 0, color: 'text-purple-400' },
            ].map(({ label, val, color }) => {
              const pct = metrics?.totalUsers ? Math.round((val / metrics.totalUsers) * 100) : 0
              return (
                <div key={label} className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-[#7a7870]">{label}</p>
                    <p className={`text-sm font-black ${color}`}>{val} <span className="text-[10px] font-normal text-[#4a4a48]">({pct}%)</span></p>
                  </div>
                  <div className="h-1 rounded-full bg-[#2a2a28]">
                    <div className="h-1 rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>)}

        {/* Users tab — now shows email */}
        {tab === 'users' && (<>
          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">
            {users.length} registered users
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-[#7a7870] py-8">No users yet.</p>
          ) : (
            <div className="space-y-2">
              {users
                .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
                .map(u => {
                  const sub = subs.find(s => s.user_id === u.id)
                  return (
                    <div key={u.id} className="bg-[#161614] border border-[#2a2a28] rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* Email — prominent */}
                        <p className="text-sm font-semibold text-[#dedad2] truncate flex-1">{u.email}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${planBadgeBg(sub?.plan ?? 'free')}`}>
                          {sub?.plan ?? 'no sub'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-[#4a4a48]">
                          Joined {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '?'}
                        </p>
                        <p className="text-[10px] text-[#4a4a48]">
                          Last seen {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-IN') : 'never'}
                        </p>
                      </div>
                      {sub?.trial_ends_at && (
                        <p className="text-[10px] text-blue-400 mt-0.5">
                          Trial ends {new Date(sub.trial_ends_at).toLocaleDateString('en-IN')}
                        </p>
                      )}
                      {sub?.current_period_end && sub?.plan === 'pro' && (
                        <p className="text-[10px] text-amber-400 mt-0.5">
                          Renews {new Date(sub.current_period_end).toLocaleDateString('en-IN')}
                        </p>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </>)}

        {/* Plans tab */}
        {tab === 'subs' && (<>
          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">Plan Distribution</p>
          <div className="grid grid-cols-2 gap-3">
            {card('Free',     metrics?.freeUsers     ?? '—', undefined, 'text-[#7a7870]')}
            {card('Trial',    metrics?.trialUsers    ?? '—', undefined, 'text-blue-400')}
            {card('Pro',      metrics?.proUsers      ?? '—', undefined, 'text-amber-400')}
            {card('Lifetime', metrics?.lifetimeUsers ?? '—', undefined, 'text-purple-400')}
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870] pt-2">Revenue Metrics</p>
          <div className="space-y-2">
            {row('MRR (estimated)',   metrics ? `₹${metrics.mrrEstimate.toLocaleString()}` : '—', 'text-green-400')}
            {row('ARR (estimated)',   metrics ? `₹${(metrics.mrrEstimate * 12).toLocaleString()}` : '—', 'text-green-400')}
            {row('ARPU',             metrics?.proUsers ? '₹200/mo' : '—', 'text-amber-400')}
            {row('Expired trials (churn risk)', metrics?.expiredTrials ?? '—', 'text-red-400')}
          </div>
        </>)}

        {/* Data tab */}
        {tab === 'data' && (<>
          <p className="text-xs font-black uppercase tracking-widest text-[#7a7870]">Platform Data (all users)</p>
          <div className="grid grid-cols-2 gap-3">
            {card('Workers',      metrics?.totalWorkers    ?? '—', undefined, 'text-green-400')}
            {card('Sites',        metrics?.totalSites      ?? '—', undefined, 'text-blue-400')}
            {card('Attendance',   metrics?.totalAttendance ?? '—', undefined, 'text-purple-400')}
            {card('PWA Installs', metrics?.pwaInstalls     ?? '—', undefined, 'text-amber-400')}
          </div>
        </>)}

        {/* Info tab */}
        {tab === 'info' && (
          <div className="space-y-2">
            {[
              { label: 'Admin Email', val: ADMIN_EMAIL ? `${ADMIN_EMAIL.slice(0, 3)}***` : '(not set)' },
              { label: 'App Version', val: 'v1.0.0' },
              { label: 'Framework',   val: 'Next.js 15' },
              { label: 'Database',    val: 'Supabase (PostgreSQL)' },
              { label: 'Auth',        val: 'Google OAuth (PKCE)' },
              { label: 'Hosting',     val: 'Vercel' },
              { label: 'Pricing',     val: '₹200/mo · 30-day free trial' },
            ].map(({ label, val }) => row(label, val))}
          </div>
        )}

      </div>
    </div>
  )
}
