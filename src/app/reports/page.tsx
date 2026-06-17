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

// FIX: Sanitize values for safe insertion into HTML to prevent XSS in print window
function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
        supabase.from('goods_orders').select('total_price,advance_paid,site_id').eq('user_id', userId).neq('status','Cancelled').is('deleted_at', null),
        // FIX: filter deleted supplier payments
        supabase.from('supplier_payments').select('amount').eq('user_id', userId).is('deleted_at', null),
        supabase.from('private_work').select('price_charged,amount_paid,worker_id').eq('user_id', userId).is('deleted_at', null),
        supabase.from('site_payments').select('amount,direction,site_id').eq('user_id', userId).is('deleted_at', null),
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

      // FIX: outstanding workers should use wages - advances (not advances alone)
      const totalWorkerAdv  = allAtt?.reduce((s,a)=>s+a.advance,0) ?? 0
      const totalGoodsOwed  = allGoods?.reduce((s,g)=>s+g.total_price,0) ?? 0
      const totalSupPaid    = allSupPay?.reduce((s,p)=>s+p.amount,0) ?? 0
      const totalPwCharged  = allPw?.reduce((s,p)=>s+p.price_charged,0) ?? 0
      const totalPwPaid     = allPw?.reduce((s,p)=>s+p.amount_paid,0) ?? 0
      const sitesPending    = (sites ?? []).filter(s=>s.status==='Active').length
      setOutstanding({
        workers:        Math.max(0, totalWorkerCost - totalWorkerAdv),
        suppliers:      Math.max(0, totalGoodsOwed  - totalSupPaid),
        privateWorkers: Math.max(0, totalPwCharged  - totalPwPaid),
        sitesPending,
      })

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
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>CM Report</title><style>
      @page{margin:16mm}
      *{box-sizing:border-box}
      body{font-family:system-ui,sans-serif;padding:0;margin:0;color:#1e293b;font-size:13px}
      h1{font-size:20px;font-weight:900;margin:0 0 2px}
      h2{font-size:11px;font-weight:700;margin:18px 0 8px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
      .meta{color:#94a3b8;font-size:11px;margin-bottom:18px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px}
      .card{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}
      .card .val{font-size:20px;font-weight:900;line-height:1.1}.card .lbl{font-size:10px;color:#94a3b8;margin-top:2px}
      .green{color:#16a34a}.red{color:#dc2626}.orange{color:#b45f06}.blue{color:#2563eb}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
      th{text-align:left;padding:6px 8px;border-bottom:2px solid #e2e8f0;font-size:10px;color:#64748b;text-transform:uppercase;background:#f8fafc}
      td{padding:6px 8px;border-bottom:1px solid #f1f5f9}
      tr:last-child td{border-bottom:none}
      .hero{background:${overview.netPL>=0?'#16a34a':'#dc2626'};color:white;border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .hero .lbl{font-size:12px;opacity:.85}
      .hero .big{font-size:32px;font-weight:900;line-height:1.1;margin:4px 0}
      .hero .sub{font-size:12px;opacity:.75}
      .outstanding{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
      .out-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f1f5f9}
      .out-row:last-child{border-bottom:none;font-weight:900;background:#f8fafc}
      @media print{
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .hero{background:${overview.netPL>=0?'#16a34a':'#dc2626'} !important}
      }
    </style></head><body>
      <h1>📊 Construction Manager — ${te?'పూర్తి నివేదిక':'Full Report'}</h1>
      <p class="meta">${te?'రూపొందించబడింది':'Generated'}: ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>

      <div class="hero">
        <div class="lbl">${te?'నికర లాభ / నష్టం (అన్ని సమయాలు)':'Net Profit / Loss (All Time)'}</div>
        <div class="big">₹${Math.abs(overview.netPL).toFixed(0)}</div>
        <div class="sub">${overview.netPL>=0?profitLabel:lossLabel}</div>
      </div>

      <h2>${te?'ఆర్థిక సారాంశం':'Financial Overview'}</h2>
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
        ${siteReports.map(s=>{const pl=s.received-(s.workerCost+s.goodsCost);return`<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.status)}</td><td>₹${(s.budget/100000).toFixed(1)}L</td><td class="green">₹${s.received.toFixed(0)}</td><td class="orange">₹${(s.workerCost+s.goodsCost).toFixed(0)}</td><td class="${pl>=0?'green':'red'}"><b>${pl>=0?'+':'-'}₹${Math.abs(pl).toFixed(0)}</b></td></tr>`}).join('')}
      </tbody></table>

      <h2>${te?'కార్మికులు':'Workers'}</h2>
      <table><thead><tr>
        <th>${te?'పేరు':'Worker'}</th><th>${te?'రోజులు':'Days'}</th><th>${te?'సంపాదించినది':'Earned'}</th>
        <th>${te?'అడ్వాన్స్':'Advance'}</th><th>${te?'బాకీ':'Balance'}</th>
      </tr></thead><tbody>
        ${workerReports.map(w=>`<tr><td><b>${esc(w.name)}</b></td><td>${w.daysWorked}</td><td class="green">₹${w.totalEarned.toFixed(0)}</td><td class="orange">₹${w.totalAdv.toFixed(0)}</td><td class="${w.balance>0?'red':'green'}"><b>₹${Math.abs(w.balance).toFixed(0)}</b></td></tr>`).join('')}
      </tbody></table>

      <h2>${te?'బకాయిలు':'Outstanding'}</h2>
      <div class="outstanding">
        <div class="out-row"><span>👷 ${te?'కార్మికుల వేతనాలు':'Worker wages due'}</span><span class="orange">₹${outstanding.workers.toFixed(0)}</span></div>
        <div class="out-row"><span>🏪 ${te?'సరఫరాదారు బిల్లులు':'Supplier bills due'}</span><span class="red">₹${outstanding.suppliers.toFixed(0)}</span></div>
        <div class="out-row"><span>🔧 ${te?'కాంట్రాక్టర్లు':'Private Contractors'}</span><span class="blue">₹${outstanding.privateWorkers.toFixed(0)}</span></div>
        <div class="out-row"><span>${te?'మొత్తం బకాయి':'Total Outstanding'}</span><span class="red">₹${(outstanding.workers+outstanding.suppliers+outstanding.privateWorkers).toFixed(0)}</span></div>
      </div>

      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    w.document.close()
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
        <div className="flex gap-1 overflow-x-auto" style={{scrollbarWidth:'none'}}>
          {tabs.map(([t,l]) => (
            <button key={t} onClick={() => setTab(t as typeof tab)}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition"
              style={{background: tab===t?'rgb(var(--accent))':'rgb(var(--surface2))', color: tab===t?'#fff':'rgb(var(--muted))'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-24">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i=><SkeletonCard key={i} rows={3}/>)}
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="space-y-3">
                <div className={`rounded-2xl p-5 text-center`}
                  style={{background: overview.netPL>=0?'#16a34a':'#dc2626'}}>
                  <p className="text-sm font-bold text-white/80">{te?'నికర లాభ / నష్టం':'Net Profit / Loss'}</p>
                  <p className="text-4xl font-black text-white mt-1">₹{Math.abs(overview.netPL).toFixed(0)}</p>
                  <p className="text-sm text-white/70 mt-1">{overview.netPL>=0?(te?'లాభంలో ఉన్నారు 🎉':'You are in profit 🎉'):(te?'నష్టంలో ఉన్నారు ⚠️':'You are at a loss ⚠️')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {l:te?'మొత్తం బడ్జెట్':'Total Budget',    v:`₹${(overview.totalBudget/100000).toFixed(1)}L`, c:'#2563eb'},
                    {l:te?'స్వీకరించబడింది':'Total Received',  v:`₹${overview.totalReceived.toFixed(0)}`,         c:'#16a34a'},
                    {l:te?'కార్మికుల వేతనాలు':'Worker Wages', v:`₹${overview.totalWorkerSpend.toFixed(0)}`,      c:'#b45f06'},
                    {l:te?'వస్తువుల ఖర్చు':'Goods Cost',      v:`₹${overview.totalGoodsSpend.toFixed(0)}`,       c:'#dc2626'},
                  ].map(({l,v,c})=>(
                    <div key={l} className="card p-4 text-center">
                      <p className="text-2xl font-black" style={{color:c}}>{v}</p>
                      <p className="text-[11px] mt-1" style={{color:'rgb(var(--muted))'}}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'sites' && (
              <div className="space-y-2">
                {siteReports.length === 0 ? (
                  <div className="text-center py-16 opacity-50"><p className="text-4xl mb-2">🏗️</p><p style={{color:'rgb(var(--muted))'}}>{te?'సైట్లు లేవు':'No sites found'}</p></div>
                ) : siteReports.map(s => {
                  const pl = s.received - (s.workerCost + s.goodsCost)
                  return (
                    <div key={s.id} className="card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm" style={{color:'rgb(var(--text))'}}>{s.name}</p>
                          <span className={s.status==='Active'?'badge-green':'badge-blue'}>{s.status}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-black text-sm" style={{color: pl>=0?'#16a34a':'#dc2626'}}>
                            {pl>=0?'+':'-'}₹{Math.abs(pl).toFixed(0)}
                          </p>
                          <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>P/L</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[
                          {l:te?'స్వీకరించబడింది':'Received',  v:s.received,                   c:'#16a34a'},
                          {l:te?'కార్మికులు':'Workers',         v:s.workerCost,                  c:'#b45f06'},
                          {l:te?'వస్తువులు':'Goods',           v:s.goodsCost,                   c:'#dc2626'},
                        ].map(({l,v,c})=>(
                          <div key={l} className="rounded-lg p-2 text-center" style={{background:'rgb(var(--bg))'}}>
                            <p className="text-sm font-black" style={{color:c}}>₹{v.toFixed(0)}</p>
                            <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{l}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'workers' && (
              <div className="space-y-2">
                {workerReports.length === 0 ? (
                  <div className="text-center py-16 opacity-50"><p className="text-4xl mb-2">👷</p><p style={{color:'rgb(var(--muted))'}}>{te?'డేటా లేదు':'No data'}</p></div>
                ) : workerReports.map(w => (
                  <div key={w.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{color:'rgb(var(--text))'}}>{w.name}</p>
                        <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{w.daysWorked} {te?'రోజులు':'days'} · {te?'సంపాదించినది':'Earned'} ₹{w.totalEarned} · {te?'అడ్వాన్స్':'Adv'} ₹{w.totalAdv}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-sm" style={{color: w.balance>0?'#dc2626':'#16a34a'}}>
                          ₹{Math.abs(w.balance).toFixed(0)}
                        </p>
                        <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>
                          {w.balance>0?(te?'చెల్లించాల్సింది':'Owe worker'):w.balance<0?(te?'తిరిగి ఇవ్వాలి':'Worker owes'):(te?'క్లియర్':'Clear')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'outstanding' && (
              <div className="space-y-3">
                <div className="card p-4">
                  <p className="text-xs font-black uppercase tracking-widest mb-3" style={{color:'rgb(var(--muted))'}}>
                    {te?'బకాయిలు':'Outstanding Amounts'}
                  </p>
                  <div className="space-y-3">
                    {[
                      { l:te?'కార్మికుల వేతనాలు':'Workers (wages due)',        v:outstanding.workers,        e:'👷', c:'text-amber-500 dark:text-amber-400' },
                      { l:te?'సరఫరాదారు బిల్లులు':'Suppliers (goods bill due)', v:outstanding.suppliers,      e:'🏪', c:'text-red-500 dark:text-red-400'    },
                      { l:te?'ప్రైవేట్ కాంట్రాక్టర్లు':'Private Contractors',   v:outstanding.privateWorkers, e:'🔧', c:'text-purple-600 dark:text-purple-400' },
                    ].map(({ l, v, e, c }) => (
                      <div key={l} className="flex items-center justify-between py-2 border-b last:border-0"
                        style={{borderColor:'rgb(var(--border))'}}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{e}</span>
                          <span className="text-sm font-medium" style={{color:'rgb(var(--text))'}}>{l}</span>
                        </div>
                        <span className={`font-black text-base ${c}`}>₹{v.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 flex items-center justify-between" style={{borderTop:'2px solid rgb(var(--border))'}}>
                    <span className="font-black text-sm" style={{color:'rgb(var(--text))'}}>{te?'మొత్తం':'Total Outstanding'}</span>
                    <span className="font-black text-red-500 dark:text-red-400">₹{(outstanding.workers+outstanding.suppliers+outstanding.privateWorkers).toFixed(0)}</span>
                  </div>
                </div>
                <div className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏗️</span>
                    <p className="font-bold" style={{color:'rgb(var(--text))'}}>{outstanding.sitesPending} {te?'చురుకైన సైట్లు':'Active Sites'}</p>
                  </div>
                  <span className="badge-green">{te?'నిర్మాణంలో':'In Progress'}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function Reports() { return <AppShell><ReportsPage /></AppShell> }
