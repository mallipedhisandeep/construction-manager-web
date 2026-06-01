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
  const [modal, setModal] = useState<'add'|'edit'|'detail'|'pay'|'hist'|null>(null)
  const [selected, setSelected] = useState<PrivateWorker | null>(null)
  const [form, setForm] = useState({ name:'', work_type:'', phone:'', notes:'' })
  const [payForm, setPayForm] = useState({ amount:'', direction:'dad_to_worker', mode:'Cash', notes:'' })
  const [hist, setHist] = useState<Array<{date:string;amount:number;isOut:boolean;label:string;sublabel:string;id?:string;canDel:boolean}>>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const getBalance = useCallback(async (workerId: string) => {
    const [{ data: work }, { data: pays }] = await Promise.all([
      supabase.from('private_work').select('price_charged,amount_paid').eq('worker_id', workerId),
      supabase.from('private_worker_payments').select('amount,direction').eq('worker_id', workerId)
    ])
    let charged = 0, paid = 0
    work?.forEach(w => { charged += w.price_charged; paid += w.amount_paid })
    pays?.forEach(p => { if (p.direction==='dad_to_worker') paid += p.amount; else charged += p.amount })
    return charged - paid
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('private_workers').select('*').is('deleted_at', null).order('name')
    if (!data) { setLoading(false); return }
    const withBal = await Promise.all(data.map(async w => ({ ...w, balance: await getBalance(w.id) })))
    setWorkers(withBal)
    setLoading(false)
  }, [getBalance])

  useEffect(() => { load() }, [load])

  const loadHist = async (workerId: string) => {
    const [{ data: pays }, { data: work }] = await Promise.all([
      supabase.from('private_worker_payments').select('*').eq('worker_id', workerId).order('created_at', {ascending:false}),
      supabase.from('private_work').select('*').eq('worker_id', workerId).gt('amount_paid', 0).order('work_date', {ascending:false})
    ])
    const entries: typeof hist = []
    pays?.forEach(p => entries.push({ date:p.date, amount:p.amount, isOut:p.direction==='dad_to_worker', label:p.direction==='dad_to_worker'?ts(lang,'youToWorker'):ts(lang,'workerToYou'), sublabel:`${p.mode}${p.notes?` · ${p.notes}`:''}`, id:p.id, canDel:true }))
    work?.forEach(w => entries.push({ date:w.work_date, amount:w.amount_paid, isOut:true, label:`Work — ${w.site_name}`, sublabel:w.work_type, canDel:false }))
    entries.sort((a,b) => b.date.localeCompare(a.date))
    setHist(entries)
  }

  const saveWorker = async () => {
    setSaving(true)
    // ── FIX: stamp user_id on insert ──
    const userId = await uid()
    if (modal==='add') {
      await supabase.from('private_workers').insert({ ...form, user_id: userId })
      showToast(ts(lang,'savedOk'))
    } else {
      await supabase.from('private_workers').update(form).eq('id', selected!.id!)
      showToast(ts(lang,'savedOk'))
    }
    setSaving(false); setModal(null); load()
  }

  const savePayment = async () => {
    if (!payForm.amount || !selected) return
    setSaving(true)
    // ── FIX: stamp user_id on payment insert ──
    const userId = await uid()
    await supabase.from('private_worker_payments').insert({
      worker_id: selected.id, amount: +payForm.amount,
      direction: payForm.direction, mode: payForm.mode,
      date: new Date().toISOString().split('T')[0], notes: payForm.notes,
      source: 'manual', user_id: userId,
    })
    setSaving(false); setModal(null); load(); showToast(ts(lang,'savedOk'))
  }

  const del = async (w: PrivateWorker) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    await supabase.from('private_workers').update({ deleted_at: new Date().toISOString() }).eq('id', w.id!)
    showToast('Moved to recycle bin 🗑️')
    load()
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {toast && <div className="fixed top-16 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <button onClick={() => { setForm({name:'',work_type:'',phone:'',notes:''}); setModal('add') }}
        className="w-full mb-4 bg-amber-600 text-white rounded-xl py-3 font-semibold hover:bg-amber-600 flex items-center justify-center gap-2">
        + {ts(lang,'addContractor')}
      </button>

      {loading ? <div className="text-center py-10 dark:text-slate-500 text-gray-400">{ts(lang,'loading')}</div> :
       workers.length === 0 ? <div className="text-center py-10 dark:text-slate-500 text-gray-400">{ts(lang,'noContractors')}</div> :
       workers.map(w => {
        const bal = w.balance ?? 0
        const balColor = bal > 0 ? 'text-green-600 bg-green-50 border-green-200' : bal < 0 ? 'text-red-600 bg-red-50 border-red-200' : 'dark:text-slate-400 text-gray-500 dark:bg-slate-800 bg-gray-50 dark:border-slate-600 border-gray-200'
        const balLabel = bal > 0 ? `₹${bal.toFixed(0)} ${ts(lang,'toGive')}` : bal < 0 ? `₹${Math.abs(bal).toFixed(0)} ${ts(lang,'toReceive')}` : ts(lang,'settled')
        return (
          <div key={w.id} className="dark:bg-slate-800 bg-white border rounded-xl shadow-sm mb-3 p-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-lg flex-shrink-0">{w.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold ">{w.name}</span>
                  <span className="text-xs dark:text-slate-400 text-gray-500">{w.work_type}</span>
                </div>
                {w.phone && <a href={`tel:${w.phone}`} className="text-xs text-green-600">📞 {w.phone}</a>}
                <div className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-lg border font-semibold ${balColor}`}>{balLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t dark:border-slate-700 border-gray-100">
              <button onClick={() => { setSelected(w); setPayForm({amount:'',direction:'dad_to_worker',mode:'Cash',notes:''}); setModal('pay') }}
                className="flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold py-2.5 rounded-xl transition">
                💳 Add Payment
              </button>
              <button onClick={async () => { setSelected(w); await loadHist(w.id!); setModal('hist') }}
                className="flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold py-2.5 rounded-xl transition">
                📜 History
              </button>
              <button onClick={() => { setSelected(w); setForm({name:w.name,work_type:w.work_type,phone:w.phone,notes:w.notes??''}); setModal('edit') }}
                className="flex items-center justify-center gap-1.5 bg-slate-800/50 hover:bg-amber-900/30 text-amber-400 text-sm font-semibold py-2.5 rounded-xl transition">
                ✏️ Edit
              </button>
              <button onClick={() => del(w)}
                className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold py-2.5 rounded-xl transition">
                🗑️ Delete
              </button>
            </div>
          </div>
        )
       })
      }

      {(modal==='add'||modal==='edit') && (
        <Overlay onClose={() => setModal(null)} title={modal==='add'?ts(lang,'addContractor'):'Edit Contractor'}>
          {['name','work_type','phone'].map(k => (
            <div key={k}>
              <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1 capitalize">{k.replace('_',' ')}</label>
              <input value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})} maxLength={k==='phone'?10:undefined}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <Btn onClick={saveWorker} saving={saving}>{ts(lang,'save')}</Btn>
        </Overlay>
      )}

      {modal==='pay' && (
        <Overlay onClose={() => setModal(null)} title={`${ts(lang,'addPayment')} — ${selected?.name}`}>
          <div>
            <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'direction')}</label>
            <div className="flex gap-2">
              {[['dad_to_worker',ts(lang,'youToWorker')],['worker_to_dad',ts(lang,'workerToYou')]].map(([v,l]) => (
                <button key={v} onClick={() => setPayForm({...payForm,direction:v})}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${payForm.direction===v?'bg-amber-600 text-white border-amber-500':'dark:bg-slate-800 bg-gray-50 dark:border-slate-600 border-gray-200'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">₹ Amount</label>
              <input type="number" value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'paymentMode')}</label>
              <select value={payForm.mode} onChange={e=>setPayForm({...payForm,mode:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                {['Cash','Online'].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-slate-200 text-gray-700 mb-1">{ts(lang,'notes')}</label>
            <input value={payForm.notes} onChange={e=>setPayForm({...payForm,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <Btn onClick={savePayment} saving={saving}>{ts(lang,'save')}</Btn>
        </Overlay>
      )}

      {modal==='hist' && (
        <Overlay onClose={() => setModal(null)} title={`${ts(lang,'paymentHistory')} — ${selected?.name}`}>
          {hist.length === 0 ? <p className="dark:text-slate-500 text-gray-400 text-center py-4">{ts(lang,'noWork')}</p> :
           hist.map((h,i) => (
            <div key={i} className="flex items-center gap-3 p-2 border rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${h.isOut?'bg-green-100 text-green-600':'bg-red-100 text-red-600'}`}>{h.isOut?'↑':'↓'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${h.isOut?'text-green-600':'text-red-600'}`}>₹{h.amount}</span>
                  <span className="text-xs dark:text-slate-400 text-gray-500 truncate">{h.label}</span>
                </div>
                <div className="text-xs dark:text-slate-500 text-gray-400">{h.date} · {h.sublabel}</div>
              </div>
              {h.canDel && h.id && <button onClick={async()=>{await supabase.from('private_worker_payments').delete().eq('id',h.id!);loadHist(selected!.id!);load()}} className="text-red-400 text-xs">🗑️</button>}
            </div>
           ))
          }
        </Overlay>
      )}
    </div>
  )
}

const Overlay = ({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
    <div className="dark:bg-slate-800 bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
      <div className="sticky top-0 border-b px-5 py-4 flex justify-between" style={{backgroundColor:'rgb(var(--surface))'}}>
        <h2 className="font-bold text-base">{title}</h2>
        <button onClick={onClose} className="dark:text-slate-500 text-gray-400 text-xl">✕</button>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  </div>
)

const Btn = ({ onClick, saving, children }: { onClick:()=>void; saving:boolean; children:React.ReactNode }) => (
  <button onClick={onClick} disabled={saving} className="w-full bg-amber-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
    {saving?'⏳...':children}
  </button>
)

export default function PrivateWorkers() { return <AppShell><PrivateWorkersPage /></AppShell> }
