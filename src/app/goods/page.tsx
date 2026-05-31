'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import type { GoodsOrder, Supplier, SupplierGoods, Site } from '@/lib/types'

const STATUS_STYLE: Record<string,string> = { Pending:'badge-amber', Delivered:'badge-green', Cancelled:'badge-red' }

function GoodsPage() {
  const [orders,    setOrders]    = useState<GoodsOrder[]>([])
  const [suppliers, setSuppliers] = useState<(Supplier & {id:string})[]>([])
  const [catalog,   setCatalog]   = useState<SupplierGoods[]>([])
  const [sites,     setSites]     = useState<(Site & {id:string})[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<{msg:string;ok:boolean}>()
  const [filter,    setFilter]    = useState<'All'|'Pending'|'Delivered'|'Cancelled'>('All')
  const [form, setForm] = useState<Partial<GoodsOrder & {priceStr:string;qtyStr:string;advStr:string}>>({
    status:'Pending', delivery_date: new Date().toISOString().split('T')[0],
    priceStr:'', qtyStr:'', advStr:''
  })
  const [selSupGoods, setSelSupGoods] = useState<SupplierGoods[]>([])

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined),3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data:o },{ data:s },{ data:si }] = await Promise.all([
      supabase.from('goods_orders').select('*').order('created_at',{ascending:false}),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('sites').select('id,site_name,status').eq('status','Active'),
    ])
    setOrders(o??[]); setSuppliers(s??[]); setSites(si??[] as any)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onSupplierChange = async (supId: string) => {
    setForm(f=>({...f, supplier_id:supId, goods_name:'', unit:'', priceStr:''}))
    const { data } = await supabase.from('supplier_goods').select('*').eq('supplier_id', supId).order('goods_name')
    setCatalog(data??[])
    setSelSupGoods(data??[])
  }

  const onGoodsChange = (goodsName: string) => {
    const item = catalog.find(g=>g.goods_name===goodsName)
    setForm(f=>({...f, goods_name:goodsName, unit:item?.unit??'bags', priceStr:item?.price_per_unit?.toString()??''}))
  }

  const calcTotal = () => {
    const qty = parseFloat(form.qtyStr||'0')
    const price = parseFloat(form.priceStr||'0')
    return qty * price
  }

  const save = async () => {
    if (!form.supplier_id||!form.goods_name||!form.delivery_date) { showToast('Please fill required fields', false); return }
    setSaving(true)
    const sup = suppliers.find(s=>s.id===form.supplier_id)
    const site = sites.find(s=>s.id===form.site_id)
    const qty = parseFloat(form.qtyStr||'0')
    const price = parseFloat(form.priceStr||'0')
    const adv = parseFloat(form.advStr||'0')
    const total = qty * price

    try {
      const { data:order, error } = await supabase.from('goods_orders').insert({
        supplier_id: form.supplier_id, supplier_name: sup?.name??'',
        goods_name: form.goods_name, unit: form.unit,
        site_id: form.site_id||null, site_name: site?.site_name??'',
        delivery_date: form.delivery_date, quantity: qty,
        price_per_unit: price, total_price: total, advance_paid: adv,
        status: form.status||'Pending', notes: form.notes
      }).select().single()
      if (error) throw error

      // If advance paid, auto-create supplier payment entry
      if (adv > 0 && order) {
        await supabase.from('supplier_payments').insert({
          supplier_id: form.supplier_id, amount: adv,
          payment_type: 'advance', mode: 'Cash',
          payment_date: new Date().toISOString().split('T')[0],
          goods_order_id: order.id,
          notes: `Advance for ${form.goods_name} order`
        })
      }
      setModal(false); load()
      showToast('Order added!' + (adv>0?' Advance logged to supplier.':''))
    } catch(e:unknown) { showToast(e instanceof Error ? e.message : 'Save failed', false) } finally { setSaving(false) }
  }

  const updateStatus = async (id:string, status:string) => {
    await supabase.from('goods_orders').update({status}).eq('id',id)
    load()
  }

  const delOrder = async (id:string) => {
    if (!confirm('Delete this order?')) return
    await supabase.from('goods_orders').delete().eq('id',id)
    load()
  }

  const filtered = filter==='All' ? orders : orders.filter(o=>o.status===filter)
  const totalSpend = orders.filter(o=>o.status!=='Cancelled').reduce((s,o)=>s+o.total_price,0)
  const totalAdv   = orders.filter(o=>o.status!=='Cancelled').reduce((s,o)=>s+o.advance_paid,0)

  return (
    <div className="page">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}

      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black text-gray-800">📦 Goods Orders</h1>
          <button onClick={()=>{ setForm({status:'Pending',delivery_date:new Date().toISOString().split('T')[0],priceStr:'',qtyStr:'',advStr:''}); setCatalog([]); setModal(true) }}
            className="btn-primary btn-sm">+ New Order</button>
        </div>
        {orders.length>0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-red-50 rounded-xl p-2 text-center"><p className="font-black text-red-600 text-sm">₹{totalSpend.toFixed(0)}</p><p className="text-[10px] text-red-400">Total Ordered</p></div>
            <div className="bg-green-50 rounded-xl p-2 text-center"><p className="font-black text-green-600 text-sm">₹{totalAdv.toFixed(0)}</p><p className="text-[10px] text-green-400">Advance Paid</p></div>
            <div className="bg-orange-50 rounded-xl p-2 text-center"><p className="font-black text-orange-600 text-sm">₹{(totalSpend-totalAdv).toFixed(0)}</p><p className="text-[10px] text-orange-400">Balance Due</p></div>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto">
          {(['All','Pending','Delivered','Cancelled'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`chip flex-shrink-0 ${filter===f?'chip-active':'chip-idle'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"/></div>
        : filtered.length===0 ? <div className="text-center py-16"><div className="text-5xl mb-2 opacity-20">📦</div><p className="text-gray-400">No {filter==='All'?'':filter.toLowerCase()+' '}orders</p></div>
        : filtered.map(o=>(
          <div key={o.id} className="card mb-3 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-800">{o.goods_name}</span>
                    <span className={STATUS_STYLE[o.status]??'badge-gray'}>{o.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">🏪 {o.supplier_name}{o.site_name?` · 🏗️ ${o.site_name}`:''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">📅 {o.delivery_date} · {o.quantity} {o.unit}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-gray-800">₹{o.total_price.toFixed(0)}</p>
                  {o.advance_paid>0 && <p className="text-xs text-green-600">Adv ₹{o.advance_paid}</p>}
                  {o.total_price-o.advance_paid>0 && <p className="text-xs text-orange-500">Due ₹{(o.total_price-o.advance_paid).toFixed(0)}</p>}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-50 flex">
              {o.status==='Pending' && <button onClick={()=>updateStatus(o.id!,'Delivered')} className="flex-1 py-2 text-xs font-bold text-green-600 hover:bg-green-50 transition">✓ Mark Delivered</button>}
              {o.status==='Pending' && <div className="w-px bg-gray-100"/>}
              {o.status!=='Cancelled' && <button onClick={()=>updateStatus(o.id!,'Cancelled')} className="flex-1 py-2 text-xs font-bold text-gray-400 hover:bg-gray-50 transition">✕ Cancel</button>}
              <div className="w-px bg-gray-100"/>
              <button onClick={()=>delOrder(o.id!)} className="px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-50 transition">🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={()=>setModal(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h2 className="font-black text-lg">New Goods Order</h2><button onClick={()=>setModal(false)} className="text-gray-300 text-2xl">✕</button></div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">Supplier *</label>
                <select value={form.supplier_id??''} onChange={e=>onSupplierChange(e.target.value)} className="input">
                  <option value="">— Select Supplier —</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name} ({s.shop_name||'no shop'})</option>)}
                </select>
              </div>
              {catalog.length>0 ? (
                <div>
                  <label className="label">Goods *</label>
                  <select value={form.goods_name??''} onChange={e=>onGoodsChange(e.target.value)} className="input">
                    <option value="">— Select Goods —</option>
                    {catalog.map(g=><option key={g.id} value={g.goods_name}>{g.goods_name} (₹{g.price_per_unit}/{g.unit})</option>)}
                  </select>
                </div>
              ) : form.supplier_id ? (
                <div>
                  <label className="label">Goods Name (enter manually)</label>
                  <input value={form.goods_name??''} onChange={e=>setForm(f=>({...f,goods_name:e.target.value}))} className="input" placeholder="Supplier has no catalog yet"/>
                </div>
              ) : null}
              <div>
                <label className="label">Site (where to deliver)</label>
                <select value={form.site_id??''} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))} className="input">
                  <option value="">— No specific site —</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Quantity</label><input type="number" inputMode="decimal" value={form.qtyStr??''} onChange={e=>setForm(f=>({...f,qtyStr:e.target.value}))} className="input" placeholder="0"/></div>
                <div><label className="label">Unit</label>
                  <select value={form.unit??'bags'} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} className="input">
                    {['bags','tons','pieces','sq.ft','cu.ft','liters','kg','loads','rods','tiles','Nos'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Price / Unit ₹</label><input type="number" inputMode="decimal" value={form.priceStr??''} onChange={e=>setForm(f=>({...f,priceStr:e.target.value}))} className="input" placeholder="0"/></div>
                <div className="bg-orange-50 rounded-xl p-3 flex flex-col justify-center"><p className="text-xs text-orange-500 font-bold uppercase tracking-wide">Total</p><p className="text-lg font-black text-orange-700">₹{calcTotal().toFixed(0)}</p></div>
              </div>
              <div><label className="label">Advance Paid ₹ <span className="text-gray-400 font-normal">(auto-added to supplier history)</span></label>
                <input type="number" inputMode="decimal" value={form.advStr??''} onChange={e=>setForm(f=>({...f,advStr:e.target.value}))} className="input" placeholder="0"/>
              </div>
              <div><label className="label">Delivery Date *</label><input type="date" value={form.delivery_date??''} onChange={e=>setForm(f=>({...f,delivery_date:e.target.value}))} className="input"/></div>
              <div><label className="label">Notes</label><input value={form.notes??''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="input" placeholder="Optional..."/></div>
              <button onClick={save} disabled={saving} className="btn-primary btn-full">{saving?'⏳ Saving...':'Place Order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default function Goods() { return <AppShell><GoodsPage /></AppShell> }
