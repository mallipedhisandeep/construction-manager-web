'use client'
import { useEffect, useState } from 'react'
import { useLang, useTheme, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import { useRouter } from 'next/navigation'

interface Stats {
  workers: number; sites: number; attendance: number
  suppliers: number; privateWorkers: number
}

// ── Subscription types ────────────────────────────────────────────────────────
// Plan field mirrors what will be stored in the subscriptions table.
// For now the app is fully free — this UI is ready for when billing is wired up.
type Plan = 'free' | 'trial' | 'pro' | 'lifetime'

interface SubInfo {
  plan: Plan
  trialEndsAt: string | null   // ISO date string, null if not on trial
  renewsAt: string | null       // ISO date string for next billing date
}

// Escape user-entered text before interpolating into the HTML report below —
// without this, a worker/site/supplier name or note containing HTML/script
// could execute in the same-origin print window this report opens into
// (which has access to the same localStorage as the main app, including the
// Supabase session token). Mirrors the esc() helper in reports/page.tsx.
function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function ProfilePage() {
  const { lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [user,  setUser]  = useState<{ name: string; email: string; avatar?: string } | null>(null)
  const [stats, setStats] = useState<Stats>({ workers:0, sites:0, attendance:0, suppliers:0, privateWorkers:0 })
  const [sub,   setSub]   = useState<SubInfo>({ plan:'free', trialEndsAt: null, renewsAt: null })
  const [loading, setLoading] = useState(true)
  const [showSignOut, setShowSignOut] = useState(false)

  const { showToast } = useToast()

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        const raw = u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? 'User'
        setUser({
          name:   raw,
          email:  u.email ?? '',
          avatar: u.user_metadata?.avatar_url,
        })

        // Load stats + subscription in parallel
        const [{ count: w },{ count: s },{ count: a },{ count: su },{ count: pw }, subResult] = await Promise.all([
          supabase.from('workers').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          supabase.from('sites').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          supabase.from('attendance').select('id',{count:'exact',head:true}).eq('user_id', u.id),
          supabase.from('suppliers').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          supabase.from('private_workers').select('id',{count:'exact',head:true}).eq('user_id', u.id).is('deleted_at',null),
          // subscriptions table — safe to attempt even if table doesn't exist yet
          supabase.from('subscriptions').select('plan,status,trial_ends_at,current_period_end').eq('user_id', u.id).maybeSingle(),
        ])
        setStats({ workers:w??0, sites:s??0, attendance:a??0, suppliers:su??0, privateWorkers:pw??0 })

        // Map subscription row to local UI state
        const row = (subResult as { data?: { plan?: string; status?: string; trial_ends_at?: string; current_period_end?: string } | null }).data
        if (row) {
          setSub({
            plan: (row.plan as Plan) ?? 'free',
            trialEndsAt: row.trial_ends_at ?? null,
            renewsAt: row.current_period_end ?? null,
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const exportData = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    showToast(lang === 'te' ? 'రిపోర్ట్ తయారవుతోంది...' : 'Preparing report...')

    const [{ data: workers }, { data: sites }, { data: att }, { data: suppliers }, { data: goods }] = await Promise.all([
      supabase.from('workers').select('*').eq('user_id', u.id).is('deleted_at', null).order('name'),
      supabase.from('sites').select('*').eq('user_id', u.id).is('deleted_at', null).order('site_name'),
      supabase.from('attendance').select('*').eq('user_id', u.id).order('date', { ascending: false }),
      supabase.from('suppliers').select('*').eq('user_id', u.id).is('deleted_at', null).order('name'),
      supabase.from('goods_orders').select('*').eq('user_id', u.id).is('deleted_at', null).order('delivery_date', { ascending: false }),
    ])

    const date  = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    const name  = u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? 'User'

    // Total wages paid
    const totalWages = (att ?? []).reduce((sum: number, r: Record<string, number>) => sum + (r.wage ?? 0), 0)
    const totalAdvance = (att ?? []).reduce((sum: number, r: Record<string, number>) => sum + (r.advance ?? 0), 0)

    const workerRows = (workers ?? []).map((w: Record<string, string | number>) => `
      <tr>
        <td>${esc(w.name ?? '')}</td>
        <td>${esc(w.phone ?? '-')}</td>
        <td>${esc(w.role ?? '-')}</td>
        <td style="text-align:right">₹${esc(w.rate_6_6 ?? 0)}</td>
        <td style="text-align:center">${esc(w.worker_status ?? 'Active')}</td>
      </tr>`).join('')

    const siteRows = (sites ?? []).map((s: Record<string, string | number>) => `
      <tr>
        <td>${esc(s.site_name ?? '')}</td>
        <td>${esc(s.owner_name ?? '-')}</td>
        <td>${esc(s.location ?? '-')}</td>
        <td style="text-align:right">₹${Number(s.budget ?? 0).toLocaleString('en-IN')}</td>
        <td style="text-align:center">${esc(s.status ?? '-')}</td>
      </tr>`).join('')

    // Group attendance by month
    const attByMonth: Record<string, typeof att> = {}
    ;(att ?? []).forEach((r: Record<string, string>) => {
      const month = r.date?.slice(0, 7) ?? 'unknown'
      if (!attByMonth[month]) attByMonth[month] = []
      attByMonth[month].push(r)
    })
    const attSections = Object.entries(attByMonth).slice(0, 6).map(([month, rows]) => {
      const monthWages = (rows as Record<string, number>[]).reduce((s, r) => s + (r.wage ?? 0), 0)
      const monthAdv   = (rows as Record<string, number>[]).reduce((s, r) => s + (r.advance ?? 0), 0)
      const d = new Date(month + '-01')
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      return `
        <h3 style="margin:18px 0 8px;color:#92400e;font-size:14px">${label}</h3>
        <table>
          <thead><tr>
            <th>Date</th><th>Worker</th><th>Site</th><th>Shift</th>
            <th style="text-align:right">Wage</th><th style="text-align:right">Advance</th><th>Mode</th>
          </tr></thead>
          <tbody>
            ${(rows as Record<string, string | number>[]).map(r => `<tr>
              <td>${esc(r.date ?? '')}</td>
              <td>${esc(r.worker_name ?? '-')}</td>
              <td>${esc(r.site_name ?? '-')}</td>
              <td>${esc(r.shift ?? '-')}</td>
              <td style="text-align:right">₹${esc(r.wage ?? 0)}</td>
              <td style="text-align:right">₹${esc(r.advance ?? 0)}</td>
              <td>${esc(r.payment_mode ?? 'Cash')}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="4"><strong>Month Total</strong></td>
            <td style="text-align:right"><strong>₹${monthWages.toLocaleString('en-IN')}</strong></td>
            <td style="text-align:right"><strong>₹${monthAdv.toLocaleString('en-IN')}</strong></td>
            <td></td>
          </tr></tfoot>
        </table>`
    }).join('')

    const supplierRows = (suppliers ?? []).map((s: Record<string, string>) => `
      <tr>
        <td>${esc(s.name ?? '')}</td>
        <td>${esc(s.phone ?? '-')}</td>
        <td>${esc(s.shop_name ?? '-')}</td>
        <td>${esc(s.notes ?? '-')}</td>
      </tr>`).join('')

    const goodsRows = (goods ?? []).map((g: Record<string, string | number>) => `
      <tr>
        <td>${esc(g.delivery_date ?? '')}</td>
        <td>${esc(g.goods_name ?? '')}</td>
        <td>${esc(g.supplier_name ?? '-')}</td>
        <td>${esc(g.site_name ?? '-')}</td>
        <td style="text-align:right">${esc(g.quantity ?? 0)} ${esc(g.unit ?? '')}</td>
        <td style="text-align:right">₹${Number(g.total_price ?? 0).toLocaleString('en-IN')}</td>
        <td style="text-align:center">${esc(g.status ?? '-')}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Construction Manager Report — ${date}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1c1917; background: #fff; padding: 24px; }
  h1 { font-size: 22px; color: #92400e; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #78350f; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #fde68a; }
  h3 { font-size: 14px; color: #92400e; }
  .meta { color: #78716c; font-size: 12px; margin-bottom: 20px; }
  .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .stat { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 18px; min-width: 130px; }
  .stat-val { font-size: 22px; font-weight: 900; color: #d97706; }
  .stat-lbl { font-size: 11px; color: #92400e; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
  th { background: #fef3c7; color: #92400e; text-align: left; padding: 7px 10px; font-weight: 700; }
  td { padding: 6px 10px; border-bottom: 1px solid #f5f5f4; }
  tr:last-child td { border-bottom: none; }
  tfoot td { background: #fffbeb; font-weight: 700; }
  .empty { color: #a8a29e; font-style: italic; padding: 12px 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>🏗️ Construction Manager</h1>
<p class="meta">Report for <strong>${esc(name)}</strong> · Generated on ${date}</p>

<div class="summary">
  <div class="stat"><div class="stat-val">${(workers ?? []).length}</div><div class="stat-lbl">Workers</div></div>
  <div class="stat"><div class="stat-val">${(sites ?? []).length}</div><div class="stat-lbl">Sites</div></div>
  <div class="stat"><div class="stat-val">${(att ?? []).length}</div><div class="stat-lbl">Attendance Records</div></div>
  <div class="stat"><div class="stat-val">₹${totalWages.toLocaleString('en-IN')}</div><div class="stat-lbl">Total Wages Paid</div></div>
  <div class="stat"><div class="stat-val">₹${totalAdvance.toLocaleString('en-IN')}</div><div class="stat-lbl">Total Advance Given</div></div>
</div>

<h2>👷 Workers (${(workers ?? []).length})</h2>
${workerRows ? `<table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th style="text-align:right">Rate (6-6)</th><th style="text-align:center">Status</th></tr></thead><tbody>${workerRows}</tbody></table>` : '<p class="empty">No workers added yet.</p>'}

<h2>🏗️ Sites (${(sites ?? []).length})</h2>
${siteRows ? `<table><thead><tr><th>Site Name</th><th>Owner</th><th>Location</th><th style="text-align:right">Budget</th><th style="text-align:center">Status</th></tr></thead><tbody>${siteRows}</tbody></table>` : '<p class="empty">No sites added yet.</p>'}

<h2>📋 Attendance by Month</h2>
${attSections || '<p class="empty">No attendance records yet.</p>'}

<h2>🏪 Suppliers (${(suppliers ?? []).length})</h2>
${supplierRows ? `<table><thead><tr><th>Name</th><th>Phone</th><th>Shop</th><th>Notes</th></tr></thead><tbody>${supplierRows}</tbody></table>` : '<p class="empty">No suppliers added yet.</p>'}

<h2>📦 Goods Orders (${(goods ?? []).length})</h2>
${goodsRows ? `<table><thead><tr><th>Date</th><th>Goods</th><th>Supplier</th><th>Site</th><th style="text-align:right">Qty</th><th style="text-align:right">Total</th><th style="text-align:center">Status</th></tr></thead><tbody>${goodsRows}</tbody></table>` : '<p class="empty">No goods orders yet.</p>'}

<p style="margin-top:32px;font-size:11px;color:#a8a29e;text-align:center">
  Generated by Construction Manager App · ${date}
</p>
</body>
</html>`

    // Inject auto-print trigger + PDF-friendly styles
    const printHtml = html
      .replace('@media print { body { padding: 0; } }',
        '@page{margin:16mm} @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact} .stat{-webkit-print-color-adjust:exact;print-color-adjust:exact}}')
      .replace('</body>', '<script>window.onload=function(){window.print()}<\/script></body>')

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(printHtml)
    w.document.close()
    showToast(lang === 'te' ? 'PDF తెరవబడుతోంది...' : 'Opening PDF...')
  }

  // ── Subscription display helpers ──────────────────────────────────────────
  const planLabel = (p: Plan, expired = false) => {
    if (expired)          return lang==='te' ? 'ట్రయల్ ముగిసింది' : 'Trial Expired'
    if (p === 'lifetime') return lang==='te' ? 'లైఫ్‌టైమ్' : 'Lifetime Free'
    if (p === 'pro')      return lang==='te' ? 'ప్రో ప్లాన్' : 'Pro Plan'
    if (p === 'trial')    return lang==='te' ? 'ఉచిత ట్రయల్' : 'Free Trial'
    return lang==='te' ? 'ఫ్రీ ప్లాన్' : 'Free Plan'
  }
  const planColor = (p: Plan, expired = false): { bg: string; text: string; border: string } => {
    if (expired)          return { bg:'rgba(220,38,38,0.1)', text:'#dc2626', border:'rgba(220,38,38,0.25)' }
    if (p === 'lifetime') return { bg:'rgba(139,92,246,0.12)', text:'#7c3aed', border:'rgba(139,92,246,0.3)' }
    if (p === 'pro')      return { bg:'rgba(var(--accent),0.12)', text:'rgb(var(--accent))', border:'rgba(var(--accent),0.3)' }
    if (p === 'trial')    return { bg:'rgba(22,163,74,0.1)', text:'#15803d', border:'rgba(22,163,74,0.25)' }
    return { bg:'rgba(100,116,139,0.1)', text:'rgb(var(--muted))', border:'rgba(100,116,139,0.2)' }
  }
  const planIcon = (p: Plan, expired = false) => expired ? '⏰' : p === 'lifetime' ? '♾️' : p === 'pro' ? '⭐' : p === 'trial' ? '🎁' : '🏗️'

  // Raw difference can be negative (expired), 0 (ends today), or positive (days left)
  const trialRawDays = sub.trialEndsAt
    ? Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000)
    : null
  const isTrialExpired = sub.plan === 'trial' && trialRawDays !== null && trialRawDays < 0
  const trialDaysLeft  = trialRawDays !== null ? Math.max(0, trialRawDays) : null

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgb(var(--accent))',borderTopColor:'transparent'}}/>
    </div>
  )

  const pc = planColor(sub.plan, isTrialExpired)

  return (
    <div className="page px-4 pt-4 pb-24">

      {/* ── Profile Card ─────────────────────────────────────────────────────── */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-4">
          {/* Google avatar or initials fallback */}
          {user?.avatar ? (
            <img
              src={user.avatar.replace(/=s\d+-c$/, '=s128-c')}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
              onError={e => {
                const img = e.target as HTMLImageElement
                img.style.display = 'none'
                const fallback = img.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className="w-16 h-16 rounded-2xl items-center justify-center text-2xl font-black flex-shrink-0"
            style={{
              background: 'rgba(var(--accent),0.15)',
              color: 'rgb(var(--accent))',
              display: user?.avatar ? 'none' : 'flex',
            }}>
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-lg truncate" style={{color:'rgb(var(--text))'}}>{user?.name}</p>
            <p className="text-sm truncate mb-1" style={{color:'rgb(var(--muted))'}}>{user?.email}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold inline-block"
              style={{background: pc.bg, color: pc.text, border:`1px solid ${pc.border}`}}>
              {planIcon(sub.plan, isTrialExpired)} {planLabel(sub.plan, isTrialExpired)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Subscription Card ────────────────────────────────────────────────── */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {lang==='te'?'సబ్‌స్క్రిప్షన్':'Subscription'}
      </p>
      <div className="card mb-4 overflow-hidden" style={{border:`1px solid ${pc.border}`}}>
        {/* Plan row */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{background: pc.bg}}>
              {planIcon(sub.plan, isTrialExpired)}
            </div>
            <div>
              <p className="font-black text-sm" style={{color: pc.text}}>{planLabel(sub.plan, isTrialExpired)}</p>
              <p className="text-xs" style={{color:'rgb(var(--muted))'}}>
                {(sub.plan === 'free') && !sub.trialEndsAt && (lang==='te'?'అన్ని ఫీచర్లు అందుబాటులో ఉన్నాయి':'All features available')}
                {sub.plan === 'trial' && isTrialExpired && (lang==='te'?'యాక్సెస్ నిలిపివేయబడింది':'Access blocked')}
                {sub.plan === 'trial' && !isTrialExpired && trialDaysLeft !== null && trialDaysLeft > 0 && `${lang==='te'?'ట్రయల్:':'Trial:'} ${trialDaysLeft} ${lang==='te'?'రోజులు మిగిలాయి':'days left'}`}
                {sub.plan === 'trial' && !isTrialExpired && trialDaysLeft === 0 && (lang==='te'?'నేడు ముగుస్తుంది!':'Ends today!')}
                {sub.plan === 'lifetime' && (lang==='te'?'ఎప్పటికీ ఉచితం':'Free forever · No billing')}
                {sub.plan === 'pro' && sub.renewsAt && `${lang==='te'?'తదుపరి చెల్లింపు':'Renews'} ${new Date(sub.renewsAt).toLocaleDateString()}`}
                {sub.plan === 'pro' && !sub.renewsAt && (lang==='te'?'యాక్టివ్':'Active')}
              </p>
            </div>
          </div>
          {/* Upgrade CTA — shown on free/trial plans */}
          {(sub.plan === 'free' || sub.plan === 'trial') && (
            <button
              onClick={() => router.push('/subscribe')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition"
              style={{background: isTrialExpired ? '#dc2626' : 'rgb(var(--accent))', color:'#fff'}}>
              {isTrialExpired
                ? (lang==='te'?'⭐ సభ్యత్వం పొందండి':'⭐ Subscribe')
                : (lang==='te'?'⭐ అప్‌గ్రేడ్':'⭐ Upgrade')}
            </button>
          )}
        </div>

        {/* Trial banner */}
        {sub.trialEndsAt && trialDaysLeft !== null && (
          <div
            className="mx-4 mb-4 px-4 py-3 rounded-xl"
            style={{background: (isTrialExpired || trialDaysLeft <= 3) ? 'rgba(220,38,38,0.08)' : 'rgba(var(--accent),0.08)', border:`1px solid ${(isTrialExpired || trialDaysLeft <= 3) ? 'rgba(220,38,38,0.25)' : 'rgba(var(--accent),0.2)'}`}}>
            <p className="text-sm font-bold" style={{color: (isTrialExpired || trialDaysLeft <= 3) ? '#dc2626' : 'rgb(var(--accent))'}}>
              {isTrialExpired
                ? (lang==='te'?'⏰ ట్రయల్ ముగిసింది':'⏰ Trial has expired')
                : trialDaysLeft === 0
                  ? (lang==='te'?'ట్రయల్ నేడు ముగుస్తుంది!':'Trial ends today!')
                  : `${lang==='te'?'ట్రయల్ ముగుస్తుంది':'Trial ends in'} ${trialDaysLeft} ${lang==='te'?'రోజులలో':'days'}`}
            </p>
            <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>
              {isTrialExpired
                ? (lang==='te'?'కొనసాగించడానికి సభ్యత్వం పొందండి':'Subscribe to restore full access')
                : (lang==='te'?'అన్ని ఫీచర్లు ఉపయోగించవచ్చు':'Full access during trial')}
            </p>
          </div>
        )}

        {/* Pricing info row */}
        {(sub.plan === 'free' || sub.plan === 'trial') && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{borderColor:'rgb(var(--border))'}}>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>
              {lang==='te'?'ప్రో ప్లాన్ ధర':'Pro plan pricing'}
            </p>
            <p className="text-sm font-black" style={{color:'rgb(var(--text))'}}>
              ₹200<span className="text-xs font-medium" style={{color:'rgb(var(--muted))'}}>/{lang==='te'?'నెల':'month'}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Usage Stats ──────────────────────────────────────────────────────── */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {lang==='te'?'మీ డేటా':'Your Data'}
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { emoji:'👷', label:lang==='te'?'కార్మికులు':'Workers',        val:stats.workers },
          { emoji:'🏗️', label:lang==='te'?'సైట్లు':'Sites',              val:stats.sites },
          { emoji:'📋', label:lang==='te'?'హాజరు':'Attendance',           val:stats.attendance },
          { emoji:'🏪', label:lang==='te'?'సరఫరాదారులు':'Suppliers',      val:stats.suppliers },
          { emoji:'🔧', label:lang==='te'?'కాంట్రాక్టర్లు':'Contractors', val:stats.privateWorkers },
          { emoji:'📊', label:lang==='te'?'మొత్తం':'Total',              val:stats.workers+stats.sites+stats.attendance+stats.suppliers+stats.privateWorkers },
        ].map(({ emoji, label, val }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-xl">{emoji}</p>
            <p className="font-black text-lg" style={{color:'rgb(var(--accent))'}}>{val}</p>
            <p className="text-[10px]" style={{color:'rgb(var(--muted))'}}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Settings ─────────────────────────────────────────────────────────── */}
      <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:'rgb(var(--muted))'}}>
        {ts(lang,'settings')}
      </p>
      <div className="card mb-4 overflow-hidden">
        {/* Theme */}
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b transition hover:opacity-80"
          style={{borderColor:'rgb(var(--border))'}}>
          <span className="text-xl">{theme==='dark'?'☀️':'🌙'}</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{color:'rgb(var(--text))'}}>{theme==='dark'?ts(lang,'lightMode'):ts(lang,'darkMode')}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'ప్రస్తుతం:':'Currently:'} {theme==='dark'?(lang==='te'?'డార్క్':'Dark'):(lang==='te'?'లైట్':'Light')}</p>
          </div>
          <span style={{color:'rgb(var(--muted))'}}>›</span>
        </button>

        {/* Language */}
        <button onClick={toggleLang}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b transition hover:opacity-80"
          style={{borderColor:'rgb(var(--border))'}}>
          <span className="text-xl">🌐</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{color:'rgb(var(--text))'}}>{ts(lang,'language')}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='en'?'English → తెలుగు':'తెలుగు → English'}</p>
          </div>
          <span style={{color:'rgb(var(--muted))'}}>›</span>
        </button>

        {/* Export / Backup */}
        <button onClick={exportData}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b transition hover:opacity-80"
          style={{borderColor:'rgb(var(--border))'}}>
          <span className="text-xl">💾</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{color:'rgb(var(--text))'}}>{lang==='te'?'రిపోర్ట్ డౌన్‌లోడ్':'Download Report'}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'కార్మికులు, హాజరు, సైట్లు — PDF':'Workers, attendance, sites — saves as PDF'}</p>
          </div>
          <span style={{color:'rgb(var(--muted))'}}>›</span>
        </button>

        {/* Help & Support */}
        <button onClick={() => router.push('/support')}
          className="w-full flex items-center gap-3 px-4 py-3.5 transition hover:opacity-80">
          <span className="text-xl">🆘</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{color:'rgb(var(--text))'}}>{lang==='te'?'సహాయం & మద్దతు':'Help & Support'}</p>
            <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'సమస్యను నివేదించండి':'Report an issue or ask a question'}</p>
          </div>
          <span style={{color:'rgb(var(--muted))'}}>›</span>
        </button>
      </div>

      {/* ── Sign Out ─────────────────────────────────────────────────────────── */}
      <button onClick={() => setShowSignOut(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition"
        style={{background:'rgba(185,28,28,0.1)',color:'#b91c1c',border:'1px solid rgba(185,28,28,0.2)'}}>
        🚪 {ts(lang,'signOut')}
      </button>

      {/* Sign out confirm */}
      {showSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{background:'rgba(0,0,0,0.6)'}}>
          <div className="card p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-3">🚪</p>
            <p className="font-black text-lg mb-2" style={{color:'rgb(var(--text))'}}>{lang==='te'?'లాగ్అవుట్ అవుతారా?':'Sign out?'}</p>
            <p className="text-sm mb-5" style={{color:'rgb(var(--muted))'}}>{lang==='te'?'మీ డేటా సురక్షితంగా ఉంటుంది.':'Your data stays safe.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowSignOut(false)} className="btn-ghost py-3">{ts(lang,'cancel')}</button>
              <button onClick={signOut} className="py-3 rounded-xl font-bold text-white" style={{background:'#b91c1c'}}>{ts(lang,'signOut')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Profile() { return <ProfilePage /> }
