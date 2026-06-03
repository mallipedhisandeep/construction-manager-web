'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts } from '@/lib/strings'
import type { Worker, Attendance, Site } from '@/lib/types'

const ATT_TYPES   = ['Full Day','Half Day','OT','Absent']
const ATT_LABELS  = ['Full','Half','OT','Absent']
const ATT_COLORS  = ['bg-green-500','bg-amber-400','bg-blue-500','bg-red-400']

function AttendancePage() {
  const { lang } = useLang()
  const [workers,  setWorkers]  = useState<Worker[]>([])
  const [sites,    setSites]    = useState<Pick<Site,'id'|'site_name'>[]>([])
  const [att,      setAtt]      = useState<Record<string, Attendance>>({})
  const [dateKey,  setDateKey]  = useState(() => new Date().toISOString().split('T')[0])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  // FIX: proper union type with undefined initial value
  const [toast,    setToast]    = useState<{msg:string; ok:boolean} | undefined>()
  const [siteId,   setSiteId]   = useState('')
  const [history,  setHistory]  = useState<(Attendance & {worker_name?:string})[]>([])
  const [viewMode, setViewMode] = useState<'mark'|'history'>('mark')

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: ws },{ data: si },{ data: existing }] = await Promise.all([
      supabase.from('workers').select('*').is('deleted_at', null).order('name'),
      supabase.from('sites').select('id,site_name').eq('status','Active').is('deleted_at', null),
      supabase.from('attendance').select('*').eq('date_key', dateKey),
    ])
    setWorkers(ws ?? [])
    setSites(si ?? [])
    const map: Record<string, Attendance> = {}
    existing?.forEach(a => { map[a.worker_id] = a })
    setAtt(map)
    setLoading(false)
  }, [dateKey])

  useEffect(() => { load() }, [load])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('attendance').select('*').order('date_key',{ascending:false}).limit(100)
    const ws: Record<string,string> = {}
    workers.forEach(w => { if (w.id) ws[w.id] = w.name })
    setHistory((data??[]).map(a => ({ ...a, worker_name: ws[a.worker_id] ?? '(Unknown)' })))
  }, [workers])

  useEffect(() => { if (viewMode==='history') loadHistory() }, [viewMode, loadHistory])

  const toggle = (wId: string, type: string) => {
    setAtt(prev => ({
      ...prev,
      [wId]: { ...(prev[wId]??{}), worker_id:wId, date_key:dateKey, attendance_type:type, advance: prev[wId]?.advance??0, wage:0 } as Attendance
    }))
  }

  const setAdv = (wId: string, val: string) => {
    setAtt(prev => ({
      ...prev,
      [wId]: { ...(prev[wId]??{ worker_id:wId, date_key:dateKey, attendance_type:'Full Day', wage:0 }), advance: parseFloat(val)||0 } as Attendance
    }))
  }

  const calcWage = (w: Worker, type: string): number => {
    const map: Record<string,keyof Worker> = {
      'Full Day':'rate_6_6','Half Day':'rate_10_6','OT':'rate_6_10','Absent':'rate_6_6'
    }
    if (type==='Absent') return 0
    return (w[map[type]??'rate_6_6'] as number) ?? 0
  }

  const saveAtt = async () => {
    setSaving(true)
    try {
      const userId = await uid()
      const rows = workers
        .filter(w => att[w.id!]?.attendance_type)
        .map(w => {
          const a = att[w.id!]
          const wage = calcWage(w, a.attendance_type)
          // FIX: removed erroneous user_id cast into Attendance record;
          //      only spread valid Attendance fields, append user_id cleanly
          return {
            worker_id:       w.id!,
            date_key:        dateKey,
            attendance_type: a.attendance_type,
            advance:         a.advance ?? 0,
            wage,
            site_id:  siteId || null,
            user_id:  userId,
          }
        })

      if (rows.length === 0) { showToast(ts(lang,'noAttMarked'), false); setSaving(false); return }

      const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'worker_id,date_key' })
      if (error) throw error
      showToast(ts(lang,'attSaved'))
    } catch(e:unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', false)
    } finally { setSaving(false) }
  }

  const deleteAtt = async (id: string) => {
    await supabase.from('attendance').delete().eq('id', id)
    loadHistory()
  }

  const summary = Object.values(att)
  const present = summary.filter(a=>a.attendance_type!=='Absent').length
  const totalWages = workers.reduce((s,w)=>{
    const a = att[w.id!]
    return s + (a ? calcWage(w, a.attendance_type) : 0)
  }, 0)
  const totalAdv = summary.reduce((s,a)=>s+(a.advance??0),0)

  const groupedHistory = history.reduce((grp, a) => {
    grp[a.date_key] = grp[a.date_key] ?? []
    grp[a.date_key].push(a)
    return grp
  }, {} as Record<string, typeof history>)

  return (
    <div className="page">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}

      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>📋 {ts(lang,'attendance')}</h1>
          <div className="flex gap-2">
            <button onClick={()=>setViewMode('mark')} className={`chip ${viewMode==='mark'?'chip-active':'chip-idle'}`}>{ts(lang,'mark')}</button>
            <button onClick={()=>setViewMode('history')} className={`chip ${viewMode==='history'?'chip-active':'chip-idle'}`}>{ts(lang,'history')}</button>
          </div>
        </div>

        {viewMode==='mark' && (
          <>
            <input type="date" value={dateKey} onChange={e=>setDateKey(e.target.value)} className="input mb-3"/>
            <select value={siteId} onChange={e=>setSiteId(e.target.value)} className="input mb-3">
              <option value="">{ts(lang,'noSite')}</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
            </select>
            {!loading && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-2 text-center">
                  <p className="font-black text-green-600 dark:text-green-400">{present}/{workers.length}</p>
                  <p className="text-[10px] text-green-500">{ts(lang,'present')}</p>
                </div>
                <div className="rounded-xl p-2 text-center" style={{background:'rgba(var(--accent),0.12)'}}>
                  <p className="font-black" style={{color:'rgb(var(--accent))'}}>₹{totalWages}</p>
                  <p className="text-[10px]" style={{color:'rgb(var(--accent))'}}>Wages</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-2 text-center">
                  <p className="font-black text-blue-600 dark:text-blue-400">₹{totalAdv}</p>
                  <p className="text-[10px] text-blue-500">Advance</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {viewMode==='mark' && (
        <div className="px-4 pt-3">
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"/></div>
          ) : workers.length===0 ? (
            <div className="text-center py-16 opacity-50"><p className="text-4xl mb-2">👷</p><p style={{color:'rgb(var(--muted))'}}>{ts(lang,'noWorkers')}</p></div>
          ) : (
            <>
              {workers.map(w=>{
                const a = att[w.id!]
                const type = a?.attendance_type
                return (
                  <div key={w.id} className="card mb-2 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-amber-400 flex-shrink-0"
                        style={{background:'rgba(var(--accent),0.15)'}}>
                        {w.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate" style={{color:'rgb(var(--text))'}}>{w.name}</p>
                        <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{w.work_type} · {w.role}</p>
                      </div>
                      {type && type!=='Absent' && (
                        <p className="text-xs font-bold text-green-600 dark:text-green-400 flex-shrink-0">₹{calcWage(w,type)}</p>
                      )}
                    </div>
                    <div className="flex border-t" style={{borderColor:'rgb(var(--border))'}}>
                      {ATT_TYPES.map((t,i)=>(
                        <button key={t} onClick={()=>toggle(w.id!,t)}
                          className={`flex-1 py-2 text-xs font-bold transition ${type===t?`${ATT_COLORS[i]} text-white`:'dark:text-slate-500 text-gray-400'}`}>
                          {ATT_LABELS[i]}
                        </button>
                      ))}
                    </div>
                    {type && type!=='Absent' && (
                      <div className="flex items-center gap-2 px-3 pb-2 border-t" style={{borderColor:'rgb(var(--border))'}}>
                        <span className="text-xs" style={{color:'rgb(var(--muted))'}}>₹ {ts(lang,'advance')}:</span>
                        <input type="number" inputMode="decimal" value={a?.advance||''} onChange={e=>setAdv(w.id!,e.target.value)}
                          className="flex-1 input py-1 text-sm" placeholder="0"/>
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={saveAtt} disabled={saving} className="btn-primary btn-full mt-4 mb-8">
                {saving ? `⏳ ${ts(lang,'saving')}` : `💾 ${ts(lang,'saveAttendance')}`}
              </button>
            </>
          )}
        </div>
      )}

      {viewMode==='history' && (
        <div className="px-4 pt-3">
          {Object.keys(groupedHistory).length===0 ? (
            <div className="text-center py-16 opacity-50"><p className="text-4xl mb-2">📋</p><p style={{color:'rgb(var(--muted))'}}>{ts(lang,'noHistory')}</p></div>
          ) : Object.entries(groupedHistory).map(([dk, records])=>{
            const tot = records.filter(a=>a.attendance_type!=='Absent').length
            const wages = records.reduce((s,a)=>s+(a.wage??0),0)
            return (
              <div key={dk} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-sm" style={{color:'rgb(var(--text))'}}>📅 {dk}</p>
                  <div className="flex gap-2 text-xs" style={{color:'rgb(var(--muted))'}}>
                    <span className="badge-green">{tot} present</span>
                    <span className="badge-orange">₹{wages}</span>
                  </div>
                </div>
                {records.map(a=>(
                  <div key={a.id} className="card mb-1.5 p-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.attendance_type==='Absent'?'bg-red-400':a.attendance_type==='Half Day'?'bg-amber-400':'bg-green-500'}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{color:'rgb(var(--text))'}}>{a.worker_name}</p>
                      <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{a.attendance_type} · ₹{a.wage??0}{(a.advance??0)>0?` · Adv ₹${a.advance}`:''}</p>
                    </div>
                    <button onClick={()=>deleteAtt(a.id!)} className="text-red-400 hover:text-red-600 p-1 text-sm">🗑️</button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Attendance() { return <AppShell><AttendancePage /></AppShell> }
