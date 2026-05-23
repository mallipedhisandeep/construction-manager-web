'use client'
import { useState, useEffect, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Worker, Attendance, Site } from '@/lib/types'

const SHIFTS = ['6-6','10-6','6-10','6-2','10-2','2-6','Absent']
const SHIFT_COLORS: Record<string,string> = {
  '6-6':'bg-green-600','10-6':'bg-teal-600','6-10':'bg-blue-600',
  '6-2':'bg-indigo-600','10-2':'bg-purple-600','2-6':'bg-cyan-600','Absent':'bg-red-500'
}
const SHIFT_LIGHT: Record<string,string> = {
  '6-6':'bg-green-50 border-green-200 text-green-700',
  '10-6':'bg-teal-50 border-teal-200 text-teal-700',
  '6-10':'bg-blue-50 border-blue-200 text-blue-700',
  '6-2':'bg-indigo-50 border-indigo-200 text-indigo-700',
  '10-2':'bg-purple-50 border-purple-200 text-purple-700',
  '2-6':'bg-cyan-50 border-cyan-200 text-cyan-700',
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
  const [toast,  setToast]  = useState<{msg:string;type:'ok'|'err'}>()
  // Summary state
  const [view,           setView]           = useState<'day'|'summary'>('day')
  const [summaryWorker,  setSummaryWorker]  = useState<Worker|null>(null)
  const [summaryData,    setSummaryData]    = useState<Attendance[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const months = ts(lang,'months') as unknown as string[]
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const pad = (n:number) => String(n).padStart(2,'0')
  const dateKey = `${year}-${pad(month+1)}-${pad(day)}`

  const showToast = (msg:string, type:'ok'|'err'='ok') => {
    setToast({msg,type})
    setTimeout(() => setToast(undefined), 3500)
  }

  const loadWorkers = useCallback(async () => {
    const { data, error } = await supabase.from('workers').select('*').order('work_type').order('state').order('name')
    if (error) { showToast(error.message,'err'); return }
    setWorkers(data ?? [])
  }, [])

  const loadSites = useCallback(async () => {
    const { data } = await supabase.from('sites').select('id,site_name').eq('status','Active')
    setSites(data ?? [])
  }, [])

  const loadAtt = useCallback(async () => {
    const { data } = await supabase.from('attendance').select('*').eq('date_key', dateKey)
    const map: Record<string, Attendance> = {}
    data?.forEach(a => { map[a.worker_id] = a })
    setAttMap(map)
  }, [dateKey])

  useEffect(() => { loadWorkers(); loadSites() }, [loadWorkers, loadSites])
  useEffect(() => { loadAtt() }, [loadAtt])

  const getWage = (w:Worker, shift:string) => {
    const map: Record<string,number> = {
      '6-6':w.rate_6_6,'10-6':w.rate_10_6,'6-10':w.rate_6_10,
      '6-2':w.rate_6_2,'10-2':w.rate_10_2,'2-6':w.rate_2_6,'Absent':0
    }
    return map[shift] ?? 0
  }

  const openModal = (w:Worker) => {
    const att = attMap[w.id!]
    setForm({ shift:att?.attendance_type??'6-6', siteId:att?.site_id??(sites[0]?.id??''), advance:att?.advance?.toString()??'', payMode:att?.payment_mode??'Cash' })
    setModal(w)
  }

  const saveAtt = async () => {
    if (!modal) return
    setSaving(true)
    try {
      const date = new Date(year, month, day).toISOString()
      const payload: Attendance = {
        worker_id:modal.id!, site_id:form.siteId||undefined,
        date, date_key:dateKey, attendance_type:form.shift,
        wage:getWage(modal,form.shift), advance:parseFloat(form.advance)||0,
        payment_mode:form.payMode, balance_after:0
      }
      const existing = attMap[modal.id!]
      const { error } = existing?.id
        ? await supabase.from('attendance').update(payload).eq('id',existing.id)
        : await supabase.from('attendance').insert(payload)
      if (error) throw error
      setModal(null); await loadAtt()
      showToast(ts(lang,'savedOk'))
    } catch(e:unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed','err')
    } finally { setSaving(false) }
  }

  // FIX 1: template literals were broken (\${} instead of ${}), now fixed
  const openSummary = async (w:Worker) => {
    setSummaryWorker(w)
    setSummaryLoading(true)
    setView('summary')
    setSummaryData([])
    setOpeningBalance(0)

    const start = `${year}-${pad(month+1)}-01`
    const nextMonth = month === 11 ? `${year+1}-01-01` : `${year}-${pad(month+2)}-01`

    try {
      // Current month records
      const { data: current, error: e1 } = await supabase
        .from('attendance').select('*')
        .eq('worker_id', w.id!)
        .gte('date_key', start)
        .lt('date_key', nextMonth)
        .order('date_key')
      if (e1) throw e1
      setSummaryData(current ?? [])

      // All records BEFORE this month → carry-forward opening balance
      const { data: prev, error: e2 } = await supabase
        .from('attendance').select('wage,advance,attendance_type')
        .eq('worker_id', w.id!)
        .lt('date_key', start)
      if (e2) throw e2

      const prevEarned = prev?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+(a.wage??0),0)??0
      const prevAdv    = prev?.reduce((s,a)=>s+(a.advance??0),0)??0
      setOpeningBalance(prevEarned - prevAdv)
    } catch(e:unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to load summary','err')
    } finally { setSummaryLoading(false) }
  }

  const grouped: Record<string,Worker[]> = {}
  workers.forEach(w => { const k=w.work_type; grouped[k]=[...(grouped[k]??[]),w] })

  const totalEarned  = summaryData.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)
  const totalAdv     = summaryData.reduce((s,a)=>s+a.advance,0)
  const finalBalance = openingBalance + totalEarned - totalAdv

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && (
        <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.type==='ok'?'bg-green-500':'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white border-b sticky top-14 z-30 px-4 py-3 space-y-2">
        {view==='summary' ? (
          <div className="flex items-center gap-3">
            <button onClick={()=>setView('day')} className="text-orange-600 font-semibold text-sm flex items-center gap-1">
              ← Back
            </button>
            <div>
              <span className="font-bold">{summaryWorker?.name}</span>
              <span className="text-gray-400 text-sm ml-2">{months[month]} {year}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <select value={year} onChange={e=>setYear(+e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm">
                {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=><option key={y}>{y}</option>)}
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
              {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                <button key={d} onClick={()=>setDay(d)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium flex-shrink-0 transition
                    ${day===d?'bg-orange-600 text-white':
                      d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear()?'bg-orange-100 text-orange-700':
                      'bg-gray-50 text-gray-600'}`}>
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Summary view */}
      {view==='summary' ? (
        <div className="p-4 space-y-3 max-w-xl mx-auto">
          {summaryLoading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
              <p className="text-gray-400 text-sm">Loading summary...</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-3 text-center">
                  <div className="text-2xl font-black text-blue-600">{summaryData.filter(a=>a.attendance_type!=='Absent').length}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{ts(lang,'daysWorked')}</div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-2xl font-black text-green-600">₹{totalEarned}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{ts(lang,'totalEarned')}</div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-2xl font-black text-red-500">₹{totalAdv}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{ts(lang,'totalAdvance')}</div>
                </div>
              </div>

              {/* Carry-forward */}
              {openingBalance !== 0 && (
                <div className={`card p-4 border-2 border-dashed ${openingBalance>0?'border-green-300 bg-green-50':'border-red-300 bg-red-50'}`}>
                  <p className="text-xs font-bold uppercase tracking-wide opacity-60 mb-1">Carried Forward (previous months)</p>
                  <p className={`text-xl font-black ${openingBalance>0?'text-green-700':'text-red-600'}`}>
                    ₹{Math.abs(openingBalance)}
                  </p>
                  <p className="text-sm opacity-70">{openingBalance>0?'You owed worker from before':'Worker owed you from before'}</p>
                </div>
              )}

              {/* Final balance */}
              <div className={`card p-4 ${finalBalance>=0?'bg-green-50':'bg-red-50'}`}>
                <p className="text-xs font-bold uppercase tracking-wide opacity-60 mb-1">Final Balance</p>
                <p className={`text-2xl font-black ${finalBalance>=0?'text-green-700':'text-red-600'}`}>
                  ₹{Math.abs(finalBalance)}
                </p>
                <p className="text-sm opacity-70">
                  {finalBalance===0?'All settled ✓':finalBalance>0?'You need to pay worker':'Worker needs to pay you'}
                </p>
              </div>

              {/* Empty state */}
              {summaryData.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2 opacity-30">📅</div>
                  <p className="text-gray-400">No attendance records for {months[month]}</p>
                </div>
              )}

              {/* Day-by-day list */}
              {summaryData.map(a => {
                const d = a.date_key?.split('-')[2]
                const dayName = new Date(a.date_key).toLocaleDateString('en', {weekday:'short'})
                return (
                  <div key={a.id} className="card flex items-center gap-3 p-3">
                    <div className={`w-12 h-12 ${SHIFT_COLORS[a.attendance_type]??'bg-gray-400'} rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0`}>
                      <span className="text-base font-black">{d}</span>
                      <span className="text-[9px] opacity-80">{dayName}</span>
                    </div>
                    <div className="flex-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${SHIFT_LIGHT[a.attendance_type]??'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        {a.attendance_type}
                      </span>
                      {a.advance>0 && <span className="ml-2 text-xs text-orange-500 font-medium">Adv ₹{a.advance}</span>}
                    </div>
                    <span className="text-sm font-bold text-gray-600">₹{a.wage}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      ) : (
        // Day view
        <div className="p-4 space-y-4">
          {Object.entries(grouped).map(([wt,list])=>(
            <div key={wt}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-orange-500 rounded" />
                <span className="font-bold text-gray-700">{wt}</span>
              </div>
              {list.map(w=>{
                const att = attMap[w.id!]
                const col = att ? (SHIFT_COLORS[att.attendance_type]??'bg-gray-400') : null
                return (
                  <div key={w.id} className="card mb-2 flex items-center gap-3 p-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 ${col??'bg-gray-100'} ${col?'text-white':'text-gray-400'}`}>
                      {w.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{w.name}</p>
                      <p className="text-xs text-gray-400">{w.state} · {w.role}</p>
                      {att ? (
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${SHIFT_LIGHT[att.attendance_type]??''}`}>{att.attendance_type}</span>
                          {att.advance>0 && <span className="text-xs text-orange-500">Adv ₹{att.advance}</span>}
                        </div>
                      ) : <span className="text-xs text-gray-300">{ts(lang,'notMarked')}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>openSummary(w)} className="p-2 text-blue-400 hover:bg-blue-50 rounded-xl transition" title="Monthly Summary">📊</button>
                      <button onClick={()=>openModal(w)} className={`p-2 rounded-xl transition ${att?'text-orange-500 hover:bg-orange-50':'text-green-500 hover:bg-green-50'}`}>
                        {att?'✏️':'➕'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {workers.length===0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-2 opacity-20">👷</div>
              <p className="text-gray-400">{ts(lang,'noWorkers')}</p>
            </div>
          )}
        </div>
      )}

      {/* Mark attendance modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center" onClick={()=>setModal(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-lg">{modal.name}</h3>
                <p className="text-sm text-gray-400">{months[month]} {day}, {year}</p>
              </div>
              <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl leading-none">✕</button>
            </div>

            {/* Shift selector */}
            <p className="label mb-2">{ts(lang,'shift')}</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {SHIFTS.map(s=>(
                <button key={s} onClick={()=>setForm({...form,shift:s})}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${form.shift===s?`${SHIFT_COLORS[s]} text-white border-transparent`:'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>

            {sites.length>0 && (
              <div className="mb-3">
                <label className="label">{ts(lang,'siteWorked')}</label>
                <select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})} className="input">
                  <option value="">— Select site —</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">{ts(lang,'advance')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₹</span>
                  <input type="number" value={form.advance} onChange={e=>setForm({...form,advance:e.target.value})}
                    placeholder="0" className="input pl-7" />
                </div>
              </div>
              <div>
                <label className="label">{ts(lang,'paymentMode')}</label>
                <select value={form.payMode} onChange={e=>setForm({...form,payMode:e.target.value})} className="input">
                  {['Cash','Online','None'].map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {form.shift!=='Absent' && (
              <div className="bg-orange-50 rounded-xl px-4 py-2.5 text-sm text-orange-700 font-medium mb-4">
                💰 Wage for this shift: ₹{getWage(modal,form.shift)}
              </div>
            )}

            <button onClick={saveAtt} disabled={saving} className="btn-primary w-full py-3">
              {saving?'⏳ Saving...':ts(lang,'save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export default function Attendance() { return <AppShell><AttendancePage /></AppShell> }
