'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang, useToast } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { ts } from '@/lib/strings'

interface TrashItem {
  id: string; table: string; label: string; subtitle: string; deleted_at: string; filePath?: string
}

const FILE_TABLES = new Set(['site_agreements', 'site_floor_files', 'site_elevations'])
const BUCKET = 'construction-files'

function storageKeyFromPath(filePath: string): string {
  if (!filePath.startsWith('http')) return filePath
  const marker = `/${BUCKET}/`
  const idx = filePath.indexOf(marker)
  return idx >= 0 ? filePath.slice(idx + marker.length) : filePath
}


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
  { name:'private_worker_payments', labelField:'notes', subtitleField:'amount',        display:'Contractor Payment' },
  { name:'supplier_goods',   labelField:'goods_name',   subtitleField:'price_per_unit',display:'Supplier Catalog Item' },
  // Site files — soft-deleted, can be restored from here
  { name:'site_agreements',  labelField:'file_name',    subtitleField:'file_name',     display:'Site Agreement' },
  { name:'site_floor_files', labelField:'file_name',    subtitleField:'floor_no',      display:'Floor Plan' },
  { name:'site_elevations',  labelField:'file_name',    subtitleField:'file_name',     display:'Elevation' },
] as const

function TrashPage() {
  const { lang } = useLang()
  const [items,    setItems]    = useState<TrashItem[]>([])
  const [loading,  setLoading]  = useState(true)
  
  const [actioning,  setActioning]  = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<TrashItem | 'all' | null>(null)

  const { showToast: _showToast } = useToast()
  const showToast = (msg: string, ok = true) => _showToast(msg, ok ? 'ok' : 'err')

  const load = useCallback(async () => {
    setLoading(true)
    
    const userId = await uid()

    
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
          filePath:   FILE_TABLES.has(t.name) ? (row.file_path as string | undefined) : undefined,
        })
      })
    }

    results.sort((a,b) => b.deleted_at.localeCompare(a.deleted_at))
    setItems(results)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const restore = async (item: TrashItem) => {
   
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
    setActioning(item.id)
    if (item.filePath) {
      const key = storageKeyFromPath(item.filePath)
      if (key) await supabase.storage.from(BUCKET).remove([key])
    }
    const { error } = await supabase.from(item.table).delete().eq('id', item.id)
    setActioning(null)
    setConfirmItem(null)
    if (error) showToast(error.message, false)
    else { showToast(lang==='te'?'శాశ్వతంగా తొలగించారు':'Permanently deleted'); load() }
  }

  const emptyTrash = async () => {
    setActioning('all')
    const filePaths = items.filter(i => i.filePath).map(i => storageKeyFromPath(i.filePath!))
    if (filePaths.length > 0) await supabase.storage.from(BUCKET).remove(filePaths)
    await Promise.all(items.map(item => supabase.from(item.table).delete().eq('id', item.id)))
    setActioning(null)
    setConfirmItem(null)
    showToast(lang==='te'?'రీసైకిల్ బిన్ ఖాళీ చేశారు':'Recycle bin emptied'); load()
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
              onClick={() => setConfirmItem('all')}
              disabled={actioning !== null}
              className="btn-danger btn-sm disabled:opacity-50">
              {actioning === 'all' ? '⏳ Deleting...' : (lang==='te'?'అన్నీ తొలగించు':'Empty All')}
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
              
              <button
                onClick={() => restore(item)}
                disabled={actioning !== null}
                className="btn-ghost btn-sm text-green-500 disabled:opacity-50">
                {actioning === item.id ? '⏳' : `↩ ${ts(lang,'restore')}`}
              </button>
              <button
                onClick={() => setConfirmItem(item)}
                disabled={actioning !== null}
                className="btn-danger btn-sm disabled:opacity-50">
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Permanent delete confirm modal ── */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{background:'rgba(0,0,0,0.7)'}}>
          <div className="card p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-black text-lg mb-2" style={{color:'rgb(var(--text))'}}>
              {lang==='te'?'శాశ్వతంగా తొలగించాలా?':'Delete permanently?'}
            </p>
            <p className="text-sm mb-5" style={{color:'rgb(var(--muted))'}}>
              {confirmItem === 'all'
                ? (lang==='te'?`అన్ని ${items.length} అంశాలు శాశ్వతంగా తొలగించబడతాయి.`:`All ${items.length} items will be deleted forever.`)
                : (lang==='te'?`"${(confirmItem as TrashItem).label}" శాశ్వతంగా తొలగించబడుతుంది. ఇది చేయగలిగే పని కాదు.`:`"${(confirmItem as TrashItem).label}" will be deleted forever. This cannot be undone.`)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmItem(null)} className="btn-ghost py-3">
                {lang==='te'?'రద్దు చేయి':'Cancel'}
              </button>
              <button
                onClick={() => confirmItem === 'all' ? emptyTrash() : deletePermanent(confirmItem as TrashItem)}
                disabled={actioning !== null}
                className="py-3 rounded-xl font-bold text-white disabled:opacity-50"
                style={{background:'#b91c1c'}}>
                {actioning ? '⏳' : (lang==='te'?'తొలగించు':'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Trash() { return <TrashPage /> }
