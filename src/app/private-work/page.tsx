'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts } from '@/lib/strings'
import type { PrivateWork, PrivateWorker, Site } from '@/lib/types'

function PrivateWorkPage() {
  const { lang } = useLang()
  const [works,    setWorks]    = useState<PrivateWork[]>([])
  const [pWorkers, setPWorkers] = useState<PrivateWorker[]>([])
  const [sites,    setSites]    = useState<Pick<Site,'id'|'site_name'>[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('All')
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState<'add'|'edit'|null>(null)
  const [form,     setForm]     = useState<Partial<PrivateWork>>({ status:'Active', price_charged:0, amount_paid:0 })
  const [priceStr, setPriceStr] = useState('')
  const [paidStr,  setPaidStr]  = useState('')
  const [saving,   setSaving]   = useState(false)

  const { showToast: _showToast } = useToast()
  const showToast = (msg: string, ok = true) => _showToast(msg, ok ? 'ok' : 'err')

  const load = useCallback(async () => {
    setLoading(true)
   
    const userId = await uid()
    if (!userId) { setLoading(false); return }
    const [{ data: w }, { data: pw }, { data: s }] = await Promise.all([
      supabase.from('private_work').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at',{ascending:false}),
      supabase.from('private_workers').select('*').eq('user_id', userId).is('deleted_at', null).order('name'),
      supabase.from('sites').select('id,site_name').eq('user_id', userId).eq('status','Active').is('deleted_at', null),
    ])
    setWorks(w??[]); setPWorkers(pw??[]); setSites(s??[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const PW_ORDER: Record<string,number> = { Active:0, Completed:1 }
  const allSorted   = [...works].sort((a,b) => (PW_ORDER[a.status]??1) - (PW_ORDER[b.status]??1))
  const filteredByStatus = filter==='All' ? allSorted : allSorted.filter(w=>w.status===filter)
  const filtered = search.trim()
    ? filteredByStatus.filter(w => w.worker_name.toLowerCase().includes(search.toLowerCase()) || w.site_name.toLowerCase().includes(search.toLowerCase()) || w.work_type.toLowerCase().includes(search.toLowerCase()))
    : filteredByStatus
  const totalPending = works.filter(w=>w.status==='Active').reduce((s,w)=>s+(w.price_charged-w.amount_paid),0)

  const save = async () => {
    if (!form.worker_id||!form.site_id) { showToast(ts(lang,'required'), false); return }
    const priceCharged = parseFloat(priceStr)||0
    const amountPaid   = parseFloat(paidStr)||0
    
    if (amountPaid > priceCharged) {
      showToast(lang==='te' ? 'చెల్లింపు చార్జ్ కంటే ఎక్కువగా ఉండకూడదు' : 'Amount paid cannot exceed price charged', false)
      return
    }
    setSaving(true)
    const worker = pWorkers.find(w=>w.id===form.worker_id)
    const site   = sites.find(s=>s.id===form.site_id)
    const userId = await uid()
    if (!userId) { setSaving(false); showToast('Not logged in', false); return }
    const data   = {
      ...form,
      worker_name:   worker?.name??'',
      work_type:     worker?.work_type??'',
      site_name:     site?.site_name??'',
      work_date:     form.work_date ?? new Date().toISOString().split('T')[0],
      price_charged: priceCharged,
      amount_paid:   amountPaid,
    }
    const { error } = modal==='add'
      ? await supabase.from('private_work').insert({ ...data, user_id: userId })
      : await supabase.from('private_work').update(data).eq('id', form.id!)
    setSaving(false)
    if (error) { showToast('Save failed: '+error.message, false); return }
    setModal(null); load(); showToast(ts(lang,'savedOk'))
  }

  
  const del = async (w: PrivateWork) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    const { error } = await supabase
      .from('private_work')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', w.id!)
    if (error) { showToast('Delete failed', false); return }
    showToast('Moved to recycle bin 🗑️')
    load()
  }

  return (
    <div className="page">

      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>📝 {ts(lang,'privateWork')}</h1>
          </div>
          <button onClick={()=>{
            setForm({status:'Active',price_charged:0,amount_paid:0,work_date:new Date().toISOString().split('T')[0]})
            setPriceStr(''); setPaidStr(''); setModal('add')
          }} className="btn-primary btn-sm" data-testid="add-contract-work-btn">+ {ts(lang,'addWork')}</button>
        </div>
        {totalPending>0 && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-sm font-semibold"
            style={{background:'rgba(var(--accent),0.12)',border:'1px solid rgba(var(--accent),0.3)',color:'rgb(var(--accent))'}}>
            ⚠️ {ts(lang,'totalPending')}: ₹{totalPending.toFixed(0)}
          </div>
        )}
        <div className="flex gap-2 mb-2.5">
          {['All','Active','Completed'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`chip ${filter===f?'chip-active':'chip-idle'}`}>{f==='All'?(lang==='te'?'అన్నీ':'All'):f==='Active'?ts(lang,'active'):ts(lang,'completed')}</button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={lang==='te'?'పేరు, సైట్ వెతకండి...':'Search worker, site...'} className="input py-2 text-sm" />
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
          </div>
        ) : filtered.length===0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-3 opacity-20">📝</div><p style={{color:'rgb(var(--muted))'}}>{ts(lang,'noWork')}</p></div>
        ) : filtered.map(w=>{
          const bal = w.price_charged - w.amount_paid
          return (
            <div key={w.id} className="card mb-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold" style={{color:'rgb(var(--text))'}}>{w.worker_name}</span>
                    <span className={w.status==='Active'?'badge-green':'badge-blue'}>{w.status==='Active'?ts(lang,'active'):ts(lang,'completed')}</span>
                  </div>
                  <div className="text-sm mt-0.5" style={{color:'rgb(var(--muted))'}}>🔧 {w.work_type} · 📍 {w.site_name}</div>
                  <div className="text-xs" style={{color:'rgb(var(--muted))'}}>📅 {w.work_date}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>{ setForm({...w}); setPriceStr(w.price_charged?.toString()??''); setPaidStr(w.amount_paid?.toString()??''); setModal('edit') }}
                    className="p-1.5 rounded-lg" style={{color:'rgb(var(--accent))'}} data-testid={w.worker_name === 'Demo Contractor' ? 'demo-contract-work-edit-btn' : undefined}>✏️</button>
                  <button onClick={()=>del(w)} className="p-1.5 text-red-500 rounded-lg" data-testid={w.worker_name === 'Demo Contractor' ? 'demo-contract-work-delete-btn' : undefined}>🗑️</button>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 rounded-xl p-2 text-center" style={{background:'rgba(59,130,246,0.1)'}}>
                  <div className="text-xs text-blue-600 dark:text-blue-400">{ts(lang,'charged')}</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400">₹{w.price_charged}</div>
                </div>
                <div className="flex-1 rounded-xl p-2 text-center" style={{background:'rgba(22,163,74,0.1)'}}>
                  <div className="text-xs text-green-600 dark:text-green-400">{ts(lang,'paid')}</div>
                  <div className="font-bold text-green-600 dark:text-green-400">₹{w.amount_paid}</div>
                </div>
                {bal>0 && (
                  <div className="flex-1 rounded-xl p-2 text-center" style={{background:'rgba(var(--accent),0.1)'}}>
                    <div className="text-xs" style={{color:'rgb(var(--accent))'}}>{ts(lang,'due')}</div>
                    <div className="font-bold" style={{color:'rgb(var(--accent))'}}>₹{bal}</div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} data-testid="contract-work-form-modal">
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{modal==='add'?ts(lang,'addWork'):'Edit Work'}</h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}} data-testid="contract-work-form-modal-close">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">{ts(lang,'selectWorker')}</label>
                <select value={form.worker_id??''} onChange={e=>setForm({...form,worker_id:e.target.value})} className="input">
                  <option value="">— Select —</option>
                  {pWorkers.map(w=><option key={w.id} value={w.id}>{w.name} ({w.work_type})</option>)}
                </select>
              </div>
              <div>
                <label className="label">{ts(lang,'selectSite')}</label>
                <select value={form.site_id??''} onChange={e=>setForm({...form,site_id:e.target.value})} className="input">
                  <option value="">— Select —</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{ts(lang,'date')}</label>
                <input type="date" value={form.work_date??''} onChange={e=>setForm({...form,work_date:e.target.value})} className="input"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{ts(lang,'priceCharged')}</label>
                  <input type="number" inputMode="decimal" value={priceStr} onChange={e=>setPriceStr(e.target.value)} placeholder="0" className="input"/>
                </div>
                <div>
                  <label className="label">{ts(lang,'amountPaid')}</label>
                  <input type="number" inputMode="decimal" value={paidStr} onChange={e=>setPaidStr(e.target.value)} placeholder="0" className="input"/>
                </div>
              </div>
              <div>
                <label className="label">{ts(lang,'status')}</label>
                <div className="flex gap-2">
                  {['Active','Completed'].map(s=>(
                    <button key={s} onClick={()=>setForm({...form,status:s})}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition"
                      style={form.status===s
                        ? {background:'linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent2)))',color:'#fff',borderColor:'transparent'}
                        : {background:'rgb(var(--surface2))',borderColor:'rgb(var(--border))',color:'rgb(var(--text))'}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">{ts(lang,'notes')}</label>
                <textarea rows={2} value={form.notes??''} onChange={e=>setForm({...form,notes:e.target.value})} className="input resize-none"/>
              </div>
              <button onClick={save} disabled={saving} className="btn-primary btn-full">{saving?'⏳...':ts(lang,'save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PrivateWork() { return <PrivateWorkPage /> }
