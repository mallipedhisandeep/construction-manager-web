'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts } from '@/lib/strings'

interface TrashItem {
  id: string; table: string; label: string; subtitle: string; deleted_at: string
}

// DB-3/DB-4 fix: only query tables that actually have a deleted_at column.
// site_payments and payment tables are excluded because they lacked deleted_at
// in the original schema. They are now added via migration (supabase_new_tables.sql).
// Tables with soft-delete support:
const TRASH_TABLES = [
  { name:'workers',          labelField:'name',         subtitleField:'work_type',    display:'Worker' },
  { name:'sites',            labelField:'site_name',    subtitleField:'status',        display:'Site' },
  { name:'suppliers',        labelField:'name',         subtitleField:'shop_name',     display:'Supplier' },
  { name:'private_workers',  labelField:'name',         subtitleField:'work_type',     display:'Contractor' },
  { name:'goods_orders',     labelField:'goods_name',   subtitleField:'supplier_name', display:'Goods Order' },
  { name:'private_work',     labelField:'worker_name',  subtitleField:'site_name',     display:'Contract Work' },
  // Payment tables included only if the migration has been run (deleted_at column added)
  { name:'site_payments',    labelField:'description',  subtitleField:'amount',        display:'Site Payment' },
  { name:'supplier_payments',labelField:'payment_type', subtitleField:'amount',        display:'Supplier Payment' },
] as const

function TrashPage() {
  const { lang } = useLang()
  const [items,    setItems]    = useState<TrashItem[]>([])
  const [loading,  setLoading]  = useState(true)
  // UX-5 fix: track in-flight action item so we can disable buttons
  const [actioning, setActioning] = useState<string | null>(null)

  const { showToast: _showToast } = useToast()
  const showToast = (msg: string, ok = true) => _showToast(msg, ok ? 'ok' : 'err')

  const load = useCallback(async () => {
    setLoading(true)
    // DATA-7 fix: filter all queries by user_id
    const userId = await uid()

    // PERF-1 fix: fire all queries in parallel with Promise.all instead of sequential for...of
    // DB-3/DB-4 fix: silently skip tables that return a PostgREST error for missing deleted_at
    const allResults = await Promise.all(
      TRASH_TABLES.map(t =>
        supabase.from(t.name).select('*')
          .eq('user_id', userId)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .then(({ data, error }) => ({ t, data, error }))
      )
    )

    const results: TrashItem[] = []
    for (const { t, data, error } of allResults) {
      // Skip tables where the column doesn't exist yet (PostgREST returns an error)
      if (error || !data) continue
      data.forEach((row: Record<string,unknown>) => {
        results.push({
          id:         row.id as string,
          table:      t.name,
          label:      `${t.display}: ${row[t.labelField]}`,
          subtitle:   String(row[t.subtitleField] ?? ''),
          deleted_at: row.deleted_at as string,
        })
      })
    }

    results.sort((a,b) => b.deleted_at.localeCompare(a.deleted_at))
    setItems(results)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const restore = async (item: TrashItem) => {
    // UX-5 fix: disable button during action
    setActioning(item.id)
    const { error } = await supabase
      .from(item.table)
      .update({ deleted_at: null })
      .eq('id', item.id)
    setActioning(null)
    if (error) showToast(error.message, false)
    else { showToast(ts(lang,'restore') + '!'); load() }
  }

  const deletePermanent = async (item: TrashItem) => {
    if (!confirm('Permanently delete? This cannot be undone.')) return
    setActioning(item.id)
    const { error } = await supabase.from(item.table).delete().eq('id', item.id)
    setActioning(null)
    if (error) showToast(error.message, false)
    else { showToast('Permanently deleted'); load() }
  }

  const emptyTrash = async () => {
    if (!confirm('Empty entire recycle bin? All items will be permanently deleted.')) return
    setActioning('all')
    await Promise.all(items.map(item => supabase.from(item.table).delete().eq('id', item.id)))
    setActioning(null)
    showToast('Recycle bin emptied'); load()
  }

  const daysSince = (d:string) =>
    Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

  const icon = (table:string) => (({
    workers:'👷', sites:'🏗️', suppliers:'🏪',
    private_workers:'🔧', goods_orders:'📦',
    private_work:'🔨', site_payments:'💰', supplier_payments:'🧾',
  } as Record<string,string>)[table] ?? '🗑️')

  return (
    <div className="page">

      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>
              🗑️ {ts(lang,'trash')}
            </h1>
            <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>
              {ts(lang,'trashNote')}
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={emptyTrash}
              disabled={actioning !== null}
              className="btn-danger btn-sm disabled:opacity-50">
              {actioning === 'all' ? '⏳ Deleting...' : 'Empty All'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"/>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4 opacity-20">🗑️</div>
            <p className="font-bold" style={{color:'rgb(var(--muted))'}}>
              {ts(lang,'noTrash')}
            </p>
            <p className="text-sm mt-1" style={{color:'rgb(var(--muted))'}}>
              Deleted workers, sites, suppliers, contractors and goods orders appear here
            </p>
          </div>
        ) : items.map(item => (
          <div key={`${item.table}-${item.id}`} className="card mb-3 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{background:'rgb(var(--surface2))'}}>
              {icon(item.table)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{color:'rgb(var(--text))'}}>
                {item.label}
              </p>
              {item.subtitle && (
                <p className="text-xs truncate" style={{color:'rgb(var(--muted))'}}>
                  {item.subtitle}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>
                {daysSince(item.deleted_at)} days ago
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {/* UX-5 fix: disabled state during async action */}
              <button
                onClick={() => restore(item)}
                disabled={actioning !== null}
                className="btn-ghost btn-sm text-green-500 disabled:opacity-50">
                {actioning === item.id ? '⏳' : `↩ ${ts(lang,'restore')}`}
              </button>
              <button
                onClick={() => deletePermanent(item)}
                disabled={actioning !== null}
                className="btn-danger btn-sm disabled:opacity-50">
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Trash() { return <AppShell><TrashPage /></AppShell> }
