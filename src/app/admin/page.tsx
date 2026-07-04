'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/components/AppShell'
import { PRICING, monthlyEquivalent } from '@/lib/pricing'

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
  billing_cycle: 'monthly' | 'yearly' | null
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

interface Ticket {
  id: string; user_email: string; category: string; subject: string; message: string
  status: string; admin_reply: string | null; created_at: string
}

type Tab = 'overview' | 'users' | 'subs' | 'data' | 'tickets' | 'info'

function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const displayFont = { fontFamily: "'Syne', sans-serif" }

  const [authed,      setAuthed]      = useState(false)
  const [checking,    setChecking]    = useState(true)
  const [authError,   setAuthError]   = useState<string|null>(null)
  const VALID_TABS: Tab[] = ['overview','users','subs','data','tickets','info']
  const initialTab = (searchParams.get('tab') as Tab | null)
  const [tab,         setTab]         = useState<Tab>(initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'overview')
  const [metrics,     setMetrics]     = useState<Metrics | null>(null)
  const [users,       setUsers]       = useState<UserRow[]>([])
  const [subs,        setSubs]        = useState<SubRow[]>([])
  const [tickets,     setTickets]     = useState<Ticket[]>([])
  const [replyDraft,  setReplyDraft]  = useState<Record<string,string>>({})
  const [replying,    setReplying]    = useState<string|null>(null)
  const [loading,     setLoading]     = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [pushStatus,  setPushStatus]  = useState<'unknown'|'unsupported'|'subscribed'|'unsubscribed'|'denied'>('unknown')
  const [pushBusy,    setPushBusy]    = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAuthed(false); setChecking(false); setLoading(false)
        setAuthError('You are not signed in.')
        router.replace('/login')
        return
      }

      const res = await fetch('/api/admin/data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        let reason = `Request failed (HTTP ${res.status})`
        try {
          const errJson = await res.json()
          if (errJson?.error) reason = errJson.error
        } catch { /* response wasn't JSON — keep generic reason */ }

        // Not signed in / signed in as someone other than the configured
        // admin → silently send them home, no message. This is a normal,
        // expected outcome for every non-admin user who lands here, not an
        // error worth surfacing.
        if (res.status === 401 || res.status === 403) {
          setAuthed(false); setChecking(false); setLoading(false)
          router.replace('/')
          return
        }

        // Anything else (500, network/config problems) is a real setup
        // issue worth showing, since silently redirecting here would just
        // look like the page is stuck buffering with no way to diagnose it.
        setAuthed(false); setChecking(false); setLoading(false)
        setAuthError(reason)
        return
      }
      setAuthed(true); setChecking(false); setAuthError(null)
      const json = await res.json()

      const now      = new Date()
      const today    = now.toISOString().split('T')[0]
      const d7       = new Date(now.getTime() - 7  * 86400000).toISOString()
      const d30      = new Date(now.getTime() - 30 * 86400000).toISOString()
      const weekAgo  = new Date(now.getTime() - 7  * 86400000).toISOString().split('T')[0]
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

      setTickets(json.tickets ?? [])

      const subsData: SubRow[]   = json.subs  ?? []
      const emailData: UserRow[] = json.users ?? []
      setSubs(subsData)

      // Build user rows with real emails
      const userMap: Record<string, UserRow> = {}
      emailData.forEach((u: UserRow) => { userMap[u.id] = u })

      // Fill in any users not yet in auth.users result (edge case)
      const allIds = new Set([
        ...emailData.map(u => u.id),
        ...(json.workers ?? []).map((r: { user_id: string }) => r.user_id),
        ...(json.sites  ?? []).map((r: { user_id: string }) => r.user_id),
        ...subsData.map(s => s.user_id),
      ])

      const firstSeen: Record<string, string> = {}
      ;[...(json.workers ?? []), ...(json.sites ?? [])].forEach((r: { user_id: string; created_at: string }) => {
        if (!firstSeen[r.user_id] || r.created_at < firstSeen[r.user_id])
          firstSeen[r.user_id] = r.created_at
      })

      const attByUser: Record<string, string> = {}
      ;(json.attendance ?? []).forEach((r: { user_id: string; date: string }) => {
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
      // Cycle-aware MRR: a yearly subscriber contributes ₹2600/12 per month,
      // not the full monthly price — summing per-user instead of a flat
      // "proUsers * monthlyPrice" keeps this accurate once both plans exist.
      const mrrEstimate = subsData
        .filter(s => s.plan === 'pro' && s.status === 'active')
        .reduce((sum, s) => sum + monthlyEquivalent(s.billing_cycle), 0)
      const lifetimeUsers     = subsData.filter(s => s.plan === 'lifetime').length
      const expiredTrials     = subsData.filter(s => s.trial_ends_at && new Date(s.trial_ends_at) <= now && s.plan === 'free').length

      setMetrics({
        totalUsers, newUsersThisWeek, newUsersThisMonth,
        dauCount, wauCount, mauCount,
        freeUsers, trialUsers, proUsers, lifetimeUsers, expiredTrials,
        totalWorkers:    json.workers?.length    ?? 0,
        totalSites:      json.sites?.length      ?? 0,
        totalAttendance: json.attendance?.length ?? 0,
        pwaInstalls:     json.pwaInstalls?.length ?? 0,
        mrrEstimate,
      })
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
      setAuthed(false); setChecking(false)
      setAuthError(e instanceof Error ? e.message : 'Network error loading admin data.')
    }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Push notifications ──────────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setPushStatus('denied'); return }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushStatus(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setPushStatus('unsubscribed'))
  }, [])

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
  }

  const enablePush = async () => {
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushStatus('denied'); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const keyRes = await fetch('/api/push/vapid-key', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const keyJson = await keyRes.json()
      if (!keyRes.ok) throw new Error(keyJson.error ?? 'Could not load push key')

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
      })

      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveJson.error ?? 'Could not save subscription')

      setPushStatus('subscribed')
    } catch (e) {
      console.error('[push] enable failed:', e)
      alert(e instanceof Error ? e.message : 'Could not enable push notifications')
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushStatus('unsubscribed')
    } catch (e) {
      console.error('[push] disable failed:', e)
    } finally {
      setPushBusy(false)
    }
  }

  const sendReply = async (ticketId: string, status: string) => {
    setReplying(ticketId)
    const reply = replyDraft[ticketId] ?? ''
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ ticketId, status, reply }),
    })
    setReplying(null)
    if (res.ok) loadData()
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg))]">
      <div className="w-8 h-8 border-4 border-[rgb(var(--accent))] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!authed) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-[rgb(var(--bg))]">
      <div className="text-5xl">🔒</div>
      <p className="font-bold text-base text-[rgb(var(--text))]">Admin access unavailable</p>
      <p className="text-sm max-w-sm text-[rgb(var(--muted))]">{authError ?? 'Something went wrong loading the admin panel.'}</p>
      <div className="flex gap-2 mt-2">
        <button onClick={loadData} className="btn-ghost">🔄 Try again</button>
        <button onClick={() => router.push('/')} className="btn-ghost text-[rgb(var(--accent))]">← Back home</button>
      </div>
    </div>
  )

  const openTicketCount = tickets.filter(t => t.status === 'open').length

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users',    label: 'Users',    icon: '👥' },
    { id: 'subs',     label: 'Plans',    icon: '💳' },
    { id: 'data',     label: 'Data',     icon: '🗄️' },
    { id: 'tickets',  label: `Tickets${openTicketCount>0?` · ${openTicketCount}`:''}`, icon: '🆘' },
    { id: 'info',     label: 'Info',     icon: 'ℹ️' },
  ]

  const card = (label: string, val: string | number, sub?: string, color = 'text-[rgb(var(--accent))]') => (
    <div key={label} className="card p-4 text-center">
      <p className={`text-3xl font-black tabular-nums ${color}`} style={displayFont}>{typeof val === 'number' ? val.toLocaleString() : val}</p>
      <p className="text-xs mt-1 text-[rgb(var(--muted))]">{label}</p>
      {sub && <p className="text-[10px] mt-0.5 text-[rgb(var(--muted))] opacity-70">{sub}</p>}
    </div>
  )

  const row = (label: string, val: string | number, color = '') => (
    <div key={label} className="card px-4 py-3 flex items-center justify-between">
      <p className="text-sm text-[rgb(var(--muted))]">{label}</p>
      <p className={`text-sm font-black tabular-nums ${color || 'text-[rgb(var(--text))]'}`}>{typeof val === 'number' ? val.toLocaleString() : val}</p>
    </div>
  )

  const planBadgeClass = (plan: string) =>
    plan === 'pro'      ? 'badge-amber' :
    plan === 'lifetime' ? 'badge-purple' :
    plan === 'trial'    ? 'badge-blue' : 'badge-gray'

  const ticketBadgeClass = (status: string) =>
    status === 'resolved'    ? 'badge-green' :
    status === 'in_progress' ? 'badge-amber' : 'badge-red'

  return (
    <div className="min-h-screen pb-16 bg-[rgb(var(--bg))] text-[rgb(var(--text))]">

      {/* Command-bar hero — MRR is the north star metric for this dashboard */}
      <div className={`px-4 pt-5 pb-5 ${isDark ? 'hero-dark' : 'hero-light'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--accent2))] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[rgb(var(--accent2))]" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
              {lastRefresh ? `Live · updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadData} disabled={loading}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/70 border border-white/15 hover:bg-white/10 disabled:opacity-40 transition">
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            <button onClick={() => router.push('/')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/70 border border-white/15 hover:bg-white/10 transition">
              ← Back
            </button>
          </div>
        </div>

        <p className="text-4xl font-black text-white tabular-nums" style={displayFont}>
          {metrics ? `₹${metrics.mrrEstimate.toLocaleString()}` : '—'}
        </p>
        <p className="text-[11px] uppercase tracking-widest text-white/50 mt-1 mb-4">Monthly recurring revenue</p>

        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: 'Users',   val: metrics?.totalUsers,  tab: 'users'   as Tab },
            { label: 'Pro',     val: metrics?.proUsers,    tab: 'subs'    as Tab },
            { label: 'Trial',   val: metrics?.trialUsers,  tab: 'subs'    as Tab },
            { label: 'Tickets', val: openTicketCount,      tab: 'tickets' as Tab },
          ].map(chip => (
            <button key={chip.label} onClick={() => setTab(chip.tab)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/90 border border-white/10 hover:bg-white/15 transition">
              {chip.val ?? '—'} <span className="text-white/50 font-medium">{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Segmented tab nav */}
      <div className="sticky top-0 z-40 px-4 py-2.5 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
              className={`flex-shrink-0 chip ${tab === tabItem.id ? 'chip-active' : 'chip-idle'}`}>
              <span className="mr-1">{tabItem.icon}</span>{tabItem.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* Overview */}
        {tab === 'overview' && (<>
          <p className="section-header">Users</p>
          <div className="grid grid-cols-2 gap-3">
            {card('Total Users',    metrics?.totalUsers        ?? '—', undefined,       'text-[rgb(var(--accent))]')}
            {card('New This Month', metrics?.newUsersThisMonth ?? '—', undefined,       'text-[rgb(var(--success))]')}
            {card('New This Week',  metrics?.newUsersThisWeek  ?? '—', undefined,       'text-[rgb(var(--info))]')}
            {card('PWA Installs',   metrics?.pwaInstalls       ?? '—', 'App installed', 'text-purple-400')}
          </div>

          <p className="section-header pt-2">Engagement</p>
          <div className="grid grid-cols-3 gap-3">
            {card('DAU', metrics?.dauCount ?? '—', 'Active today', 'text-[rgb(var(--success))]')}
            {card('WAU', metrics?.wauCount ?? '—', 'Last 7 days',  'text-[rgb(var(--info))]')}
            {card('MAU', metrics?.mauCount ?? '—', 'Last 30 days', 'text-[rgb(var(--accent))]')}
          </div>

          <p className="section-header pt-2">Revenue</p>
          <div className="grid grid-cols-2 gap-3">
            {card('MRR (est.)', metrics ? `₹${metrics.mrrEstimate.toLocaleString()}` : '—', 'Pro users, cycle-weighted', 'text-[rgb(var(--success))]')}
            {card('Pro Users',  metrics?.proUsers ?? '—', 'Paying', 'text-[rgb(var(--accent))]')}
          </div>

          <p className="section-header pt-2">Conversion Funnel</p>
          <div className="space-y-2">
            {[
              { label: 'Total signups',                  val: metrics?.totalUsers    ?? 0, color: 'text-[rgb(var(--text))]' },
              { label: 'On free trial',                  val: metrics?.trialUsers    ?? 0, color: 'text-[rgb(var(--info))]' },
              { label: 'Trial expired (not converted)',  val: metrics?.expiredTrials ?? 0, color: 'text-[rgb(var(--danger))]' },
              { label: 'Converted → Pro',                val: metrics?.proUsers      ?? 0, color: 'text-[rgb(var(--success))]' },
              { label: 'Lifetime access',                val: metrics?.lifetimeUsers ?? 0, color: 'text-purple-400' },
            ].map(({ label, val, color }) => {
              const pct = metrics?.totalUsers ? Math.round((val / metrics.totalUsers) * 100) : 0
              return (
                <div key={label} className="card px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-[rgb(var(--muted))]">{label}</p>
                    <p className={`text-sm font-black ${color}`}>{val} <span className="text-[10px] font-normal text-[rgb(var(--muted))] opacity-70">({pct}%)</span></p>
                  </div>
                  <div className="h-1.5 rounded-full bg-[rgb(var(--border))] overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent2)))' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>)}

        {/* Users tab — now shows email */}
        {tab === 'users' && (<>
          <p className="section-header">{users.length} registered users</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-[rgb(var(--accent))] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm py-8 text-[rgb(var(--muted))]">No users yet.</p>
          ) : (
            <div className="space-y-2">
              {users
                .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
                .map(u => {
                  const sub = subs.find(s => s.user_id === u.id)
                  return (
                    <div key={u.id} className="card px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* Email — prominent */}
                        <p className="text-sm font-semibold truncate flex-1 text-[rgb(var(--text))]">{u.email}</p>
                        <span className={`${planBadgeClass(sub?.plan ?? 'free')} flex-shrink-0`}>
                          {sub?.plan ?? 'no sub'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-[rgb(var(--muted))] opacity-70">
                          Joined {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '?'}
                        </p>
                        <p className="text-[10px] text-[rgb(var(--muted))] opacity-70">
                          Last seen {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-IN') : 'never'}
                        </p>
                      </div>
                      {sub?.trial_ends_at && (
                        <p className="text-[10px] text-[rgb(var(--info))] mt-0.5">
                          Trial ends {new Date(sub.trial_ends_at).toLocaleDateString('en-IN')}
                        </p>
                      )}
                      {sub?.current_period_end && sub?.plan === 'pro' && (
                        <p className="text-[10px] text-[rgb(var(--accent))] mt-0.5">
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
          <p className="section-header">Plan Distribution</p>
          <div className="grid grid-cols-2 gap-3">
            {card('Free',     metrics?.freeUsers     ?? '—', undefined, 'text-[rgb(var(--muted))]')}
            {card('Trial',    metrics?.trialUsers    ?? '—', undefined, 'text-[rgb(var(--info))]')}
            {card('Pro',      metrics?.proUsers      ?? '—', undefined, 'text-[rgb(var(--accent))]')}
            {card('Lifetime', metrics?.lifetimeUsers ?? '—', undefined, 'text-purple-400')}
          </div>

          <p className="section-header pt-2">Revenue Metrics</p>
          <div className="space-y-2">
            {row('MRR (estimated)',   metrics ? `₹${metrics.mrrEstimate.toLocaleString()}` : '—', 'text-[rgb(var(--success))]')}
            {row('ARR (estimated)',   metrics ? `₹${(metrics.mrrEstimate * 12).toLocaleString()}` : '—', 'text-[rgb(var(--success))]')}
            {row('ARPU',             metrics?.proUsers ? `₹${Math.round(metrics.mrrEstimate / metrics.proUsers).toLocaleString()}/mo` : '—', 'text-[rgb(var(--accent))]')}
            {row('Expired trials (churn risk)', metrics?.expiredTrials ?? '—', 'text-[rgb(var(--danger))]')}
          </div>
        </>)}

        {/* Data tab */}
        {tab === 'data' && (<>
          <p className="section-header">Platform Data (all users)</p>
          <div className="grid grid-cols-2 gap-3">
            {card('Workers',      metrics?.totalWorkers    ?? '—', undefined, 'text-[rgb(var(--success))]')}
            {card('Sites',        metrics?.totalSites      ?? '—', undefined, 'text-[rgb(var(--info))]')}
            {card('Attendance',   metrics?.totalAttendance ?? '—', undefined, 'text-purple-400')}
            {card('PWA Installs', metrics?.pwaInstalls     ?? '—', undefined, 'text-[rgb(var(--accent))]')}
          </div>
        </>)}

        {/* Tickets tab */}
        {tab === 'tickets' && (<>
          <p className="section-header">{tickets.length} support tickets · {openTicketCount} open</p>
          {tickets.length === 0 ? (
            <p className="text-center text-sm py-8 text-[rgb(var(--muted))]">No tickets yet.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map(tk => (
                <div key={tk.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate text-[rgb(var(--text))]">{tk.subject}</p>
                      <p className="text-[10px] text-[rgb(var(--muted))]">{tk.user_email} · {tk.category}</p>
                    </div>
                    <span className={`${ticketBadgeClass(tk.status)} flex-shrink-0`}>{tk.status}</span>
                  </div>
                  <p className="text-xs mb-2 text-[rgb(var(--muted))]">{tk.message}</p>
                  <p className="text-[10px] mb-2 text-[rgb(var(--muted))] opacity-70">
                    {new Date(tk.created_at).toLocaleString('en-IN')}
                  </p>
                  <textarea
                    value={replyDraft[tk.id] ?? tk.admin_reply ?? ''}
                    onChange={e => setReplyDraft({ ...replyDraft, [tk.id]: e.target.value })}
                    placeholder="Type a reply to the user..."
                    rows={2}
                    className="input mb-2 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => sendReply(tk.id, 'in_progress')} disabled={replying===tk.id}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[rgba(var(--accent),0.1)] text-[rgb(var(--accent))] border border-[rgba(var(--accent),0.2)] disabled:opacity-40 transition">
                      Mark In Progress
                    </button>
                    <button onClick={() => sendReply(tk.id, 'resolved')} disabled={replying===tk.id}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[rgba(var(--success),0.1)] text-[rgb(var(--success))] border border-[rgba(var(--success),0.2)] disabled:opacity-40 transition">
                      {replying===tk.id ? 'Saving...' : 'Reply & Resolve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* Info tab */}
        {tab === 'info' && (
          <div className="space-y-2">
            <div className="card gold-glow-sm p-4 mb-2">
              <p className="text-sm font-bold mb-1 text-[rgb(var(--text))]">🔔 Push notifications</p>
              <p className="text-xs mb-3 text-[rgb(var(--muted))]">
                Get notified on this device for installs, signups, payments, cancellations, and support tickets — even if the app is closed.
              </p>
              {pushStatus === 'unsupported' && (
                <p className="text-xs text-[rgb(var(--muted))]">Not supported in this browser. Install the app to your home screen first, then open it from there.</p>
              )}
              {pushStatus === 'denied' && (
                <p className="text-xs text-[rgb(var(--accent))]">Notifications are blocked for this site. Enable them in your browser/phone settings, then reload this page.</p>
              )}
              {(pushStatus === 'subscribed') && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[rgb(var(--success))]">✓ Enabled on this device</span>
                  <button onClick={disablePush} disabled={pushBusy} className="btn-ghost btn-sm">
                    {pushBusy ? '...' : 'Turn off'}
                  </button>
                </div>
              )}
              {pushStatus === 'unsubscribed' && (
                <button onClick={enablePush} disabled={pushBusy} className="btn-primary btn-sm">
                  {pushBusy ? 'Enabling...' : '🔔 Enable on this device'}
                </button>
              )}
            </div>

            {[
              { label: 'Admin Auth',  val: 'Server-side (ADMIN_EMAIL env var, not client-exposed)' },
              { label: 'App Version', val: 'v1.0.0' },
              { label: 'Framework',   val: 'Next.js 15' },
              { label: 'Database',    val: 'Supabase (PostgreSQL)' },
              { label: 'Auth',        val: 'Google OAuth (PKCE)' },
              { label: 'Hosting',     val: 'Vercel' },
              { label: 'Pricing',     val: `${PRICING.monthly.label_en} or ${PRICING.yearly.label_en} · 30-day free trial` },
            ].map(({ label, val }) => row(label, val))}
          </div>
        )}

      </div>
    </div>
  )
}

export default function Admin() {
  return (
    <Suspense fallback={null}>
      <AdminPage />
    </Suspense>
  )
}
