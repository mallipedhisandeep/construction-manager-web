'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'

interface SiteReport   { id:string; name:string; budget:number; received:number; workerCost:number; goodsCost:number; status:string }
interface WorkerReport { id:string; name:string; daysWorked:number; totalEarned:number; totalAdv:number; balance:number }

function SkeletonCard({ rows=2 }: { rows?: number }) {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-4 skeleton rounded w-2/3 mb-3"/>
      {Array.from({length:rows}).map((_,i)=>(
        <div key={i} className="h-3 skeleton rounded w-full mb-2"/>
      ))}
    </div>
  )
}

function ReportsPage() {
  const { lang } = useLang()
  const te = lang === 'te'
  const [siteReports,   setSiteReports]   = useState<SiteReport[]>([])
  const [workerReports, setWorkerReports] = useState<WorkerReport[]>([])
  const [tab,     setTab]     = useState<'overview'|'sites'|'workers'|'outstanding'>('overview')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({ totalBudget:0, totalReceived:0, totalSpend:0, totalGoodsSpend:0, totalWorkerSpend:0, netPL:0 })
  const [outstanding, setOutstanding] = useState({ workers:0, suppliers:0, privateWorkers:0, sitesPending:0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const userId = await uid()
      const [
        { data: sites },
        { data: allAtt },
        { data: allGoods },
        { data: allSupPay },
        { data: allPw },
        { data: spData },
        { data: allWorkers },
      ] = await Promise.all([
        supabase.from('sites').select('*').eq('user_id', userId).is('deleted_at', null),
        supabase.from('attendance').select('wage,advance,attendance_type,site_id,worker_id').eq('user_id', userId),
        supabase.from('goods_orders').select('total_price,advance_paid,site_id').eq('user_id', userId).neq('status','Cancelled'),
        supabase.from('supplier_payments').select('amount').eq('user_id', userId),
        supabase.from('private_work').select('price_charged,amount_paid,worker_id').eq('user_id', userId),
        supabase.from('site_payments').select('amount,direction,site_id').eq('user_id', userId),
        supabase.from('workers').select('id,name').eq('user_id', userId).is('deleted_at', null),
      ])

      const workerNameMap: Record<string, string> = {}
      allWorkers?.forEach(w => { workerNameMap[w.id] = w.name })

      const sr = (sites ?? []).map(site => {
        const received   = spData?.filter(p=>p.site_id===site.id&&p.direction==='received').reduce((s,p)=>s+p.amount,0) ?? 0
        const workerCost = allAtt?.filter(a=>a.site_id===site.id&&a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0) ?? 0
        const goodsCost  = allGoods?.filter(g=>g.site_id===site.id).reduce((s,g)=>s+g.total_price,0) ?? 0
        return { id:site.id, name:site.site_name, budget:site.budget, received, workerCost, goodsCost, status:site.status }
      })
      setSiteReports(sr)

      const totalReceived   = spData?.filter(p=>p.direction==='received').reduce((s,p)=>s+p.amount,0) ?? 0
      const totalWorkerCost = allAtt?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0) ?? 0
      const totalGoods      = allGoods?.reduce((s,g)=>s+g.total_price,0) ?? 0
      const totalBudget     = (sites ?? []).reduce((s,si)=>s+si.budget,0)
      setOverview({ totalBudget, totalReceived, totalSpend:totalWorkerCost+totalGoods, totalGoodsSpend:totalGoods, totalWorkerSpend:totalWorkerCost, netPL:totalReceived-(totalWorkerCost+totalGoods) })

      const totalAdv        = allAtt?.reduce((s,a)=>s+a.advance,0) ?? 0
      const totalGoodsOwed  = allGoods?.reduce((s,g)=>s+g.total_price,0) ?? 0
      const totalSupPaid    = allSupPay?.reduce((s,p)=>s+p.amount,0) ?? 0
      const totalPwCharged  = allPw?.reduce((s,p)=>s+p.price_charged,0) ?? 0
      const totalPwPaid     = allPw?.reduce((s,p)=>s+p.amount_paid,0) ?? 0
      const sitesPending    = (sites ?? []).filter(s=>s.status==='Active').length
      setOutstanding({ workers:Math.max(0,totalWorkerCost-totalAdv), suppliers:Math.max(0,totalGoodsOwed-totalSupPaid), privateWorkers:Math.max(0,totalPwCharged-totalPwPaid), sitesPending })

      const workerIds = [...new Set(allAtt?.map(a=>a.worker_id) ?? [])]
      const wr: WorkerReport[] = workerIds
        .map(wid => {
          const wAtt       = allAtt?.filter(a=>a.worker_id===wid) ?? []
          const daysWorked = wAtt.filter(a=>a.attendance_type!=='Absent').length
          const totalEarned= wAtt.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)
          const totalAdv2  = wAtt.reduce((s,a)=>s+a.advance,0)
          if (daysWorked === 0) return null
          return { id:wid, name:workerNameMap[wid]??'(Deleted Worker)', daysWorked, totalEarned, totalAdv:totalAdv2, balance:totalEarned-totalAdv2 }
        })
        .filter(Boolean) as WorkerReport[]
      setWorkerReports(wr.sort((a,b)=>b.totalEarned-a.totalEarned))
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handlePrint = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const profitLabel = te ? 'లాభంలో ఉన్నారు 🎉' : 'You are in profit 🎉'
    const lossLabel   = te ? 'నష్టంలో ఉన్నారు ⚠️' : 'You are at a loss ⚠️'
    w.document.write(`<html><head><title>CM Report</title><style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#1e293b}
      h1{font-size:20px;font-weight:900;margin-bottom:4px}
      h2{font-size:14px;font-weight:700;margin:16px 0 8px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
      .card{border:1px solid #e2e8f0;border-radius:12px;padding:12px}
      .card .val{font-size:22px;font-weight:900}.card .lbl{font-size:11px;color:#94a3b8;margin-top:2px}
      .green{color:#16a34a}.red{color:#dc2626}.orange{color:#b45f06}.blue{color:#2563eb}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;font-size:11px;color:#64748b;text-transform:uppercase}
      td{padding:8px;border-bottom:1px solid #f1f5f9}
      .hero{background:${overview.netPL>=0?'#16a34a':'#dc2626'};color:white;border-radius:16px;padding:20px;text-align:center;margin-bottom:16px}
      .hero .big{font-size:36px;font-weight:900}.hero .sub{font-size:13px;opacity:.8;margin-top:4px}
      @media print{body{padding:0}}
    </style></head><body>
      <h1>📊 Construction Manager — Full Report</h1>
      <p style="color:#94a3b8;font-size:12px;margin-bottom:20px">Generated: ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
      <div class="hero">
        <div>${te?'నికర లాభ / నష్టం (అన్ని సమయాలు)':'Net Profit / Loss (All Time)'}</div>
        <div class="big">₹${Math.abs(overview.netPL).toFixed(0)}</div>
        <div class="sub">${overview.netPL>=0?profitLabel:lossLabel}</div>
      </div>
      <div class="grid">
        <div class="card"><div class="val blue">₹${(overview.totalBudget/100000).toFixed(1)}L</div><div class="lbl">${te?'మొత్తం బడ్జెట్':'Total Budget'}</div></div>
        <div class="card"><div class="val green">₹${overview.totalReceived.toFixed(0)}</div><div class="lbl">${te?'స్వీకరించబడింది':'Total Received'}</div></div>
        <div class="card"><div class="val orange">₹${overview.totalWorkerSpend.toFixed(0)}</div><div class="lbl">${te?'కార్మికుల వేతనాలు':'Worker Wages'}</div></div>
        <div class="card"><div class="val red">₹${overview.totalGoodsSpend.toFixed(0)}</div><div class="lbl">${te?'వస్తువుల ఖర్చు':'Goods Cost'}</div></div>
      </div>
      <h2>${te?'సైట్లు':'Sites'}</h2>
      <table><thead><tr>
        <th>${te?'సైటు':'Site'}</th><th>${te?'స్థితి':'Status'}</th><th>${te?'బడ్జెట్':'Budget'}</th>
        <th>${te?'స్వీకరించబడింది':'Received'}</th><th>${te?'ఖర్చు':'Spent'}</th><th>P/L</th>
      </tr></thead><tbody>
        ${siteReports.map(s=>{const pl=s.received-(s.workerCost+s.goodsCost);return`<tr><td>${s.name}</td><td>${s.status}</td><td>₹${(s.budget/100000).toFixed(1)}L</td><td>₹${s.received.toFixed(0)}</td><td>₹${(s.workerCost+s.goodsCost).toFixed(0)}</td><td class="${pl>=0?'green':'red'}">₹${Math.abs(pl).toFixed(0)}</td></tr>`}).join('')}
      </tbody></table>
      <h2>${te?'కార్మికులు':'Workers'}</h2>
      <table><thead><tr>
        <th>${te?'పేరు':'Worker'}</th><th>${te?'రోజులు':'Days'}</th><th>${te?'సంపాదించినది':'Earned'}</th>
        <th>${te?'అడ్వాన్స్':'Advance'}</th><th>${te?'బాకీ':'Balance'}</th>
      </tr></thead><tbody>
        ${workerReports.map(w=>`<tr><td>${w.name}</td><td>${w.daysWorked}</td><td>₹${w.totalEarned.toFixed(0)}</td><td>₹${w.totalAdv.toFixed(0)}</td><td class="${w.balance>0?'red':'green'}">₹${Math.abs(w.balance).toFixed(0)}</td></tr>`).join('')}
      </tbody></table>
    </body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => { w.print(); w.close() }, 500)
  }

  const tabs: [string, string][] = [
    ['overview',    te?'అవలోకనం':'Overview'],
    ['sites',       te?'సైట్లు':'Sites'],
    ['workers',     te?'కార్మికులు':'Workers'],
    ['outstanding', te?'బకాయిలు':'Outstanding'],
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>📊 {te?'నివేదికలు':'Reports'}</h1>
          <button onClick={handlePrint} className="btn-ghost btn-sm">🖨️ {te?'PDF':'Export PDF'}</button>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(([t,l]) => (
            <button key={t} onClick={()=>setTab(t as typeof tab)} className={`chip flex-shrink-0 ${tab===t?'chip-active':'chip-idle'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-28">
        {tab==='overview' && (
          <div className="space-y-4">
            {loading ? (
              <>
                <div className="h-32 skeleton rounded-2xl animate-pulse"/>
                <div className="grid grid-cols-2 gap-3">
                  {[0,1,2,3].map(i=><div key={i} className="h-20 skeleton rounded-2xl animate-pulse"/>)}
                </div>
              </>
            ) : (
              <>
                <div className={`rounded-2xl p-5 text-center ${overview.netPL>=0?'bg-gradient-to-br from-green-500 to-emerald-600':'bg-gradient-to-br from-red-500 to-red-600'}`}>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wide">{te?'నికర లాభ / నష్టం (అన్ని సమయాలు)':'Net Profit / Loss (All Time)'}</p>
                  <p className="text-white text-4xl font-black mt-1">₹{Math.abs(overview.netPL).toFixed(0)}</p>
                  <p className="text-white/80 text-sm mt-1">
                    {overview.netPL>=0 ? (te?'లాభంలో ఉన్నారు 🎉':'You are in profit 🎉') : (te?'నష్టంలో ఉన్నారు ⚠️':'You are at a loss ⚠️')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="card p-4 text-center"><p className="text-lg font-black text-blue-600 dark:text-blue-400">₹{(overview.totalBudget/100000).toFixed(1)}L</p><p className="text-xs" style={{color:'rgb(var(--muted))'}}>{te?'మొత్తం బడ్జెట్':'Total Budget'}</p></div>
                  <div className="card p-4 text-center"><p className="text-lg font-black text-green-600 dark:text-green-400">₹{overview.totalReceived.toFixed(0)}</p><p className="text-xs" style={{color:'rgb(var(--muted))'}}>{te?'స్వీకరించబడింది':'Received'}</p></div>
                  <div className="card p-4 text-center"><p className="text-lg font-black" style={{color:'rgb(var(--accent))'}}>₹{overview.totalWorkerSpend.toFixed(0)}</p><p className="text-xs" style={{color:'rgb(var(--muted))'}}>{te?'కార్మికుల వేతనాలు':'Worker Cost'}</p></div>
                  <div className="card p-4 text-center"><p className="text-lg font-black text-red-500 dark:text-red-400">₹{overview.totalGoodsSpend.toFixed(0)}</p><p className="text-xs" style={{color:'rgb(var(--muted))'}}>{te?'వస్తువుల ఖర్చు':'Goods Cost'}</p></div>
                </div>
                <div className="card p-4">
                  <p className="font-bold mb-3" style={{color:'rgb(var(--text))'}}>{te?'ఖర్చుల వివరాలు':'Expense Breakdown'}</p>
                  {([[te?'కార్మికుల వేతనాలు':'Worker Wages',overview.totalWorkerSpend],[te?'వస్తువులు & సామగ్రి':'Goods & Materials',overview.totalGoodsSpend]] as [string,number][]).map(([l,v])=>{
                    const pct=overview.totalSpend>0?Math.round(v/overview.totalSpend*100):0
                    return (
                      <div key={l} className="mb-3">
                        <div className="flex justify-between text-sm mb-1"><span style={{color:'rgb(var(--text))'}}>{l}</span><span className="font-bold" style={{color:'rgb(var(--text))'}}>₹{v.toFixed(0)} ({pct}%)</span></div>
                        <div className="h-2 rounded-full" style={{background:'rgb(var(--surface2))'}}>
                          <div className="h-2 rounded-full" style={{width:`${pct}%`,background:'linear-gradient(90deg,rgb(var(--accent)),rgb(var(--accent2)))'}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {tab==='sites' && (
          <div className="space-y-3">
            {loading ? [0,1,2].map(i=><SkeletonCard key={i} rows={3}/>) :
             siteReports.length===0 ? <div className="text-center py-16" style={{color:'rgb(var(--muted))'}}>{te?'సైటు డేటా లేదు':'No site data'}</div>
             : siteReports.map(s=>{
              const spend=s.workerCost+s.goodsCost; const netPL=s.received-spend
              return (
                <div key={s.id} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold" style={{color:'rgb(var(--text))'}}>{s.name}</p>
                      <span className={s.status==='Active'?'badge-green':'badge-blue'}>{s.status}</span>
                    </div>
                    <div className="text-right">
                      <p className={`font-black ${netPL>=0?'text-green-600 dark:text-green-400':'text-red-500 dark:text-red-400'}`}>₹{Math.abs(netPL).toFixed(0)}</p>
                      <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{netPL>=0?(te?'లాభం':'Profit'):(te?'నష్టం':'Loss')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg p-2" style={{background:'rgba(59,130,246,0.1)'}}><p className="font-bold text-blue-600 dark:text-blue-400">₹{(s.budget/100000).toFixed(1)}L</p><p style={{color:'rgb(var(--muted))'}}>{te?'బడ్జెట్':'Budget'}</p></div>
                    <div className="rounded-lg p-2" style={{background:'rgba(22,163,74,0.1)'}}><p className="font-bold text-green-600 dark:text-green-400">₹{s.received.toFixed(0)}</p><p style={{color:'rgb(var(--muted))'}}>{te?'స్వీకరించబడింది':'Received'}</p></div>
                    <div className="rounded-lg p-2" style={{background:'rgba(200,40,40,0.1)'}}><p className="font-bold text-red-500 dark:text-red-400">₹{spend.toFixed(0)}</p><p style={{color:'rgb(var(--muted))'}}>{te?'ఖర్చు':'Spent'}</p></div>
                  </div>
                  {s.budget>0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1" style={{color:'rgb(var(--muted))'}}><span>{te?'బడ్జెట్ వాడుక':'Budget used'}</span><span>{Math.round(spend/s.budget*100)}%</span></div>
                      <div className="h-1.5 rounded-full" style={{background:'rgb(var(--surface2))'}}>
                        <div className={`h-1.5 rounded-full ${spend/s.budget>0.9?'bg-red-500':spend/s.budget>0.7?'bg-amber-500':'bg-green-500'}`} style={{width:`${Math.min(100,Math.round(spend/s.budget*100))}%`}}/>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab==='workers' && (
          <div className="space-y-2">
            {loading ? [0,1,2,3].map(i=><SkeletonCard key={i}/>) :
             workerReports.length===0 ? <div className="text-center py-16" style={{color:'rgb(var(--muted))'}}>{te?'హాజరు డేటా లేదు':'No attendance data'}</div>
             : workerReports.map(w=>(
              <div key={w.id} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black flex-shrink-0" style={{background:'rgba(var(--accent),0.15)',color:'rgb(var(--accent))'}}>
                  {w.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold" style={{color:'rgb(var(--text))'}}>{w.name}</p>
                  <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{w.daysWorked} {te?'రోజులు':'days'} · {te?'సంపాదించినది':'Earned'} ₹{w.totalEarned} · {te?'అడ్వాన్స్':'Adv'} ₹{w.totalAdv}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${w.balance>0?'text-red-500 dark:text-red-400':w.balance<0?'text-green-600 dark:text-green-400':''}`} style={w.balance===0?{color:'rgb(var(--muted))'}:{}}>₹{Math.abs(w.balance).toFixed(0)}</p>
                  <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{w.balance>0?(te?'ఇవ్వాలి':'Owe'):(te?'అడ్వాన్స్':'Advance')}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='outstanding' && (
          <div className="space-y-3">
            {loading ? [0,1].map(i=><SkeletonCard key={i} rows={3}/>) : (
              <>
                <div className="card p-5">
                  <p className="font-bold mb-4" style={{color:'rgb(var(--text))'}}>{te?'మీరు ఇవ్వాల్సినవి':'What You Owe'}</p>
                  <div className="space-y-3">
                    {[
                      { l:te?'కార్మికుల వేతనాలు':'Workers (wages due)',       v:outstanding.workers,        e:'👷', c:'text-amber-500 dark:text-amber-400' },
                      { l:te?'సరఫరాదారు బిల్లులు':'Suppliers (goods bill due)', v:outstanding.suppliers,      e:'🏪', c:'text-red-500 dark:text-red-400'    },
                      { l:te?'ప్రైవేట్ కాంట్రాక్టర్లు':'Private Contractors',   v:outstanding.privateWorkers, e:'🔧', c:'text-purple-600 dark:text-purple-400' },
                    ].map(({l,v,e,c})=>(
                      <div key={l} className="flex items-center gap-3 py-2 border-b last:border-0" style={{borderColor:'rgb(var(--border))'}}>
                        <span className="text-xl">{e}</span>
                        <div className="flex-1"><p className="text-sm" style={{color:'rgb(var(--text))'}}>{l}</p></div>
                        <p className={`font-black ${c}`}>₹{v.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t flex justify-between" style={{borderColor:'rgb(var(--border))'}}>
                    <span className="font-black" style={{color:'rgb(var(--text))'}}>{te?'మొత్తం బకాయి':'Total Outstanding'}</span>
                    <span className="font-black text-red-500 dark:text-red-400">₹{(outstanding.workers+outstanding.suppliers+outstanding.privateWorkers).toFixed(0)}</span>
                  </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                  <span className="text-3xl">🏗️</span>
                  <div>
                    <p className="font-bold" style={{color:'rgb(var(--text))'}}>{outstanding.sitesPending} {te?'చురుకైన సైట్లు':'Active Sites'}</p>
                    <p className="text-sm" style={{color:'rgb(var(--muted))'}}>{te?'నిర్మాణంలో ఉన్నవి':'Currently under construction'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Reports() { return <AppShell><ReportsPage /></AppShell> }
