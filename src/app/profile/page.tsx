'use client'
import { useEffect, useState } from 'react'
import AppShell, { useLang, useTheme, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import { useRouter } from 'next/navigation'

interface Stats {
  workers: number; sites: number; attendance: number
  suppliers: number; privateWorkers: number
}

// ── Subscription types ────────────────────────────────────────────────────────
// Plan field mirrors what will be stored in the subscriptions table.
// For now the app is fully free — this UI is ready for when billing is wired up.
type Plan = 'free' | 'pro' | 'lifetime'

interface SubInfo {
  plan: Plan
  trialEndsAt: string | null   // ISO date string, null if not on trial
  renewsAt: string | null       // ISO date string for next billing date
}

function ProfilePage() {
  const { lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [user,  setUser]  = useState<{ name: string; email: string; avatar?: string } | null>(null)
  const [stats, setStats] = useState<Stats>({ workers:0, sites:0, attendance:0, suppliers:0, privateWorkers:0 })
  const [sub,   setSub]   = useState<SubInfo>({ plan:'free', trialEndsAt: null, renewsAt: null })
  const [loading, setLoading] = useState(true)
  const [showSignOut, setShowSignOut] = useState(false)

  const { showToast } = useToast()

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        const raw = u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? 'User'
        setUser({
          name:   raw,
          email:  u.email ?? '',
          avatar: u.user_metadata?.avatar_url,
        })

        // Load stats + subscription in parallel
        const [{ count: w },{ count: s },{ count: a },{ count: su },{ count: pw }, subResult] = await Promise.all([
          supabase.from('workers').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          supabase.from('sites').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          supabase.from('attendance').select('id',{count:'exact',head:true}).eq('user_id', u.id),
          supabase.from('suppliers').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          supabase.from('private_workers').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          // subscriptions table — safe to attempt even if table doesn't exist yet
          supabase.from('subscriptions').select('plan,status,trial_ends_at,current_period_end').eq('user_id', u.id).maybeSingle(),
        ])
        setStats({ workers:w??0, sites:s??0, attendance:a??0, suppliers:su??0, privateWorkers:pw??0 })

        // Map subscription row to local UI state
        const row = (subResult as { data?: { plan?: string; status?: string; trial_ends_at?: string; current_period_end?: string } | null }).data
        if (row) {
          setSub({
            plan: (row.plan as Plan) ?? 'free',
            trialEndsAt: row.trial_ends_at ?? null,
            renewsAt: row.current_period_end ?? null,
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const exportData = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    const [{ data: workers },{ data: sites },{ data: att }] = await Promise.all([
      supabase.from('workers').select('*').eq('user_id', u.id).is('deleted_at',null),
      supabase.from('sites').select('*').eq('user_id', u.id).is('deleted_at',null),
      supabase.from('attendance').select('*').eq('user_id', u.id),
    ])
    const blob = new Blob([JSON.stringify({ workers, sites, attendance: att, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `cm-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
    showToast('Backup downloaded!')
  }

  // ── Subscription display helpers ──────────────────────────────────────────
  const planLabel = (p: Plan) => p === 'lifetime' ? (lang==='te'?'లైఫ్‌టైమ్':'Lifetime Free') : p === 'pro' ? (lang==='te'?'ప్రో ప్లాన్':'Pro Plan') : (lang==='te'?'ఫ్రీ ప్లాన్':'Free Plan')
  const planColor = (p: Plan): { bg: string; text: string; border: string } => {
    if (p === 'lifetime') return { bg:'rgba(139,92,246,0.12)', text:'#7c3aed', border:'rgba(139,92,246,0.3)' }
    if (p === 'pro')      return { bg:'rgba(var(--accent),0.12)', text:'rgb(var(--accent))', border:'rgba(var(--accent),0.3)' }
    return { bg:'rgba(100,116,139,0.1)', text:'rgb(var(--muted))', border:'rgba(100,116,139,0.2)' }
  }
  const planIcon = (p: Plan) => p === 'lifetime' ? '♾️' : p === 'pro' ? '⭐' : '🏗️'

  const trialDaysLeft = sub.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
    </div>
  )

  const pc = planColor(sub.plan)

  return (
    <div className="page px-4 pt-4 pb-24">

      {/* ── Profile Card ─────────────────────────────────────────────────────── */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-4">
          {/* Google avatar or initials fallback */}
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{background:'rgba(var(--accent),0.15)',color:'rgb(var(--accent))'}}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-black text-lg truncate" style={{color:'rgb(var(--text))'}}>{user?.name}</p>
            <p className="text-sm truncate mb-1" style={{color:'rgb(var(--muted))'}}>{user?.email}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold inline-block"
              style={{background: pc.bg, color: pc.text, border:`1px solid ${pc.border}`}}>
              {planIcon(sub.plan)} {planLabel(sub.plan)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Subscription Card ────────────────────────────────────────────────── */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {lang==='te'?'సబ్‌స్క్రిప్షన్':'Subscription'}
      </p>
      <div className="card mb-4 overflow-hidden" style={{border:`1px solid ${pc.border}`}}>
        {/* Plan row */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{background: pc.bg}}>
              {planIcon(sub.plan)}
            </div>
            <div>
              <p className="font-black text-sm" style={{color: pc.text}}>{planLabel(sub.plan)}</p>
              <p className="text-xs" style={{color:'rgb(var(--muted))'}}>
                {sub.plan === 'free' && !sub.trialEndsAt && (lang==='te'?'అన్ని ఫీచర్లు అందుబాటులో ఉన్నాయి':'All features available')}
                {sub.plan === 'lifetime' && (lang==='te'?'ఎప్పటికీ ఉచితం':'Free forever · No billing')}
                {sub.plan === 'pro' && sub.renewsAt && `${lang==='te'?'తదుపరి చెల్లింపు':'Renews'} ${new Date(sub.renewsAt).toLocaleDateString()}`}
                {sub.plan === 'pro' && !sub.renewsAt && (lang==='te'?'యాక్టివ్':'Active')}
              </p>
            </div>
          </div>
          {/* Upgrade CTA — shown only on free plan */}
          {sub.plan === 'free' && (
            <div
              className="px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{background:'rgba(var(--accent),0.12)',color:'rgb(var(--accent))',border:'1px solid rgba(var(--accent),0.25)'}}>
              {lang==='te'?'త్వరలో':'Coming soon'}
            </div>
          )}
        </div>

        {/* Trial banner */}
        {sub.trialEndsAt && trialDaysLeft !== null && (
          <div
            className="mx-4 mb-4 px-4 py-3 rounded-xl"
            style={{background: trialDaysLeft <= 3 ? 'rgba(220,38,38,0.08)' : 'rgba(var(--accent),0.08)', border:`1px solid ${trialDaysLeft <= 3 ? 'rgba(220,38,38,0.25)' : 'rgba(var(--accent),0.2)'}`}}>
            <p className="text-sm font-bold" style={{color: trialDaysLeft <= 3 ? '#dc2626' : 'rgb(var(--accent))'}}>
              {trialDaysLeft === 0
                ? (lang==='te'?'ట్రయల్ నేడు ముగుస్తుంది!':'Trial ends today!')
                : `${lang==='te'?'ట్రయల్ ముగుస్తుంది':'Trial ends in'} ${trialDaysLeft} ${lang==='te'?'రోజులలో':'days'}`}
            </p>
            <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>
              {lang==='te'?'అన్ని ఫీచర్లు ఉపయోగించవచ్చు':'Full access during trial'}
            </p>
          </div>
        )}

        {/* Pricing info row */}
        {sub.plan === 'free' && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{borderColor:'rgb(var(--border))'}}>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>
              {lang==='te'?'ప్రో ప్లాన్ ధర':'Pro plan pricing'}
            </p>
            <p className="text-sm font-black" style={{color:'rgb(var(--text))'}}>
              ₹200<span className="text-xs font-medium" style={{color:'rgb(var(--muted))'}}>/{lang==='te'?'నెల':'month'}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Usage Stats ──────────────────────────────────────────────────────── */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {lang==='te'?'మీ డేటా':'Your Data'}
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { emoji:'👷', label:lang==='te'?'కార్మికులు':'Workers',        val:stats.workers },
          { emoji:'🏗️', label:lang==='te'?'సైట్లు':'Sites',              val:stats.sites },
          { emoji:'📋', label:lang==='te'?'హాజరు':'Attendance',           val:stats.attendance },
          { emoji:'🏪', label:lang==='te'?'సరఫరాదారులు':'Suppliers',      val:stats.suppliers },
          { emoji:'🔧', label:lang==='te'?'కాంట్రాక్టర్లు':'Contractors', val:stats.privateWorkers },
          { emoji:'📊', label:lang==='te'?'మొత్తం':'Total',              val:stats.workers+stats.sites+stats.attendance+stats.suppliers+stats.privateWorkers },
        ].map(({ emoji, label, val }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-xl">{emoji}</p>
            <p className="font-black text-lg" style={{color:'rgb(var(--accent))'}}>{val}</p>
            <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Settings ─────────────────────────────────────────────────────────── */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {ts(lang,'settings')}
      </p>
      <div className="card mb-4 overflow-hidden">
        {/* Theme */}
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b transition hover:opacity-80"
          style={{borderColor:'rgb(var(--border))'}}>
          <span className="text-xl">{theme==='dark'?'☀️':'🌙'}</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{color:'rgb(var(--text))'}}>{theme==='dark'?ts(lang,'lightMode'):ts(lang,'darkMode')}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'ప్రస్తుతం:':'Currently:'} {theme==='dark'?(lang==='te'?'డార్క్':'Dark'):(lang==='te'?'లైట్':'Light')}</p>
          </div>
          <span style={{color:'rgb(var(--muted))'}}>›</span>
        </button>

        {/* Language */}
        <button onClick={toggleLang}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b transition hover:opacity-80"
          style={{borderColor:'rgb(var(--border))'}}>
          <span className="text-xl">🌐</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{color:'rgb(var(--text))'}}>{ts(lang,'language')}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='en'?'English → తెలుగు':'తెలుగు → English'}</p>
          </div>
          <span style={{color:'rgb(var(--muted))'}}>›</span>
        </button>

        {/* Export / Backup */}
        <button onClick={exportData}
          className="w-full flex items-center gap-3 px-4 py-3.5 transition hover:opacity-80">
          <span className="text-xl">💾</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{color:'rgb(var(--text))'}}>{lang==='te'?'డేటా బ్యాకప్':'Backup Data'}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'JSON ఫైల్ డౌన్లోడ్ చేయి':'Download as JSON file'}</p>
          </div>
          <span style={{color:'rgb(var(--muted))'}}>›</span>
        </button>
      </div>

      {/* ── Sign Out ─────────────────────────────────────────────────────────── */}
      <button onClick={() => setShowSignOut(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition"
        style={{background:'rgba(185,28,28,0.1)',color:'#b91c1c',border:'1px solid rgba(185,28,28,0.2)'}}>
        🚪 {ts(lang,'signOut')}
      </button>

      {/* Sign out confirm */}
      {showSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{background:'rgba(0,0,0,0.6)'}}>
          <div className="card p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-3">🚪</p>
            <p className="font-black text-lg mb-2" style={{color:'rgb(var(--text))'}}>{lang==='te'?'లాగ్అవుట్ అవుతారా?':'Sign out?'}</p>
            <p className="text-sm mb-5" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'మీ డేటా సురక్షితంగా ఉంటుంది.':'Your data stays safe.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowSignOut(false)} className="btn-ghost py-3">{ts(lang,'cancel')}</button>
              <button onClick={signOut} className="py-3 rounded-xl font-bold text-white" style={{background:'#b91c1c'}}>{ts(lang,'signOut')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Profile() { return <AppShell><ProfilePage /></AppShell> }
