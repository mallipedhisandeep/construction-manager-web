'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { GOODS_UNITS } from '@/lib/constants'
import type { GoodsOrder, Supplier, SupplierGoods, Site } from '@/lib/types'

const STATUS_STYLE: Record<string,string> = {
  Pending:'badge-amber', Delivered:'badge-green', Cancelled:'badge-red'
}

function GoodsPage() {
  const { lang } = useLang()
  const te = lang === 'te'

  const [orders,    setOrders]    = useState<GoodsOrder[]>([])
  const [suppliers, setSuppliers] = useState<(Supplier & {id:string})[]>([])
  const [catalog,   setCatalog]   = useState<SupplierGoods[]>([])
  const [sites,     setSites]     = useState<(Site & {id:string})[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [filter,    setFilter]    = useState<'All'|'Pending'|'Delivered'|'Cancelled'>('Pending')
  const [search,    setSearch]    = useState('')
  const [form, setForm] = useState<Partial<GoodsOrder & {priceStr:string;qtyStr:string;advStr:string}>>({
    status:'Pending',
    delivery_date: new Date().toISOString().split('T')[0],
    priceStr:'', qtyStr:'', advStr:'',
  })

  const { showToast: _showToast } = useToast()
  const showToast = (msg: string, ok = true) => _showToast(msg, ok ? 'ok' : 'err')

  const load = useCallback(async () => {
    setLoading(true)
    const userId = await uid()
    if (!userId) { setLoading(false); return }
    const [{ data:o },{ data:s },{ data:si }] = await Promise.all([
      supabase.from('goods_orders').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at',{ascending:false}),
      supabase.from('suppliers').select('*').eq('user_id', userId).is('deleted_at', null).order('name'),
      supabase.from('sites').select('id,site_name,status').eq('user_id', userId).eq('status','Active').is('deleted_at', null),
    ])
    setOrders(o??[]); setSuppliers(s??[]); setSites((si??[]) as (Site & {id:string})[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onSupplierChange = async (supId: string) => {
    setForm(f=>({...f, supplier_id:supId, goods_name:'', unit:'', priceStr:''}))
    const userId = await uid()
    // Filter by both supplier_id and user_id to prevent cross-user catalog leakage
    const { data } = await supabase.from('supplier_goods').select('*')
      .eq('supplier_id', supId).eq('user_id', userId).order('goods_name')
    setCatalog(data??[])
  }

  const onGoodsChange = (goodsName: string) => {
    const item = catalog.find(g=>g.goods_name===goodsName)
    setForm(f=>({...f, goods_name:goodsName, unit:item?.unit??'bags', priceStr:item?.price_per_unit?.toString()??''}))
  }

  const calcTotal = () => (parseFloat(form.qtyStr||'0')) * (parseFloat(form.priceStr||'0'))

  const save = async () => {
    if (!form.supplier_id||!form.goods_name||!form.delivery_date) {
      showToast(te ? 'అవసరమైన ఫీల్డ్‌లు నింపండి' : 'Please fill required fields', false)
      return
    }
    const qty   = parseFloat(form.qtyStr||'0')
    const price = parseFloat(form.priceStr||'0')
    if (qty <= 0) { showToast(te ? 'పరిమాణం 0 కంటే ఎక్కువ ఉండాలి' : 'Quantity must be greater than 0', false); return }
    if (price <= 0) { showToast(te ? 'ధర 0 కంటే ఎక్కువ ఉండాలి' : 'Price must be greater than 0', false); return }
    const advCheck = parseFloat(form.advStr||'0')
    if (advCheck < 0) { showToast(te ? 'అడ్వాన్స్ నెగటివ్‌గా ఉండకూడదు' : 'Advance cannot be negative', false); return }
    if (advCheck > qty * price) { showToast(te ? 'అడ్వాన్స్ మొత్తం ఖరీదు కంటే ఎక్కువ ఉండకూడదు' : 'Advance cannot exceed the order total', false); return }
    setSaving(true)
    const sup  = suppliers.find(s=>s.id===form.supplier_id)
    const site = sites.find(s=>s.id===form.site_id)
    const adv   = parseFloat(form.advStr||'0')
    const total = qty * price

    try {
      const userId = await uid()
      const { data:order, error } = await supabase.from('goods_orders').insert({
        supplier_id: form.supplier_id, supplier_name: sup?.name??'',
        goods_name: form.goods_name, unit: form.unit,
        site_id: form.site_id||null, site_name: site?.site_name??'',
        delivery_date: form.delivery_date, quantity: qty,
        price_per_unit: price, total_price: total, advance_paid: adv,
        status: form.status||'Pending', notes: form.notes,
        user_id: userId,
      }).select().single()
      if (error) throw error

      if (adv > 0 && order) {
        await supabase.from('supplier_payments').insert({
          supplier_id: form.supplier_id, amount: adv,
          payment_type: 'advance', mode: 'Cash',
          payment_date: new Date().toISOString().split('T')[0],
          goods_order_id: order.id,
          notes: `Advance for ${form.goods_name} order`,
          user_id: userId,
        })
      }
      setModal(false); load()
      showToast(te
        ? ('ఆర్డర్ జోడించబడింది!' + (adv>0?' అడ్వాన్స్ నమోదు చేయబడింది.':''))
        : ('Order added!'         + (adv>0?' Advance logged to supplier.':'')))
    } catch(e:unknown) {
      showToast(e instanceof Error ? e.message : (te?'సేవ్ విఫలమైంది':'Save failed'), false)
    } finally { setSaving(false) }
  }

  const updateStatus = async (id:string, status:string) => {
    const { error } = await supabase.from('goods_orders').update({status}).eq('id',id)
    if (error) { showToast(error.message, false); return }
    load()
  }

 
  const delOrder = async (id:string) => {
    if (!confirm(te ? 'ఈ ఆర్డర్‌ని చెత్తబుట్టకు తరలించాలా?' : 'Move this order to recycle bin?')) return
    const { error } = await supabase
      .from('goods_orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { showToast(error.message, false); return }

    // The advance payment created alongside this order (supplier_payments.goods_order_id)
    // would otherwise keep counting toward the supplier's balance for an order
    // that no longer exists in any active view.
    const { error: payErr } = await supabase
      .from('supplier_payments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('goods_order_id', id)
      .is('deleted_at', null)
    if (payErr) console.error('Failed to cascade-delete linked advance payment:', payErr.message)

    showToast(te ? 'చెత్తబుట్టకు తరలించబడింది 🗑️' : 'Moved to recycle bin 🗑️')
    load()
  }

  const GOODS_ORDER: Record<string,number> = { Pending:0, Delivered:1, Cancelled:2 }
  const allSorted  = [...orders].sort((a,b) => (GOODS_ORDER[a.status]??1) - (GOODS_ORDER[b.status]??1))
  const filteredByStatus = filter==='All' ? allSorted : allSorted.filter(o=>o.status===filter)
  const filtered = search.trim()
    ? filteredByStatus.filter(o => o.goods_name.toLowerCase().includes(search.toLowerCase()) || (o.supplier_name??'').toLowerCase().includes(search.toLowerCase()) || (o.site_name??'').toLowerCase().includes(search.toLowerCase()))
    : filteredByStatus
  const totalSpend = orders.filter(o=>o.status!=='Cancelled').reduce((s,o)=>s+o.total_price,0)
  const totalAdv   = orders.filter(o=>o.status!=='Cancelled').reduce((s,o)=>s+o.advance_paid,0)

  const filterLabels: Record<string,string> = te
    ? {All:'అన్ని ఆర్డర్లు',Pending:'పెండింగ్',Delivered:'డెలివరీ అయింది',Cancelled:'రద్దు చేయబడింది'}
    : {All:'All Orders', Pending:'Pending', Delivered:'Delivered', Cancelled:'Cancelled'}
  // Count per status for badge display
  const filterCounts: Record<string,number> = {
    All: orders.length,
    Pending:   orders.filter(o=>o.status==='Pending').length,
    Delivered: orders.filter(o=>o.status==='Delivered').length,
    Cancelled: orders.filter(o=>o.status==='Cancelled').length,
  }
  const statusLabels: Record<string,string> = te
    ? {Pending:'పెండింగ్',Delivered:'డెలివరీ అయింది',Cancelled:'రద్దు'}
    : {Pending:'Pending', Delivered:'Delivered',       Cancelled:'Cancelled'}

  return (
    <div className="page">

      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>
            📦 {te?'వస్తువుల ఆర్డర్లు':'Goods Orders'}
          </h1>
          <button
            onClick={()=>{ setForm({status:'Pending',delivery_date:new Date().toISOString().split('T')[0],priceStr:'',qtyStr:'',advStr:''}); setCatalog([]); setModal(true) }}
            className="btn-primary btn-sm">
            + {te?'కొత్త ఆర్డర్':'New Order'}
          </button>
        </div>

        {orders.length>0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl p-2 text-center" style={{background:'rgba(220,38,38,0.12)'}}>
              <p className="font-black text-red-400 text-sm">₹{totalSpend.toFixed(0)}</p>
              <p className="text-[10px] text-red-400">{te?'మొత్తం ఆర్డర్':'Total Ordered'}</p>
            </div>
            <div className="rounded-xl p-2 text-center" style={{background:'rgba(22,163,74,0.12)'}}>
              <p className="font-black text-green-400 text-sm">₹{totalAdv.toFixed(0)}</p>
              <p className="text-[10px] text-green-400">{te?'అడ్వాన్స్ చెల్లింపు':'Advance Paid'}</p>
            </div>
            <div className="rounded-xl p-2 text-center" style={{background:'rgba(212,140,40,0.12)'}}>
              <p className="font-black text-sm" style={{color:'#d48c28'}}>₹{(totalSpend-totalAdv).toFixed(0)}</p>
              <p className="text-[10px]" style={{color:'#d48c28'}}>{te?'బాకీ':'Balance Due'}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto mb-2.5">
          {(['All','Pending','Delivered','Cancelled'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`chip flex-shrink-0 ${filter===f?'chip-active':'chip-idle'} flex items-center gap-1.5`}>
              {filterLabels[f]}
              {filterCounts[f] > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    background: filter===f ? 'rgba(255,255,255,0.25)' : 'rgba(var(--accent),0.15)',
                    color: filter===f ? '#fff' : 'rgb(var(--accent))',
                  }}>
                  {filterCounts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={te?'వస్తువు, సరఫరాదారు వెతకండి...':'Search goods, supplier, site...'} className="input py-2 text-sm" />
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"/>
          </div>
        ) : filtered.length===0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-2 opacity-20">📦</div>
            <p style={{color:'rgb(var(--muted))'}}>{te?'ఆర్డర్లు లేవు':'No orders'}</p>
          </div>
        ) : filtered.map(o=>(
          <div key={o.id} className="card mb-3 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold" style={{color:'rgb(var(--text))'}}>{o.goods_name}</span>
                    <span className={STATUS_STYLE[o.status]??'badge-gray'}>{statusLabels[o.status]??o.status}</span>
                  </div>
                  <p className="text-sm mt-0.5" style={{color:'rgb(var(--muted))'}}>
                    🏪 {o.supplier_name}{o.site_name?` · 🏗️ ${o.site_name}`:''}
                  </p>
                  <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>
                    📅 {o.delivery_date} · {o.quantity} {o.unit}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black" style={{color:'rgb(var(--text))'}}>₹{o.total_price.toFixed(0)}</p>
                  {o.advance_paid>0 && <p className="text-xs text-green-500">{te?'అడ్వాన్స్':'Adv'} ₹{o.advance_paid}</p>}
                  {(o.total_price-o.advance_paid)>0 && (
                    <p className="text-xs" style={{color:'#d48c28'}}>{te?'బాకీ':'Due'} ₹{(o.total_price-o.advance_paid).toFixed(0)}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t flex" style={{borderColor:'rgb(var(--border))'}}>
              {o.status==='Pending' && (
                <button onClick={()=>updateStatus(o.id!,'Delivered')}
                  className="flex-1 py-2 text-xs font-bold text-green-500 hover:bg-green-500/10 transition">
                  ✓ {te?'డెలివరీ గుర్తించు':'Mark Delivered'}
                </button>
              )}
              {o.status==='Pending' && (
                <div className="w-px" style={{background:'rgb(var(--border))'}}/>
              )}
              {o.status!=='Cancelled' && (
                <button onClick={()=>updateStatus(o.id!,'Cancelled')}
                  className="flex-1 py-2 text-xs font-bold transition"
                  style={{color:'rgb(var(--muted))'}}>
                  ✕ {te?'రద్దు చేయి':'Cancel'}
                </button>
              )}
              <div className="w-px" style={{background:'rgb(var(--border))'}}/>
          
              <button onClick={()=>delOrder(o.id!)}
                className="px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 transition">
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── New Order Modal ── */}
      {modal && (
        <div className="modal-backdrop" onClick={()=>setModal(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>
                {te?'కొత్త వస్తువుల ఆర్డర్':'New Goods Order'}
              </h2>
              <button onClick={()=>setModal(false)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">{te?'సరఫరాదారు *':'Supplier *'}</label>
                <select value={form.supplier_id??''} onChange={e=>onSupplierChange(e.target.value)} className="input">
                  <option value="">{te?'— సరఫరాదారు ఎంచుకోండి —':'— Select Supplier —'}</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name} ({s.shop_name||(te?'దుకాణం లేదు':'no shop')})</option>)}
                </select>
              </div>
              {catalog.length>0 ? (
                <div>
                  <label className="label">{te?'వస్తువు *':'Goods *'}</label>
                  <select value={form.goods_name??''} onChange={e=>onGoodsChange(e.target.value)} className="input">
                    <option value="">{te?'— వస్తువు ఎంచుకోండి —':'— Select Goods —'}</option>
                    {catalog.map(g=><option key={g.id} value={g.goods_name}>{g.goods_name} (₹{g.price_per_unit}/{g.unit})</option>)}
                  </select>
                </div>
              ) : form.supplier_id ? (
                <div>
                  <label className="label">{te?'వస్తువు పేరు':'Goods Name'}</label>
                  <input value={form.goods_name??''} onChange={e=>setForm(f=>({...f,goods_name:e.target.value}))}
                    className="input" placeholder={te?'మాన్యువల్‌గా నమోదు చేయండి':'Enter manually'}/>
                </div>
              ) : null}
              <div>
                <label className="label">{te?'సైటు':'Site'}</label>
                <select value={form.site_id??''} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))} className="input">
                  <option value="">{te?'— నిర్దిష్ట సైటు లేదు —':'— No specific site —'}</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{te?'పరిమాణం':'Quantity'}</label>
                  <input type="number" inputMode="decimal" value={form.qtyStr??''} onChange={e=>setForm(f=>({...f,qtyStr:e.target.value}))} className="input" placeholder="0"/>
                </div>
                <div><label className="label">{te?'యూనిట్':'Unit'}</label>
                  <select value={form.unit??'bags'} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} className="input">
                    {GOODS_UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{te?'ధర / యూనిట్ ₹':'Price / Unit ₹'}</label>
                  <input type="number" inputMode="decimal" value={form.priceStr??''} onChange={e=>setForm(f=>({...f,priceStr:e.target.value}))} className="input" placeholder="0"/>
                </div>
                <div className="rounded-xl p-3 flex flex-col justify-center" style={{background:'rgba(212,140,40,0.1)'}}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color:'#d48c28'}}>{te?'మొత్తం':'Total'}</p>
                  <p className="text-xl font-black" style={{color:'#d48c28'}}>₹{calcTotal().toFixed(0)}</p>
                </div>
              </div>
              <div>
                <label className="label">{te?'అడ్వాన్స్ చెల్లింపు ₹':'Advance Paid ₹'}</label>
                <input type="number" inputMode="decimal" value={form.advStr??''} onChange={e=>setForm(f=>({...f,advStr:e.target.value}))} className="input" placeholder="0"/>
              </div>
              <div>
                <label className="label">{te?'డెలివరీ తేదీ *':'Delivery Date *'}</label>
                <input type="date" value={form.delivery_date??''} onChange={e=>setForm(f=>({...f,delivery_date:e.target.value}))} className="input"/>
              </div>
              <div>
                <label className="label">{te?'గమనికలు':'Notes'}</label>
                <input value={form.notes??''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="input" placeholder={te?'ఐచ్ఛికం...':'Optional...'}/>
              </div>
              <button onClick={save} disabled={saving} className="btn-primary btn-full">
                {saving ? (te?'⏳ సేవ్ అవుతోంది...':'⏳ Saving...') : (te?'ఆర్డర్ ఇవ్వు':'Place Order')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default function Goods() { return <GoodsPage /> }
