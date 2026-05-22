'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Worker } from '@/lib/types'

const SHIFTS = ['6-6','10-6','6-10','6-2','10-2','2-6']
const SHIFT_LABELS = ['6AM–6PM','10AM–6PM','6AM–10PM','6AM–2PM','10AM–2PM','2PM–6PM']

const emptyWorker = (): Worker => ({
  name:'', phone:'', gender:'Male', state:'Telangana',
  role:'Mason', work_type:'Centring',
  rate_6_6:0, rate_10_6:0, rate_6_10:0, rate_6_2:0, rate_10_2:0, rate_2_6:0
})

function WorkersPage() {
  const { lang } = useLang()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string|null>(null)
  const [filterState, setFilterState] = useState<string|null>(null)
  const [modal, setModal] = useState<'add'|'edit'|'view'|null>(null)
  const [form, setForm] = useState<Worker>(emptyWorker())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('workers').select('*').order('name')
    setWorkers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtered = workers.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.phone.includes(search)) return false
    if (filterType && w.work_type !== filterType) return false
    if (filterState && w.state !== filterState) return false
    return true
  })

  const grouped: Record<string, Worker[]> = {}
  filtered.forEach(w => { grouped[w.work_type] = [...(grouped[w.work_type]??[]), w] })

  const save = async () => {
    if (!form.name.trim()) return
    if (form.phone.length !== 10) { showToast(ts(lang,'invalidPhone')); return }
    setSaving(true)
    const data = { ...form, phone: form.phone }
    if (modal === 'add') {
      await supabase.from('workers').insert(data)
      showToast(ts(lang,'workerAdded'))
    } else {
      await supabase.from('workers').update(data).eq('id', form.id!)
      showToast(ts(lang,'workerUpdated'))
    }
    setSaving(false); setModal(null); load()
  }

  const del = async (w: Worker) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    await supabase.from('workers').delete().eq('id', w.id!)
    load()
  }

  const stateColor = (s: string) => s==='Telangana'?'bg-green-100 text-green-800':s==='Andhra'?'bg-blue-100 text-blue-800':'bg-yellow-100 text-yellow-800'

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {toast && <div className="fixed top-16 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 space-y-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={ts(lang,'search')}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">{ts(lang,'workType')}:</span>
          {[null,'Centring','Brickwork'].map(v => (
            <button key={v??'all'} onClick={() => setFilterType(v)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${filterType===v?'bg-orange-600 text-white border-orange-600':'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {v??ts(lang,'allTypes')}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">{ts(lang,'state')}:</span>
          {[null,'Telangana','Andhra','Bihar'].map(v => (
            <button key={v??'all'} onClick={() => setFilterState(v)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${filterState===v?'bg-orange-600 text-white border-orange-600':'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {v ? ts(lang,v.toLowerCase() as 'telangana'|'andhra'|'bihar') : ts(lang,'allStates')}
            </button>
          ))}
        </div>
      </div>

      {/* Add button */}
      <button onClick={() => { setForm(emptyWorker()); setModal('add') }}
        className="w-full mb-4 bg-orange-600 text-white rounded-xl py-3 font-semibold hover:bg-orange-700 flex items-center justify-center gap-2">
        <span>+</span> {ts(lang,'addWorker')}
      </button>

      {/* List */}
      {loading ? <div className="text-center py-10 text-gray-400">{ts(lang,'loading')}</div> :
       filtered.length === 0 ? <div className="text-center py-10 text-gray-400">{ts(lang,'noWorkers')}</div> :
       Object.entries(grouped).map(([wt, list]) => (
        <div key={wt} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-5 bg-orange-500 rounded" />
            <span className="font-bold text-gray-700">{wt}</span>
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold">{list.length}</span>
          </div>
          {list.map(w => (
            <div key={w.id} className="bg-white rounded-xl border shadow-sm mb-2 overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-lg flex-shrink-0">
                  {w.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800">{w.name}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{w.role}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stateColor(w.state)}`}>{w.state}</span>
                    <span className="text-xs text-gray-400">₹{w.rate_6_6}/day</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {w.phone && <a href={`tel:${w.phone}`} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">📞</a>}
                  <button onClick={() => { setForm({...w}); setModal('view') }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">👁️</button>
                  <button onClick={() => { setForm({...w}); setModal('edit') }}
                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg">✏️</button>
                  <button onClick={() => del(w)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Modal */}
      {modal && modal !== 'view' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setModal(null)}>
          <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-lg">{modal==='add'?ts(lang,'addWorker'):ts(lang,'editWorker')}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <Section title={ts(lang,'personalInfo')}>
                <Field label={ts(lang,'name')} value={form.name} onChange={v => setForm({...form, name:v})} required />
                <Field label={ts(lang,'phone')} value={form.phone} type="tel" maxLen={10} onChange={v => setForm({...form, phone:v.replace(/\D/g,'').slice(0,10)})} required />
                <div className="grid grid-cols-2 gap-3">
                  <Select label={ts(lang,'gender')} value={form.gender} opts={['Male','Female']} labels={[ts(lang,'male'),ts(lang,'female')]} onChange={v => setForm({...form, gender:v})} />
                  <Select label={ts(lang,'workType')} value={form.work_type} opts={['Centring','Brickwork']} labels={[ts(lang,'centring'),ts(lang,'brickwork')]} onChange={v => setForm({...form, work_type:v})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label={ts(lang,'state')} value={form.state} opts={['Telangana','Andhra','Bihar']} labels={[ts(lang,'telangana'),ts(lang,'andhra'),ts(lang,'bihar')]} onChange={v => setForm({...form, state:v})} />
                  <Select label={ts(lang,'role')} value={form.role} opts={['Mason','Helper']} labels={[ts(lang,'mason'),ts(lang,'helper')]} onChange={v => setForm({...form, role:v})} />
                </div>
              </Section>
              <Section title={ts(lang,'wageRates')}>
                {SHIFTS.map((s,i) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24 flex-shrink-0">{SHIFT_LABELS[i]}</span>
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₹</span>
                      <input type="number" inputMode="numeric" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm"
                        value={(form as any)[`rate_${s.replace('-','_')}`]||''}
                        onChange={e => setForm({...form, [`rate_${s.replace('-','_')}`]: +e.target.value})} />
                    </div>
                  </div>
                ))}
              </Section>
              <Section title={ts(lang,'notes')}>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})} />
              </Section>
              <button onClick={save} disabled={saving}
                className="w-full bg-orange-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
                {saving ? '⏳...' : ts(lang,'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {modal === 'view' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setModal(null)}>
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-lg">{form.name}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <InfoRow label={ts(lang,'phone')} value={form.phone} />
              <InfoRow label={ts(lang,'gender')} value={form.gender} />
              <InfoRow label={ts(lang,'state')} value={form.state} />
              <InfoRow label={ts(lang,'role')} value={form.role} />
              <InfoRow label={ts(lang,'workType')} value={form.work_type} />
              <div className="border-t pt-3">
                <div className="font-semibold text-sm text-gray-500 mb-2">{ts(lang,'wageRates')}</div>
                {SHIFTS.map((s,i) => (
                  <div key={s} className="flex justify-between py-1 border-b border-dashed">
                    <span className="text-sm text-gray-600">{SHIFT_LABELS[i]}</span>
                    <span className="font-semibold text-orange-600">₹{(form as any)[`rate_${s.replace('-','_')}`]||0}</span>
                  </div>
                ))}
              </div>
              {form.notes && <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{form.notes}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide border-b pb-1">{title}</h3>
    {children}
  </div>
)

const Field = ({ label, value, onChange, type='text', required=false, maxLen }: { label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean;maxLen?:number }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required&&<span className="text-red-500 ml-1">*</span>}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} maxLength={maxLen}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
  </div>
)

const Select = ({ label, value, opts, labels, onChange }: { label:string;value:string;opts:string[];labels:string[];onChange:(v:string)=>void }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
      {opts.map((o,i) => <option key={o} value={o}>{labels[i]}</option>)}
    </select>
  </div>
)

const InfoRow = ({ label, value }: { label:string; value:string }) => (
  <div className="flex justify-between">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
)

export default function Workers() { return <AppShell><WorkersPage /></AppShell> }
