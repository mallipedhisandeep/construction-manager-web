'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Worker } from '@/lib/types'

const SHIFTS   = ['6-6','10-6','6-10','6-2','10-2','2-6']
const S_LABELS = ['6AM–6PM','10AM–6PM','6AM–9AM','6AM–2PM','10AM–2PM','3PM–6PM']
const empty = (): Worker => ({ name:'', phone:'', gender:'Male', state:'Telangana', role:'Mason', work_type:'Centring', rate_6_6:0, rate_10_6:0, rate_6_10:0, rate_6_2:0, rate_10_2:0, rate_2_6:0 })
const stateTag = (s:string) => s==='Telangana'?'badge-green':s==='Andhra'?'badge-blue':'badge-orange'

function WorkersPage() {
  const { lang } = useLang()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  // FIX 1: null = "All" — one unified All for each filter
  const [fType,  setFType]  = useState<string|null>(null)
  const [fState, setFState] = useState<string|null>(null)
  const [fRole,  setFRole]  = useState<string|null>(null)
  const [modal,  setModal]  = useState<'add'|'edit'|'view'|null>(null)
  const [form,   setForm]   = useState<Worker>(empty())
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState<{msg:string;type:'ok'|'err'}>()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('workers').select('*').order('name')
    setWorkers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(undefined),3500) }

  const filtered = workers.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.phone.includes(search)) return false
    if (fType  && w.work_type !== fType)  return false
    if (fState && w.state     !== fState) return false
    if (fRole  && w.role      !== fRole)  return false
    return true
  })
  const grouped: Record<string,Worker[]> = {}
  filtered.forEach(w => { grouped[w.work_type] = [...(grouped[w.work_type]??[]), w] })

  const save = async () => {
    if (!form.name.trim()) { showToast('Name required','err'); return }
    if (form.phone.length !== 10) { showToast(ts(lang,'invalidPhone'),'err'); return }
    setSaving(true)
    try {
      const { error } = modal==='add'
        ? await supabase.from('workers').insert(form)
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
    const { error } = await supabase.from('workers').delete().eq('id', w.id!)
    if (error) { showToast(error.message,'err'); return }
    setModal(null); load()
    showToast('Worker deleted')
  }

  const rateKey = (s:string) => `rate_${s.replace('-','_')}` as keyof Worker

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.type==='ok'?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}

      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-5 pb-4 sticky top-14 z-30">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black text-gray-800">{ts(lang,'workers')}</h1>
          <button onClick={() => { setForm(empty()); setModal('add') }} className="btn-primary text-sm">
            + {ts(lang,'addWorker')}
          </button>
        </div>
        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={ts(lang,'search')}
          className="input mb-3" />
        {/* FIX 1 — Filters with labels, null = All */}
        <div className="space-y-2">
          <FilterRow label={ts(lang,'workType')} opts={[null,'Centring','Brickwork']} labels={['All','Centring','Brickwork']} value={fType} onChange={setFType} />
          <FilterRow label={ts(lang,'state')}    opts={[null,'Telangana','Andhra','Bihar']} labels={['All','Telangana','Andhra','Bihar']} value={fState} onChange={setFState} />
          <FilterRow label={ts(lang,'role')}     opts={[null,'Mason','Helper']} labels={['All', ts(lang,'mason'), ts(lang,'helper')]} value={fRole} onChange={setFRole} />
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? <Spinner /> :
         filtered.length === 0 ? <Empty msg={ts(lang,'noWorkers')} icon="👷" /> :
         Object.entries(grouped).map(([wt, list]) => (
          <div key={wt} className="mb-5">
            <div className="section-title">
              <div className="w-1 h-3 rounded bg-orange-500 inline-block" />
              {wt}
              <span className="badge-orange">{list.length}</span>
            </div>
            {list.map(w => (
              <div key={w.id} className="card mb-2 overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 border border-orange-100 flex items-center justify-center text-orange-700 font-black text-lg flex-shrink-0">
                    {w.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800">{w.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={stateTag(w.state)}>{w.state}</span>
                      <span className="badge-purple">{w.role}</span>
                      <span className="text-xs text-gray-400 self-center">₹{w.rate_6_6}/day</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {w.phone && <a href={`tel:${w.phone}`} className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition">📞</a>}
                    <button onClick={() => { setForm({...w}); setModal('view') }}  className="p-2 text-blue-400 hover:bg-blue-50  rounded-xl transition">👁️</button>
                    <button onClick={() => { setForm({...w}); setModal('edit') }}  className="p-2 text-orange-400 hover:bg-orange-50 rounded-xl transition">✏️</button>
                    <button onClick={() => del(w)}                                 className="p-2 text-red-300 hover:bg-red-50    rounded-xl transition">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add / Edit modal */}
      {(modal==='add'||modal==='edit') && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg">{modal==='add'?ts(lang,'addWorker'):ts(lang,'editWorker')}</h2>
              <button onClick={()=>setModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <section>
                <p className="section-title">🙍 {ts(lang,'personalInfo')}</p>
                <div className="space-y-3">
                  <FI label={ts(lang,'name')}   value={form.name}  onChange={v=>setForm({...form,name:v})} required />
                  <FI label={ts(lang,'phone')}  value={form.phone} onChange={v=>setForm({...form,phone:v.replace(/\D/g,'').slice(0,10)})} type="tel" maxLen={10} required hint={`${form.phone.length}/10`} />
                  <div className="grid grid-cols-2 gap-3">
                    <FS label={ts(lang,'gender')}   value={form.gender}    opts={['Male','Female']}          labels={[ts(lang,'male'),ts(lang,'female')]}             onChange={v=>setForm({...form,gender:v})} />
                    <FS label={ts(lang,'workType')} value={form.work_type} opts={['Centring','Brickwork']}   labels={[ts(lang,'centring'),ts(lang,'brickwork')]}       onChange={v=>setForm({...form,work_type:v})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FS label={ts(lang,'state')}    value={form.state}     opts={['Telangana','Andhra','Bihar']} labels={[ts(lang,'telangana'),ts(lang,'andhra'),ts(lang,'bihar')]} onChange={v=>setForm({...form,state:v})} />
                    <FS label={ts(lang,'role')}     value={form.role}      opts={['Mason','Helper']}         labels={[ts(lang,'mason'),ts(lang,'helper')]}             onChange={v=>setForm({...form,role:v})} />
                  </div>
                </div>
              </section>
              <section>
                <p className="section-title">💰 {ts(lang,'wageRates')}</p>
                <div className="space-y-2">
                  {SHIFTS.map((s,i) => (
                    <div key={s} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                      <span className="text-sm text-gray-600 w-24 flex-shrink-0 font-medium">{S_LABELS[i]}</span>
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-medium">₹</span>
                        <input type="number" inputMode="numeric" className="input pl-7 py-2"
                          value={((form as unknown) as Record<string, number>)[rateKey(s)]||''}
                          onChange={e=>setForm({...form,[rateKey(s)]:+e.target.value})} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <FI label={ts(lang,'notes')} value={form.notes||''} onChange={v=>setForm({...form,notes:v})} multiline />
              <button onClick={save} disabled={saving} className="btn-primary w-full py-3">
                {saving ? '⏳ Saving...' : ts(lang,'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {modal==='view' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-700 font-black">{form.name[0]}</div>
                <div>
                  <h2 className="font-black text-lg leading-tight">{form.name}</h2>
                  <p className="text-sm text-gray-400">{form.work_type} · {form.state}</p>
                </div>
              </div>
              <button onClick={()=>setModal(null)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  [ts(lang,'phone'),  form.phone],
                  [ts(lang,'gender'), form.gender],
                  [ts(lang,'state'),  form.state],
                  [ts(lang,'role'),   form.role],
                ].map(([l,v]) => (
                  <div key={l} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{l}</p>
                    <p className="font-bold text-gray-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="section-title">💰 {ts(lang,'wageRates')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {SHIFTS.map((s,i) => (
                    <div key={s} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                      <span className="text-sm text-gray-500">{S_LABELS[i]}</span>
                      <span className="font-bold text-orange-600">₹{((form as unknown) as Record<string, number>)[rateKey(s)]||0}</span>
                    </div>
                  ))}
                </div>
              </div>
              {form.notes && <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{form.notes}</div>}
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

const FilterRow = ({ label, opts, labels, value, onChange }:
  { label:string; opts:(string|null)[]; labels:string[]; value:string|null; onChange:(v:string|null)=>void }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs font-semibold text-gray-400 w-16 flex-shrink-0">{label}:</span>
    {opts.map((o,i) => (
      <button key={i} onClick={()=>onChange(o)}
        className={`chip ${value===o?'chip-active':'chip-idle'}`}>
        {labels[i]}
      </button>
    ))}
  </div>
)
const FI = ({ label,value,onChange,type='text',required=false,maxLen,hint,multiline }:
  { label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean;maxLen?:number;hint?:string;multiline?:boolean }) => (
  <div>
    <div className="flex justify-between">
      <label className="label">{label}{required&&<span className="text-red-400 ml-1">*</span>}</label>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
    {multiline
      ? <textarea rows={2} value={value} onChange={e=>onChange(e.target.value)} className="input resize-none" />
      : <input type={type} value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLen} className="input" />}
  </div>
)
const FS = ({ label,value,opts,labels,onChange }:
  { label:string;value:string;opts:string[];labels:string[];onChange:(v:string)=>void }) => (
  <div>
    <label className="label">{label}</label>
    <select value={value} onChange={e=>onChange(e.target.value)} className="input">
      {opts.map((o,i) => <option key={o} value={o}>{labels[i]}</option>)}
    </select>
  </div>
)
const Spinner = () => <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full" /></div>
const Empty = ({msg,icon}:{msg:string;icon:string}) => (
  <div className="text-center py-16">
    <div className="text-5xl mb-3 opacity-30">{icon}</div>
    <p className="text-gray-400 font-medium">{msg}</p>
  </div>
)

export default function Workers() { return <AppShell><WorkersPage /></AppShell> }
