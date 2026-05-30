'use client'
import { useEffect, useState, useRef } from 'react'
import AppShell from '@/components/AppShell'
import { supabase } from '@/lib/supabase'

interface SiteReport   { id:string; name:string; budget:number; received:number; workerCost:number; goodsCost:number; status:string }
interface WorkerReport { id:string; name:string; daysWorked:number; totalEarned:number; totalAdv:number; balance:number }

// Skeleton card for loading state
function SkeletonCard({ rows=2 }: { rows?: number }) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"/>
      {Array.from({length:rows}).map((_,i)=>(
        <div key={i} className="h-3 bg-gray-100 rounded w-full mb-2"/>
      ))}
    </div>
  )
}

function ReportsPage() {
  const [siteReports,   setSiteReports]   = useState<SiteReport[]>([])
  const [workerReports, setWorkerReports] = useState<WorkerReport[]>([])
  const [tab,     setTab]     = useState<'overview'|'sites'|'workers'|'outstanding'>('overview')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({ totalBudget:0, totalReceived:0, totalSpend:0, totalGoodsSpend:0, totalWorkerSpend:0, netPL:0 })
  const [outstanding, setOutstanding] = useState({ workers:0, suppliers:0, privateWorkers:0, sitesPending:0 })
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [
          { data: sites },
          { data: allAtt },
          { data: allGoods },
          { data: allSupPay },
          { data: allPw },
          { data: spData },
          // FIX: fetch ALL workers upfront so name lookup never fails
          { data: allWorkers },
        ] = await Promise.all([
          supabase.from('sites').select('*'),
          supabase.from('attendance').select('wage,advance,attendance_type,site_id,worker_id'),
          supabase.from('goods_orders').select('total_price,advance_paid,site_id').neq('status','Cancelled'),
          supabase.from('supplier_payments').select('amount'),
          supabase.from('private_work').select('price_charged,amount_paid,worker_id'),
          supabase.from('site_payments').select('amount,direction,site_id'),
          supabase.from('workers').select('id,name'),  // FIX: fetch all worker names in one go
        ])

        // Build a quick name-lookup map — O(1) lookup instead of nested find
        const workerNameMap: Record<string, string> = {}
        allWorkers?.forEach(w => { workerNameMap[w.id] = w.name })

        // Site reports
        const sr = (sites ?? []).map(site => {
          const received   = spData?.filter(p=>p.site_id===site.id&&p.direction==='received').reduce((s,p)=>s+p.amount,0) ?? 0
          const workerCost = allAtt?.filter(a=>a.site_id===site.id&&a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0) ?? 0
          const goodsCost  = allGoods?.filter(g=>g.site_id===site.id).reduce((s,g)=>s+g.total_price,0) ?? 0
          return { id:site.id, name:site.site_name, budget:site.budget, received, workerCost, goodsCost, status:site.status }
        })
        setSiteReports(sr)

        // Overview totals
        const totalReceived   = spData?.filter(p=>p.direction==='received').reduce((s,p)=>s+p.amount,0) ?? 0
        const totalWorkerCost = allAtt?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0) ?? 0
        const totalGoods      = allGoods?.reduce((s,g)=>s+g.total_price,0) ?? 0
        const totalBudget     = (sites ?? []).reduce((s,si)=>s+si.budget,0)
        setOverview({ totalBudget, totalReceived, totalSpend:totalWorkerCost+totalGoods, totalGoodsSpend:totalGoods, totalWorkerSpend:totalWorkerCost, netPL:totalReceived-(totalWorkerCost+totalGoods) })

        // Outstanding
        const totalWages      = totalWorkerCost
        const totalAdv        = allAtt?.reduce((s,a)=>s+a.advance,0) ?? 0
        const totalGoodsOwed  = allGoods?.reduce((s,g)=>s+g.total_price,0) ?? 0
        const totalSupPaid    = allSupPay?.reduce((s,p)=>s+p.amount,0) ?? 0
        const totalPwCharged  = allPw?.reduce((s,p)=>s+p.price_charged,0) ?? 0
        const totalPwPaid     = allPw?.reduce((s,p)=>s+p.amount_paid,0) ?? 0
        const sitesPending    = (sites ?? []).filter(s=>s.status==='Active').length
        setOutstanding({ workers:Math.max(0,totalWages-totalAdv), suppliers:Math.max(0,totalGoodsOwed-totalSupPaid), privateWorkers:Math.max(0,totalPwCharged-totalPwPaid), sitesPending })

        // FIX: Worker reports — NO 20-worker limit, names resolved from pre-fetched map
        const workerIds = [...new Set(allAtt?.map(a=>a.worker_id) ?? [])]
        const wr: WorkerReport[] = workerIds
          .map(wid => {
            const wAtt       = allAtt?.filter(a=>a.worker_id===wid) ?? []
            const daysWorked = wAtt.filter(a=>a.attendance_type!=='Absent').length
            const totalEarned= wAtt.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)
            const totalAdv2  = wAtt.reduce((s,a)=>s+a.advance,0)
            if (daysWorked === 0) return null
            return {
              id: wid,
              // FIX: name resolved immediately from map — never shows UUID or 'Unknown'
              name: workerNameMap[wid] ?? '(Deleted Worker)',
              daysWorked,
              totalEarned,
              totalAdv: totalAdv2,
              balance: totalEarned - totalAdv2,
            }
          })
          .filter(Boolean) as WorkerReport[]

        setWorkerReports(wr.sort((a,b)=>b.totalEarned-a.totalEarned))
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // FIX: Print handler for PDF export
  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Construction Manager — Report</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; color: #1e293b; }
            h1 { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
            h2 { font-size: 14px; font-weight: 700; margin: 16px 0 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
            .card .val { font-size: 22px; font-weight: 900; }
            .card .lbl { font-size: 11px; color: #94a3b8; margin-top: 2px; }
            .green { color: #16a34a; } .red { color: #dc2626; } .orange { color: #ea580c; } .blue { color: #2563eb; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; font-size: 11px; color: #64748b; text-transform: uppercase; }
            td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
            .hero { background: ${overview.netPL>=0?'#16a34a':'#dc2626'}; color: white; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 16px; }
            .hero .big { font-size: 36px; font-weight: 900; }
            .hero .sub { font-size: 13px; opacity: 0.8; margin-top: 4px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>📊 Construction Manager — Full Report</h1>
          <p style="color:#94a3b8;font-size:12px;margin-bottom:20px">Generated: ${new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</p>

          <div class="hero">
            <div>Net Profit / Loss (All Time)</div>
            <div class="big">₹${Math.abs(overview.netPL).toFixed(0)}</div>
            <div class="sub">${overview.netPL>=0?'You are in profit 🎉':'You are at a loss ⚠️'}</div>
          </div>

          <div class="grid">
            <div class="card"><div class="val blue">₹${(overview.totalBudget/100000).toFixed(1)}L</div><div class="lbl">Total Budget</div></div>
            <div class="card"><div class="val green">₹${overview.totalReceived.toFixed(0)}</div><div class="lbl">Total Received</div></div>
            <div class="card"><div class="val orange">₹${overview.totalWorkerSpend.toFixed(0)}</div><div class="lbl">Worker Wages</div></div>
            <div class="card"><div class="val red">₹${overview.totalGoodsSpend.toFixed(0)}</div><div class="lbl">Goods Cost</div></div>
          </div>

          <h2>Sites</h2>
          <table>
            <thead><tr><th>Site</th><th>Status</th><th>Budget</th><th>Received</th><th>Spent</th><th>P/L</th></tr></thead>
            <tbody>
              ${siteReports.map(s=>{const pl=s.received-(s.workerCost+s.goodsCost);return`<tr><td>${s.name}</td><td>${s.status}</td><td>₹${(s.budget/100000).toFixed(1)}L</td><td>₹${s.received.toFixed(0)}</td><td>₹${(s.workerCost+s.goodsCost).toFixed(0)}</td><td class="${pl>=0?'green':'red'}">₹${Math.abs(pl).toFixed(0)}</td></tr>`}).join('')}
            </tbody>
          </table>

          <h2>Workers</h2>
          <table>
            <thead><tr><th>Worker</th><th>Days</th><th>Earned</th><th>Advance</th><th>Balance</th></tr></thead>
            <tbody>
              ${workerReports.map(w=>`<tr><td>${w.name}</td><td>${w.daysWorked}</td><td>₹${w.totalEarned.toFixed(0)}</td><td>₹${w.totalAdv.toFixed(0)}</td><td class="${w.balance>0?'red':'green'}">₹${Math.abs(w.balance).toFixed(0)}</td></tr>`).join('')}
            </tbody>
          </table>

          <h2>Outstanding</h2>
          <table>
            <thead><tr><th>Category</th><th>Amount Due</th></tr></thead>
            <tbody>
              <tr><td>Worker Wages Due</td><td class="red">₹${outstanding.workers.toFixed(0)}</td></tr>
              <tr><td>Supplier Bills Due</td><td class="red">₹${outstanding.suppliers.toFixed(0)}</td></tr>
              <tr><td>Private Contractors Due</td><td class="red">₹${outstanding.privateWorkers.toFixed(0)}</td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
  }

  const totalSiteSpend = siteReports.reduce((s,r)=>s+r.workerCost+r.goodsCost,0)

  return (
    <AppShell>
      <div className="page">
        <div className="page-header">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-black text-gray-800">📊 Reports</h1>
            {/* FIX: PDF/Print export button */}
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-2 rounded-xl transition">
              🖨️ Export PDF
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {([['overview','Overview'],['sites','Sites'],['workers','Workers'],['outstanding','Outstanding']] as const).map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} className={`chip flex-shrink-0 ${tab===t?'chip-active':'chip-idle'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div ref={printRef} className="px-4 pt-4 pb-28">
          {/* ── OVERVIEW ── */}
          {tab==='overview' && (
            <div className="space-y-4">
              {loading ? (
                <>
                  <div className="h-32 bg-gray-200 rounded-2xl animate-pulse"/>
                  <div className="grid grid-cols-2 gap-3">
                    {[0,1,2,3].map(i=><div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse"/>)}
                  </div>
                </>
              ) : (
                <>
                  <div className={`rounded-2xl p-5 text-center ${overview.netPL>=0?'bg-gradient-to-br from-green-500 to-emerald-600':'bg-gradient-to-br from-red-500 to-red-600'}`}>
                    <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Net Profit / Loss (All Time)</p>
                    <p className="text-white text-4xl font-black mt-1">₹{Math.abs(overview.netPL).toFixed(0)}</p>
                    <p className="text-white/80 text-sm mt-1">{overview.netPL>=0?'You are in profit 🎉':'You are at a loss ⚠️'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card p-4 text-center"><p className="text-lg font-black text-blue-600">₹{(overview.totalBudget/100000).toFixed(1)}L</p><p className="text-xs text-gray-400">Total Budget</p></div>
                    <div className="card p-4 text-center"><p className="text-lg font-black text-green-600">₹{overview.totalReceived.toFixed(0)}</p><p className="text-xs text-gray-400">Received</p></div>
                    <div className="card p-4 text-center"><p className="text-lg font-black text-orange-600">₹{overview.totalWorkerSpend.toFixed(0)}</p><p className="text-xs text-gray-400">Worker Cost</p></div>
                    <div className="card p-4 text-center"><p className="text-lg font-black text-red-500">₹{overview.totalGoodsSpend.toFixed(0)}</p><p className="text-xs text-gray-400">Goods Cost</p></div>
                  </div>
                  <div className="card p-4">
                    <p className="font-bold text-gray-700 mb-3">Expense Breakdown</p>
                    {([['Worker Wages',overview.totalWorkerSpend],['Goods & Materials',overview.totalGoodsSpend]] as [string,number][]).map(([l,v])=>{
                      const pct = overview.totalSpend>0?Math.round(v/overview.totalSpend*100):0
                      return (
                        <div key={l} className="mb-3">
                          <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{l}</span><span className="font-bold">₹{v.toFixed(0)} ({pct}%)</span></div>
                          <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-orange-500 rounded-full" style={{width:`${pct}%`}}/></div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── SITES ── */}
          {tab==='sites' && (
            <div className="space-y-3">
              {loading ? [0,1,2].map(i=><SkeletonCard key={i} rows={3}/>) :
               siteReports.length===0 ? <div className="text-center py-16 text-gray-400">No site data</div>
               : siteReports.map(s=>{
                const spend = s.workerCost + s.goodsCost
                const netPL = s.received - spend
                return (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div><p className="font-bold text-gray-800">{s.name}</p><span className={s.status==='Active'?'badge-green':'badge-blue'}>{s.status}</span></div>
                      <div className="text-right"><p className={`font-black ${netPL>=0?'text-green-600':'text-red-500'}`}>₹{Math.abs(netPL).toFixed(0)}</p><p className="text-xs text-gray-400">{netPL>=0?'Profit':'Loss'}</p></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-blue-50 rounded-lg p-2"><p className="font-bold text-blue-600">₹{(s.budget/100000).toFixed(1)}L</p><p className="text-blue-400">Budget</p></div>
                      <div className="bg-green-50 rounded-lg p-2"><p className="font-bold text-green-600">₹{s.received.toFixed(0)}</p><p className="text-green-400">Received</p></div>
                      <div className="bg-red-50 rounded-lg p-2"><p className="font-bold text-red-500">₹{spend.toFixed(0)}</p><p className="text-red-400">Spent</p></div>
                    </div>
                    {s.budget>0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Budget used</span><span>{Math.round(spend/s.budget*100)}%</span></div>
                        <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-1.5 rounded-full ${spend/s.budget>0.9?'bg-red-500':spend/s.budget>0.7?'bg-orange-500':'bg-green-500'}`} style={{width:`${Math.min(100,Math.round(spend/s.budget*100))}%`}}/></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── WORKERS ── */}
          {tab==='workers' && (
            <div className="space-y-2">
              {loading ? [0,1,2,3].map(i=><SkeletonCard key={i}/>) :
               workerReports.length===0 ? <div className="text-center py-16 text-gray-400">No attendance data</div>
               : workerReports.map(w=>(
                <div key={w.id} className="card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center font-black text-orange-600 flex-shrink-0">{w.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800">{w.name}</p>
                    <p className="text-xs text-gray-400">{w.daysWorked} days · Earned ₹{w.totalEarned} · Adv ₹{w.totalAdv}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm ${w.balance>0?'text-red-500':w.balance<0?'text-green-600':'text-gray-400'}`}>₹{Math.abs(w.balance).toFixed(0)}</p>
                    <p className="text-[10px] text-gray-400">{w.balance>0?'Owe':'Advance'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── OUTSTANDING ── */}
          {tab==='outstanding' && (
            <div className="space-y-3">
              {loading ? [0,1].map(i=><SkeletonCard key={i} rows={3}/>) : (
                <>
                  <div className="card p-5">
                    <p className="font-bold text-gray-700 mb-4">What You Owe</p>
                    <div className="space-y-3">
                      {[
                        { l:'Workers (wages due)',      v:outstanding.workers,        e:'👷', c:'text-orange-600' },
                        { l:'Suppliers (goods bill due)',v:outstanding.suppliers,      e:'🏪', c:'text-red-500'    },
                        { l:'Private Contractors',      v:outstanding.privateWorkers, e:'🔧', c:'text-purple-600' },
                      ].map(({l,v,e,c})=>(
                        <div key={l} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                          <span className="text-xl">{e}</span>
                          <div className="flex-1"><p className="text-sm text-gray-600">{l}</p></div>
                          <p className={`font-black ${c}`}>₹{v.toFixed(0)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                      <span className="font-black text-gray-700">Total Outstanding</span>
                      <span className="font-black text-red-600">₹{(outstanding.workers+outstanding.suppliers+outstanding.privateWorkers).toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="card p-4 flex items-center gap-3">
                    <span className="text-3xl">🏗️</span>
                    <div><p className="font-bold text-gray-800">{outstanding.sitesPending} Active Sites</p><p className="text-sm text-gray-500">Currently under construction</p></div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
export default function Reports() { return <ReportsPage /> }
