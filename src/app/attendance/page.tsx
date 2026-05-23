'use client'
import { useState, useEffect, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Worker, Attendance, Site } from '@/lib/types'

const SHIFTS = ['6-6','10-6','6-10','6-2','10-2','2-6','Absent']
const SC: Record<string,string> = { '6-6':'bg-green-600','10-6':'bg-teal-600','6-10':'bg-blue-600','6-2':'bg-indigo-600','10-2':'bg-purple-600','2-6':'bg-cyan-600','Absent':'bg-red-500' }
const SL: Record<string,string> = { '6-6':'bg-green-50 border-green-300 text-green-700','10-6':'bg-teal-50 border-teal-300 text-teal-700','6-10':'bg-blue-50 border-blue-300 text-blue-700','6-2':'bg-indigo-50 border-indigo-300 text-indigo-700','10-2':'bg-purple-50 border-purple-300 text-purple-700','2-6':'bg-cyan-50 border-cyan-300 text-cyan-700','Absent':'bg-red-50 border-red-300 text-red-600' }

function AttendancePage() {
  const { lang } = useLang()
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [day,   setDay]   = useState(now.getDate())
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attMap,  setAttMap]  = useState<Record<string,Attendance>>({})
  const [sites,   setSites]   = useState<Pick<Site,'id'|'site_name'>[]>([])
  const [modal,   setModal]   = useState<Worker|null>(null)
  const [form, setForm] = useState({ shift:'6-6', siteId:'', advance:'', payMode:'Cash' })
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState<{msg:string;ok:boolean}>()

  // ── Summary state ──────────────────────────────────────
  const [view,       setView]       = useState<'day'|'summary'>('day')
  const [sumWorker,  setSumWorker]  = useState<Worker|null>(null)
  const [sumRecords, setSumRecords] = useState<Attendance[]>([])
  const [sumPrevBal, setSumPrevBal] = useState(0)
  const [sumLoading, setSumLoading] = useState(false)
  const [sumError,   setSumError]   = useState('')

  const months = ts(lang,'months') as unknown as string[]
  const days   = new Date(year, month+1, 0).getDate()
  const pad    = (n:number) => String(n).padStart(2,'0')
  const dKey   = `${year}-${pad(month+1)}-${pad(day)}`

  const toast$ = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined),3000) }

  const loadW = useCallback(async()=>{
    const {data} = await supabase.from('workers').select('*').order('work_type').order('state').order('name')
    setWorkers(data??[])
  },[])
  const loadS = useCallback(async()=>{
    const {data} = await supabase.from('sites').select('id,site_name').eq('status','Active')
    setSites(data??[])
  },[])
  const loadA = useCallback(async()=>{
    const {data} = await supabase.from('attendance').select('*').eq('date_key',dKey)
    const m:Record<string,Attendance>={}; data?.forEach(a=>{m[a.worker_id]=a}); setAttMap(m)
  },[dKey])

  useEffect(()=>{loadW();loadS()},[loadW,loadS])
  useEffect(()=>{loadA()},[loadA])

  const wage=(w:Worker,s:string)=>({'6-6':w.rate_6_6,'10-6':w.rate_10_6,'6-10':w.rate_6_10,'6-2':w.rate_6_2,'10-2':w.rate_10_2,'2-6':w.rate_2_6,'Absent':0}[s]??0)

  const markAtt = async()=>{
    if (!modal) return
    setSaving(true)
    try {
      const pl:Attendance = { worker_id:modal.id!, site_id:form.siteId||undefined, date:new Date(year,month,day).toISOString(), date_key:dKey, attendance_type:form.shift, wage:wage(modal,form.shift), advance:parseFloat(form.advance)||0, payment_mode:form.payMode, balance_after:0 }
      const ex = attMap[modal.id!]
      const {error} = ex?.id ? await supabase.from('attendance').update(pl).eq('id',ex.id) : await supabase.from('attendance').insert(pl)
      if (error) throw error
      setModal(null); await loadA(); toast$('Saved ✓')
    } catch(e:unknown) { toast$(e instanceof Error?e.message:'Save failed',false) }
    finally { setSaving(false) }
  }

  // ── Open monthly summary ───────────────────────────────
  const openSummary = async(w:Worker)=>{
    setSumWorker(w); setSumLoading(true); setSumError(''); setSumRecords([]); setSumPrevBal(0); setView('summary')

    // Build date range strings for current month
    const monthStart = `${year}-${pad(month+1)}-01`
    const monthEnd   = month===11 ? `${year+1}-01-01` : `${year}-${pad(month+2)}-01`

    try {
      // Current month attendance
      const {data:curr, error:e1} = await supabase.from('attendance').select('*')
        .eq('worker_id', w.id!)
        .gte('date_key', monthStart)
        .lt('date_key', monthEnd)
        .order('date_key', {ascending:true})
      if (e1) throw new Error(e1.message)
      setSumRecords(curr??[])

      // Previous months for carry-forward balance
      const {data:prev, error:e2} = await supabase.from('attendance')
        .select('wage,advance,attendance_type')
        .eq('worker_id', w.id!)
        .lt('date_key', monthStart)
      if (e2) throw new Error(e2.message)

      const prevEarned = prev?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+(a.wage??0),0)??0
      const prevAdv    = prev?.reduce((s,a)=>s+(a.advance??0),0)??0
      setSumPrevBal(prevEarned - prevAdv)
    } catch(e:unknown) {
      setSumError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setSumLoading(false) }
  }

  const grouped:Record<string,Worker[]>={}
  workers.forEach(w=>{const k=w.work_type;grouped[k]=[...(grouped[k]??[]),w]})

  const earned  = sumRecords.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)
  const advTot  = sumRecords.reduce((s,a)=>s+a.advance,0)
  const balance = sumPrevBal + earned - advTot

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}

      {/* ── Header bar ── */}
      <div className="bg-white border-b sticky top-14 z-30 px-4 py-3 space-y-2">
        {view==='summary' ? (
          <div className="flex items-center gap-3">
            <button onClick={()=>setView('day')} className="text-orange-600 font-bold">← {ts(lang,'attendance')}</button>
            <span className="font-bold text-gray-700">{sumWorker?.name} — {months[month]} {year}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <select value={year} onChange={e=>setYear(+e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm">
                {[now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1].map(y=><option key={y}>{y}</option>)}
              </select>
              <div className="flex overflow-x-auto gap-1 flex-1">
                {months.map((m,i)=>(
                  <button key={i} onClick={()=>setMonth(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${month===i?'bg-orange-600 text-white':'bg-gray-100 text-gray-600'}`}>
                    {m.slice(0,3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex overflow-x-auto gap-1">
              {Array.from({length:days},(_,i)=>i+1).map(d=>(
                <button key={d} onClick={()=>setDay(d)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium flex-shrink-0 transition
                    ${day===d?'bg-orange-600 text-white':d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear()?'bg-orange-100 text-orange-700':'bg-gray-50 text-gray-600'}`}>
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Monthly Summary ── */}
      {view==='summary' && (
        <div className="p-4 max-w-lg mx-auto">

          {sumLoading && (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"/>
              <p className="text-gray-400">Loading {months[month]} records...</p>
            </div>
          )}

          {!sumLoading && sumError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{sumError}</div>
          )}

          {!sumLoading && !sumError && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-2xl border p-3 text-center shadow-sm">
                  <div className="text-2xl font-black text-blue-600">{sumRecords.filter(a=>a.attendance_type!=='Absent').length}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Days Worked</div>
                </div>
                <div className="bg-white rounded-2xl border p-3 text-center shadow-sm">
                  <div className="text-xl font-black text-green-600">₹{earned.toFixed(0)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Earned</div>
                </div>
                <div className="bg-white rounded-2xl border p-3 text-center shadow-sm">
                  <div className="text-xl font-black text-red-500">₹{advTot.toFixed(0)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Advance</div>
                </div>
              </div>

              {/* Carry-forward if any */}
              {sumPrevBal !== 0 && (
                <div className={`rounded-xl border-2 border-dashed p-4 mb-4 ${sumPrevBal>0?'border-green-300 bg-green-50':'border-red-300 bg-red-50'}`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Carried from previous months</p>
                  <p className={`text-xl font-black ${sumPrevBal>0?'text-green-700':'text-red-600'}`}>₹{Math.abs(sumPrevBal).toFixed(0)}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{sumPrevBal>0?'You owed this to worker':'Worker owed this to you'}</p>
                </div>
              )}

              {/* Final balance */}
              <div className={`rounded-xl p-4 mb-4 ${balance>0?'bg-green-600':balance<0?'bg-red-500':'bg-gray-200'}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-white/70 mb-1">Net Balance</p>
                <p className="text-3xl font-black text-white">₹{Math.abs(balance).toFixed(0)}</p>
                <p className="text-sm text-white/80 mt-1">
                  {balance===0?'✓ All settled':balance>0?`You need to pay worker ₹${balance.toFixed(0)}`:`Worker needs to pay you ₹${Math.abs(balance).toFixed(0)}`}
                </p>
              </div>

              {/* No records message */}
              {sumRecords.length===0 ? (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <p className="font-bold text-gray-700 text-lg">No Records Found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    No attendance was marked for <strong>{sumWorker?.name}</strong> in <strong>{months[month]} {year}</strong>
                  </p>
                  <div className="mt-4 bg-white rounded-xl p-3 border border-amber-100">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">What to do</p>
                    <p className="text-sm text-gray-600">Go back → select a day → tap ➕ next to this worker → mark attendance → come back to see summary</p>
                  </div>
                </div>
              ) : (
                /* Day by day */
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Day by Day — {sumRecords.length} records</p>
                  {sumRecords.map(a=>{
                    const d = a.date_key?.split('-')[2]
                    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(a.date_key+'T00:00:00').getDay()]
                    return (
                      <div key={a.id} className="bg-white rounded-xl border flex items-center gap-3 px-4 py-3 shadow-sm">
                        <div className={`w-12 h-12 ${SC[a.attendance_type]??'bg-gray-400'} rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0`}>
                          <span className="font-black text-base leading-tight">{d}</span>
                          <span className="text-[9px] opacity-80">{dow}</span>
                        </div>
                        <div className="flex-1">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${SL[a.attendance_type]??'bg-gray-50 border-gray-200 text-gray-600'}`}>
                            {a.attendance_type}
                          </span>
                          {a.advance>0 && <span className="ml-2 text-xs text-orange-500 font-semibold">Adv ₹{a.advance}</span>}
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
      )}

      {/* ── Day View ── */}
      {view==='day' && (
        <div className="p-4 space-y-4">
          {Object.entries(grouped).map(([wt,list])=>(
            <div key={wt}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-orange-500 rounded"/>
                <span className="font-bold text-gray-700">{wt}</span>
              </div>
              {list.map(w=>{
                const att = attMap[w.id!]
                const col = att ? (SC[att.attendance_type]??'bg-gray-400') : null
                return (
                  <div key={w.id} className="bg-white rounded-xl border shadow-sm mb-2 flex items-center gap-3 p-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 ${col??'bg-gray-100'} ${col?'text-white':'text-gray-300'}`}>
                      {w.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{w.name}</p>
                      <p className="text-xs text-gray-400">{w.state} · {w.role}</p>
                      {att
                        ? <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${SL[att.attendance_type]??''}`}>{att.attendance_type}</span>
                            {att.advance>0 && <span className="text-xs text-orange-500">Adv ₹{att.advance}</span>}
                          </div>
                        : <span className="text-xs text-gray-300">Not marked</span>
                      }
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={()=>openSummary(w)} className="p-2 text-blue-400 hover:bg-blue-50 rounded-xl" title="Monthly Summary">📊</button>
                      <button onClick={()=>{ const att=attMap[w.id!]; setForm({shift:att?.attendance_type??'6-6',siteId:att?.site_id??'',advance:att?.advance?.toString()??'',payMode:att?.payment_mode??'Cash'}); setModal(w) }}
                        className={`p-2 rounded-xl ${attMap[w.id!]?'text-orange-500 hover:bg-orange-50':'text-green-500 hover:bg-green-50'}`}>
                        {attMap[w.id!]?'✏️':'➕'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {workers.length===0 && <div className="text-center py-12 text-gray-300"><div className="text-5xl mb-2">👷</div><p>{ts(lang,'noWorkers')}</p></div>}
        </div>
      )}

      {/* ── Mark Attendance Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center" onClick={()=>setModal(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div>
                <h3 className="font-black text-lg">{modal.name}</h3>
                <p className="text-sm text-gray-400">{months[month]} {day}, {year}</p>
              </div>
              <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl">✕</button>
            </div>
            <p className="label mb-2">Shift</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {SHIFTS.map(s=>(
                <button key={s} onClick={()=>setForm({...form,shift:s})}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${form.shift===s?`${SC[s]} text-white border-transparent`:'bg-gray-50 text-gray-600 border-gray-100'}`}>
                  {s}
                </button>
              ))}
            </div>
            {sites.length>0 && (
              <div className="mb-3">
                <label className="label">Site</label>
                <select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})} className="input">
                  <option value="">— Select —</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Advance ₹</label>
                <input type="number" value={form.advance} onChange={e=>setForm({...form,advance:e.target.value})} placeholder="0" className="input"/>
              </div>
              <div>
                <label className="label">Mode</label>
                <select value={form.payMode} onChange={e=>setForm({...form,payMode:e.target.value})} className="input">
                  {['Cash','Online','None'].map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {form.shift!=='Absent' && <div className="bg-orange-50 rounded-xl px-4 py-2 text-sm text-orange-700 font-medium mb-4">💰 Wage: ₹{wage(modal,form.shift)}</div>}
            <button onClick={markAtt} disabled={saving} className="btn-primary w-full py-3">{saving?'Saving...':'Save'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
export default function Attendance(){ return <AppShell><AttendancePage/></AppShell> }
