'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts } from '@/lib/strings'
import { SHIFTS, SHIFT_LABELS } from '@/lib/constants'
import type { Worker } from '@/lib/types'

const DISPLAY_SHIFTS = SHIFTS.filter(s => s !== 'Absent') as string[]
const empty = (): Worker => ({ name:'', phone:'', gender:'Male', state:'Telangana', role:'Mason', work_type:'Centring', rate_6_6:0, rate_10_6:0, rate_6_10:0, rate_6_2:0, rate_10_2:0, rate_2_6:0, worker_status:'Active' })


const stateColor = (s:string) => s==='Telangana'?'#16a34a':s==='Andhra'?'#2563eb':'#d97706'

function WorkersPage() {
  const { lang } = useLang()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [fType,  setFType]  = useState<string|null>(null)
  const [fState, setFState] = useState<string|null>(null)
  const [fRole,  setFRole]  = useState<string|null>(null)
  const [modal,  setModal]  = useState<'add'|'edit'|'view'|null>(null)
  const [form,   setForm]   = useState<Worker>(empty())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    
    const userId = await uid()
    if (!userId) { setLoading(false); return }
    const { data } = await supabase.from('workers').select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('name')
    setWorkers(data ?? [])
    setLoading(false)
  }, [])

  const { showToast: _showToast } = useToast()
  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => _showToast(msg, type)
  useEffect(() => { load() }, [load])

  const filtered = workers.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.phone.includes(search)) return false
    if (fType  && w.work_type !== fType)  return false
    if (fState && w.state     !== fState) return false
    if (fRole  && w.role      !== fRole)  return false
    return true
  })
  // Explicit sort: Active first, Inactive at bottom, then by name within each group
  const WORKER_STATUS_ORDER: Record<string,number> = { Active:0, Inactive:1 }
  const sortedFiltered = [...filtered].sort((a,b) =>
    (WORKER_STATUS_ORDER[a.worker_status??'Active']??0) - (WORKER_STATUS_ORDER[b.worker_status??'Active']??0) ||
    a.name.localeCompare(b.name)
  )
  const grouped: Record<string,Worker[]> = {}
  sortedFiltered.forEach(w => { grouped[w.work_type] = [...(grouped[w.work_type]??[]), w] })

  const save = async () => {
    if (!form.name.trim()) { showToast('Name required','err'); return }
    if (form.phone.length !== 10 || !/^[6-9]/.test(form.phone)) {
      showToast(ts(lang,'invalidPhone'),'err'); return
    }
    setSaving(true)
    try {
      const userId = await uid()
      if (!userId) throw new Error('Not logged in')

      const { data: existing } = await supabase.from('workers')
        .select('id').eq('user_id', userId).eq('phone', form.phone).is('deleted_at', null).limit(2)
      const duplicateExists = modal === 'add'
        ? (existing && existing.length > 0)
        : (existing && existing.some(w => w.id !== form.id))
      if (duplicateExists) {
        showToast('A worker with this phone number already exists','err')
        setSaving(false); return
      }
      const { error } = modal==='add'
        ? await supabase.from('workers').insert({ ...form, user_id: userId })
        : await supabase.from('workers').update(form).eq('id', form.id!)
      if (error) throw error
      setModal(null); load()
      showToast(modal==='add' ? ts(lang,'workerAdded') : ts(lang,'workerUpdated'))
    } catch(e:unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed','err')
    } finally { setSaving(false) }
  }

  const del = async (w:Worker) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    const { error } = await supabase.from('workers').update({ deleted_at: new Date().toISOString() }).eq('id', w.id!)
    if (error) { showToast(error.message,'err'); return }
    setModal(null); load(); showToast('Moved to recycle bin 🗑️')
  }

  const rateKey = (s:string) => `rate_${s.replace('-','_')}` as keyof Worker

  return (
    <div className="min-h-screen pb-24" style={{background:'rgb(var(--bg))'}}>
      
      <div className="border-b px-4 pt-4 pb-3 sticky top-14 z-30"
        style={{background:'rgb(var(--surface))', borderColor:'rgb(var(--border))'}}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>{ts(lang,'workers')}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setForm(empty()); setModal('add') }} className="btn-primary btn-sm" data-testid="add-worker-btn">
              + {ts(lang,'addWorker')}
            </button>
          </div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={ts(lang,'search')} className="input mb-2.5 py-2 text-sm" />

        
        <div className="space-y-1.5">
          {/* Work Type row */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide flex-shrink-0 w-14"
              style={{color:'rgb(var(--muted))'}}>
              {ts(lang,'workType')}
            </span>
            <div className="flex gap-1 flex-nowrap overflow-x-auto" style={{scrollbarWidth:'none'}}>
              {[{v:null,l:ts(lang,'allTypes')},{v:'Centring',l:ts(lang,'centring')},{v:'Brickwork',l:ts(lang,'brickwork')}].map(({v,l})=>(
                <button key={String(v)} onClick={()=>setFType(v)}
                  className="chip flex-shrink-0 text-xs py-0.5 px-2"
                  style={fType===v
                    ? {background:'rgb(var(--accent))',color:'#fff',border:'1px solid transparent'}
                    : {background:'rgb(var(--surface2))',color:'rgb(var(--muted))',border:'1px solid rgb(var(--border))'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
         
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide flex-shrink-0 w-14"
              style={{color:'rgb(var(--muted))'}}>
              {ts(lang,'state')}
            </span>
            <div className="flex gap-1 flex-nowrap overflow-x-auto" style={{scrollbarWidth:'none'}}>
              {[{v:null,l:ts(lang,'allStates')},{v:'Telangana',l:ts(lang,'telangana')},{v:'Andhra',l:ts(lang,'andhra')},{v:'Bihar',l:ts(lang,'bihar')}].map(({v,l})=>(
                <button key={String(v)} onClick={()=>setFState(v)}
                  className="chip flex-shrink-0 text-xs py-0.5 px-2"
                  style={fState===v
                    ? {background:'rgb(var(--accent))',color:'#fff',border:'1px solid transparent'}
                    : {background:'rgb(var(--surface2))',color:'rgb(var(--muted))',border:'1px solid rgb(var(--border))'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {/* Role row */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide flex-shrink-0 w-14"
              style={{color:'rgb(var(--muted))'}}>
              {ts(lang,'role')}
            </span>
            <div className="flex gap-1 flex-nowrap overflow-x-auto" style={{scrollbarWidth:'none'}}>
              {[{v:null,l:ts(lang,'allRoles')},{v:'Mason',l:ts(lang,'mason')},{v:'Helper',l:ts(lang,'helper')}].map(({v,l})=>(
                <button key={String(v)} onClick={()=>setFRole(v)}
                  className="chip flex-shrink-0 text-xs py-0.5 px-2"
                  style={fRole===v
                    ? {background:'rgb(var(--accent))',color:'#fff',border:'1px solid transparent'}
                    : {background:'rgb(var(--surface2))',color:'rgb(var(--muted))',border:'1px solid rgb(var(--border))'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? <Spinner /> :
         filtered.length === 0 ? <Empty msg={ts(lang,'noWorkers')} icon="👷" /> :
         Object.entries(grouped).map(([wt, list]) => (
          <div key={wt} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3.5 rounded" style={{background:'rgb(var(--accent))'}} />
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'rgb(var(--muted))'}}>{wt}</span>
              <span className="badge-orange">{list.length}</span>
            </div>
            {list.map(w => (
              <div key={w.id} className="card mb-2 overflow-hidden">
                <div className="flex items-center gap-3 p-3.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
                    style={{background:'rgba(212,140,40,0.15)', color:'rgb(var(--accent))'}}>
                    {w.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm" style={{color: w.worker_status==='Inactive' ? 'rgb(var(--muted))' : 'rgb(var(--text))'}}>{w.name}</p>
                      {w.worker_status==='Inactive' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:'rgba(100,116,139,0.15)',color:'rgb(var(--muted))',border:'1px solid rgb(var(--border))'}}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{background:`${stateColor(w.state)}22`, color:stateColor(w.state), border:`1px solid ${stateColor(w.state)}44`}}>
                        {({'Telangana':ts(lang,'telangana'),'Andhra':ts(lang,'andhra'),'Bihar':ts(lang,'bihar')} as Record<string,string>)[w.state] ?? w.state}
                      </span>
                      <span className="badge-purple text-[11px]">{w.role==='Mason'?ts(lang,'mason'):w.role==='Helper'?ts(lang,'helper'):w.role}</span>
                      <span className="text-[11px]" style={{color:'rgb(var(--muted))'}}>₹{w.rate_6_6}/day</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {w.phone && <a href={`tel:${w.phone}`} className="p-1.5 text-green-500 rounded-lg">📞</a>}
                    <button onClick={() => { setForm({...w}); setModal('view') }} className="p-1.5 rounded-lg" style={{color:'rgb(var(--info))'}} data-testid={w.name === 'Demo Worker' ? 'demo-worker-view-btn' : undefined}>👁️</button>
                    <button onClick={() => { setForm({...w}); setModal('edit') }} className="p-1.5 rounded-lg" style={{color:'rgb(var(--accent))'}} data-testid={w.name === 'Demo Worker' ? 'demo-worker-edit-btn' : undefined}>✏️</button>
                    <button onClick={() => del(w)} className="p-1.5 rounded-lg" style={{color:'rgb(var(--danger))'}} data-testid={w.name === 'Demo Worker' ? 'demo-worker-delete-btn' : undefined}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {(modal==='add'||modal==='edit') && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} data-testid="worker-form-modal">
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{modal==='add'?ts(lang,'addWorker'):ts(lang,'editWorker')}</h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <FI label={ts(lang,'name')} value={form.name} onChange={v=>setForm({...form,name:v})} required />
                <FI label={ts(lang,'phone')} value={form.phone} onChange={v=>setForm({...form,phone:v.replace(/\D/g,'').slice(0,10)})} type="tel" maxLen={10} required hint={`${form.phone.length}/10`} />
                <div className="grid grid-cols-2 gap-3">
                  <FS label={ts(lang,'gender')} value={form.gender} opts={['Male','Female']} labels={[ts(lang,'male'),ts(lang,'female')]} onChange={v=>setForm({...form,gender:v})} />
                  <FS label={ts(lang,'workType')} value={form.work_type} opts={['Centring','Brickwork']} labels={[ts(lang,'centring'),ts(lang,'brickwork')]} onChange={v=>setForm({...form,work_type:v})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FS label={ts(lang,'state')} value={form.state} opts={['Telangana','Andhra','Bihar']} labels={[ts(lang,'telangana'),ts(lang,'andhra'),ts(lang,'bihar')]} onChange={v=>setForm({...form,state:v})} />
                  <FS label={ts(lang,'role')} value={form.role} opts={['Mason','Helper']} labels={[ts(lang,'mason'),ts(lang,'helper')]} onChange={v=>setForm({...form,role:v})} />
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{color:'rgb(var(--muted))'}}>
                  💰 {ts(lang,'wageRates')}
                </p>
                <div className="space-y-2">
                  {DISPLAY_SHIFTS.map(s => (
                    <div key={s} className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{background:'rgb(var(--surface2))', border:'1px solid rgb(var(--border))'}}>
                      <span className="text-sm w-24 flex-shrink-0 font-medium" style={{color:'rgb(var(--text))'}}>{SHIFT_LABELS[s]}</span>
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none" style={{color:'rgb(var(--accent))'}}>₹</span>
                        <input type="number" inputMode="numeric" className="input pl-7 py-2" placeholder="0"
                          value={(form as unknown as Record<string,number>)[rateKey(s)] || ''}
                          onChange={e=>setForm({...form,[rateKey(s)]:+e.target.value})} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <FI label={ts(lang,'notes')} value={form.notes||''} onChange={v=>setForm({...form,notes:v})} multiline />
              <div>
                <label className="label">{ts(lang,'workerStatus')}</label>
                <div className="flex gap-2">
                  {(['Active','Inactive'] as const).map(s => (
                    <button key={s} onClick={() => setForm({...form, worker_status: s})}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition"
                      style={form.worker_status===s
                        ? {background: s==='Active'?'#16a34a':'rgb(var(--muted))', color:'#fff', borderColor:'transparent'}
                        : {background:'rgb(var(--surface2))', borderColor:'rgb(var(--border))', color:'rgb(var(--muted))'}}>
                      {s==='Active' ? ts(lang,'activeStatus') : ts(lang,'inactiveStatus')}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={save} disabled={saving} className="btn-primary w-full py-3">
                {saving ? '⏳ Saving...' : ts(lang,'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal==='view' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black"
                  style={{background:'rgba(212,140,40,0.15)', color:'rgb(var(--accent))'}}>
                  {form.name[0]}
                </div>
                <div>
                  <h2 className="font-black text-lg leading-tight" style={{color:'rgb(var(--text))'}}>{form.name}</h2>
                  <p className="text-sm" style={{color:'rgb(var(--muted))'}}>{form.work_type} · {form.state}</p>
                </div>
              </div>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[[ts(lang,'phone'),form.phone],[ts(lang,'gender'),form.gender],[ts(lang,'state'),form.state],[ts(lang,'role'),form.role]].map(([l,v])=>(
                  <div key={l} className="rounded-xl p-3" style={{background:'rgb(var(--bg))'}}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{color:'rgb(var(--muted))'}}>{l}</p>
                    <p className="font-bold mt-0.5" style={{color:'rgb(var(--text))'}}>{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>💰 {ts(lang,'wageRates')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {DISPLAY_SHIFTS.map(s=>(
                    <div key={s} className="flex justify-between items-center rounded-xl px-3 py-2" style={{background:'rgb(var(--bg))'}}>
                      <span className="text-xs font-medium" style={{color:'rgb(var(--muted))'}}>{SHIFT_LABELS[s]}</span>
                      <span className="font-bold text-sm" style={{color:'rgb(var(--accent))'}}>₹{(form as unknown as Record<string,number>)[rateKey(s)]||0}</span>
                    </div>
                  ))}
                </div>
              </div>
              {form.notes && <div className="text-sm rounded-xl p-3" style={{color:'rgb(var(--muted))',background:'rgb(var(--bg))'}}>{form.notes}</div>}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setModal('edit')} className="btn-ghost w-full py-3">✏️ {ts(lang,'edit')}</button>
                <button onClick={()=>del(form)} className="btn-danger w-full py-3">🗑️ {ts(lang,'delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const FI = ({ label,value,onChange,type='text',required=false,maxLen,hint,multiline }:{ label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean;maxLen?:number;hint?:string;multiline?:boolean }) => (
  <div>
    <div className="flex justify-between">
      <label className="label">{label}{required&&<span className="text-red-400 ml-1">*</span>}</label>
      {hint && <span className="text-xs" style={{color:'rgb(var(--muted))'}}>{hint}</span>}
    </div>
    {multiline ? <textarea rows={2} value={value} onChange={e=>onChange(e.target.value)} className="input resize-none" /> : <input type={type} value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLen} className="input" />}
  </div>
)
const FS = ({ label,value,opts,labels,onChange }:{ label:string;value:string;opts:string[];labels:string[];onChange:(v:string)=>void }) => (
  <div>
    <label className="label">{label}</label>
    <select value={value} onChange={e=>onChange(e.target.value)} className="input">
      {opts.map((o,i)=><option key={o} value={o}>{labels[i]}</option>)}
    </select>
  </div>
)
const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}} />
  </div>
)
const Empty = ({msg,icon}:{msg:string;icon:string}) => (
  <div className="text-center py-16"><div className="text-5xl mb-3 opacity-30">{icon}</div><p className="font-medium" style={{color:'rgb(var(--muted))'}}>{msg}</p></div>
)

export default function Workers() { return <WorkersPage /> }
