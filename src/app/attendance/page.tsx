'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts, MONTHS } from '@/lib/strings'
import type { Worker, Attendance, Site } from '@/lib/types'

// ── Shift config ──────────────────────────────────────────────────────────────
const SHIFTS = ['6-6','10-6','6-10','6-2','10-2','2-6','Absent'] as const
type Shift = typeof SHIFTS[number]
const SHIFT_LABEL: Record<Shift,string> = {
  '6-6':'6AM–6PM','10-6':'10AM–6PM','6-10':'6AM–9AM',
  '6-2':'6AM–2PM','10-2':'10AM–2PM','2-6':'3PM–6PM','Absent':'Absent',
}
const SHIFT_BG: Record<Shift,string> = {
  '6-6':'#16a34a','10-6':'#0d9488','6-10':'#2563eb',
  '6-2':'#7c3aed','10-2':'#db2777','2-6':'#0891b2','Absent':'#dc2626',
}

const pad = (n: number) => String(n).padStart(2, '0')

function AttendancePage() {
  const { lang } = useLang()
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [day,   setDay]   = useState(now.getDate())

  const [workers,    setWorkers]    = useState<Worker[]>([])
  const [sites,      setSites]      = useState<Pick<Site,'id'|'site_name'>[]>([])
  const [attMap,     setAttMap]     = useState<Record<string, Attendance>>({})
  const [markedDays, setMarkedDays] = useState<Record<string,'full'|'partial'|'absent'>>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<{msg:string;ok:boolean}|undefined>()

  // ── Modal state — one per worker, includes per-worker site ────────────────
  const [modal,      setModal]      = useState<Worker | null>(null)
  const [shiftPick,  setShiftPick]  = useState<Shift>('6-6')
  const [advInput,   setAdvInput]   = useState('')
  const [modalSite,  setModalSite]  = useState('')   // per-worker site selection

  // ── Summary state ─────────────────────────────────────────────────────────
  const [view,       setView]       = useState<'day'|'summary'>('day')
  const [sumWorker,  setSumWorker]  = useState<Worker|null>(null)
  const [sumRecords, setSumRecords] = useState<Attendance[]>([])
  const [sumLoading, setSumLoading] = useState(false)

  const months      = MONTHS[lang]
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dKey        = `${year}-${pad(month+1)}-${pad(day)}`

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(undefined), 3000)
  }

  // ── Rate helpers ─────────────────────────────────────────────────────────
  const rateKey = (s: Shift): keyof Worker => {
    const m: Record<Shift,keyof Worker> = {
      '6-6':'rate_6_6','10-6':'rate_10_6','6-10':'rate_6_10',
      '6-2':'rate_6_2','10-2':'rate_10_2','2-6':'rate_2_6','Absent':'rate_6_6',
    }
    return m[s]
  }
  const wage = (w: Worker, s: Shift) => s === 'Absent' ? 0 : ((w[rateKey(s)] as number) ?? 0)

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadBase = useCallback(async () => {
    const [{ data: ws }, { data: si }] = await Promise.all([
      supabase.from('workers').select('*').is('deleted_at', null).order('work_type').order('name'),
      supabase.from('sites').select('id,site_name').eq('status','Active').is('deleted_at',null).order('site_name'),
    ])
    setWorkers(ws ?? [])
    setSites(si ?? [])
  }, [])

  const loadDay = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('attendance').select('*').eq('date_key', dKey)
    const m: Record<string, Attendance> = {}
    data?.forEach(a => { m[a.worker_id] = a })
    setAttMap(m)
    setLoading(false)
  }, [dKey])

  const loadMonthMarks = useCallback(async () => {
    const start = `${year}-${pad(month+1)}-01`
    const end   = month === 11 ? `${year+1}-01-01` : `${year}-${pad(month+2)}-01`
    const { data } = await supabase.from('attendance')
      .select('date_key,attendance_type')
      .gte('date_key', start).lt('date_key', end)
    if (!data) return
    const byDay: Record<string, string[]> = {}
    data.forEach(a => { byDay[a.date_key] = byDay[a.date_key] ?? []; byDay[a.date_key].push(a.attendance_type) })
    const result: typeof markedDays = {}
    Object.entries(byDay).forEach(([dk, types]) => {
      const hasPresent = types.some(t => t !== 'Absent')
      const hasAbsent  = types.some(t => t === 'Absent')
      result[dk] = hasPresent ? (hasAbsent ? 'partial' : 'full') : 'absent'
    })
    setMarkedDays(result)
  }, [year, month])

  useEffect(() => { loadBase() },       [loadBase])
  useEffect(() => { loadDay() },        [loadDay])
  useEffect(() => { loadMonthMarks() }, [loadMonthMarks])

  // ── Open modal — pre-fill with existing record including its site ─────────
  const openModal = (w: Worker) => {
    const existing = attMap[w.id!]
    setShiftPick((existing?.attendance_type as Shift) ?? '6-6')
    setAdvInput(existing?.advance?.toString() ?? '')
    // Pre-select the site this worker was already marked on (if any),
    // otherwise leave blank so the user picks the correct site.
    setModalSite(existing?.site_id ?? '')
    setModal(w)
  }

  // ── Save — uses per-worker modalSite ─────────────────────────────────────
  const saveOne = async () => {
    if (!modal) return
    setSaving(true)
    try {
      const userId = await uid()
      const existing = attMap[modal.id!]
      const payload = {
        worker_id:       modal.id!,
        date_key:        dKey,
        date:            new Date(year, month, day).toISOString(),
        attendance_type: shiftPick,
        wage:            wage(modal, shiftPick),
        advance:         parseFloat(advInput) || 0,
        site_id:         modalSite || null,   // ← per-worker site
        user_id:         userId,
      }
      const { error } = existing?.id
        ? await supabase.from('attendance').update(payload).eq('id', existing.id)
        : await supabase.from('attendance').insert(payload)
      if (error) throw error
      setModal(null)
      await loadDay()
      await loadMonthMarks()
      showToast('Saved!')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', false)
    } finally { setSaving(false) }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const openSummary = async (w: Worker) => {
    setSumWorker(w); setView('summary'); setSumRecords([]); setSumLoading(true)
    const start = `${year}-${pad(month+1)}-01`
    const end   = month === 11 ? `${year+1}-01-01` : `${year}-${pad(month+2)}-01`
    const { data } = await supabase.from('attendance').select('*')
      .eq('worker_id', w.id!).gte('date_key', start).lt('date_key', end).order('date_key')
    setSumRecords(data ?? [])
    setSumLoading(false)
  }

  // ── Sidebar dot colour ────────────────────────────────────────────────────
  const dotStyle = (d: number) => {
    const dk        = `${year}-${pad(month+1)}-${pad(d)}`
    const isToday   = d === now.getDate() && month === now.getMonth() && year === now.getFullYear()
    const isSel     = d === day
    const isWeekend = [0,6].includes(new Date(year, month, d).getDay())
    const mark      = markedDays[dk]
    if (isSel)               return { bg:'#d48c28',                    text:'#fff',                     dot:'' }
    if (mark === 'full')     return { bg:'rgba(22,163,74,0.18)',        text:'#4ade80',                  dot:'bg-green-500' }
    if (mark === 'partial')  return { bg:'rgba(234,162,32,0.18)',       text:'#fbbf24',                  dot:'bg-amber-400' }
    if (mark === 'absent')   return { bg:'rgba(220,38,38,0.12)',        text:'#f87171',                  dot:'bg-red-400' }
    if (isToday)             return { bg:'rgba(212,140,40,0.12)',       text:'#d48c28',                  dot:'' }
    if (isWeekend)           return { bg:'transparent',                 text:'rgba(212,140,40,0.45)',    dot:'' }
    return                          { bg:'transparent',                 text:'rgba(238,236,229,0.55)',   dot:'' }
  }

  // ── Group workers by work type ────────────────────────────────────────────
  const grouped: Record<string, Worker[]> = {}
  workers.forEach(w => { grouped[w.work_type] = grouped[w.work_type] ?? []; grouped[w.work_type].push(w) })

  // ── Summary calc ──────────────────────────────────────────────────────────
  const sumEarned  = sumRecords.filter(a => a.attendance_type !== 'Absent').reduce((s,a) => s + (a.wage ?? 0), 0)
  const sumAdv     = sumRecords.reduce((s,a) => s + (a.advance ?? 0), 0)
  const sumBalance = sumEarned - sumAdv

  // ── Site name lookup helper ───────────────────────────────────────────────
  const siteName = (id: string | undefined | null) =>
    id ? (sites.find(s => s.id === id)?.site_name ?? '—') : null

  return (
    <div className="page" style={{ display:'flex', flexDirection:'column' }}>
      {toast && (
        <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        {view === 'summary' ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setView('day')} className="text-amber-500 font-bold text-sm">
              ← {ts(lang,'back')}
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-black truncate" style={{color:'rgb(var(--text))'}}>
                {sumWorker?.name}
              </p>
              <p className="text-xs" style={{color:'rgb(var(--muted))'}}>
                {months[month]} {year}
              </p>
            </div>
            {sumLoading && (
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <select value={year} onChange={e => { setYear(+e.target.value); setDay(1) }}
                className="input py-1.5 text-sm w-24 flex-shrink-0">
                {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="flex gap-1.5 overflow-x-auto flex-1 pb-0.5 scrollbar-none">
                {months.map((m,i) => (
                  <button key={i} onClick={() => { setMonth(i); setDay(1) }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                    style={{
                      background: month===i ? '#d48c28' : 'rgb(var(--surface2))',
                      color: month===i ? '#fff' : 'rgb(var(--muted))',
                    }}>
                    {m.slice(0,3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{background:'rgba(212,140,40,0.1)',border:'1px solid rgba(212,140,40,0.2)'}}>
              <span className="text-sm font-black" style={{color:'#d48c28'}}>
                📅 {months[month]} {day}, {year}
              </span>
              <span className="text-xs" style={{color:'rgb(var(--muted))'}}>
                {Object.keys(attMap).length}/{workers.length} {lang==='te' ? 'గుర్తించారు' : 'marked'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Summary view ─────────────────────────────────────────────────── */}
      {view === 'summary' && sumWorker && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          {sumLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: lang==='te' ? 'పని రోజులు' : 'Days',    val: sumRecords.filter(a=>a.attendance_type!=='Absent').length, color:'#2563eb' },
                  { label: lang==='te' ? 'సంపాదించినది' : 'Earned', val: `₹${sumEarned}`,                                          color:'#16a34a' },
                  { label: lang==='te' ? 'అడ్వాన్స్' : 'Advance',   val: `₹${sumAdv}`,                                             color:'#d48c28' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="card p-3 text-center">
                    <p className="text-xl font-black" style={{color}}>{val}</p>
                    <p className="text-[10px] mt-0.5" style={{color:'rgb(var(--muted))'}}>{label}</p>
                  </div>
                ))}
              </div>
              <div className="card p-4 mb-4 text-center">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:'rgb(var(--muted))'}}>
                  {lang==='te' ? 'నికర బాకీ' : 'Net Balance'}
                </p>
                <p className="text-3xl font-black"
                  style={{color: sumBalance>0 ? '#16a34a' : sumBalance<0 ? '#dc2626' : 'rgb(var(--muted))'}}>
                  ₹{Math.abs(sumBalance)}
                </p>
                <p className="text-sm mt-1" style={{color:'rgb(var(--muted))'}}>
                  {sumBalance===0
                    ? (lang==='te' ? 'అన్నీ క్లియర్ ✓' : 'All settled ✓')
                    : sumBalance>0
                      ? (lang==='te' ? 'కార్మికుడికి ఇవ్వాలి' : 'Pay worker')
                      : (lang==='te' ? 'కార్మికుడు ఇవ్వాలి' : 'Worker owes you')}
                </p>
              </div>
              {sumRecords.length === 0 ? (
                <div className="text-center py-8 opacity-50">
                  <p className="text-4xl mb-2">📋</p>
                  <p style={{color:'rgb(var(--muted))'}}>{lang==='te' ? 'రికార్డులు లేవు' : 'No records this month'}</p>
                </div>
              ) : sumRecords.map(a => {
                const d   = a.date_key.split('-')[2]
                const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(a.date_key+'T00:00:00').getDay()]
                const col = SHIFT_BG[a.attendance_type as Shift] ?? '#888'
                const sn  = siteName(a.site_id)
                return (
                  <div key={a.id} className="card mb-2 flex items-center gap-3 p-3">
                    <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white"
                      style={{background:col}}>
                      <span className="font-black text-sm leading-none">{d}</span>
                      <span className="text-[9px] opacity-80">{dow}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{color:'rgb(var(--text))'}}>
                        {SHIFT_LABEL[a.attendance_type as Shift] ?? a.attendance_type}
                      </p>
                      {sn && (
                        <p className="text-[11px] truncate" style={{color:'rgba(212,140,40,0.8)'}}>📍 {sn}</p>
                      )}
                      {(a.advance??0) > 0 && (
                        <p className="text-xs" style={{color:'#d48c28'}}>
                          {lang==='te' ? 'అడ్వాన్స్' : 'Advance'} ₹{a.advance}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-sm flex-shrink-0" style={{color:'rgb(var(--text))'}}>₹{a.wage??0}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ── Day view: date sidebar + worker list ─────────────────────────── */}
      {view === 'day' && (
        <div className="flex flex-1 overflow-hidden" style={{ height:'calc(100vh - 148px)' }}>

          {/* LEFT — vertical date sidebar */}
          <div className="overflow-y-auto flex-shrink-0 border-r"
            style={{ width:52, background:'rgb(var(--surface))', borderColor:'rgb(var(--border))' }}>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const s   = dotStyle(d)
              const dow = ['S','M','T','W','T','F','S'][new Date(year, month, d).getDay()]
              return (
                <button key={d} onClick={() => setDay(d)}
                  className="w-full flex flex-col items-center py-2.5 transition-all"
                  style={{ background: s.bg }}>
                  <span className="text-xs font-black leading-none" style={{ color: s.text }}>{d}</span>
                  <span className="text-[8px] mt-0.5" style={{ color: s.text, opacity: 0.7 }}>{dow}</span>
                  {s.dot && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${s.dot}`}/>}
                </button>
              )
            })}
          </div>

          {/* RIGHT — worker list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : workers.length === 0 ? (
              <div className="text-center py-16 opacity-50">
                <p className="text-4xl mb-2">👷</p>
                <p style={{color:'rgb(var(--muted))'}}>{ts(lang,'noWorkers')}</p>
              </div>
            ) : (
              <div className="p-3 pb-24">
                {Object.entries(grouped).map(([wt, list]) => (
                  <div key={wt} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 sticky top-0 py-1 z-10"
                      style={{background:'rgb(var(--bg))'}}>
                      <div className="w-1 h-3.5 rounded" style={{background:'#d48c28'}}/>
                      <span className="text-xs font-black uppercase tracking-widest" style={{color:'rgb(var(--muted))'}}>
                        {wt}
                      </span>
                      <span className="text-xs" style={{color:'rgb(var(--muted))'}}>
                        · {list.filter(w => attMap[w.id!]).length}/{list.length}
                      </span>
                    </div>

                    {list.map(w => {
                      const att = attMap[w.id!]
                      const col = att ? (SHIFT_BG[att.attendance_type as Shift] ?? '#888') : null
                      const sn  = att ? siteName(att.site_id) : null
                      return (
                        <div key={w.id} className="card mb-2 flex items-center gap-2.5 p-2.5">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
                            style={{
                              background: col ?? 'rgb(var(--surface2))',
                              color: col ? '#fff' : 'rgb(var(--muted))',
                            }}>
                            {w.name[0]?.toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate" style={{color:'rgb(var(--text))'}}>
                              {w.name}
                            </p>
                            {att ? (
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                  style={{background: col ?? '#888'}}>
                                  {SHIFT_LABEL[att.attendance_type as Shift] ?? att.attendance_type}
                                </span>
                                {sn && (
                                  <span className="text-[10px] font-semibold truncate max-w-[90px]"
                                    style={{color:'rgba(212,140,40,0.85)'}}>
                                    📍{sn}
                                  </span>
                                )}
                                {(att.advance??0) > 0 && (
                                  <span className="text-[10px] font-semibold" style={{color:'#d48c28'}}>
                                    Adv ₹{att.advance}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] mt-0.5" style={{color:'rgb(var(--muted))'}}>
                                {lang==='te' ? 'గుర్తించబడలేదు' : 'Not marked'}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => openSummary(w)}
                              className="p-1.5 rounded-lg text-sm transition"
                              style={{color:'#2563eb', background:'rgba(37,99,235,0.08)'}}>
                              📊
                            </button>
                            <button onClick={() => openModal(w)}
                              className="p-1.5 rounded-lg text-sm transition"
                              style={{
                                color: att ? '#d48c28' : '#16a34a',
                                background: att ? 'rgba(212,140,40,0.1)' : 'rgba(22,163,74,0.1)',
                              }}>
                              {att ? '✏️' : '➕'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Attendance modal (per-worker site selection inside) ───────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)'}}
          onClick={() => setModal(null)}>
          <div className="w-full max-w-lg rounded-t-3xl shadow-2xl"
            style={{background:'rgb(var(--surface))'}}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b"
              style={{borderColor:'rgb(var(--border))'}}>
              <div>
                <p className="font-black text-base" style={{color:'rgb(var(--text))'}}>
                  {modal.name}
                </p>
                <p className="text-xs" style={{color:'rgb(var(--muted))'}}>
                  {months[month]} {day}, {year} · {modal.state} · {modal.role}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="text-2xl leading-none"
                style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>

            <div className="p-5 space-y-4">

              {/* Shift grid */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2"
                  style={{color:'rgb(var(--muted))'}}>
                  {lang==='te' ? 'షిఫ్ట్ / హాజరు' : 'Shift / Attendance'}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {SHIFTS.map(s => (
                    <button key={s} onClick={() => setShiftPick(s)}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: shiftPick===s ? SHIFT_BG[s] : 'rgb(var(--surface2))',
                        color: shiftPick===s ? '#fff' : 'rgb(var(--muted))',
                        border: shiftPick===s ? `1px solid ${SHIFT_BG[s]}` : '1px solid rgb(var(--border))',
                      }}>
                      {SHIFT_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wage preview */}
              {shiftPick !== 'Absent' && (
                <div className="rounded-xl px-4 py-2.5 flex items-center justify-between"
                  style={{background:'rgba(212,140,40,0.1)', border:'1px solid rgba(212,140,40,0.2)'}}>
                  <span className="text-sm font-semibold" style={{color:'rgb(var(--muted))'}}>
                    {lang==='te' ? 'వేతనం' : 'Wage'}
                  </span>
                  <span className="font-black text-lg" style={{color:'#d48c28'}}>
                    ₹{wage(modal, shiftPick)}
                  </span>
                </div>
              )}

              {/* ── Per-worker site selector ────────────────────────────── */}
              {sites.length > 0 && shiftPick !== 'Absent' && (
                <div>
                  <label className="label">
                    {lang==='te' ? '📍 సైటు (ఐచ్ఛికం)' : '📍 Site (optional)'}
                  </label>
                  <select
                    value={modalSite}
                    onChange={e => setModalSite(e.target.value)}
                    className="input"
                  >
                    <option value="">{lang==='te' ? '— సైటు ఎంచుకోండి —' : '— Select site —'}</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.site_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Advance */}
              {shiftPick !== 'Absent' && (
                <div>
                  <label className="label">
                    {lang==='te' ? 'అడ్వాన్స్ ₹' : 'Advance ₹'}
                  </label>
                  <input
                    type="number" inputMode="decimal"
                    value={advInput} onChange={e => setAdvInput(e.target.value)}
                    placeholder="0" className="input"
                  />
                </div>
              )}

              <button onClick={saveOne} disabled={saving} className="btn-primary btn-full">
                {saving
                  ? '⏳ Saving...'
                  : (lang==='te' ? '💾 సేవ్ చేయి' : '💾 Save Attendance')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Attendance() {
  return <AppShell><AttendancePage /></AppShell>
}
