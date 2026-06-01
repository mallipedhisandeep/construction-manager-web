'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts } from '@/lib/strings'
import type { PrivateWork, PrivateWorker, Site } from '@/lib/types'

function PrivateWorkPage() {
  const { lang } = useLang()
  const [works, setWorks] = useState<PrivateWork[]>([])
  const [pWorkers, setPWorkers] = useState<PrivateWorker[]>([])
  const [sites, setSites] = useState<Pick<Site,"id"|"site_name">[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState<'add'|'edit'|null>(null)
  const [form, setForm] = useState<Partial<PrivateWork>>({status:'Active', price_charged:0, amount_paid:0})
  const [priceStr, setPriceStr] = useState('')
  const [paidStr,  setPaidStr]  = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: w }, { data: pw }, { data: s }] = await Promise.all([
      supabase.from('private_work').select('*').is('deleted_at', null).order('created_at', {ascending:false}),
      supabase.from('private_workers').select('*').is('deleted_at', null).order('name'),
      supabase.from('sites').select('id,site_name').eq('status','Active').is('deleted_at', null)
    ])
    setWorks(w ?? []); setPWorkers(pw ?? []); setSites(s ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const filtered = filter === 'All' ? works : works.filter(w => w.status === filter)
  const totalPending = works.reduce((s, w) => s + (w.price_charged - w.amount_paid), 0)

  const save = async () => {
    if (!form.worker_id || !form.site_id) return
    setSaving(true)
    const worker = pWorkers.find(w => w.id === form.worker_id)
    const site = sites.find(s => s.id === form.site_id)
    // ── FIX: stamp user_id on insert ──
    const userId = await uid()
    const data = {
      ...form,
      worker_name: worker?.name ?? '',
      work_type: worker?.work_type ?? '',
      site_name: site?.site_name ?? '',
      work_date: form.work_date ?? new Date().toISOString().split('T')[0],
      price_charged: parseFloat(priceStr) || 0,
      amount_paid:   parseFloat(paidStr)  || 0,
    }
    const { error: saveErr } = modal==='add'
      ? await supabase.from('private_work').insert({ ...data, user_id: userId })
      : await supabase.from('private_work').update(data).eq('id', form.id!)
    setSaving(false)
    if (saveErr) { showToast('Save failed: ' + saveErr.message); return }
    setModal(null); load(); showToast(ts(lang,'savedOk'))
  }

  const del = async (w: PrivateWork) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    const { error: delErr } = await supabase.from('private_work').update({ deleted_at: new Date().toISOString() }).eq('id', w.id!)
    if (delErr) { showToast('Delete failed'); return }
    load()
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {toast && <div className="fixed top-16 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {totalPending > 0 && (
        <div className="bg-slate-800/50 border border-amber-700/40 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-amber-500 font-bold">⚠️ {ts(lang,'totalPending')}: ₹{totalPending.toFixed(0)}</span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['All','Active','Completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${filter===f?'bg-amber-600 text-white border-amber-500':'dark:text-slate-300 text-gray-600 dark:border-slate-600 border-gray-200'}`} style={filter!==f?{backgroundColor:'rgb(var(--surface))'}:{}}>
            {f}
          </button>
        ))}
      </div>

      <button onClick={() => { setForm({ status:'Active', price_charged:0, amount_paid:0, work_date: new Date().toISOString().split('T')[0] }); setPriceStr(''); setPaidStr(''); setModal('add') }}
        className="w-full mb-4 bg-amber-600 text-white rounded-xl py-3 font-semibold hover:bg-amber-600 flex items-center justify-center gap-2">
        + {ts(lang,'addWork')}
      </button>

      {loading ? <div className="text-center py-10 dark:text-slate-500 text-gray-400">{ts(lang,'loading')}</div> :
       filtered.length === 0 ? <div className="text-center py-10 dark:text-slate-500 text-gray-400">{ts(lang,'noWork')}</div> :
       filtered.map(w => {
        const bal = w.price_charged - w.amount_paid
        return (
          <div key={w.id} className="border rounded-xl shadow-sm mb-3 p-4" style={{backgroundColor:"rgb(var(--surface))"}}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold ">{w.worker_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.status==='Active'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{w.status}</span>
                </div>
                <div className="text-sm dark:text-slate-400 text-gray-500 mt-0.5">🔧 {w.work_type} · 📍 {w.site_name}</div>
                <div className="text-xs dark:text-slate-500 text-gray-400">📅 {w.work_date}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setForm({...w}); setPriceStr(w.price_charged?.toString() ?? ''); setPaidStr(w.amount_paid?.toString() ?? ''); setModal('edit') }} className="p-1.5 text-amber-400 hover:bg-slate-800/50 rounded-lg text-sm">✏️</button>
                <button onClick={() => del(w)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg text-sm">🗑️</button>
              </div>
            </div>
            <div className="flex gap-3 mt-3">
              <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-xs text-blue-500">{ts(lang,'charged')}</div>
                <div className="font-bold text-blue-700">₹{w.price_charged}</div>
              </div>
              <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
                <div className="text-xs text-green-500">{ts(lang,'paid')}</div>
                <div className="font-bold text-green-700">₹{w.amount_paid}</div>
              </div>
              {bal > 0 && (
                <div className="flex-1 bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-xs text-amber-400">{ts(lang,'due')}</div>
                  <div className="font-bold text-amber-400">₹{bal}</div>
                </div>
              )}
            </div>
          </div>
        )
       })
      }

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setModal(null)}>
          <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto" style={{backgroundColor:"rgb(var(--surface))"}} onClick={e=>e.stopPropagation()}>
            <div className="sticky top-0 border-b px-5 py-4 flex justify-between" style={{backgroundColor:"rgb(var(--surface))"}}>
              <h2 className="font-bold text-lg">{modal==='add'?ts(lang,'addWork'):'Edit Work'}</h2>
              <button onClick={() => setModal(null)} className="dark:text-slate-500 text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'selectWorker')}</label>
                <select value={form.worker_id??''} onChange={e=>setForm({...form,worker_id:e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {pWorkers.map(w=><option key={w.id} value={w.id}>{w.name} ({w.work_type})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'selectSite')}</label>
                <select value={form.site_id??''} onChange={e=>setForm({...form,site_id:e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'date')}</label>
                <input type="date" value={form.work_date??''} onChange={e=>setForm({...form,work_date:e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'priceCharged')}</label>
                  <input type="number" inputMode="decimal" value={priceStr} onChange={e=>setPriceStr(e.target.value)}
                    placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'amountPaid')}</label>
                  <input type="number" inputMode="decimal" value={paidStr} onChange={e=>setPaidStr(e.target.value)}
                    placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'status')}</label>
                <div className="flex gap-2">
                  {['Active','Completed'].map(s => (
                    <button key={s} onClick={() => setForm({...form,status:s})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${form.status===s?'bg-amber-600 text-white border-amber-500':'dark:bg-slate-800 bg-gray-50 dark:border-slate-600 border-gray-200'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'notes')}</label>
                <textarea rows={2} value={form.notes??''} onChange={e=>setForm({...form,notes:e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <button onClick={save} disabled={saving} className="w-full bg-amber-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
                {saving?'⏳...':ts(lang,'save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PrivateWork() { return <AppShell><PrivateWorkPage /></AppShell> }
