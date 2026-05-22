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
const SHIFT_BG: Record<string,string> = {
  '6-6':'bg-green-50 border-green-200','10-6':'bg-teal-50 border-teal-200',
  '6-10':'bg-blue-50 border-blue-200','6-2':'bg-indigo-50 border-indigo-200',
  '10-2':'bg-purple-50 border-purple-200','2-6':'bg-cyan-50 border-cyan-200',
  'Absent':'bg-red-50 border-red-200'
}

function AttendancePage() {
  const { lang } = useLang()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [day, setDay] = useState(now.getDate())
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attMap, setAttMap] = useState<Record<string, Attendance>>({})
  const [sites, setSites] = useState<Site[]>([])
  const [modal, setModal] = useState<Worker|null>(null)
  const [form, setForm] = useState({ shift:'6-6', siteId:'', advance:'', payMode:'Cash' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [view, setView] = useState<'day'|'summary'>('day')
  const [summaryWorker, setSummaryWorker] = useState<Worker|null>(null)
  const [summaryData, setSummaryData] = useState<Attendance[]>([])

  const months = ts(lang,'months') as unknown as string[]

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  const loadWorkers = useCallback(async () => {
    const { data } = await supabase.from('workers').select('*').order('work_type').order('state').order('name')
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

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const getWage = (w: Worker, shift: string) => {
    const map: Record<string,number> = { '6-6':w.rate_6_6,'10-6':w.rate_10_6,'6-10':w.rate_6_10,'6-2':w.rate_6_2,'10-2':w.rate_10_2,'2-6':w.rate_2_6,'Absent':0 }
    return map[shift] ?? 0
  }

  const openModal = (w: Worker) => {
    const att = attMap[w.id!]
    setForm({ shift: att?.attendance_type ?? '6-6', siteId: att?.site_id ?? (sites[0]?.id ?? ''), advance: att?.advance?.toString() ?? '0', payMode: att?.payment_mode ?? 'Cash' })
    setModal(w)
  }

  const saveAtt = async () => {
    if (!modal) return
    setSaving(true)
    const date = new Date(year, month, day).toISOString()
    const payload: Attendance = {
      worker_id: modal.id!, site_id: form.siteId || undefined,
      date, date_key: dateKey, attendance_type: form.shift,
      wage: getWage(modal, form.shift), advance: parseFloat(form.advance)||0,
      payment_mode: form.payMode, balance_after: 0
    }
    const existing = attMap[modal.id!]
    if (existing?.id) await supabase.from('attendance').update(payload).eq('id', existing.id)
    else await supabase.from('attendance').insert(payload)
    setSaving(false); setModal(null); loadAtt()
    showToast(ts(lang,'savedOk'))
  }

  const openSummary = async (w: Worker) => {
    setSummaryWorker(w)
    const start = `${year}-${String(month+1).padStart(2,'0')}-01`
    const end = `${month === 11 ? year+1 : year}-${String(month===11?1:month+2).padStart(2,'0')}-01`
    const { data } = await supabase.from('attendance').select('*')
      .eq('worker_id', w.id!).gte('date_key', start).lt('date_key', end).order('date_key')
    setSummaryData(data ?? [])
    setView('summary')
  }

  const grouped: Record<string, Worker[]> = {}
  workers.forEach(w => { const k = w.work_type; grouped[k] = [...(grouped[k]??[]), w] })

  const totalEarned = summaryData.filter(a => a.attendance_type !== 'Absent').reduce((s,a) => s + a.wage, 0)
  const totalAdv    = summaryData.reduce((s,a) => s + a.advance, 0)

  return (
    <div className="max-w-3xl mx-auto">
      {toast && <div className="fixed top-16 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header controls */}
      <div className="bg-white border-b sticky top-14 z-30 px-4 py-3 space-y-2">
        {view === 'summary' ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setView('day')} className="text-orange-600 font-medium text-sm">← Back</button>
            <span className="font-bold">{summaryWorker?.name} — {months[month]} {year}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <select value={year} onChange={e => setYear(+e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm">
                {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => <option key={y}>{y}</option>)}
              </select>
              <div className="flex overflow-x-auto gap-1 flex-1">
                {months.map((m,i) => (
                  <button key={i} onClick={() => setMonth(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${month===i?'bg-orange-600 text-white':'bg-gray-100 text-gray-600'}`}>
                    {m.slice(0,3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex overflow-x-auto gap-1">
              {Array.from({length: daysInMonth}, (_,i) => i+1).map(d => (
                <button key={d} onClick={() => setDay(d)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium flex-shrink-0 transition ${day===d?'bg-orange-600 text-white':d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear()?'bg-orange-100 text-orange-700':'bg-gray-50 text-gray-600'}`}>
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {view === 'summary' ? (
        <div className="p-4 space-y-3">
          {/* Summary totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{summaryData.filter(a=>a.attendance_type!=='Absent').length}</div>
              <div className="text-xs text-blue-500">{ts(lang,'daysWorked')}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-green-600">₹{totalEarned}</div>
              <div className="text-xs text-green-500">{ts(lang,'totalEarned')}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-red-600">₹{totalAdv}</div>
              <div className="text-xs text-red-500">{ts(lang,'totalAdvance')}</div>
            </div>
          </div>
          <div className={`rounded-xl p-3 text-center font-bold ${totalEarned >= totalAdv ? 'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>
            {ts(lang,'balance')}: ₹{Math.abs(totalEarned-totalAdv)} {totalEarned>=totalAdv?ts(lang,'toGive'):ts(lang,'toReceive')}
          </div>
          {/* Day by day */}
          {summaryData.map(a => {
            const d = a.date_key.split('-')[2]
            const col = SHIFT_COLORS[a.attendance_type] ?? 'bg-gray-400'
            return (
              <div key={a.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                <div className={`w-10 h-10 ${col} rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>{d}</div>
                <div className="flex-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${SHIFT_BG[a.attendance_type]??'bg-gray-50 border-gray-200'}`}>{a.attendance_type}</span>
                  {a.advance > 0 && <span className="ml-2 text-xs text-orange-600 font-medium">Adv: ₹{a.advance}</span>}
                </div>
                <span className="text-sm font-semibold text-gray-600">₹{a.wage}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {Object.entries(grouped).map(([wt, list]) => (
            <div key={wt}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-orange-500 rounded" />
                <span className="font-bold text-gray-700">{wt}</span>
              </div>
              {list.map(w => {
                const att = attMap[w.id!]
                const col = att ? (SHIFT_COLORS[att.attendance_type] ?? 'bg-gray-400') : null
                return (
                  <div key={w.id} className="bg-white border rounded-xl mb-2 flex items-center gap-3 p-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${col ?? 'bg-gray-200'}`}>
                      {col ? w.name[0] : <span className="text-gray-400 text-sm">{w.name[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800">{w.name}</div>
                      <div className="text-xs text-gray-400">{w.state} · {w.role}</div>
                      {att ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${SHIFT_BG[att.attendance_type]??''}`}>{att.attendance_type}</span>
                          {att.advance > 0 && <span className="text-xs text-orange-500">Adv ₹{att.advance}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{ts(lang,'notMarked')}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openSummary(w)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg text-sm">📊</button>
                      <button onClick={() => openModal(w)} className={`p-1.5 rounded-lg text-sm ${att?'text-orange-500 hover:bg-orange-50':'text-green-500 hover:bg-green-50'}`}>
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

      {/* Mark Attendance Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setModal(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{modal.name}</h3>
                <p className="text-sm text-gray-400">{months[month]} {day}, {year}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            {/* Shift selector */}
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-2">{ts(lang,'shift')}</label>
              <div className="grid grid-cols-4 gap-2">
                {SHIFTS.map(s => (
                  <button key={s} onClick={() => setForm({...form, shift:s})}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${form.shift===s?`${SHIFT_COLORS[s]} text-white border-transparent`:'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {sites.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm text-gray-500 mb-1">{ts(lang,'siteWorked')}</label>
                <select value={form.siteId} onChange={e => setForm({...form, siteId:e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">— {ts(lang,'selectSite')} —</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">{ts(lang,'advance')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₹</span>
                  <input type="number" value={form.advance} onChange={e => setForm({...form,advance:e.target.value})}
                    className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">{ts(lang,'paymentMode')}</label>
                <select value={form.payMode} onChange={e => setForm({...form,payMode:e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {['Cash','Online','None'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {form.shift !== 'Absent' && (
              <div className="bg-orange-50 rounded-lg px-3 py-2 text-sm text-orange-700 mb-4">
                💰 Wage: ₹{getWage(modal, form.shift)}
              </div>
            )}
            <button onClick={saveAtt} disabled={saving}
              className="w-full bg-orange-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
              {saving ? '⏳...' : ts(lang,'save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Attendance() { return <AppShell><AttendancePage /></AppShell> }
