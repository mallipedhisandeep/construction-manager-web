'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
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
  const [fType,  setFType]  = useState<string|null>(null)
  const [fState, setFState] = useState<string|null>(null)
  const [fRole,  setFRole]  = useState<string|null>(null)
  const [modal,  setModal]  = useState<'add'|'edit'|'view'|null>(null)
  const [form,   setForm]   = useState<Worker>(empty())
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState<{msg:string;type:'ok'|'err'} | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('workers').select('*').is('deleted_at', null).order('name')
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
      const userId = await uid()
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
    setModal(null); load()
    showToast('Moved to recycle bin 🗑️')
  }

  const rateKey = (s:string) => `rate_${s.replace('-','_')}` as keyof Worker

  return (
    <div className="min-h-screen pb-24" style={{backgroundColor:'rgb(var(--bg))'}}>
      {toast && (
        <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.type==='ok'?'bg-green-500':'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="border-b px-4 pt-5 pb-4 sticky top-14 z-30" style={{backgroundColor:'rgb(var(--surface))', borderColor:'rgb(var(--border))'}}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>{ts(lang,'workers')}</h1>
          <button onClick={() => { setForm(empty()); setModal('add') }} className="btn-primary text-sm">
            + {ts(lang,'addWorker')}
          </button>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={ts(lang,'search')} className="input mb-3" />
        <div className="space-y-2">
          <FilterRow label={ts(lang,'workType')} opts={[null,'Centring','Brickwork']} labels={['All','Centring','Brickwork']} value={fType} onChange={setFType} />
          <FilterRow label={ts(lang,'state')}    opts={[null,'Telangana','Andhra','Bihar']} labels={['All','Telangana','Andhra','Bihar']} value={fState} onChange={setFState} />
          <FilterRow label={ts(lang,'role')}     opts={[null,'Mason','Helper']} labels={['All', ts(lang,'mason'), ts(lang,'helper')]} value={fRole} onChange={setFRole} />
        </div>
      </div>

      {/* ── Worker list ────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        {loading ? <Spinner /> :
         filtered.length === 0 ? <Empty msg={ts(lang,'noWorkers')} icon="👷" /> :
         Object.entries(grouped).map(([wt, list]) => (
          <div key={wt} className="mb-5">
            {/* Section title — uses CSS variables, works in both light + dark */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3.5 rounded" style={{background:'rgb(var(--accent))'}} />
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'rgb(var(--muted))'}}>{wt}</span>
              <span className="badge-orange">{list.length}</span>
            </div>
            {list.map(w => (
              <div key={w.id} className="card mb-2 overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
                    style={{background:'rgba(212,140,40,0.15)', border:'1px solid rgba(212,140,40,0.3)', color:'rgb(var(--accent))'}}>
                    {w.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold" style={{color:'rgb(var(--text))'}}>{w.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={stateTag(w.state)}>{w.state}</span>
                      <span className="badge-purple">{w.role}</span>
                      <span className="text-xs self-center" style={{color:'rgb(var(--muted))'}}>₹{w.rate_6_6}/day</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {w.phone && <a href={`tel:${w.phone}`} className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition">📞</a>}
                    <button onClick={() => { setForm({...w}); setModal('view') }}  className="p-2 rounded-xl transition" style={{color:'rgb(var(--info))'}}>👁️</button>
                    <button onClick={() => { setForm({...w}); setModal('edit') }}  className="p-2 rounded-xl transition" style={{color:'rgb(var(--accent))'}}>✏️</button>
                    <button onClick={() => del(w)}                                 className="p-2 rounded-xl transition" style={{color:'rgb(var(--danger))'}}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Add / Edit modal ───────────────────────────────────────── */}
      {(modal==='add'||modal==='edit') && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{modal==='add'?ts(lang,'addWorker'):ts(lang,'editWorker')}</h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-5">

              {/* Personal info section */}
              <section>
                <SectionTitle>🙍 {ts(lang,'personalInfo')}</SectionTitle>
                <div className="space-y-3">
                  <FI label={ts(lang,'name')}  value={form.name}  onChange={v=>setForm({...form,name:v})} required />
                  <FI label={ts(lang,'phone')} value={form.phone} onChange={v=>setForm({...form,phone:v.replace(/\D/g,'').slice(0,10)})} type="tel" maxLen={10} required hint={`${form.phone.length}/10`} />
                  <div className="grid grid-cols-2 gap-3">
                    <FS label={ts(lang,'gender')}   value={form.gender}    opts={['Male','Female']}            labels={[ts(lang,'male'),ts(lang,'female')]}                             onChange={v=>setForm({...form,gender:v})} />
                    <FS label={ts(lang,'workType')} value={form.work_type} opts={['Centring','Brickwork']}     labels={[ts(lang,'centring'),ts(lang,'brickwork')]}                       onChange={v=>setForm({...form,work_type:v})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FS label={ts(lang,'state')} value={form.state} opts={['Telangana','Andhra','Bihar']} labels={[ts(lang,'telangana'),ts(lang,'andhra'),ts(lang,'bihar')]} onChange={v=>setForm({...form,state:v})} />
                    <FS label={ts(lang,'role')}  value={form.role}  opts={['Mason','Helper']}             labels={[ts(lang,'mason'),ts(lang,'helper')]}                     onChange={v=>setForm({...form,role:v})} />
                  </div>
                </div>
              </section>

              {/* Wage rates section — FIX: all colors use CSS variables for light+dark */}
              <section>
                <SectionTitle>💰 {ts(lang,'wageRates')}</SectionTitle>
                <div className="space-y-2">
                  {SHIFTS.map((s,i) => (
                    <div key={s} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{background:'rgb(var(--surface2))', border:'1px solid rgb(var(--border))'}}>
                      {/* Shift label — uses --text for full contrast in both modes */}
                      <span className="text-sm w-24 flex-shrink-0 font-semibold" style={{color:'rgb(var(--text))'}}>
                        {S_LABELS[i]}
                      </span>
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none"
                          style={{color:'rgb(var(--accent))'}}>
                          ₹
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input pl-7 py-2"
                          placeholder="0"
                          value={(form as unknown as Record<string,number>)[rateKey(s)] || ''}
                          onChange={e=>setForm({...form,[rateKey(s)]:+e.target.value})}
                        />
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

      {/* ── View modal ─────────────────────────────────────────────── */}
      {modal==='view' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black"
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
                {[
                  [ts(lang,'phone'),  form.phone],
                  [ts(lang,'gender'), form.gender],
                  [ts(lang,'state'),  form.state],
                  [ts(lang,'role'),   form.role],
                ].map(([l,v]) => (
                  <div key={l} className="rounded-xl p-3" style={{background:'rgb(var(--bg))'}}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{color:'rgb(var(--muted))'}}>{l}</p>
                    <p className="font-bold mt-0.5" style={{color:'rgb(var(--text))'}}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Wage rates in view modal — FIX: use CSS variables */}
              <div>
                <SectionTitle>💰 {ts(lang,'wageRates')}</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {SHIFTS.map((s,i) => (
                    <div key={s} className="flex justify-between items-center rounded-xl px-3 py-2"
                      style={{background:'rgb(var(--bg))'}}>
                      <span className="text-sm font-medium" style={{color:'rgb(var(--muted))'}}>{S_LABELS[i]}</span>
                      <span className="font-bold" style={{color:'rgb(var(--accent))'}}>
                        ₹{(form as unknown as Record<string,number>)[rateKey(s)]||0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {form.notes && (
                <div className="text-sm rounded-xl p-3" style={{color:'rgb(var(--muted))',background:'rgb(var(--bg))'}}>
                  {form.notes}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setModal('edit')} className="btn-ghost w-full py-3">✏️ {ts(lang,'edit')}</button>
                <button onClick={()=>del(form)}        className="btn-danger w-full py-3">🗑️ {ts(lang,'delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

// SectionTitle: uses CSS variables instead of hardcoded dark/light Tailwind classes
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-0.5 h-4 rounded" style={{background:'rgb(var(--accent))'}} />
      <p className="text-xs font-black uppercase tracking-widest" style={{color:'rgb(var(--muted))'}}>
        {children}
      </p>
    </div>
  )
}

const FilterRow = ({ label, opts, labels, value, onChange }:
  { label:string; opts:(string|null)[]; labels:string[]; value:string|null; onChange:(v:string|null)=>void }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs font-semibold w-16 flex-shrink-0" style={{color:'rgb(var(--muted))'}}>{label}:</span>
    {opts.map((o,i) => (
      <button key={i} onClick={()=>onChange(o)} className={`chip ${value===o?'chip-active':'chip-idle'}`}>
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
      {hint && <span className="text-xs" style={{color:'rgb(var(--muted))'}}>{hint}</span>}
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

const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{borderColor:'rgb(var(--accent))', borderTopColor:'transparent'}} />
  </div>
)

const Empty = ({msg,icon}:{msg:string;icon:string}) => (
  <div className="text-center py-16">
    <div className="text-5xl mb-3 opacity-30">{icon}</div>
    <p className="font-medium" style={{color:'rgb(var(--muted))'}}>{msg}</p>
  </div>
)

export default function Workers() { return <AppShell><WorkersPage /></AppShell> }
