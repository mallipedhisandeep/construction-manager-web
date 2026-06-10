'use client'
import { useEffect, useState } from 'react'
import AppShell, { useLang, useTheme } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import { useRouter } from 'next/navigation'

interface Stats {
  workers: number; sites: number; attendance: number
  suppliers: number; privateWorkers: number
}

function ProfilePage() {
  const { lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [user,  setUser]  = useState<{ name: string; email: string; avatar?: string } | null>(null)
  const [stats, setStats] = useState<Stats>({ workers:0, sites:0, attendance:0, suppliers:0, privateWorkers:0 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showSignOut, setShowSignOut] = useState(false)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

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
        // Load stats
        const [{ count: w },{ count: s },{ count: a },{ count: su },{ count: pw }] = await Promise.all([
          supabase.from('workers').select('id',{count:'exact',head:true}).is('deleted_at',null),
          supabase.from('sites').select('id',{count:'exact',head:true}).is('deleted_at',null),
          supabase.from('attendance').select('id',{count:'exact',head:true}),
          supabase.from('suppliers').select('id',{count:'exact',head:true}).is('deleted_at',null),
          supabase.from('private_workers').select('id',{count:'exact',head:true}).is('deleted_at',null),
        ])
        setStats({ workers:w??0, sites:s??0, attendance:a??0, suppliers:su??0, privateWorkers:pw??0 })
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
      supabase.from('workers').select('*').is('deleted_at',null),
      supabase.from('sites').select('*').is('deleted_at',null),
      supabase.from('attendance').select('*'),
    ])
    const blob = new Blob([JSON.stringify({ workers, sites, attendance: att, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `cm-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
    showToast('Backup downloaded!')
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
    </div>
  )

  return (
    <div className="page px-4 pt-4 pb-24">
      {toast && <div className="fixed top-16 right-4 z-50 bg-green-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg">{toast}</div>}

      {/* Profile Card */}
      <div className="card p-5 mb-4 flex items-center gap-4">
        {user?.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"/>
        ) : (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
            style={{background:'rgba(var(--accent),0.15)',color:'rgb(var(--accent))'}}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-black text-lg truncate" style={{color:'rgb(var(--text))'}}>{user?.name}</p>
          <p className="text-sm truncate" style={{color:'rgb(var(--muted))'}}>{user?.email}</p>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block"
            style={{background:'rgba(var(--accent),0.12)',color:'rgb(var(--accent))'}}>
            🏗️ {lang==='te'?'ఫ్రీ ప్లాన్':'Free Plan'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {lang==='te'?'మీ డేటా':'Your Data'}
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { emoji:'👷', label:lang==='te'?'కార్మికులు':'Workers',     val:stats.workers },
          { emoji:'🏗️', label:lang==='te'?'సైట్లు':'Sites',           val:stats.sites },
          { emoji:'📋', label:lang==='te'?'హాజరు':'Attendance',        val:stats.attendance },
          { emoji:'🏪', label:lang==='te'?'సరఫరాదారులు':'Suppliers',   val:stats.suppliers },
          { emoji:'🔧', label:lang==='te'?'కాంట్రాక్టర్లు':'Contractors', val:stats.privateWorkers },
          { emoji:'📊', label:lang==='te'?'మొత్తం':'Total',            val:stats.workers+stats.sites+stats.attendance+stats.suppliers+stats.privateWorkers },
        ].map(({ emoji, label, val }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-xl">{emoji}</p>
            <p className="font-black text-lg" style={{color:'rgb(var(--accent))'}}>{val}</p>
            <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{label}</p>
          </div>
        ))}
      </div>

      {/* Settings */}
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

      {/* Plan info */}
      <div className="card p-4 mb-4" style={{border:'1px solid rgba(var(--accent),0.3)',background:'rgba(var(--accent),0.06)'}}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <p className="font-bold" style={{color:'rgb(var(--text))'}}>{lang==='te'?'ఫ్రీ ప్లాన్':'Free Plan'}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'అన్ని ఫీచర్లు అందుబాటులో ఉన్నాయి':'All features available · Unlimited records'}</p>
          </div>
        </div>
      </div>

      {/* Sign Out */}
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
