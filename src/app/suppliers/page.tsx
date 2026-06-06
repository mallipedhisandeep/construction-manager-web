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
  const [toast,     setToast]     = useState<{msg:string;ok:boolean}|undefined>()
  const [sForm, setSForm] = useState<Partial<Supplier>>({})
  const [gForm, setGForm] = useState<Partial<SupplierGoods>>({ unit:'bags' })
  const [pForm, setPForm] = useState<Partial<SupplierPayment>>({ payment_type:'payment', mode:'Cash' })

  const showToast = (msg:string, ok=true) => {
    setToast({msg,ok}); setTimeout(()=>setToast(undefined), 3000)
  }

  // FIX C4+C5+P1: single bulk query for all suppliers, exclude cancelled+deleted goods orders
  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: allPays }, { data: allOrders }, { data: allCounts }] = await Promise.all([
      supabase.from('suppliers').select('*').is('deleted_at', null).order('name'),
      supabase.from('supplier_payments').select('supplier_id,amount'),
      // FIX C4: exclude cancelled orders  FIX C5: exclude soft-deleted orders
      supabase.from('goods_orders').select('supplier_id,total_price')
        .neq('status','Cancelled')
        .is('deleted_at', null),
      supabase.from('supplier_goods').select('supplier_id'),
    ])
    if (!data) { setLoading(false); return }

    const paidMap: Record<string,number>  = {}
    const owedMap: Record<string,number>  = {}
    const countMap: Record<string,number> = {}

    allPays?.forEach(p => { paidMap[p.supplier_id]  = (paidMap[p.supplier_id]  ?? 0) + p.amount })
    allOrders?.forEach(o => { owedMap[o.supplier_id] = (owedMap[o.supplier_id] ?? 0) + o.total_price })
    allCounts?.forEach(g => { countMap[g.supplier_id] = (countMap[g.supplier_id] ?? 0) + 1 })

    const withBal: SupplierFull[] = data.map(sup => ({
      ...sup,
      balance:    (owedMap[sup.id] ?? 0) - (paidMap[sup.id] ?? 0),
      goodsCount: countMap[sup.id] ?? 0,
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
        ? await supabase.from('suppliers').update(payload).eq('id', selected.id)
        : await supabase.from('suppliers').insert({ ...payload, user_id: userId })
      if (error) throw error
      setModal(null); load()
      showToast(te ? 'సరఫరాదారు సేవ్ అయింది!' : 'Supplier saved!')
    } catch(e:unknown) { showToast((e as Error).message, false) } finally { setSaving(false) }
  }

  const saveGoods = async () => {
    if (!gForm.goods_name?.trim() || !selected) return
    setSaving(true)
    try {
      const userId = await uid()
      const { error } = await supabase.from('supplier_goods').insert({ ...gForm, supplier_id: selected.id, user_id: userId })
      if (error) throw error
      await loadDetail(selected); setModal(null)
      showToast(te ? 'వస్తువు జోడించబడింది!' : 'Goods added!')
    } catch(e:unknown) { showToast((e as Error).message, false) } finally { setSaving(false) }
  }

  const savePayment = async () => {
    if (!pForm.amount || !selected) return
    setSaving(true)
    try {
      const userId = await uid()
      const { error } = await supabase.from('supplier_payments').insert({
        ...pForm, supplier_id: selected.id,
        payment_date: pForm.payment_date || new Date().toISOString().split('T')[0],
        user_id: userId,
      })
      if (error) throw error
      await loadDetail(selected); setModal(null); load()
      showToast(te ? 'చెల్లింపు సేవ్ అయింది!' : 'Payment saved!')
    } catch(e:unknown) { showToast((e as Error).message, false) } finally { setSaving(false) }
  }

  const delGoods = async (id:string) => {
    await supabase.from('supplier_goods').delete().eq('id', id)
    if (selected) await loadDetail(selected)
  }
  const delPayment = async (id:string) => {
    await supabase.from('supplier_payments').delete().eq('id', id)
    if (selected) { await loadDetail(selected); load() }
  }
  const delSup = async () => {
    if (!selected || !confirm(te ? 'సరఫరాదారుని చెత్తబుట్టకు తరలించాలా?' : 'Move supplier to recycle bin?')) return
    await supabase.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', selected.id)
    setView('list'); load()
    showToast(te ? 'చెత్తబుట్టకు తరలించబడింది 🗑️' : 'Moved to recycle bin 🗑️', false)
  }

  const bal = selected?.balance ?? 0

  return (
    <div className="page">
      {toast && (
        <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {view === 'list' ? (
        <>
          <div className="page-header">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>
                🏪 {te?'సరఫరాదారులు':'Suppliers'}
              </h1>
              <button onClick={()=>{ setSForm({}); setSelected(null); setModal('supplier') }} className="btn-primary btn-sm">
                + {te?'సరఫరాదారు జోడించు':'Add Supplier'}
              </button>
            </div>
          </div>
          <div className="px-4 pt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-2 opacity-20">🏪</div>
                <p style={{color:'rgb(var(--muted))'}}>{te?'సరఫరాదారులు లేరు':'No suppliers yet'}</p>
              </div>
            ) : suppliers.map(sup => {
              const b = sup.balance ?? 0
              return (
                <div key={sup.id} className="card-hover mb-3 p-4" onClick={()=>loadDetail(sup)}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-400 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0">
                      {sup.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold" style={{color:'rgb(var(--text))'}}>{sup.name}</p>
                      {sup.shop_name && <p className="text-xs" style={{color:'rgb(var(--muted))'}}>🏪 {sup.shop_name}</p>}
                      <div className="flex gap-2 mt-1 flex-wrap items-center">
                        {sup.phone && (
                          <a href={`tel:${sup.phone}`} className="text-xs text-green-600 dark:text-green-400 font-medium"
                            onClick={e=>e.stopPropagation()}>
                            📞 {sup.phone}
                          </a>
                        )}
                        <span className="badge-gray">{sup.goodsCount} {te?'వస్తువులు':'goods'}</span>
                      </div>
                    </div>
                    <div className={`text-xs font-bold px-2.5 py-1.5 rounded-xl text-right ${b>0?'text-red-600':'b'<'0'?'text-green-700':''}`}
                      style={{
                        background: b>0 ? 'rgba(220,38,38,0.1)' : b<0 ? 'rgba(22,163,74,0.1)' : 'rgb(var(--surface2))',
                        color: b>0 ? '#dc2626' : b<0 ? '#15803d' : 'rgb(var(--muted))',
                        border: `1px solid ${b>0?'rgba(220,38,38,0.2)':b<0?'rgba(22,163,74,0.2)':'rgb(var(--border))'}`,
                      }}>
                      {b === 0
                        ? (te ? '✓ క్లియర్' : '✓ Settled')
                        : b > 0
                          ? (te ? `₹${b.toFixed(0)} ఇవ్వాలి` : `We Owe ₹${b.toFixed(0)}`)
                          : (te ? `సరఫరాదారు ₹${Math.abs(b).toFixed(0)} ఇవ్వాలి` : `Supplier Owes ₹${Math.abs(b).toFixed(0)}`)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : selected && (
        <>
          <div className="page-header">
            <div className="flex items-center gap-3">
              <button onClick={()=>setView('list')} className="font-bold text-sm" style={{color:'rgb(var(--accent))'}}>
                ← {te?'వెనక్కి':'Back'}
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-black truncate" style={{color:'rgb(var(--text))'}}>{selected.name}</p>
                {selected.shop_name && <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{selected.shop_name}</p>}
              </div>
              <div className="flex gap-1">
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="p-2 rounded-xl text-sm" style={{background:'rgba(22,163,74,0.1)',color:'#15803d'}}>📞</a>
                )}
                <button onClick={()=>{ setSForm({...selected}); setModal('supplier') }} className="p-2 rounded-xl" style={{background:'rgba(var(--accent),0.1)',color:'rgb(var(--accent))'}}>✏️</button>
                <button onClick={delSup} className="p-2 rounded-xl" style={{background:'rgba(220,38,38,0.1)',color:'#dc2626'}}>🗑️</button>
              </div>
            </div>
          </div>

          <div className="px-4 pt-3">
            {/* Balance card */}
            <div className="rounded-2xl p-4 mb-4 border-2"
              style={{
                background: bal>0?'rgba(220,38,38,0.06)':bal<0?'rgba(22,163,74,0.06)':'rgb(var(--surface2))',
                borderColor: bal>0?'rgba(220,38,38,0.3)':bal<0?'rgba(22,163,74,0.3)':'rgb(var(--border))',
              }}>
              <p className="text-xs font-black uppercase tracking-wide mb-1" style={{color:'rgb(var(--muted))'}}>
                {te?'బాలెన్స్':'Balance'}
              </p>
              <p className="text-2xl font-black" style={{color:bal>0?'#dc2626':bal<0?'#15803d':'rgb(var(--muted))'}}>
                ₹{Math.abs(bal).toFixed(0)}
              </p>
              <p className="text-sm mt-0.5" style={{color:'rgb(var(--muted))'}}>
                {bal === 0
                  ? (te?'అన్నీ క్లియర్ ✓':'All settled ✓')
                  : bal > 0
                    ? (te?'మేము సరఫరాదారుకు ఇవ్వాలి':'We owe supplier')
                    : (te?'సరఫరాదారు మాకు ఇవ్వాలి':'Supplier owes us')}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b mb-4" style={{borderColor:'rgb(var(--border))'}}>
              {([['goods', te?'📦 వస్తువుల జాబితా':'📦 Goods Catalog'], ['payments', te?'💳 చెల్లింపు చరిత్ర':'💳 Payment History']] as const).map(([t,l]) => (
                <button key={t} onClick={()=>setTab(t)}
                  className={`flex-1 py-2.5 text-sm font-bold border-b-2 transition`}
                  style={{
                    color: tab===t ? 'rgb(var(--accent))' : 'rgb(var(--muted))',
                    borderBottomColor: tab===t ? 'rgb(var(--accent))' : 'transparent',
                  }}>
                  {l}
                </button>
              ))}
            </div>

            {tab === 'goods' ? (
              <>
                <button onClick={()=>{ setGForm({unit:'bags'}); setModal('goods') }} className="btn-primary w-full mb-3">
                  + {te?'వస్తువు జోడించు':'Add Goods Item'}
                </button>
                {goods.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <p className="text-4xl mb-2">📦</p>
                    <p style={{color:'rgb(var(--muted))'}}>{te?'జాబితాలో వస్తువులు లేవు':'No goods in catalog'}</p>
                  </div>
                ) : goods.map(g => (
                  <div key={g.id} className="card mb-2 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'rgba(212,140,40,0.1)'}}>📦</div>
                    <div className="flex-1">
                      <p className="font-bold" style={{color:'rgb(var(--text))'}}>{g.goods_name}</p>
                      <p className="text-sm" style={{color:'rgb(var(--muted))'}}>₹{g.price_per_unit} {te?'ప్రతి':'per'} {g.unit}</p>
                    </div>
                    <button onClick={()=>delGoods(g.id!)} className="p-1.5 rounded-lg text-sm text-red-400 hover:text-red-600">🗑️</button>
                  </div>
                ))}
              </>
            ) : (
              <>
                <button onClick={()=>{ setPForm({payment_type:'payment',mode:'Cash',payment_date:new Date().toISOString().split('T')[0]}); setModal('payment') }}
                  className="btn-green w-full mb-3">
                  + {te?'చెల్లింపు జోడించు':'Add Payment'}
                </button>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="card p-3 text-center">
                    <p className="text-lg font-black text-red-500 dark:text-red-400">₹{bal>0?bal.toFixed(0):'0'}</p>
                    <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{te?'బాకీ':'Still Owe'}</p>
                  </div>
                  <div className="card p-3 text-center">
                    <p className="text-lg font-black text-green-600 dark:text-green-400">₹{payments.reduce((s,p)=>s+p.amount,0).toFixed(0)}</p>
                    <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{te?'మొత్తం చెల్లింపు':'Total Paid'}</p>
                  </div>
                </div>
                {payments.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <p className="text-4xl mb-2">💳</p>
                    <p style={{color:'rgb(var(--muted))'}}>{te?'చెల్లింపులు లేవు':'No payments yet'}</p>
                  </div>
                ) : payments.map(p => (
                  <div key={p.id} className="card mb-2 p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{background: p.payment_type==='advance'?'rgba(212,140,40,0.1)':'rgba(22,163,74,0.1)'}}>
                      {p.payment_type==='advance' ? '🔶' : '💳'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold" style={{color:'rgb(var(--text))'}}>₹{p.amount}</span>
                        <span className={p.payment_type==='advance'?'badge-amber':'badge-green'}>
                          {te ? (p.payment_type==='advance'?'అడ్వాన్స్':'చెల్లింపు') : p.payment_type}
                        </span>
                        <span className="badge-gray">{p.mode}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>{p.payment_date}{p.notes?` · ${p.notes}`:''}</p>
                    </div>
                    <button onClick={()=>delPayment(p.id!)} className="text-red-400 text-sm p-1.5">🗑️</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Supplier modal */}
      {modal === 'supplier' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>
                {selected && modal==='supplier' ? (te?'సరఫరాదారు సవరించు':'Edit Supplier') : (te?'సరఫరాదారు జోడించు':'Add Supplier')}
              </h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                {k:'name',      l:te?'సరఫరాదారు పేరు *':'Supplier Name *'},
                {k:'phone',     l:te?'ఫోన్ నంబర్':'Phone Number'},
                {k:'shop_name', l:te?'దుకాణం పేరు':'Shop Name'},
              ].map(({k,l}) => (
                <div key={k}>
                  <label className="label">{l}</label>
                  <input value={(sForm as Record<string,string>)[k]??''} maxLength={k==='phone'?10:undefined}
                    onChange={e=>setSForm({...sForm,[k]:e.target.value})} className="input"/>
                </div>
              ))}
              <div>
                <label className="label">{te?'గమనికలు':'Notes'}</label>
                <textarea rows={2} value={sForm.notes??''} onChange={e=>setSForm({...sForm,notes:e.target.value})} className="input resize-none"/>
              </div>
              <button onClick={saveSup} disabled={saving} className="btn-primary btn-full">
                {saving ? '⏳ Saving...' : (te?'సేవ్ చేయి':'Save Supplier')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goods modal */}
      {modal === 'goods' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>
                {te ? `${selected?.name} జాబితాకు జోడించు` : `Add to ${selected?.name}'s Catalog`}
              </h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">{te?'వస్తువు పేరు *':'Goods Name *'}</label>
                <input value={gForm.goods_name??''} onChange={e=>setGForm({...gForm,goods_name:e.target.value})} className="input" placeholder={te?'ఉదా: సిమెంట్, ఇసుక...':'e.g. Cement, Sand...'}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{te?'ధర / యూనిట్ ₹':'Price per Unit ₹'}</label>
                  <input type="number" value={gForm.price_per_unit??''} onChange={e=>setGForm({...gForm,price_per_unit:+e.target.value})} className="input" placeholder="0"/>
                </div>
                <div>
                  <label className="label">{te?'యూనిట్':'Unit'}</label>
                  <select value={gForm.unit??'bags'} onChange={e=>setGForm({...gForm,unit:e.target.value})} className="input">
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={saveGoods} disabled={saving} className="btn-primary btn-full">
                {saving ? '⏳...' : (te?'జాబితాకు జోడించు':'Add to Catalog')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {modal === 'payment' && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>
                {te ? `చెల్లింపు — ${selected?.name}` : `Payment — ${selected?.name}`}
              </h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">{te?'చెల్లింపు రకం':'Payment Type'}</label>
                <div className="flex gap-2">
                  {(['payment','advance'] as const).map(t => (
                    <button key={t} onClick={()=>setPForm({...pForm,payment_type:t})}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: pForm.payment_type===t ? 'linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent2)))' : 'rgb(var(--surface2))',
                        color: pForm.payment_type===t ? '#fff' : 'rgb(var(--muted))',
                        border: `1px solid ${pForm.payment_type===t?'transparent':'rgb(var(--border))'}`,
                      }}>
                      {t==='advance' ? (te?'🔶 అడ్వాన్స్':'🔶 Advance') : (te?'💳 చెల్లింపు':'💳 Regular Payment')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">{te?'మొత్తం ₹ *':'Amount ₹ *'}</label>
                <input type="number" inputMode="decimal" value={pForm.amount??''} onChange={e=>setPForm({...pForm,amount:+e.target.value})} className="input" placeholder="0"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{te?'పద్ధతి':'Mode'}</label>
                  <select value={pForm.mode??'Cash'} onChange={e=>setPForm({...pForm,mode:e.target.value})} className="input">
                    {['Cash','Online','Cheque'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{te?'తేదీ':'Date'}</label>
                  <input type="date" value={pForm.payment_date??''} onChange={e=>setPForm({...pForm,payment_date:e.target.value})} className="input"/>
                </div>
              </div>
              <div>
                <label className="label">{te?'గమనికలు':'Notes'}</label>
                <input value={pForm.notes??''} onChange={e=>setPForm({...pForm,notes:e.target.value})} className="input" placeholder={te?'ఐచ్ఛికం...':'Optional...'}/>
              </div>
              <button onClick={savePayment} disabled={saving} className="btn-green btn-full">
                {saving ? '⏳...' : (te?'చెల్లింపు సేవ్ చేయి':'Save Payment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Suppliers() { return <AppShell><SuppliersPage /></AppShell> }
