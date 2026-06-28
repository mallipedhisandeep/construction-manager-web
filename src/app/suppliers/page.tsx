'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { GOODS_UNITS } from '@/lib/constants'
import type { Supplier, SupplierGoods, SupplierPayment } from '@/lib/types'

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
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState<'supplier'|'goods'|'payment'|null>(null)
  const [saving,    setSaving]    = useState(false)
  const [sForm, setSForm] = useState<Partial<Supplier>>({})
  const [gForm, setGForm] = useState<Partial<SupplierGoods>>({ unit:'bags' })
  const [pForm, setPForm] = useState<Partial<SupplierPayment>>({ payment_type:'payment', mode:'Cash' })

  const { showToast: _showToast } = useToast()
  const showToast = (msg: string, ok = true) => _showToast(msg, ok ? 'ok' : 'err')

  const load = useCallback(async () => {
    setLoading(true)
    const userId = await uid()
    const [{ data }, { data: allPays }, { data: allOrders }, { data: allCounts }] = await Promise.all([
      supabase.from('suppliers').select('*').eq('user_id', userId).is('deleted_at', null).order('name'),
      // FIX: filter deleted payments out of the balance calculation
      supabase.from('supplier_payments').select('supplier_id,amount').eq('user_id', userId).is('deleted_at', null),
      supabase.from('goods_orders').select('supplier_id,total_price')
        .eq('user_id', userId)
        .neq('status','Cancelled')
        .is('deleted_at', null),
      supabase.from('supplier_goods').select('supplier_id').eq('user_id', userId).is('deleted_at', null),
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
    const userId = await uid()
    const [{ data:g }, { data:p }] = await Promise.all([
      supabase.from('supplier_goods').select('*').eq('supplier_id', sup.id).eq('user_id', userId).is('deleted_at', null).order('goods_name'),
      // FIX: filter deleted payments in detail view too
      supabase.from('supplier_payments').select('*').eq('supplier_id', sup.id).eq('user_id', userId).is('deleted_at', null).order('created_at',{ascending:false}),
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
      if (!userId) throw new Error('Not logged in')
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
      if (!userId) throw new Error('Not logged in')
      const { error } = await supabase.from('supplier_goods').insert({ ...gForm, supplier_id: selected.id, user_id: userId })
      if (error) throw error
      setModal(null); loadDetail(selected)
      showToast(te ? 'వస్తువు జోడించబడింది!' : 'Item added!')
    } catch(e:unknown) { showToast((e as Error).message, false) } finally { setSaving(false) }
  }

  const savePayment = async () => {
    if (!pForm.amount || !selected) return
    setSaving(true)
    try {
      const userId = await uid()
      if (!userId) throw new Error('Not logged in')
      const { error } = await supabase.from('supplier_payments').insert({
        ...pForm,
        supplier_id:  selected.id,
        payment_date: pForm.payment_date ?? new Date().toISOString().split('T')[0],
        user_id:      userId,
      })
      if (error) throw error
      // Reset form
      setPForm({ payment_type:'payment', mode:'Cash' })
      setModal(null); loadDetail(selected); load()
      showToast(te ? 'చెల్లింపు సేవ్ అయింది!' : 'Payment saved!')
    } catch(e:unknown) { showToast((e as Error).message, false) } finally { setSaving(false) }
  }

  const deleteGoods = async (id: string) => {
    if (!confirm(te ? 'చెత్తబుట్టకు తరలించాలా?' : 'Move this item to recycle bin?')) return
    const { error } = await supabase.from('supplier_goods').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast(error.message, false); return }
    if (selected) loadDetail(selected); load()
    showToast(te ? 'చెత్తబుట్టకు తరలించబడింది 🗑️' : 'Moved to recycle bin 🗑️')
  }

  const deletePayment = async (id: string) => {
    if (!confirm(te ? 'తొలగించాలా?' : 'Delete this payment?')) return
    const { error } = await supabase.from('supplier_payments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast(error.message, false); return }
    if (selected) loadDetail(selected); load()
    showToast(te ? 'తొలగించబడింది' : 'Deleted')
  }

  const deleteSup = async () => {
    if (!selected || !confirm(te ? 'ఖచ్చితంగా తొలగించాలా?' : 'Delete this supplier?')) return
    const { error } = await supabase.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', selected.id)
    if (error) { showToast(error.message, false); return }
    setView('list'); setSelected(null); load()
    showToast(te ? 'చెత్తబుట్టకు తరలించబడింది 🗑️' : 'Moved to recycle bin 🗑️')
  }

  if (view === 'detail' && selected) {
    const bal = selected.balance ?? 0
    return (
      <div className="page">
        <div className="page-header">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="font-bold text-sm" style={{color:'rgb(var(--accent))'}}>
              ←
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-black truncate" style={{color:'rgb(var(--text))'}}>{selected.name}</p>
              <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{selected.shop_name || selected.phone}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setSForm({name:selected.name,phone:selected.phone,shop_name:selected.shop_name,notes:selected.notes}); setModal('supplier') }}
                className="btn-ghost btn-sm" data-testid="demo-supplier-edit-btn">✏️</button>
              <button onClick={deleteSup} className="btn-danger btn-sm" data-testid="demo-supplier-delete-btn">🗑️</button>
            </div>
          </div>
          {/* Balance banner */}
          <div className="mt-3 flex items-center justify-between rounded-xl px-4 py-2.5"
            style={{background: bal>0?'rgba(220,38,38,0.1)':'rgba(21,128,61,0.1)', border:`1px solid ${bal>0?'rgba(220,38,38,0.25)':'rgba(21,128,61,0.25)'}`}}>
            <span className="text-sm font-bold" style={{color: bal>0?'rgb(var(--danger))':'rgb(var(--success))'}}>
              {bal > 0 ? (te?'మీరు ఇవ్వాల్సినది:':'You Owe:') : (te?'మీరు అదనంగా చెల్లించారు:':'Overpaid:')}
            </span>
            <span className="font-black text-lg" style={{color: bal>0?'rgb(var(--danger))':'rgb(var(--success))'}}>
              ₹{Math.abs(bal).toFixed(0)}
            </span>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(['goods','payments'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition"
                style={{background: tab===t?'rgb(var(--accent))':'rgb(var(--surface2))', color: tab===t?'#fff':'rgb(var(--muted))'}}
                data-testid={`demo-supplier-tab-${t}`}>
                {t === 'goods' ? (te?'వస్తువులు':'Goods') : (te?'చెల్లింపులు':'Payments')}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-4 pb-24">
          {tab === 'goods' && (
            <>
              <div className="flex items-center gap-1.5 mb-3">
                <button onClick={() => { setGForm({ unit:'bags' }); setModal('goods') }} className="btn-primary btn-sm" data-testid="demo-supplier-add-item-btn">
                  + {te?'వస్తువు జోడించు':'Add Item'}
                </button>
              </div>
              {goods.length === 0 ? (
                <div className="text-center py-12 opacity-50"><p className="text-4xl mb-2">📦</p><p style={{color:'rgb(var(--muted))'}}>{te?'వస్తువులు లేవు':'No items added'}</p></div>
              ) : goods.map(g => (
                <div key={g.id} className="card mb-2 flex items-center gap-3 p-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{color:'rgb(var(--text))'}}>{g.goods_name}</p>
                    <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>₹{g.price_per_unit}/{g.unit}</p>
                  </div>
                  <button onClick={() => deleteGoods(g.id!)} className="text-red-400 p-1.5">🗑️</button>
                </div>
              ))}
            </>
          )}

          {tab === 'payments' && (
            <>
              <div className="flex items-center gap-1.5 mb-3">
                <button onClick={() => { setPForm({ payment_type:'payment', mode:'Cash', payment_date: new Date().toISOString().split('T')[0] }); setModal('payment') }}
                  className="btn-primary btn-sm" data-testid="demo-supplier-add-payment-btn">
                  + {te?'చెల్లింపు జోడించు':'Add Payment'}
                </button>
              </div>
              {payments.length === 0 ? (
                <div className="text-center py-12 opacity-50"><p className="text-4xl mb-2">💳</p><p style={{color:'rgb(var(--muted))'}}>{te?'చెల్లింపులు లేవు':'No payments'}</p></div>
              ) : payments.map(p => (
                <div key={p.id} className="card mb-2 flex items-center gap-3 p-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={p.payment_type==='advance'?'badge-amber':'badge-green'}>{p.payment_type}</span>
                      <span className="text-sm font-black" style={{color:'rgb(var(--accent))'}}>₹{p.amount}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>{p.payment_date} · {p.mode}</p>
                    {p.notes && <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>{p.notes}</p>}
                  </div>
                  <button onClick={() => deletePayment(p.id!)} className="text-red-400 p-1.5">🗑️</button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Goods modal */}
        {modal === 'goods' && (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <div className="modal-box" onClick={e=>e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{te?'వస్తువు జోడించు':'Add Goods Item'}</h2>
                <button onClick={() => setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
              </div>
              <div className="p-5 space-y-3">
                <div><label className="label">{te?'వస్తువు పేరు *':'Goods Name *'}</label>
                  <input value={gForm.goods_name??''} onChange={e=>setGForm(f=>({...f,goods_name:e.target.value}))} className="input" placeholder={te?'ఉదా: సిమెంట్':'e.g. Cement'}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">{te?'ధర/యూనిట్':'Price/Unit'}</label>
                    <input type="number" inputMode="decimal" value={gForm.price_per_unit??''} onChange={e=>setGForm(f=>({...f,price_per_unit:+e.target.value}))} className="input" placeholder="0"/></div>
                  <div><label className="label">{te?'యూనిట్':'Unit'}</label>
                    <select value={gForm.unit??'bags'} onChange={e=>setGForm(f=>({...f,unit:e.target.value}))} className="input">
                      {GOODS_UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                </div>
                <button onClick={saveGoods} disabled={saving} className="btn-primary w-full py-3">
                  {saving ? '⏳...' : (te?'సేవ్ చేయి':'Save')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Payment modal */}
        {modal === 'payment' && (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <div className="modal-box" onClick={e=>e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{te?'చెల్లింపు జోడించు':'Add Payment'}</h2>
                <button onClick={() => setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
              </div>
              <div className="p-5 space-y-3">
                <div><label className="label">{te?'మొత్తం ₹ *':'Amount ₹ *'}</label>
                  <input type="number" inputMode="decimal" value={pForm.amount??''} onChange={e=>setPForm(f=>({...f,amount:+e.target.value}))} className="input" placeholder="0"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">{te?'రకం':'Type'}</label>
                    <select value={pForm.payment_type??'payment'} onChange={e=>setPForm(f=>({...f,payment_type:e.target.value as 'advance'|'payment'}))} className="input">
                      <option value="payment">{te?'చెల్లింపు':'Payment'}</option>
                      <option value="advance">{te?'అడ్వాన్స్':'Advance'}</option>
                    </select></div>
                  <div><label className="label">{te?'పద్ధతి':'Mode'}</label>
                    <select value={pForm.mode??'Cash'} onChange={e=>setPForm(f=>({...f,mode:e.target.value}))} className="input">
                      {['Cash','Online','Cheque'].map(m=><option key={m}>{m}</option>)}</select></div>
                </div>
                <div><label className="label">{te?'తేదీ':'Date'}</label>
                  <input type="date" value={pForm.payment_date??new Date().toISOString().split('T')[0]} onChange={e=>setPForm(f=>({...f,payment_date:e.target.value}))} className="input"/></div>
                <div><label className="label">{te?'గమనికలు':'Notes'}</label>
                  <input value={pForm.notes??''} onChange={e=>setPForm(f=>({...f,notes:e.target.value}))} className="input" placeholder={te?'ఐచ్ఛికం':'Optional'}/></div>
                <button onClick={savePayment} disabled={saving} className="btn-primary w-full py-3">
                  {saving ? '⏳...' : (te?'సేవ్ చేయి':'Save')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit supplier modal */}
        {modal === 'supplier' && (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <div className="modal-box" onClick={e=>e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{te?'సరఫరాదారును సవరించు':'Edit Supplier'}</h2>
                <button onClick={() => setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
              </div>
              <div className="p-5 space-y-3">
                <div><label className="label">{te?'పేరు *':'Name *'}</label>
                  <input value={sForm.name??''} onChange={e=>setSForm(f=>({...f,name:e.target.value}))} className="input"/></div>
                <div><label className="label">{te?'ఫోన్':'Phone'}</label>
                  <input value={sForm.phone??''} onChange={e=>setSForm(f=>({...f,phone:e.target.value.replace(/\D/g,'').slice(0,10)}))} className="input" type="tel"/></div>
                <div><label className="label">{te?'దుకాణం పేరు':'Shop Name'}</label>
                  <input value={sForm.shop_name??''} onChange={e=>setSForm(f=>({...f,shop_name:e.target.value}))} className="input"/></div>
                <div><label className="label">{te?'గమనికలు':'Notes'}</label>
                  <textarea rows={2} value={sForm.notes??''} onChange={e=>setSForm(f=>({...f,notes:e.target.value}))} className="input resize-none"/></div>
                <button onClick={saveSup} disabled={saving} className="btn-primary w-full py-3">
                  {saving ? '⏳...' : (te?'సేవ్ చేయి':'Save')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>🏪 {te?'సరఫరాదారులు':'Suppliers'}</h1>
          </div>
          <button onClick={() => { setSForm({}); setModal('supplier') }} className="btn-primary btn-sm" data-testid="add-supplier-btn">
            + {te?'జోడించు':'Add'}
          </button>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={te ? '🔍 పేరు, ఫోన్ వెతకండి...' : '🔍 Search by name, phone...'}
          className="input mt-3 py-2 text-sm" />
      </div>

      <div className="px-4 pt-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16 opacity-50"><p className="text-5xl mb-3">🏪</p><p style={{color:'rgb(var(--muted))'}}>{te?'సరఫరాదారులు లేరు':'No suppliers added'}</p></div>
        ) : suppliers.filter(s =>
            !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.shop_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (s.phone ?? '').includes(search)
          ).map(sup => {
          const bal = sup.balance ?? 0
          return (
            <div key={sup.id} className="card mb-3 p-4 cursor-pointer" onClick={() => loadDetail(sup)} data-testid={sup.name === 'Demo Supplier' ? 'demo-supplier-card' : undefined}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0"
                  style={{background:'rgba(212,140,40,0.12)', color:'rgb(var(--accent))'}}>
                  {sup.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{color:'rgb(var(--text))'}}>{sup.name}</p>
                  <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>{sup.shop_name || sup.phone || '—'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-sm" style={{color: bal>0?'rgb(var(--danger))':'rgb(var(--success))'}}>
                    {bal > 0 ? `₹${bal.toFixed(0)} due` : bal < 0 ? `₹${Math.abs(bal).toFixed(0)} cr` : '✅'}
                  </p>
                  {(sup.goodsCount??0) > 0 && <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{sup.goodsCount} items</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add supplier modal */}
      {modal === 'supplier' && !selected && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} data-testid="supplier-form-modal">
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{te?'సరఫరాదారు జోడించు':'Add Supplier'}</h2>
              <button onClick={() => setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}} data-testid="supplier-form-modal-close">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="label">{te?'పేరు *':'Name *'}</label>
                <input value={sForm.name??''} onChange={e=>setSForm(f=>({...f,name:e.target.value}))} className="input"/></div>
              <div><label className="label">{te?'ఫోన్':'Phone'}</label>
                <input value={sForm.phone??''} onChange={e=>setSForm(f=>({...f,phone:e.target.value.replace(/\D/g,'').slice(0,10)}))} className="input" type="tel"/></div>
              <div><label className="label">{te?'దుకాణం పేరు':'Shop Name'}</label>
                <input value={sForm.shop_name??''} onChange={e=>setSForm(f=>({...f,shop_name:e.target.value}))} className="input"/></div>
              <div><label className="label">{te?'గమనికలు':'Notes'}</label>
                <textarea rows={2} value={sForm.notes??''} onChange={e=>setSForm(f=>({...f,notes:e.target.value}))} className="input resize-none"/></div>
              <button onClick={saveSup} disabled={saving} className="btn-primary w-full py-3">
                {saving ? '⏳...' : (te?'సేవ్ చేయి':'Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Suppliers() { return <SuppliersPage /> }
