'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts } from '@/lib/strings'
import type { PrivateWorker, PrivateWorkerPayment } from '@/lib/types'

function PrivateWorkersPage() {
  const { lang } = useLang()
  const [workers, setWorkers] = useState<(PrivateWorker & { balance?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'add'|'edit'|'pay'|'hist'|null>(null)
  const [selected,setSelected]= useState<PrivateWorker|null>(null)
  const [form,    setForm]    = useState({ name:'', work_type:'', phone:'', notes:'' })
  const [payForm, setPayForm] = useState({ amount:'', direction:'dad_to_worker', mode:'Cash', notes:'' })
  const [hist,    setHist]    = useState<Array<{date:string;amount:number;isOut:boolean;label:string;sublabel:string;id?:string;canDel:boolean}>>([])
  const [saving,  setSaving]  = useState(false)
  // FIX M6: typed with | undefined so setToast(undefined) works correctly
  const [toast,   setToast]   = useState<{msg:string;ok:boolean}|undefined>()

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined),3000) }

  // DATA-5: filter all queries by user_id
  const load = useCallback(async () => {
    setLoading(true)
    const userId = await uid()
    const [{ data: workers }, { data: allWork }, { data: allPays }] = await Promise.all([
      supabase.from('private_workers').select('*').eq('user_id', userId).is('deleted_at', null).order('name'),
      supabase.from('private_work').select('worker_id,price_charged,amount_paid').eq('user_id', userId),
      supabase.from('private_worker_payments').select('worker_id,amount,direction').eq('user_id', userId),
    ])
    if (!workers) { setLoading(false); return }

    const withBal = workers.map(w => {
      let charged = 0, paid = 0
      allWork?.filter(x=>x.worker_id===w.id).forEach(x=>{ charged += x.price_charged; paid += x.amount_paid })
      allPays?.filter(x=>x.worker_id===w.id).forEach(p=>{ if(p.direction==='dad_to_worker') paid+=p.amount; else charged+=p.amount })
      return { ...w, balance: charged - paid }
    })
    setWorkers(withBal)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadHist = async (workerId: string) => {
    const userId = await uid()
    const [{ data: pays }, { data: work }] = await Promise.all([
      supabase.from('private_worker_payments').select('*').eq('worker_id', workerId).eq('user_id', userId).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('private_work').select('*').eq('worker_id', workerId).eq('user_id', userId).gt('amount_paid',0).order('work_date',{ascending:false}),
    ])
    const entries: typeof hist = []
    pays?.forEach(p => entries.push({ date:p.date, amount:p.amount, isOut:p.direction==='dad_to_worker', label:p.direction==='dad_to_worker'?ts(lang,'youToWorker'):ts(lang,'workerToYou'), sublabel:`${p.mode}${p.notes?` · ${p.notes}`:''}`, id:p.id, canDel:true }))
    work?.forEach(w => entries.push({ date:w.work_date, amount:w.amount_paid, isOut:true, label:`Work — ${w.site_name}`, sublabel:w.work_type, canDel:false }))
    entries.sort((a,b)=>b.date.localeCompare(a.date))
    setHist(entries)
  }

  const saveWorker = async () => {
    if (!form.name.trim()) { showToast('Name required',false); return }
    setSaving(true)
    const userId = await uid()
    const { error } = modal==='add'
      ? await supabase.from('private_workers').insert({ ...form, user_id: userId })
      : await supabase.from('private_workers').update(form).eq('id', selected!.id!)
    setSaving(false)
    if (error) { showToast(error.message,false); return }
    setModal(null); load(); showToast(ts(lang,'savedOk'))
  }

  const savePayment = async () => {
    if (!payForm.amount || !selected) return
    setSaving(true)
    const userId = await uid()
    const { error } = await supabase.from('private_worker_payments').insert({
      worker_id: selected.id, amount: +payForm.amount,
      direction: payForm.direction, mode: payForm.mode,
      date: new Date().toISOString().split('T')[0], notes: payForm.notes,
      source: 'manual', user_id: userId,
    })
    setSaving(false)
    if (error) { showToast(error.message,false); return }
    setModal(null); load(); showToast(ts(lang,'savedOk'))
  }

  const del = async (w: PrivateWorker) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    await supabase.from('private_workers').update({ deleted_at: new Date().toISOString() }).eq('id', w.id!)
    showToast('Moved to recycle bin 🗑️'); load()
  }

  return (
    <div className="page">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}

      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>🔧 {ts(lang,'privateWorkers')}</h1>
          <button onClick={()=>{ setForm({name:'',work_type:'',phone:'',notes:''}); setModal('add') }} className="btn-primary btn-sm">
            + {ts(lang,'addContractor')}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/></div>
        ) : workers.length===0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-3 opacity-30">🔧</div><p style={{color:'rgb(var(--muted))'}}>{ts(lang,'noContractors')}</p></div>
        ) : workers.map(w => {
          const bal = w.balance ?? 0
          return (
            <div key={w.id} className="card mb-3 p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0" style={{background:'rgba(139,92,246,0.15)',color:'#7c3aed'}}>{w.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold" style={{color:'rgb(var(--text))'}}>{w.name}</span>
                    <span className="text-xs" style={{color:'rgb(var(--muted))'}}>{w.work_type}</span>
                  </div>
                  {w.phone && <a href={`tel:${w.phone}`} className="text-xs text-green-600 dark:text-green-400">📞 {w.phone}</a>}
                  <div className="inline-block mt-1.5 text-xs px-2.5 py-1 rounded-xl font-semibold"
                    style={{
                      background: bal>0?'rgba(22,163,74,0.12)':bal<0?'rgba(220,38,38,0.12)':'rgb(var(--surface2))',
                      color: bal>0?'#15803d':bal<0?'#b91c1c':'rgb(var(--muted))',
                      border:`1px solid ${bal>0?'rgba(22,163,74,0.3)':bal<0?'rgba(220,38,38,0.3)':'rgb(var(--border))'}`,
                    }}>
                    {bal===0 ? ts(lang,'settled') : bal>0 ? `₹${bal.toFixed(0)} ${ts(lang,'toGive')}` : `₹${Math.abs(bal).toFixed(0)} ${ts(lang,'toReceive')}`}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t" style={{borderColor:'rgb(var(--border))'}}>
                <button onClick={()=>{ setSelected(w); setPayForm({amount:'',direction:'dad_to_worker',mode:'Cash',notes:''}); setModal('pay') }} className="btn-green btn-sm">💳 {ts(lang,'addPayment')}</button>
                <button onClick={async()=>{ setSelected(w); await loadHist(w.id!); setModal('hist') }} className="btn-ghost btn-sm">📜 {ts(lang,'history')}</button>
                <button onClick={()=>{ setSelected(w); setForm({name:w.name,work_type:w.work_type,phone:w.phone,notes:w.notes??''}); setModal('edit') }} className="btn-ghost btn-sm" style={{color:'rgb(var(--accent))'}}>✏️ {ts(lang,'edit')}</button>
                <button onClick={()=>del(w)} className="btn-danger btn-sm">🗑️ {ts(lang,'delete')}</button>
              </div>
            </div>
          )
        })}
      </div>

      {(modal==='add'||modal==='edit') && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{modal==='add'?ts(lang,'addContractor'):'Edit Contractor'}</h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              {(['name','work_type','phone'] as const).map(k=>(
                <div key={k}><label className="label">{k.replace('_',' ')}</label><input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} maxLength={k==='phone'?10:undefined} className="input"/></div>
              ))}
              <div><label className="label">{ts(lang,'notes')}</label><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="input"/></div>
              <button onClick={saveWorker} disabled={saving} className="btn-primary btn-full">{saving?'⏳...':ts(lang,'save')}</button>
            </div>
          </div>
        </div>
      )}

      {modal==='pay' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{ts(lang,'addPayment')} — {selected?.name}</h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">{ts(lang,'direction')}</label>
                <div className="flex gap-2">
                  {[['dad_to_worker',ts(lang,'youToWorker')],['worker_to_dad',ts(lang,'workerToYou')]].map(([v,l])=>(
                    <button key={v} onClick={()=>setPayForm({...payForm,direction:v})}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: payForm.direction===v?'linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent2)))':'rgb(var(--surface2))',
                        color: payForm.direction===v?'#fff':'rgb(var(--text))',
                        border:`1px solid ${payForm.direction===v?'transparent':'rgb(var(--border))'}`,
                      }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">₹ Amount</label><input type="number" value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} className="input"/></div>
                <div><label className="label">{ts(lang,'paymentMode')}</label>
                  <select value={payForm.mode} onChange={e=>setPayForm({...payForm,mode:e.target.value})} className="input">
                    {['Cash','Online'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">{ts(lang,'notes')}</label><input value={payForm.notes} onChange={e=>setPayForm({...payForm,notes:e.target.value})} className="input"/></div>
              <button onClick={savePayment} disabled={saving} className="btn-green btn-full">{saving?'⏳...':ts(lang,'save')}</button>
            </div>
          </div>
        </div>
      )}

      {modal==='hist' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{ts(lang,'paymentHistory')} — {selected?.name}</h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-2">
              {hist.length===0 ? <p className="text-center py-4" style={{color:'rgb(var(--muted))'}}>{ts(lang,'noWork')}</p> :
               hist.map((h,i)=>(
                <div key={i} className="card p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{background:h.isOut?'rgba(22,163,74,0.12)':'rgba(220,38,38,0.12)',color:h.isOut?'#15803d':'#b91c1c'}}>
                    {h.isOut?'↑':'↓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="font-bold" style={{color:h.isOut?'#15803d':'#b91c1c'}}>₹{h.amount}</span><span className="text-xs truncate" style={{color:'rgb(var(--muted))'}}>{h.label}</span></div>
                    <div className="text-xs" style={{color:'rgb(var(--muted))'}}>{h.date} · {h.sublabel}</div>
                  </div>
                  {h.canDel && h.id && (
                    <button onClick={async()=>{ await supabase.from('private_worker_payments').update({deleted_at:new Date().toISOString()}).eq('id',h.id!); loadHist(selected!.id!); load() }} className="text-red-400 text-xs p-1.5">🗑️</button>
                  )}
                </div>
               ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PrivateWorkers() { return <AppShell><PrivateWorkersPage /></AppShell> }
