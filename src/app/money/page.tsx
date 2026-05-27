'use client'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import { supabase } from '@/lib/supabase'

interface MoneyData {
  siteIncome: number; workerWages: number; workerAdvances: number
  goodsSpend: number; supplierPaid: number; privateWorkerPaid: number
  siteSpend: number; workerBalance: number; supplierBalance: number
  privateWorkerBalance: number
}

function MoneyPage() {
  const [data, setData] = useState<MoneyData|null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'all'|'month'>('month')
  const [sites, setSites] = useState<Array<{id:string;name:string;income:number;workerCost:number;goodsCost:number;net:number}>>([])

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`

  const load = async () => {
    setLoading(true)
    try {
      const dateFilter = period==='month' ? monthStart : '2000-01-01'

      const [
        { data: attData },
        { data: spData },
        { data: goodsData },
        { data: supPay },
        { data: pwPay },
        { data: sitePayData },
        { data: siteList },
      ] = await Promise.all([
        supabase.from('attendance').select('wage,advance,attendance_type').gte('date_key', dateFilter),
        supabase.from('site_payments').select('amount,direction').gte('payment_date', dateFilter),
        supabase.from('goods_orders').select('total_price,advance_paid').neq('status','Cancelled').gte('delivery_date', dateFilter),
        supabase.from('supplier_payments').select('amount').gte('payment_date', dateFilter),
        supabase.from('private_worker_payments').select('amount,direction').gte('created_at', dateFilter),
        supabase.from('site_payments').select('*'),
        supabase.from('sites').select('id,site_name'),
      ])

      const workerWages    = attData?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)??0
      const workerAdvances = attData?.reduce((s,a)=>s+a.advance,0)??0
      const siteIncome     = spData?.filter(s=>s.direction==='received').reduce((s,p)=>s+p.amount,0)??0
      const siteSpend      = spData?.filter(s=>s.direction==='spent').reduce((s,p)=>s+p.amount,0)??0
      const goodsSpend     = goodsData?.reduce((s,o)=>s+o.total_price,0)??0
      const supplierPaid   = supPay?.reduce((s,p)=>s+p.amount,0)??0
      const pwOut          = pwPay?.filter(p=>p.direction==='dad_to_worker').reduce((s,p)=>s+p.amount,0)??0

      // Outstanding balances (all time)
      const [{ data:allAtt },{ data:allGoods },{ data:allSupPay },{ data:allPwPay }] = await Promise.all([
        supabase.from('attendance').select('wage,advance,attendance_type'),
        supabase.from('goods_orders').select('total_price,advance_paid').neq('status','Cancelled'),
        supabase.from('supplier_payments').select('amount'),
        supabase.from('private_worker_payments').select('amount,direction'),
      ])
      const totalWages     = allAtt?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)??0
      const totalAdvances  = allAtt?.reduce((s,a)=>s+a.advance,0)??0
      const workerBalance  = totalWages - totalAdvances
      const totalGoodsOwed = allGoods?.reduce((s,o)=>s+o.total_price,0)??0
      const totalSupPaid   = allSupPay?.reduce((s,p)=>s+p.amount,0)??0
      const supplierBalance = totalGoodsOwed - totalSupPaid
      const totalPwOut     = allPwPay?.filter(p=>p.direction==='dad_to_worker').reduce((s,p)=>s+p.amount,0)??0
      const totalPwIn      = allPwPay?.filter(p=>p.direction==='worker_to_dad').reduce((s,p)=>s+p.amount,0)??0
      const [{ data:allPw }] = await Promise.all([
        supabase.from('private_work').select('price_charged,amount_paid'),
      ])
      const pwCharged      = allPw?.reduce((s,p)=>s+p.price_charged,0)??0
      const pwPaid         = (allPw?.reduce((s,p)=>s+p.amount_paid,0)??0) + totalPwOut - totalPwIn
      const privateWorkerBalance = pwCharged - pwPaid

      setData({ siteIncome, workerWages, workerAdvances, goodsSpend, supplierPaid:supplierPaid, privateWorkerPaid:pwOut, siteSpend, workerBalance, supplierBalance, privateWorkerBalance })

      // Per-site breakdown
      if (siteList) {
        const perSite = await Promise.all(siteList.map(async (site) => {
          const [{ data:sAtt },{ data:sGoods },{ data:sPay }] = await Promise.all([
            supabase.from('attendance').select('wage').eq('site_id',site.id).neq('attendance_type','Absent'),
            supabase.from('goods_orders').select('total_price').eq('site_id',site.id).neq('status','Cancelled'),
            supabase.from('site_payments').select('amount,direction').eq('site_id',site.id),
          ])
          const income = sPay?.filter(p=>p.direction==='received').reduce((s,p)=>s+p.amount,0)??0
          const workerCost = sAtt?.reduce((s,a)=>s+a.wage,0)??0
          const goodsCost  = sGoods?.reduce((s,o)=>s+o.total_price,0)??0
          return { id:site.id, name:site.site_name, income, workerCost, goodsCost, net:income-workerCost-goodsCost }
        }))
        setSites(perSite.filter(s=>s.income+s.workerCost+s.goodsCost>0))
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [period])

  if (loading) return <AppShell><div className="flex justify-center items-center h-64"><div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"/></div></AppShell>
  if (!data) return <AppShell><div className="text-center p-8 text-gray-400">No data available</div></AppShell>

  const totalExpenses = data.workerWages + data.goodsSpend + data.siteSpend + data.privateWorkerPaid
  const net = data.siteIncome - totalExpenses

  return (
    <AppShell>
      <div className="page">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-gray-800">💰 Money Tracking</h1>
            <div className="flex gap-2">
              <button onClick={()=>setPeriod('month')} className={`chip ${period==='month'?'chip-active':'chip-idle'}`}>This Month</button>
              <button onClick={()=>setPeriod('all')} className={`chip ${period==='all'?'chip-active':'chip-idle'}`}>All Time</button>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Net position banner */}
          <div className={`rounded-2xl p-5 text-center ${net>=0?'bg-green-600':'bg-red-600'}`}>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wide mb-1">Net Position ({period==='month'?'This Month':'All Time'})</p>
            <p className="text-white text-3xl font-black">₹{Math.abs(net).toFixed(0)}</p>
            <p className="text-white/80 text-sm mt-1">{net>=0?'Profit — income exceeds expenses':'Loss — expenses exceed income'}</p>
          </div>

          {/* Income */}
          <div>
            <p className="section-header">📈 Income</p>
            <div className="card divide-y divide-gray-50">
              <Row emoji="🏗️" label="Site Income (from owners)" val={data.siteIncome} color="text-green-600"/>
            </div>
            <div className="card mt-1 px-4 py-2 flex justify-between"><span className="font-bold text-sm text-gray-600">Total Income</span><span className="font-black text-green-600">₹{data.siteIncome.toFixed(0)}</span></div>
          </div>

          {/* Expenses */}
          <div>
            <p className="section-header">📉 Expenses</p>
            <div className="card divide-y divide-gray-50">
              <Row emoji="👷" label="Worker Wages" val={data.workerWages} color="text-red-500"/>
              <Row emoji="💵" label="Worker Advances Given" val={data.workerAdvances} color="text-orange-500"/>
              <Row emoji="📦" label="Goods Purchased" val={data.goodsSpend} color="text-red-500"/>
              <Row emoji="🏪" label="Supplier Payments" val={data.supplierPaid} color="text-red-500"/>
              <Row emoji="🔧" label="Private Worker Payments" val={data.privateWorkerPaid} color="text-red-500"/>
              {data.siteSpend>0 && <Row emoji="💸" label="Other Site Expenses" val={data.siteSpend} color="text-red-500"/>}
            </div>
            <div className="card mt-1 px-4 py-2 flex justify-between"><span className="font-bold text-sm text-gray-600">Total Expenses</span><span className="font-black text-red-500">₹{totalExpenses.toFixed(0)}</span></div>
          </div>

          {/* Outstanding balances (all-time) */}
          <div>
            <p className="section-header">⏳ Outstanding Balances (All Time)</p>
            <div className="card divide-y divide-gray-50">
              <BalRow emoji="👷" label="Workers Balance" val={data.workerBalance} posLabel="We owe workers" negLabel="Workers owe us"/>
              <BalRow emoji="🏪" label="Suppliers Balance" val={data.supplierBalance} posLabel="We owe suppliers" negLabel="Suppliers owe us"/>
              <BalRow emoji="🔧" label="Private Workers Balance" val={data.privateWorkerBalance} posLabel="We owe contractors" negLabel="Contractors owe us"/>
            </div>
          </div>

          {/* Per site */}
          {sites.length>0 && (
            <div>
              <p className="section-header">🏗️ Per Site Breakdown (All Time)</p>
              {sites.map(s => (
                <div key={s.id} className="card mb-2 p-4">
                  <p className="font-bold text-gray-800 mb-2">{s.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-green-50 rounded-xl p-2"><p className="text-sm font-black text-green-600">₹{s.income.toFixed(0)}</p><p className="text-[10px] text-green-400">Received</p></div>
                    <div className="bg-red-50 rounded-xl p-2"><p className="text-sm font-black text-red-500">₹{(s.workerCost+s.goodsCost).toFixed(0)}</p><p className="text-[10px] text-red-400">Spent</p></div>
                    <div className={`rounded-xl p-2 ${s.net>=0?'bg-green-50':'bg-red-50'}`}><p className={`text-sm font-black ${s.net>=0?'text-green-700':'text-red-600'}`}>₹{Math.abs(s.net).toFixed(0)}</p><p className={`text-[10px] ${s.net>=0?'text-green-400':'text-red-400'}`}>{s.net>=0?'Profit':'Loss'}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const Row = ({emoji,label,val,color}:{emoji:string;label:string;val:number;color:string}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <span className="text-xl">{emoji}</span>
    <span className="flex-1 text-sm text-gray-600">{label}</span>
    <span className={`font-bold ${color}`}>₹{val.toFixed(0)}</span>
  </div>
)
const BalRow = ({emoji,label,val,posLabel,negLabel}:{emoji:string;label:string;val:number;posLabel:string;negLabel:string}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <span className="text-xl">{emoji}</span>
    <div className="flex-1">
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-xs font-semibold ${val>0?'text-red-500':val<0?'text-green-600':'text-gray-400'}`}>{val===0?'All settled':val>0?posLabel:negLabel}</p>
    </div>
    <span className={`font-bold ${val>0?'text-red-500':val<0?'text-green-600':'text-gray-400'}`}>₹{Math.abs(val).toFixed(0)}</span>
  </div>
)

export default function Money() { return <MoneyPage /> }
