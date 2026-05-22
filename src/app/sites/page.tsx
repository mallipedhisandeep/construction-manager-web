'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Site } from '@/lib/types'

const empty = (): Site => ({ site_name:'', site_name_search:'', location:'', owner_name:'', owner_phone:'', budget:0, floors_count:1, status:'Active', notes:'' })

function SitesPage() {
  const { lang } = useLang()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'All'|'Active'|'Completed'>('All')
  const [modal, setModal] = useState<'add'|'edit'|null>(null)
  const [form, setForm] = useState<Site>(empty())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sites').select('*').order('site_name')
    setSites(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const filtered = filter === 'All' ? sites : sites.filter(s => s.status === filter)

  const save = async () => {
    if (!form.site_name.trim()) return
    setSaving(true)
    const data = { ...form, site_name_search: form.site_name.toLowerCase() }
    if (modal === 'add') { await supabase.from('sites').insert(data); showToast(ts(lang,'siteAdded')) }
    else { await supabase.from('sites').update(data).eq('id', form.id!); showToast(ts(lang,'siteUpdated')) }
    setSaving(false); setModal(null); load()
  }

  const del = async (s: Site) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    await supabase.from('sites').delete().eq('id', s.id!)
    load()
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {toast && <div className="fixed top-16 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['All','Active','Completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${filter===f?'bg-orange-600 text-white border-orange-600':'bg-white text-gray-600 border-gray-200'}`}>
            {f} ({f==='All'?sites.length:sites.filter(s=>s.status===f).length})
          </button>
        ))}
      </div>

      <button onClick={() => { setForm(empty()); setModal('add') }}
        className="w-full mb-4 bg-orange-600 text-white rounded-xl py-3 font-semibold hover:bg-orange-700 flex items-center justify-center gap-2">
        <span>+</span> {ts(lang,'addSite')}
      </button>

      {loading ? <div className="text-center py-10 text-gray-400">{ts(lang,'loading')}</div> :
       filtered.length === 0 ? <div className="text-center py-10 text-gray-400">{ts(lang,'noSites')}</div> :
       filtered.map(s => (
        <div key={s.id} className="bg-white border rounded-xl shadow-sm mb-3 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-800">{s.site_name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status==='Active'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{s.status}</span>
                </div>
                {s.location && <p className="text-sm text-gray-500 mt-0.5">📍 {s.location}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setForm({...s}); setModal('edit') }} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg">✏️</button>
                <button onClick={() => del(s)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">🗑️</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
              {s.owner_name && <span>👤 {s.owner_name}</span>}
              {s.owner_phone && <a href={`tel:${s.owner_phone}`} className="text-green-600">📞 {s.owner_phone}</a>}
              <span>🏢 {s.floors_count} {ts(lang,'floors')}</span>
              <span>💰 ₹{(s.budget/100000).toFixed(1)}L</span>
              {s.start_date && <span>📅 {s.start_date}</span>}
            </div>
            {s.notes && <p className="text-xs text-gray-400 mt-1 bg-gray-50 rounded p-2">{s.notes}</p>}
          </div>
        </div>
       ))
      }

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setModal(null)}>
          <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex justify-between">
              <h2 className="font-bold text-lg">{modal==='add'?ts(lang,'addSite'):'Edit Site'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <F label={ts(lang,'siteName')} value={form.site_name} onChange={v=>setForm({...form,site_name:v})} required />
              <F label={ts(lang,'location')} value={form.location??''} onChange={v=>setForm({...form,location:v})} />
              <div className="grid grid-cols-2 gap-3">
                <F label={ts(lang,'budget')} value={form.budget.toString()} type="number" onChange={v=>setForm({...form,budget:+v})} />
                <F label={ts(lang,'floors')} value={form.floors_count.toString()} type="number" onChange={v=>setForm({...form,floors_count:+v})} />
              </div>
              <F label={ts(lang,'ownerName')} value={form.owner_name??''} onChange={v=>setForm({...form,owner_name:v})} />
              <F label={ts(lang,'ownerPhone')} value={form.owner_phone??''} type="tel" maxLen={10} onChange={v=>setForm({...form,owner_phone:v.replace(/\D/g,'').slice(0,10)})} />
              <F label={ts(lang,'startDate')} value={form.start_date??''} type="date" onChange={v=>setForm({...form,start_date:v})} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{ts(lang,'status')}</label>
                <div className="flex gap-2">
                  {['Active','Completed'].map(s => (
                    <button key={s} onClick={() => setForm({...form,status:s})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${form.status===s?s==='Active'?'bg-green-600 text-white border-green-600':'bg-blue-600 text-white border-blue-600':'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {ts(lang, s.toLowerCase() as 'active'|'completed')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{ts(lang,'notes')}</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  value={form.notes??''} onChange={e=>setForm({...form,notes:e.target.value})} />
              </div>
              <button onClick={save} disabled={saving} className="w-full bg-orange-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
                {saving?'⏳...':ts(lang,'save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const F = ({ label, value, onChange, type='text', required=false, maxLen }: { label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean;maxLen?:number }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required&&<span className="text-red-500 ml-1">*</span>}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLen}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
  </div>
)

export default function Sites() { return <AppShell><SitesPage /></AppShell> }
