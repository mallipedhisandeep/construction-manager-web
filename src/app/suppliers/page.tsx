'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import type { Supplier, SupplierGoods, SupplierPayment } from '@/lib/types'

const UNITS = ['bags','tons','pieces','sq.ft','cu.ft','liters','kg','loads','rods','tiles','Nos']
type SupplierFull = Supplier & { id: string; balance?: number; goodsCount?: number }

function SuppliersPage() {
  const { lang } = useLang()
  const te = lang === 'te'

  const [suppliers, setSuppliers] = useState<SupplierFull[]>([])
  const [selected,  setSelected]  = useState<SupplierFull | null>(null)
  const [goods,     setGoods]     = useState<SupplierGoods[]>([])
  const [payments,  setPayments]  = useState<SupplierPayment[]>([])
  const [view,      setView]      = useState<'list'|'detail'>('list')
  const [tab,       setTab]       = useState<'goods'|'payments'>('goods')
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<'supplier'|'goods'|'payment'|null>(null)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<{msg:string;ok:boolean}>()
  const [sForm, setSForm] = useState<Partial<Supplier>>({})
  const [gForm, setGForm] = useState<Partial<SupplierGoods>>({ unit:'bags' })
  const [pForm, setPForm] = useState<Partial<SupplierPayment>>({ payment_type:'payment', mode:'Cash' })

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined),3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').is('deleted_at', null).order('name')
    if (!data) { setLoading(false); return }
    const withBal = await Promise.all(data.map(async (sup) => {
      const [{ data:pays }, { data:orders }, { count:gc }] = await Promise.all([
        supabase.from('supplier_payments').select('amount').eq('supplier_id', sup.id),
        supabase.from('goods_orders').select('total_price').eq('supplier_id', sup.id),
        supabase.from('supplier_goods').select('id',{count:'exact',head:true}).eq('supplier_id', sup.id),
      ])
      const paid = pays?.reduce((s,p)=>s+p.amount,0)??0
      const owed = orders?.reduce((s,o)=>s+o.total_price,0)??0
      return { ...sup, balance: owed - paid, goodsCount: gc??0 } as SupplierFull
    }))
    setSuppliers(withBal)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadDetail = async (sup: SupplierFull) => {
    setSelected(sup); setView('detail'); setTab('goods')
    const [{ data:g }, { data:p }] = await Promise.all([
      supabase.from('supplier_goods').select('*').eq('supplier_id', sup.id).order('goods_name'),
      supabase.from('supplier_payments').select('*').eq('supplier_id', sup.id).order('created_at',{ascending:false}),
    ])
    setGoods(g??[]); setPayments(p??[])
  }

  const saveSup = async () => {
    if (!sForm.name?.trim()) return
    setSaving(true)
    try {
      const payload = {
        name:      sForm.name?.trim() ?? '',
        phone:     sForm.phone?.trim() ?? '',
        shop_name: sForm.shop_name?.trim() ?? '',
        notes:     sForm.notes ?? '',
      }
      const userId = await uid()
      const { error } = modal==='supplier' && selected
        ? await supabase.from('suppliers').update(payload).eq('id',selected.id)
        : await supabase.from('suppliers').insert({ ...payload, user_id: userId })
      if (error) throw error
      setModal(null); load()
      showToast(te ? 'సరఫరాదారు సేవ్ అయింది!' : 'Supplier saved!')
    } catch(e:unknown) { showToast((e as Error).message,false) } finally { setSaving(false) }
  }

  const saveGoods = async () => {
    if (!gForm.goods_name?.trim()||!selected) return
    setSaving(true)
    try {
      const userId = await uid()
      const { error } = await supabase.from('supplier_goods').insert({ ...gForm, supplier_id:selected.id, user_id: userId })
      if (error) throw error
      await loadDetail(selected); setModal(null)
      showToast(te ? 'వస్తువు జోడించబడింది!' : 'Goods added!')
    } catch(e:unknown) { showToast((e as Error).message,false) } finally { setSaving(false) }
  }

  const savePayment = async () => {
    if (!pForm.amount||!selected) return
    setSaving(true)
    try {
      const userId = await uid()
      const { error } = await supabase.from('supplier_payments').insert({
        ...pForm, supplier_id:selected.id,
        payment_date: pForm.payment_date||new Date().toISOString().split('T')[0],
        user_id: userId,
      })
      if (error) throw error
      const updated = { ...selected, balance:(selected.balance??0)-pForm.amount! }
      setSelected(updated as SupplierFull)
      await loadDetail(updated as SupplierFull)
      setModal(null); load()
      showToast(te ? 'చెల్లింపు సేవ్ అయింది!' : 'Payment saved!')
    } catch(e:unknown) { showToast((e as Error).message,false) } finally { setSaving(false) }
  }

  const delGoods = async (id:string) => {
    await supabase.from('supplier_goods').delete().eq('id',id)
    if (selected) await loadDetail(selected)
  }
  const delPayment = async (id:string) => {
    await supabase.from('supplier_payments').delete().eq('id',id)
    if (selected) await loadDetail(selected); load()
  }
  const delSup = async () => {
    if (!selected||!confirm(te ? 'సరఫరాదారుని చెత్తబుట్టకు తరలించాలా?' : 'Move supplier to recycle bin?')) return
    await supabase.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', selected.id)
    setView('list'); load()
    showToast(te ? 'చెత్తబుట్టకు తరలించబడింది 🗑️' : 'Moved to recycle bin 🗑️', false)
  }

  const bal = selected?.balance ?? 0

  return (
    <div className="page">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}

      {view==='list' ? (
        <>
          <div className="page-header">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black dark:text-slate-100 text-gray-800">🏪 {te?'సరఫరాదారులు':'Suppliers'}</h1>
              <button onClick={()=>{ setSForm({}); setSelected(null); setModal('supplier') }} className="btn-primary btn-sm">+ {te?'సరఫరాదారు జోడించు':'Add Supplier'}</button>
            </div>
          </div>
          <div className="px-4 pt-4">
            {loading
              ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"/></div>
              : suppliers.length===0
                ? <div className="text-center py-16"><div className="text-5xl mb-2 opacity-20">🏪</div><p className="dark:text-slate-500 text-gray-400">{te?'సరఫరాదారులు లేరు':'No suppliers yet'}</p></div>
                : suppliers.map(sup => {
                  const b = sup.balance??0
                  return (
                    <div key={sup.id} className="card-hover mb-3 p-4" onClick={()=>loadDetail(sup)}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-400 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0">{sup.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold dark:text-slate-100 text-gray-800">{sup.name}</p>
                          {sup.shop_name && <p className="text-xs dark:text-slate-500 text-gray-400">🏪 {sup.shop_name}</p>}
                          <div className="flex gap-2 mt-1 flex-wrap items-center">
                            {sup.phone && <span className="text-xs text-green-600 font-medium">📞 {sup.phone}</span>}
                            <span className="badge-gray">{sup.goodsCount} {te?'వస్తువులు':'goods'}</span>
                          </div>
                        </div>
                        <div className={`text-xs font-bold px-2.5 py-1.5 rounded-xl ${b>0?'bg-red-50 text-red-600':b<0?'bg-green-50 text-green-700':'bg-gray-100 dark:text-slate-400 text-gray-500'}`}>
                          {b===0
                            ? (te?'✓ క్లియర్':'✓ Settled')
                            : b>0
                              ? (te?`మేము ₹${b.toFixed(0)} ఇవ్వాలి`:`We Owe ₹${b.toFixed(0)}`)
                              : (te?`అడ్వాన్స్ ₹${Math.abs(b).toFixed(0)}`:`Advance ₹${Math.abs(b).toFixed(0)}`)}
                        </div>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </>
      ) : selected && (
        <>
          <div className="page-header">
            <div className="flex items-center gap-3">
              <button onClick={()=>setView('list')} className="text-orange-600 font-bold text-sm">← {te?'వెనక్కి':'Back'}</button>
              <div className="flex-1 min-w-0">
                <p className="font-black dark:text-slate-100 text-gray-800 truncate">{selected.name}</p>
                {selected.shop_name && <p className="text-xs dark:text-slate-500 text-gray-400">{selected.shop_name}</p>}
              </div>
              <div className="flex gap-1">
                {selected.phone && <a href={`tel:${selected.phone}`} className="p-2 bg-green-50 text-green-600 rounded-xl text-sm">📞</a>}
                <button onClick={()=>{ setSForm({...selected}); setModal('supplier') }} className="p-2 bg-orange-50 text-orange-600 rounded-xl">✏️</button>
                <button onClick={delSup} className="p-2 bg-red-50 text-red-500 rounded-xl">🗑️</button>
              </div>
            </div>
          </div>
          <div className="px-4 pt-3">
            <div className={`rounded-2xl p-4 mb-4 border-2 ${bal>0?'bg-red-50 border-red-200':bal<0?'bg-green-50 border-green-200':'dark:bg-slate-800 bg-gray-50 dark:border-slate-600 border-gray-200'}`}>
              <p className="text-xs font-black dark:text-slate-500 text-gray-400 uppercase tracking-wide mb-1">{te?'బాలెన్స్':'Balance'}</p>
              <p className={`text-2xl font-black ${bal>0?'text-red-600':bal<0?'text-green-700':'dark:text-slate-500 text-gray-400'}`}>₹{Math.abs(bal).toFixed(0)}</p>
              <p className="text-sm dark:text-slate-400 text-gray-500 mt-0.5">
                {bal===0
                  ? (te?'అన్నీ క్లియర్ ✓':'All settled ✓')
                  : bal>0
                    ? (te?'మేము సరఫరాదారుకు ఇవ్వాలి':'We owe supplier')
                    : (te?'సరఫరాదారు మాకు ఇవ్వాలి':'Supplier owes us')}
              </p>
            </div>
            <div className="flex border-b dark:border-slate-700 border-gray-100 mb-4">
              {([
                ['goods',    te?'📦 వస్తువుల జాబితా':'📦 Goods Catalog'],
                ['payments', te?'💳 చెల్లింపు చరిత్ర':'💳 Payment History'],
              ] as const).map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)}
                  className={`flex-1 py-2.5 text-sm font-bold border-b-2 transition ${tab===t?'text-orange-600 border-orange-500':'dark:text-slate-500 text-gray-400 border-transparent'}`}>{l}</button>
              ))}
            </div>
            {tab==='goods' ? (
              <>
                <button onClick={()=>{ setGForm({unit:'bags'}); setModal('goods') }} className="btn-primary w-full mb-3">+ {te?'వస్తువు జోడించు':'Add Goods Item'}</button>
                {goods.length===0
                  ? <div className="text-center py-10 dark:text-slate-500 text-gray-400"><p className="text-4xl mb-2 opacity-30">📦</p><p>{te?'జాబితాలో వస్తువులు లేవు':'No goods in catalog'}</p></div>
                  : goods.map(g=>(
                    <div key={g.id} className="card mb-2 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📦</div>
                      <div className="flex-1">
                        <p className="font-bold dark:text-slate-100 text-gray-800">{g.goods_name}</p>
                        <p className="text-sm dark:text-slate-400 text-gray-500">₹{g.price_per_unit} {te?'ప్రతి':'per'} {g.unit}</p>
                      </div>
                      <button onClick={()=>delGoods(g.id!)} className="text-red-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg">🗑️</button>
                    </div>
                  ))
                }
              </>
            ) : (
              <>
                <button onClick={()=>{ setPForm({payment_type:'payment',mode:'Cash',payment_date:new Date().toISOString().split('T')[0]}); setModal('payment') }}
                  className="btn-green w-full mb-3">+ {te?'చెల్లింపు జోడించు':'Add Payment'}</button>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="card p-3 text-center">
                    <p className="text-lg font-black text-red-600">₹{bal>0?bal.toFixed(0):'0'}</p>
                    <p className="text-xs dark:text-slate-500 text-gray-400">{te?'బాకీ':'Still Owe'}</p>
                  </div>
                  <div className="card p-3 text-center">
                    <p className="text-lg font-black text-green-600">₹{payments.reduce((s,p)=>s+p.amount,0).toFixed(0)}</p>
                    <p className="text-xs dark:text-slate-500 text-gray-400">{te?'మొత్తం చెల్లింపు':'Total Paid'}</p>
                  </div>
                </div>
                {payments.length===0
                  ? <div className="text-center py-10 dark:text-slate-500 text-gray-400"><p className="text-4xl mb-2 opacity-30">💳</p><p>{te?'చెల్లింపులు లేవు':'No payments yet'}</p></div>
                  : payments.map(p=>(
                    <div key={p.id} className="card mb-2 p-3 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${p.payment_type==='advance'?'bg-amber-100':'bg-green-100'}`}>
                        {p.payment_type==='advance'?'🔶':'💳'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold dark:text-slate-100 text-gray-800">₹{p.amount}</span>
                          <span className={p.payment_type==='advance'?'badge-amber':'badge-green'}>{te?(p.payment_type==='advance'?'అడ్వాన్స్':'చెల్లింపు'):p.payment_type}</span>
                          <span className="badge-gray">{te?(p.mode==='Cash'?'నగదు':p.mode==='Online'?'ఆన్‌లైన్':'చెక్కు'):p.mode}</span>
                        </div>
                        <p className="text-xs dark:text-slate-500 text-gray-400 mt-0.5">{p.payment_date}{p.notes?` · ${p.notes}`:''}</p>
                      </div>
                      <button onClick={()=>delPayment(p.id!)} className="text-red-300 hover:text-red-500 text-sm p-1.5">🗑️</button>
                    </div>
                  ))
                }
              </>
            )}
          </div>
        </>
      )}

      {modal==='supplier' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg">{selected&&modal==='supplier'?(te?'సరఫరాదారు సవరించు':'Edit'):(te?'సరఫరాదారు జోడించు':'Add')} {te?'':'Supplier'}</h2>
              <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                {k:'name',      l:te?'సరఫరాదారు పేరు':'Supplier Name', req:true},
                {k:'phone',     l:te?'ఫోన్ నంబర్':'Phone Number',      req:false},
                {k:'shop_name', l:te?'దుకాణం పేరు':'Shop Name',         req:false},
              ].map(({k,l,req})=>(
                <div key={k}><label className="label">{l}{req?' *':''}</label>
                  <input value={(sForm as Record<string,string>)[k]??''} maxLength={k==='phone'?10:undefined} onChange={e=>setSForm({...sForm,[k]:e.target.value})} className="input"/></div>
              ))}
              <div><label className="label">{te?'గమనికలు':'Notes'}</label><textarea rows={2} value={sForm.notes??''} onChange={e=>setSForm({...sForm,notes:e.target.value})} className="input resize-none"/></div>
              <button onClick={saveSup} disabled={saving} className="btn-primary btn-full">
                {saving?(te?'⏳ సేవ్ అవుతోంది...':'⏳ Saving...'):(te?'సేవ్ చేయి':'Save Supplier')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal==='goods' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg">{te?`${selected?.name} జాబితాకు జోడించు`:`Add to ${selected?.name}'s Catalog`}</h2>
              <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="label">{te?'వస్తువు పేరు *':'Goods Name *'}</label><input value={gForm.goods_name??''} onChange={e=>setGForm({...gForm,goods_name:e.target.value})} className="input" placeholder={te?'ఉదా: సిమెంట్, స్టీల్ రాడ్లు, ఇసుక...':'e.g. Cement, Steel Rods, Sand...'}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{te?'ధర / యూనిట్ ₹':'Price per Unit ₹'}</label><input type="number" value={gForm.price_per_unit??''} onChange={e=>setGForm({...gForm,price_per_unit:+e.target.value})} className="input" placeholder="0"/></div>
                <div><label className="label">{te?'యూనిట్':'Unit'}</label>
                  <select value={gForm.unit??'bags'} onChange={e=>setGForm({...gForm,unit:e.target.value})} className="input">
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={saveGoods} disabled={saving} className="btn-primary btn-full">
                {saving?(te?'⏳...':'⏳...'):(te?'జాబితాకు జోడించు':'Add to Catalog')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal==='payment' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg">{te?`చెల్లింపు — ${selected?.name}`:`Payment — ${selected?.name}`}</h2>
              <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">{te?'చెల్లింపు రకం':'Payment Type'}</label>
                <div className="flex gap-2">
                  {(['payment','advance'] as const).map(t=>(
                    <button key={t} onClick={()=>setPForm({...pForm,payment_type:t})}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition ${pForm.payment_type===t?'bg-orange-600 text-white border-orange-600':'dark:bg-slate-800 bg-gray-50 dark:border-slate-600 border-gray-200 dark:text-slate-300 text-gray-600'}`}>
                      {t==='advance'?(te?'🔶 అడ్వాన్స్':'🔶 Advance'):(te?'💳 సాధారణ చెల్లింపు':'💳 Regular Payment')}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label">{te?'మొత్తం ₹ *':'Amount ₹ *'}</label><input type="number" inputMode="decimal" value={pForm.amount??''} onChange={e=>setPForm({...pForm,amount:+e.target.value})} className="input" placeholder="0"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{te?'పద్ధతి':'Mode'}</label>
                  <select value={pForm.mode??'Cash'} onChange={e=>setPForm({...pForm,mode:e.target.value})} className="input">
                    <option value="Cash">{te?'నగదు':'Cash'}</option>
                    <option value="Online">{te?'ఆన్‌లైన్':'Online'}</option>
                    <option value="Cheque">{te?'చెక్కు':'Cheque'}</option>
                  </select>
                </div>
                <div><label className="label">{te?'తేదీ':'Date'}</label><input type="date" value={pForm.payment_date??''} onChange={e=>setPForm({...pForm,payment_date:e.target.value})} className="input"/></div>
              </div>
              <div><label className="label">{te?'గమనికలు':'Notes'}</label><input value={pForm.notes??''} onChange={e=>setPForm({...pForm,notes:e.target.value})} className="input" placeholder={te?'ఐచ్ఛిక గమనికలు...':'Optional notes...'}/></div>
              <button onClick={savePayment} disabled={saving} className="btn-green btn-full">
                {saving?(te?'⏳...':'⏳...'):(te?'చెల్లింపు సేవ్ చేయి':'Save Payment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default function Suppliers() { return <AppShell><SuppliersPage /></AppShell> }
