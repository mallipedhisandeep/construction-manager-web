'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface Ticket {
  id: string; subject: string; message: string; status: string
  admin_reply: string | null; created_at: string
}

const CATEGORIES = [
  { key: 'bug',     en: 'Bug / Something broken', te: 'బగ్ / పని చేయడం లేదు' },
  { key: 'billing', en: 'Billing / Payment',       te: 'బిల్లింగ్ / చెల్లింపు' },
  { key: 'data',    en: 'Data issue',              te: 'డేటా సమస్య' },
  { key: 'other',   en: 'Other',                   te: 'ఇతరం' },
]

function SupportPage() {
  const { lang } = useLang()
  const te = lang === 'te'
  const router = useRouter()
  const { showToast: _showToast } = useToast()
  const showToast = (msg: string, ok = true) => _showToast(msg, ok ? 'ok' : 'err')

  const [tickets,  setTickets]  = useState<Ticket[]>([])
  const [loading,  setLoading]  = useState(true)
  const [category, setCategory] = useState('bug')
  const [subject,  setSubject]  = useState('')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const userId = await uid()
    if (!userId) { setLoading(false); return }
    const { data } = await supabase.from('support_tickets')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false })
    setTickets(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      showToast(te ? 'వివరాలు పూరించండి' : 'Please fill in all fields', false)
      return
    }
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }

    const { error } = await supabase.from('support_tickets').insert({
      user_id:    user.id,
      user_email: user.email,
      category,
      subject:    subject.trim(),
      message:    message.trim(),
      status:     'open',
    })
    setSending(false)
    if (error) { showToast(error.message, false); return }
    setSubject(''); setMessage('')
    showToast(te ? 'పంపబడింది! త్వరలో సంప్రదిస్తాం.' : 'Sent! We\'ll get back to you soon.')
    load()
  }

  const statusColor = (s: string) =>
    s === 'resolved' ? { bg:'rgba(22,163,74,0.1)', text:'#15803d' } :
    s === 'in_progress' ? { bg:'rgba(212,140,40,0.1)', text:'#d48c28' } :
    { bg:'rgba(100,116,139,0.1)', text:'rgb(var(--muted))' }

  const statusLabel = (s: string) => {
    if (s === 'resolved')    return te ? 'పరిష్కరించబడింది' : 'Resolved'
    if (s === 'in_progress') return te ? 'పరిశీలనలో' : 'In Progress'
    return te ? 'తెరిచి ఉంది' : 'Open'
  }

  return (
    <div className="page px-4 pt-4 pb-24">

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/profile')} className="text-2xl" style={{color:'rgb(var(--muted))'}}>‹</button>
        <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>
          🆘 {te ? 'సహాయం & మద్దతు' : 'Help & Support'}
        </h1>
      </div>

      {/* New ticket form */}
      <div className="card p-4 mb-5">
        <p className="text-sm font-bold mb-3" style={{color:'rgb(var(--text))'}}>
          {te ? 'కొత్త సమస్యను నివేదించండి' : 'Report a new issue'}
        </p>

        <label className="label">{te ? 'వర్గం' : 'Category'}</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className="py-2 px-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: category===c.key ? 'rgb(var(--accent))' : 'rgb(var(--surface2))',
                color:      category===c.key ? '#fff' : 'rgb(var(--text))',
                border:     `1px solid ${category===c.key ? 'transparent' : 'rgb(var(--border))'}`,
              }}>
              {te ? c.te : c.en}
            </button>
          ))}
        </div>

        <label className="label">{te ? 'విషయం' : 'Subject'}</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} className="input mb-3"
          placeholder={te ? 'సమస్యను ఒక్క వాక్యంలో చెప్పండి' : 'Briefly describe the issue'} />

        <label className="label">{te ? 'వివరాలు' : 'Details'}</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="input resize-none mb-3"
          placeholder={te ? 'ఏమి జరిగింది? ఎప్పుడు జరిగింది?' : 'What happened? When did it happen?'} />

        <button onClick={submit} disabled={sending} className="btn-primary w-full py-3 font-bold disabled:opacity-50">
          {sending ? (te ? '⏳ పంపుతోంది...' : '⏳ Sending...') : (te ? '📨 పంపండి' : '📨 Submit')}
        </button>
      </div>

      {/* Past tickets */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {te ? 'మీ గత నివేదికలు' : 'Your past reports'}
      </p>
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}} />
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-center text-sm py-8" style={{color:'rgb(var(--muted))'}}>
          {te ? 'ఇంకా నివేదికలు లేవు' : 'No reports yet'}
        </p>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const sc = statusColor(t.status)
            return (
              <div key={t.id} className="card p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold flex-1" style={{color:'rgb(var(--text))'}}>{t.subject}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{background:sc.bg, color:sc.text}}>
                    {statusLabel(t.status)}
                  </span>
                </div>
                <p className="text-xs mb-1" style={{color:'rgb(var(--muted))'}}>{t.message}</p>
                <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>
                  {new Date(t.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                </p>
                {t.admin_reply && (
                  <div className="mt-2 pt-2 border-t rounded-lg px-2 py-1.5" style={{borderColor:'rgb(var(--border))', background:'rgba(var(--accent),0.06)'}}>
                    <p className="text-[10px] font-bold mb-0.5" style={{color:'rgb(var(--accent))'}}>
                      {te ? '↪️ మద్దతు బృందం:' : '↪️ Support team:'}
                    </p>
                    <p className="text-xs" style={{color:'rgb(var(--text))'}}>{t.admin_reply}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Support() { return <AppShell><SupportPage /></AppShell> }
