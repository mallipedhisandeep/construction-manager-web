'use client'
import { useState, useEffect, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Worker, Attendance, Site } from '@/lib/types'

const SHIFTS = ['6-6','10-6','6-10','6-2','10-2','2-6','Absent']
const SC: Record<string,string> = {
  '6-6':'bg-green-600','10-6':'bg-teal-600','6-10':'bg-blue-600',
  '6-2':'bg-indigo-600','10-2':'bg-purple-600','2-6':'bg-cyan-600','Absent':'bg-red-500'
}
const SL: Record<string,string> = {
  '6-6':'bg-green-50 border-green-200 text-green-700','10-6':'bg-teal-50 border-teal-200 text-teal-700',
  '6-10':'bg-blue-50 border-blue-200 text-blue-700','6-2':'bg-indigo-50 border-indigo-200 text-indigo-700',
  '10-2':'bg-purple-50 border-purple-200 text-purple-700','2-6':'bg-cyan-50 border-cyan-200 text-cyan-700',
  'Absent':'bg-red-50 border-red-200 text-red-600'
}

function AttendancePage() {
  const { lang } = useLang()
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [day,   setDay]   = useState(now.getDate())
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attMap,  setAttMap]  = useState<Record<string, Attendance>>({})
  const [sites,   setSites]   = useState<Pick<Site,'id'|'site_name'>[]>([])
  const [modal,   setModal]   = useState<Worker|null>(null)
  const [form, setForm] = useState({ shift:'6-6', siteId:'', advance:'', payMode:'Cash' })
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState<{msg:string;ok:boolean}>()
  const [view,   setView]   = useState<'day'|'summary'>('day')
  const [sumWorker,  setSumWorker]  = useState<Worker|null>(null)
  const [sumRecords, setSumRecords] = useState<Attendance[]>([])
  const [sumPrevBal, setSumPrevBal] = useState(0)
  const [sumLoading, setSumLoading] = useState(false)

  // FIX: Track which date keys have attendance in the current month view
  const [markedDays, setMarkedDays] = useState<Record<string, 'full'|'partial'>>({})

  const months = ts(lang,'months') as unknown as string[]
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const pad = (n:number) => String(n).padStart(2,'0')
  const dKey = `${year}-${pad(month+1)}-${pad(day)}`

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined),3000) }

  const loadWorkers  = useCallback(async()=>{ const {data}=await supabase.from('workers').select('*').is('deleted_at',null).order('work_type').order('state').order('name'); setWorkers(data??[]) },[])
  const loadSites    = useCallback(async()=>{ const {data}=await supabase.from('sites').select('id,site_name').is('deleted_at',null); setSites(data??[]) },[])
  const loadAtt      = useCallback(async()=>{ const {data}=await supabase.from('attendance').select('*').eq('date_key',dKey); const m:Record<string,Attendance>={}; data?.forEach(a=>{m[a.worker_id]=a}); setAttMap(m) },[dKey])

  // FIX: Load all attendance for the current month to colour the day column
  const loadMonthMarked = useCallback(async () => {
    const start = `${year}-${pad(month+1)}-01`
    const end   = month===11 ? `${year+1}-01-01` : `${year}-${pad(month+2)}-01`
    const { data } = await supabase
      .from('attendance')
      .select('date_key, worker_id')
      .gte('date_key', start)
      .lt('date_key', end)
    if (!data) return
    // Group by date_key and count unique workers marked
    const byDay: Record<string, Set<string>> = {}
    data.forEach(a => {
      if (!byDay[a.date_key]) byDay[a.date_key] = new Set()
      byDay[a.date_key].add(a.worker_id)
    })
    // Determine full vs partial (need total worker count)
    const { count: totalWorkers } = await supabase.from('workers').select('id', { count: 'exact', head: true }).is('deleted_at', null)
    const total = totalWorkers ?? 0
    const result: Record<string, 'full'|'partial'> = {}
    Object.entries(byDay).forEach(([dk, workerSet]) => {
      result[dk] = (total > 0 && workerSet.size >= total) ? 'full' : 'partial'
    })
    setMarkedDays(result)
  }, [year, month, pad])

  useEffect(()=>{ loadWorkers(); loadSites() },[loadWorkers,loadSites])
  useEffect(()=>{ loadAtt() },[loadAtt])
  useEffect(()=>{ loadMonthMarked() },[loadMonthMarked])

  const wage = (w:Worker,s:string) => ({
    '6-6':w.rate_6_6,'10-6':w.rate_10_6,'6-10':w.rate_6_10,
    '6-2':w.rate_6_2,'10-2':w.rate_10_2,'2-6':w.rate_2_6,'Absent':0
  }[s]??0)

  const openSummary = async (w:Worker) => {
    setSumWorker(w); setSumLoading(true); setView('summary'); setSumRecords([]); setSumPrevBal(0)
    const start = `${year}-${pad(month+1)}-01`
    const end   = month===11 ? `${year+1}-01-01` : `${year}-${pad(month+2)}-01`
    try {
      const [{data:curr},{data:prev}] = await Promise.all([
        supabase.from('attendance').select('*').eq('worker_id',w.id!).gte('date_key',start).lt('date_key',end).order('date_key'),
        supabase.from('attendance').select('wage,advance,attendance_type').eq('worker_id',w.id!).lt('date_key',start),
      ])
      setSumRecords(curr??[])
      const pE = prev?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+(a.wage??0),0)??0
      const pA = prev?.reduce((s,a)=>s+(a.advance??0),0)??0
      setSumPrevBal(pE-pA)
    } finally { setSumLoading(false) }
  }

  const saveAtt = async () => {
    if (!modal) return
    setSaving(true)
    try {
      const workerWage = wage(modal, form.shift)
      const advance    = parseFloat(form.advance) || 0
      // FIX 3: Removed the extra DB fetch for balance_after to make saves instant.
      // balance_after is computed from the summary view when needed instead.
      const payload: Attendance = {
        worker_id: modal.id!, site_id: form.siteId||undefined,
        date: new Date(year,month,day).toISOString(), date_key: dKey,
        attendance_type: form.shift, wage: workerWage,
        advance, payment_mode: form.payMode,
        balance_after: 0
      }
      const existing = attMap[modal.id!]
      const {error} = existing?.id
        ? await supabase.from('attendance').update(payload).eq('id',existing.id)
        : await supabase.from('attendance').insert(payload)
      if (error) throw error
      setModal(null)
      await loadAtt()
      await loadMonthMarked()
      showToast(ts(lang,'savedOk') as string)
    } catch(e:unknown) { showToast(e instanceof Error ? e.message : 'Save failed', false) }
    finally { setSaving(false) }
  }

  const grouped: Record<string,Worker[]> = {}
  workers.forEach(w=>{ const k=w.work_type; grouped[k]=[...(grouped[k]??[]),w] })

  const earned   = sumRecords.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)
  const advTot   = sumRecords.reduce((s,a)=>s+a.advance,0)
  const finalBal = sumPrevBal + earned - advTot

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}

      {/* ─── Top controls bar ─── */}
      <div className="bg-white border-b sticky top-14 z-30 px-4 py-3">
        {view==='summary' ? (
          <div className="flex items-center gap-3">
            <button onClick={()=>setView('day')} className="text-orange-600 font-bold text-sm">← Back</button>
            <div className="flex-1">
              <p className="font-black text-gray-800">{sumWorker?.name}</p>
              <p className="text-xs text-gray-400">{months[month]} {year} — Summary</p>
            </div>
            {sumLoading && <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/>}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Year + Month row */}
            <div className="flex items-center gap-2">
              <select value={year} onChange={e=>{ setYear(+e.target.value) }}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none">
                {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <div className="flex overflow-x-auto gap-1 flex-1 pb-0.5">
                {months.map((m,i)=>(
                  <button key={i} onClick={()=>setMonth(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition ${month===i?'bg-orange-600 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {m.slice(0,3)}
                  </button>
                ))}
              </div>
            </div>
            {/* Selected date display */}
            <div className="bg-orange-50 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-bold text-orange-700">
                📅 {months[month]} {day}, {year}
              </span>
              <span className="text-xs text-orange-500">{Object.keys(attMap).length}/{workers.length} marked</span>
            </div>
          </div>
        )}
      </div>

      {view==='summary' ? (
        /* ─── SUMMARY VIEW ─── */
        <div className="p-4 max-w-xl mx-auto space-y-3">
          {sumLoading ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"/>
              <p className="text-gray-400 text-sm">Loading...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border p-3 text-center shadow-sm">
                  <p className="text-2xl font-black text-blue-600">{sumRecords.filter(a=>a.attendance_type!=='Absent').length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Days</p>
                </div>
                <div className="bg-white rounded-2xl border p-3 text-center shadow-sm">
                  <p className="text-2xl font-black text-green-600">₹{earned.toFixed(0)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Earned</p>
                </div>
                <div className="bg-white rounded-2xl border p-3 text-center shadow-sm">
                  <p className="text-2xl font-black text-orange-500">₹{advTot.toFixed(0)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Advance</p>
                </div>
              </div>
              {sumPrevBal!==0 && (
                <div className={`rounded-2xl border-2 border-dashed p-4 ${sumPrevBal>0?'border-green-300 bg-green-50':'border-red-300 bg-red-50'}`}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Carried from previous months</p>
                  <p className={`text-xl font-black ${sumPrevBal>0?'text-green-700':'text-red-600'}`}>₹{Math.abs(sumPrevBal).toFixed(0)}</p>
                  <p className="text-xs text-gray-500">{sumPrevBal>0?'You owed this to worker':'Worker owed this to you'}</p>
                </div>
              )}
              <div className={`rounded-2xl p-4 ${finalBal>0?'bg-green-600':finalBal<0?'bg-red-500':'bg-gray-200'}`}>
                <p className="text-xs font-bold text-white/70 uppercase tracking-wide mb-1">Net Balance</p>
                <p className="text-3xl font-black text-white">₹{Math.abs(finalBal).toFixed(0)}</p>
                <p className="text-sm text-white/80 mt-1">
                  {finalBal===0?'✓ All settled':finalBal>0?`Pay worker ₹${finalBal.toFixed(0)}`:`Worker owes ₹${Math.abs(finalBal).toFixed(0)}`}
                </p>
              </div>
              {sumRecords.length===0 ? (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 text-center">
                  <p className="text-3xl mb-2">📅</p>
                  <p className="font-bold text-gray-700">No Records for {months[month]} {year}</p>
                  <p className="text-sm text-gray-500 mt-1">Go back and mark attendance first</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{sumRecords.length} Records</p>
                  {sumRecords.map(a=>{
                    const d = a.date_key?.split('-')[2]
                    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(a.date_key+'T00:00:00').getDay()]
                    return (
                      <div key={a.id} className="bg-white border rounded-xl flex items-center gap-3 px-4 py-3 shadow-sm">
                        <div className={`w-12 h-12 ${SC[a.attendance_type]??'bg-gray-400'} rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0`}>
                          <span className="font-black text-sm leading-tight">{d}</span>
                          <span className="text-[9px] opacity-80">{dow}</span>
                        </div>
                        <div className="flex-1">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${SL[a.attendance_type]??''}`}>{a.attendance_type}</span>
                          {a.advance>0 && <span className="ml-2 text-xs text-orange-500 font-semibold">Adv ₹{a.advance}</span>}
                          {/* FIX 2: Show site name in summary */}
                          {a.site_id && (
                            <p className="text-[11px] text-blue-500 font-medium mt-0.5">
                              📍 {sites.find(s=>s.id===a.site_id)?.site_name ?? 'Site'}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-gray-700">₹{a.wage}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex" style={{ height: 'calc(100vh - 170px)', minHeight: '400px' }}>

          {/* LEFT: vertical day picker — FIX: colour boxes by marked status */}
          <div className="w-14 bg-white border-r flex-shrink-0 overflow-y-auto">
            <div className="py-2">
              {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                const dk = `${year}-${pad(month+1)}-${pad(d)}`
                const isToday   = d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear()
                const isSel     = d===day
                const isWeekend = [0,6].includes(new Date(year,month,d).getDay())
                const markStatus = markedDays[dk] // 'full' | 'partial' | undefined

                // FIX: Determine background colour for the day box
                // Priority: selected > full marked (green) > partial marked (amber) > today (orange tint) > default
                const bgClass = isSel
                  ? 'bg-orange-600'
                  : markStatus === 'full'
                  ? 'bg-green-500'
                  : markStatus === 'partial'
                  ? 'bg-amber-400'
                  : isToday
                  ? 'bg-orange-100'
                  : 'hover:bg-gray-50'

                const numColor = isSel
                  ? 'text-white'
                  : markStatus
                  ? 'text-white'
                  : isToday
                  ? 'text-orange-700'
                  : isWeekend
                  ? 'text-red-400'
                  : 'text-gray-600'

                const dowColor = isSel
                  ? 'text-orange-100'
                  : markStatus
                  ? 'text-white/70'
                  : isToday
                  ? 'text-orange-500'
                  : isWeekend
                  ? 'text-red-300'
                  : 'text-gray-300'

                return (
                  <button key={d} onClick={()=>setDay(d)}
                    className={`w-full py-3 flex flex-col items-center transition ${bgClass}`}>
                    <span className={`text-xs font-black leading-none ${numColor}`}>
                      {d}
                    </span>
                    <span className={`text-[8px] mt-0.5 ${dowColor}`}>
                      {['S','M','T','W','T','F','S'][new Date(year,month,d).getDay()]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* RIGHT: workers */}
          <div className="flex-1 overflow-y-auto">
            {workers.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p className="text-4xl mb-2 opacity-30">👷</p>
                <p className="text-sm">No workers added</p>
              </div>
            ) : (
              <div className="p-3 pb-20">
                {Object.entries(grouped).map(([wt,list])=>(
                  <div key={wt} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-slate-50 py-1">
                      <div className="w-1 h-4 bg-orange-500 rounded"/>
                      <span className="text-sm font-black text-gray-700">{wt}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        {list.filter(w=>attMap[w.id!]).length}/{list.length} marked
                      </span>
                    </div>
                    {list.map(w=>{
                      const att = attMap[w.id!]
                      const col = att ? (SC[att.attendance_type]??'bg-gray-400') : null
                      return (
                        <div key={w.id} className="bg-white border rounded-xl mb-2 flex items-center gap-2.5 p-2.5 shadow-sm">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${col??'bg-gray-100'} ${col?'text-white':'text-gray-400'}`}>
                            {w.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{w.name}</p>
                            {att ? (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${SL[att.attendance_type]??''}`}>{att.attendance_type}</span>
                                {att.advance>0 && <span className="text-[11px] text-orange-500 font-medium">₹{att.advance} adv</span>}
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-300 mt-0.5">{ts(lang,'notMarked') as string}</p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={()=>openSummary(w)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg" title="Summary">📊</button>
                            <button onClick={()=>{
                              const a=attMap[w.id!]
                              setForm({shift:a?.attendance_type??'6-6',siteId:a?.site_id??(sites[0]?.id??''),advance:a?.advance?.toString()??'',payMode:a?.payment_mode??'Cash'})
                              setModal(w)
                            }} className={`p-1.5 rounded-lg ${att?'text-orange-500 hover:bg-orange-50':'text-green-500 hover:bg-green-50'}`}>
                              {att?'✏️':'➕'}
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

      {/* ─── Mark attendance modal ─── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center" onClick={()=>setModal(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-lg">{modal.name}</h3>
                <p className="text-sm text-gray-400">{months[month]} {day}, {year} · {modal.state} · {modal.role}</p>
              </div>
              <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl leading-none">✕</button>
            </div>
            {/* Shift chips */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Shift / Attendance</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {SHIFTS.map(s=>(
                <button key={s} onClick={()=>setForm({...form,shift:s})}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${form.shift===s?`${SC[s]} text-white border-transparent`:'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
            {form.shift!=='Absent' && (
              <div className="bg-orange-50 rounded-xl px-4 py-2 text-sm font-semibold text-orange-700 mb-3">
                💰 Wage: ₹{wage(modal,form.shift)}
              </div>
            )}
            {sites.length>0 && (
              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Site</label>
                <select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none">
                  <option value="">— No site —</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Advance ₹</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₹</span>
                  <input type="number" inputMode="numeric" value={form.advance} onChange={e=>setForm({...form,advance:e.target.value})} placeholder="0" className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Payment</label>
                <select value={form.payMode} onChange={e=>setForm({...form,payMode:e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none">
                  {['Cash','Online','None'].map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <button onClick={saveAtt} disabled={saving}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 font-bold disabled:opacity-50 transition">
              {saving?'⏳ Saving...':'Save Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export default function Attendance() { return <AppShell><AttendancePage /></AppShell> }
