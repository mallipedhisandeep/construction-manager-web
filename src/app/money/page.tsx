'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { fetchAll } from '@/lib/fetchAll'
import { HelpIcon } from '@/components/HelpIcon'

interface MoneyData {
  siteIncome: number; workerWages: number; workerAdvances: number
  goodsSpend: number; supplierPaid: number; privateWorkerPaid: number
  siteSpend: number; workerBalance: number; supplierBalance: number
  privateWorkerBalance: number
}

function MoneyPage() {
  const { lang } = useLang()
  const te = lang === 'te'
  const [data,    setData]    = useState<MoneyData|null>(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState<'all'|'month'>('month')
  const [sites,   setSites]   = useState<Array<{id:string;name:string;income:number;workerCost:number;goodsCost:number;net:number}>>([])

  const CACHE_KEY = `cm_money_${period}`
  const CACHE_TTL = 60 * 1000  // 60 seconds — short enough that edits elsewhere show up quickly

  const load = useCallback(async () => {
    // Check sessionStorage cache first — avoids 14 parallel queries on revisit
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { ts: cachedAt, data: cachedData, sites: cachedSites } = JSON.parse(cached)
        if (Date.now() - cachedAt < CACHE_TTL) {
          setData(cachedData); setSites(cachedSites); setLoading(false); return
        }
      }
    } catch {}

    setLoading(true)
    try {
      
      const userId = await uid()
      if (!userId) { setLoading(false); return }

      const now        = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
      const dateFilter = period === 'month' ? monthStart : '2000-01-01'

      // Single batch for period-filtered data + all-time balances
      const [
        { data: attData },    { data: spData },     { data: goodsData },
        { data: supPay },     { data: pwPay },      { data: siteList },
        { data: allAtt },     { data: allGoods },   { data: allSupPay },
        { data: allPwPay },   { data: allPw },
        { data: attSite },    { data: goodsSite },  { data: sitePayAll },
      ] = await Promise.all([
        // Period-filtered
        fetchAll(() => supabase.from('attendance').select('wage,advance,attendance_type').eq('user_id',userId).gte('date_key', dateFilter)),
        fetchAll(() => supabase.from('site_payments').select('amount,direction').eq('user_id',userId).is('deleted_at',null).gte('payment_date', dateFilter)),
        fetchAll(() => supabase.from('goods_orders').select('total_price,advance_paid').eq('user_id',userId).neq('status','Cancelled').is('deleted_at',null).gte('delivery_date', dateFilter)),
        fetchAll(() => supabase.from('supplier_payments').select('amount').eq('user_id',userId).is('deleted_at',null).gte('payment_date', dateFilter)),
        fetchAll(() => supabase.from('private_worker_payments').select('amount,direction').eq('user_id',userId).is('deleted_at',null).gte('date', dateFilter)),
        fetchAll(() => supabase.from('sites').select('id,site_name').eq('user_id',userId).is('deleted_at', null)),
        // All-time for outstanding balances
        fetchAll(() => supabase.from('attendance').select('wage,advance,attendance_type').eq('user_id',userId)),
        fetchAll(() => supabase.from('goods_orders').select('total_price,advance_paid').eq('user_id',userId).neq('status','Cancelled').is('deleted_at',null)),
        fetchAll(() => supabase.from('supplier_payments').select('amount').eq('user_id',userId).is('deleted_at',null)),
        fetchAll(() => supabase.from('private_worker_payments').select('amount,direction').eq('user_id',userId).is('deleted_at',null)),
        fetchAll(() => supabase.from('private_work').select('price_charged,amount_paid').eq('user_id',userId).is('deleted_at',null)),
        // Per-site breakdown (all-time)
        fetchAll(() => supabase.from('attendance').select('wage,site_id').eq('user_id',userId).neq('attendance_type','Absent')),
        fetchAll(() => supabase.from('goods_orders').select('total_price,site_id').eq('user_id',userId).neq('status','Cancelled').is('deleted_at',null)),
        fetchAll(() => supabase.from('site_payments').select('amount,direction,site_id').eq('user_id',userId).is('deleted_at',null)),
      ])

      const workerWages    = attData?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)??0
      const workerAdvances = attData?.reduce((s,a)=>s+a.advance,0)??0
      const siteIncome     = spData?.filter(s=>s.direction==='received').reduce((s,p)=>s+p.amount,0)??0
      const siteSpend      = spData?.filter(s=>s.direction==='spent').reduce((s,p)=>s+p.amount,0)??0
      const goodsSpend     = goodsData?.reduce((s,o)=>s+o.total_price,0)??0
      const supplierPaid   = supPay?.reduce((s,p)=>s+p.amount,0)??0
      const pwOut          = pwPay?.filter(p=>p.direction==='dad_to_worker').reduce((s,p)=>s+p.amount,0)??0

      const totalWages     = allAtt?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)??0
      const totalAdvances  = allAtt?.reduce((s,a)=>s+a.advance,0)??0
      const workerBalance  = totalWages - totalAdvances
      const totalGoodsOwed = allGoods?.reduce((s,o)=>s+o.total_price,0)??0
      const totalSupPaid   = allSupPay?.reduce((s,p)=>s+p.amount,0)??0
      const supplierBalance = totalGoodsOwed - totalSupPaid
      const totalPwOut     = allPwPay?.filter(p=>p.direction==='dad_to_worker').reduce((s,p)=>s+p.amount,0)??0
      const totalPwIn      = allPwPay?.filter(p=>p.direction==='worker_to_dad').reduce((s,p)=>s+p.amount,0)??0
      const pwCharged      = allPw?.reduce((s,p)=>s+p.price_charged,0)??0
      const pwPaid         = (allPw?.reduce((s,p)=>s+p.amount_paid,0)??0) + totalPwOut - totalPwIn
      const privateWorkerBalance = pwCharged - pwPaid

      setData({ siteIncome, workerWages, workerAdvances, goodsSpend, supplierPaid, privateWorkerPaid:pwOut, siteSpend, workerBalance, supplierBalance, privateWorkerBalance })

      if (siteList) {
        const perSite = siteList.map(site => {
          const income     = sitePayAll?.filter(p=>p.site_id===site.id&&p.direction==='received').reduce((s,p)=>s+p.amount,0)??0
          const workerCost = attSite?.filter(a=>a.site_id===site.id).reduce((s,a)=>s+a.wage,0)??0
          const goodsCost  = goodsSite?.filter(g=>g.site_id===site.id).reduce((s,o)=>s+o.total_price,0)??0
          return { id:site.id, name:site.site_name, income, workerCost, goodsCost, net:income-workerCost-goodsCost }
        })
        const filteredSites = perSite.filter(s=>s.income+s.workerCost+s.goodsCost>0)
        setSites(filteredSites)
        // Write full result to sessionStorage cache
        try {
          const result2 = { siteIncome, workerWages, workerAdvances, goodsSpend, supplierPaid, privateWorkerPaid:pwOut, siteSpend, workerBalance, supplierBalance, privateWorkerBalance }
          sessionStorage.setItem(`cm_money_${period}`, JSON.stringify({ ts: Date.now(), data: result2, sites: filteredSites }))
        } catch {}
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin w-10 h-10 border-4 border-t-transparent rounded-full" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
    </div>
  )
  if (!data) return (
    <div className="page flex items-center justify-center">
      <p className="text-center p-8" style={{color:'rgb(var(--muted))'}}>{te?'డేటా లేదు':'No data available'}</p>
    </div>
  )

  const totalExpenses = data.workerWages + data.goodsSpend + data.siteSpend + data.privateWorkerPaid
  const net = data.siteIncome - totalExpenses

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>💰 {te?'డబ్బు':'Money Tracking'}</h1>
            <HelpIcon textKey="money.profitLoss" />
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={()=>setPeriod('month')} className={`chip ${period==='month'?'chip-active':'chip-idle'}`}>{te?'ఈ నెల':'This Month'}</button>
            <button onClick={()=>setPeriod('all')}   className={`chip ${period==='all'  ?'chip-active':'chip-idle'}`}>{te?'అన్ని సమయాలు':'All Time'}</button>
            <HelpIcon textKey="money.periodFilter" />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className={`rounded-2xl p-5 text-center ${net>=0?'bg-green-600':'bg-red-600'}`}>
          <p className="text-white/70 text-xs font-bold uppercase tracking-wide mb-1">
            {te?'నికర స్థానం':'Net Position'} ({period==='month'?(te?'ఈ నెల':'This Month'):(te?'అన్ని సమయాలు':'All Time')})
          </p>
          <p className="text-white text-3xl font-black">₹{Math.abs(net).toFixed(0)}</p>
          <p className="text-white/80 text-sm mt-1">
            {net>=0 ? (te?'లాభం — ఆదాయం ఖర్చులను మించింది':'Profit — income exceeds expenses') : (te?'నష్టం — ఖర్చులు ఆదాయాన్ని మించాయి':'Loss — expenses exceed income')}
          </p>
        </div>

        <div>
          <p className="section-header">📈 {te?'ఆదాయం':'Income'}</p>
          <div className="card">
            <Row emoji="🏗️" label={te?'సైటు ఆదాయం (యజమానుల నుండి)':'Site Income (from owners)'} val={data.siteIncome} color="text-green-600 dark:text-green-400"/>
          </div>
        </div>

        <div>
          <p className="section-header">📉 {te?'ఖర్చులు':'Expenses'}</p>
          <div className="card">
            <Row emoji="👷" label={te?'కార్మికుల వేతనాలు':'Worker Wages'}                         val={data.workerWages}         color="text-red-500 dark:text-red-400"/>
            <Row emoji="💵" label={te?'అడ్వాన్సులు ఇచ్చాము':'Worker Advances Given'}              val={data.workerAdvances}      color="text-amber-500 dark:text-amber-400"/>
            <Row emoji="📦" label={te?'వస్తువులు కొన్నవి':'Goods Purchased'}                       val={data.goodsSpend}          color="text-red-500 dark:text-red-400"/>
            <Row emoji="🏪" label={te?'సరఫరాదారు చెల్లింపులు':'Supplier Payments'}                 val={data.supplierPaid}        color="text-red-500 dark:text-red-400"/>
            <Row emoji="🔧" label={te?'ప్రైవేట్ కార్మికుల చెల్లింపులు':'Private Worker Payments'} val={data.privateWorkerPaid}   color="text-red-500 dark:text-red-400"/>
            {data.siteSpend>0 && <Row emoji="💸" label={te?'ఇతర సైటు ఖర్చులు':'Other Site Expenses'} val={data.siteSpend} color="text-red-500 dark:text-red-400"/>}
          </div>
          <div className="card mt-1 px-4 py-2 flex justify-between">
            <span className="font-bold text-sm" style={{color:'rgb(var(--muted))'}}>{te?'మొత్తం ఖర్చులు':'Total Expenses'}</span>
            <span className="font-black text-red-500 dark:text-red-400">₹{totalExpenses.toFixed(0)}</span>
          </div>
        </div>

        <div>
          <p className="section-header">⏳ {te?'బకాయి బాలెన్సులు (అన్ని సమయాలు)':'Outstanding Balances (All Time)'}</p>
          <div className="card">
            <BalRow emoji="👷" label={te?'కార్మికుల బాలెన్స్':'Workers Balance'}         val={data.workerBalance}          posLabel={te?'మేము కార్మికులకు ఇవ్వాలి':'We owe workers'}       negLabel={te?'కార్మికులు మాకు ఇవ్వాలి':'Workers owe us'}/>
            <BalRow emoji="🏪" label={te?'సరఫరాదారుల బాలెన్స్':'Suppliers Balance'}      val={data.supplierBalance}        posLabel={te?'మేము సరఫరాదారులకు ఇవ్వాలి':'We owe suppliers'}   negLabel={te?'సరఫరాదారులు మాకు ఇవ్వాలి':'Suppliers owe us'}/>
            <BalRow emoji="🔧" label={te?'ప్రైవేట్ కార్మికుల బాలెన్స్':'Contractors Balance'} val={data.privateWorkerBalance} posLabel={te?'మేము కాంట్రాక్టర్లకు ఇవ్వాలి':'We owe contractors'} negLabel={te?'కాంట్రాక్టర్లు మాకు ఇవ్వాలి':'Contractors owe us'}/>
          </div>
        </div>

        {sites.length > 0 && (
          <div>
            <p className="section-header">🏗️ {te?'సైటు వారీగా (అన్ని సమయాలు)':'Per Site Breakdown (All Time)'}</p>
            {sites.map(s => (
              <div key={s.id} className="card mb-2 p-4">
                <p className="font-bold mb-2" style={{color:'rgb(var(--text))'}}>{s.name}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl p-2" style={{background:'rgba(22,163,74,0.1)'}}><p className="text-sm font-black text-green-600 dark:text-green-400">₹{s.income.toFixed(0)}</p><p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{te?'వచ్చింది':'Received'}</p></div>
                  <div className="rounded-xl p-2" style={{background:'rgba(220,38,38,0.1)'}}><p className="text-sm font-black text-red-500 dark:text-red-400">₹{(s.workerCost+s.goodsCost).toFixed(0)}</p><p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{te?'ఖర్చు':'Spent'}</p></div>
                  <div className="rounded-xl p-2" style={{background:s.net>=0?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.1)'}}><p className={`text-sm font-black ${s.net>=0?'text-green-600 dark:text-green-400':'text-red-500 dark:text-red-400'}`}>₹{Math.abs(s.net).toFixed(0)}</p><p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{s.net>=0?(te?'లాభం':'Profit'):(te?'నష్టం':'Loss')}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const Row = ({emoji,label,val,color}:{emoji:string;label:string;val:number;color:string}) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{borderColor:'rgb(var(--border))'}}>
    <span className="text-xl">{emoji}</span>
    <span className="flex-1 text-sm" style={{color:'rgb(var(--muted))'}}>{label}</span>
    <span className={`font-bold ${color}`}>₹{val.toFixed(0)}</span>
  </div>
)
const BalRow = ({emoji,label,val,posLabel,negLabel}:{emoji:string;label:string;val:number;posLabel:string;negLabel:string}) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{borderColor:'rgb(var(--border))'}}>
    <span className="text-xl">{emoji}</span>
    <div className="flex-1">
      <p className="text-sm" style={{color:'rgb(var(--muted))'}}>{label}</p>
      <p className={`text-xs font-semibold ${val>0?'text-red-500 dark:text-red-400':val<0?'text-green-600 dark:text-green-400':''}`}
        style={val===0?{color:'rgb(var(--muted))'}:{}}>
        {val===0 ? '✓ All settled' : val>0 ? posLabel : negLabel}
      </p>
    </div>
    <span className={`font-bold ${val>0?'text-red-500 dark:text-red-400':val<0?'text-green-600 dark:text-green-400':''}`}
      style={val===0?{color:'rgb(var(--muted))'}:{}}>
      ₹{Math.abs(val).toFixed(0)}
    </span>
  </div>
)

export default function Money() { return <MoneyPage /> }
