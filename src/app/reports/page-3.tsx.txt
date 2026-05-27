'use client'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import { supabase } from '@/lib/supabase'

interface SiteReport { id:string; name:string; budget:number; received:number; workerCost:number; goodsCost:number; pwCost:number; status:string }
interface WorkerReport { id:string; name:string; daysWorked:number; totalEarned:number; totalAdv:number; balance:number }

function ReportsPage() {
  const [siteReports, setSiteReports] = useState<SiteReport[]>([])
  const [workerReports, setWorkerReports] = useState<WorkerReport[]>([])
  const [tab, setTab] = useState<'overview'|'sites'|'workers'|'outstanding'>('overview')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({ totalBudget:0, totalReceived:0, totalSpend:0, totalGoodsSpend:0, totalWorkerSpend:0, netPL:0 })
  const [outstanding, setOutstanding] = useState<{workers:number;suppliers:number;privateWorkers:number;sitesPending:number}>({workers:0,suppliers:0,privateWorkers:0,sitesPending:0})

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [{ data:sites },{ data:allAtt },{ data:allGoods },{ data:allSupPay },{ data:allPwPay },{ data:allPw },{ data:spData }] = await Promise.all([
          supabase.from('sites').select('*'),
          supabase.from('attendance').select('wage,advance,attendance_type,site_id,worker_id'),
          supabase.from('goods_orders').select('total_price,advance_paid,site_id').neq('status','Cancelled'),
          supabase.from('supplier_payments').select('amount'),
          supabase.from('private_worker_payments').select('amount,direction'),
          supabase.from('private_work').select('price_charged,amount_paid,worker_id'),
          supabase.from('site_payments').select('amount,direction,site_id'),
        ])

        // Site reports
        const sr = (sites??[]).map(site => {
          const received   = spData?.filter(p=>p.site_id===site.id&&p.direction==='received').reduce((s,p)=>s+p.amount,0)??0
          const workerCost = allAtt?.filter(a=>a.site_id===site.id&&a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)??0
          const goodsCost  = allGoods?.filter(g=>g.site_id===site.id).reduce((s,g)=>s+g.total_price,0)??0
          const pwCost     = 0 // private work linked to site
          return { id:site.id, name:site.site_name, budget:site.budget, received, workerCost, goodsCost, pwCost, status:site.status }
        })
        setSiteReports(sr)

        // Overview
        const totalReceived = spData?.filter(p=>p.direction==='received').reduce((s,p)=>s+p.amount,0)??0
        const totalWorker   = allAtt?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)??0
        const totalGoods    = allGoods?.reduce((s,g)=>s+g.total_price,0)??0
        const totalBudget   = (sites??[]).reduce((s,si)=>s+si.budget,0)
        setOverview({ totalBudget, totalReceived, totalSpend:totalWorker+totalGoods, totalGoodsSpend:totalGoods, totalWorkerSpend:totalWorker, netPL:totalReceived-(totalWorker+totalGoods) })

        // Outstanding
        const totalWages    = allAtt?.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)??0
        const totalAdv      = allAtt?.reduce((s,a)=>s+a.advance,0)??0
        const totalGoodsOwed = allGoods?.reduce((s,g)=>s+g.total_price,0)??0
        const totalSupPaid  = allSupPay?.reduce((s,p)=>s+p.amount,0)??0
        const totalPwOut    = allPwPay?.filter(p=>p.direction==='dad_to_worker').reduce((s,p)=>s+p.amount,0)??0
        const totalPwCharged = allPw?.reduce((s,p)=>s+p.price_charged,0)??0
        const totalPwPaid   = allPw?.reduce((s,p)=>s+p.amount_paid,0)??0
        const sitesPending  = (sites??[]).filter(s=>s.status==='Active').length
        setOutstanding({ workers:Math.max(0,totalWages-totalAdv), suppliers:Math.max(0,totalGoodsOwed-totalSupPaid), privateWorkers:Math.max(0,totalPwCharged-totalPwPaid-totalPwOut), sitesPending })

        // Worker reports (simple)
        const workers = [...new Set(allAtt?.map(a=>a.worker_id)||[])]
        const wr: WorkerReport[] = []
        for (const wid of workers.slice(0,20)) { // limit for performance
          const wAtt = allAtt?.filter(a=>a.worker_id===wid)??[]
          const daysWorked = wAtt.filter(a=>a.attendance_type!=='Absent').length
          const totalEarned = wAtt.filter(a=>a.attendance_type!=='Absent').reduce((s,a)=>s+a.wage,0)
          const totalAdv2 = wAtt.reduce((s,a)=>s+a.advance,0)
          if (daysWorked>0) wr.push({ id:wid, name:wid, daysWorked, totalEarned, totalAdv:totalAdv2, balance:totalEarned-totalAdv2 })
        }
        // Fetch worker names
        if (wr.length>0) {
          const { data:wnames } = await supabase.from('workers').select('id,name').in('id',wr.map(w=>w.id))
          wr.forEach(w => { w.name = wnames?.find(n=>n.id===w.id)?.name ?? 'Unknown' })
        }
        setWorkerReports(wr.sort((a,b)=>b.totalEarned-a.totalEarned))
      } catch(e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <AppShell><div className="flex justify-center items-center h-64"><div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"/></div></AppShell>

  const totalSiteSpend = siteReports.reduce((s,r)=>s+r.workerCost+r.goodsCost,0)

  return (
    <AppShell>
      <div className="page">
        <div className="page-header">
          <h1 className="text-xl font-black text-gray-800 mb-3">📊 Reports</h1>
          <div className="flex gap-2 overflow-x-auto">
            {([['overview','Overview'],['sites','Sites'],['workers','Workers'],['outstanding','Outstanding']] as const).map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} className={`chip flex-shrink-0 ${tab===t?'chip-active':'chip-idle'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-4 pb-28">
          {tab==='overview' && (
            <div className="space-y-4">
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
                    <div key={l as string} className="mb-3">
                      <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{l as string}</span><span className="font-bold">₹{(v as number).toFixed(0)} ({pct}%)</span></div>
                      <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-orange-500 rounded-full" style={{width:`${pct}%`}}/></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab==='sites' && (
            <div className="space-y-3">
              {siteReports.length===0 ? <div className="text-center py-16 text-gray-400">No site data</div>
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

          {tab==='workers' && (
            <div className="space-y-2">
              {workerReports.length===0 ? <div className="text-center py-16 text-gray-400">No attendance data</div>
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

          {tab==='outstanding' && (
            <div className="space-y-3">
              <div className="card p-5">
                <p className="font-bold text-gray-700 mb-4">What You Owe</p>
                <div className="space-y-3">
                  {[
                    { l:'Workers (wages due)', v:outstanding.workers, e:'👷', c:'text-orange-600' },
                    { l:'Suppliers (goods bill due)', v:outstanding.suppliers, e:'🏪', c:'text-red-500' },
                    { l:'Private Contractors', v:outstanding.privateWorkers, e:'🔧', c:'text-purple-600' },
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
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
export default function Reports() { return <ReportsPage /> }
