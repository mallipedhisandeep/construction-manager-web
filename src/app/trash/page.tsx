'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { tss } from '@/lib/strings'

interface TrashItem {
  id: string; table: string; label: string; subtitle: string; deleted_at: string
}

function TrashPage() {
  const { lang } = useLang()
  const [items,   setItems]   = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<{msg:string;ok:boolean} | undefined>()
  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined),3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const results: TrashItem[] = []

    const tables = [
      { name:'workers',         labelField:'name',      subtitleField:'work_type', display:'Worker' },
      { name:'sites',           labelField:'site_name', subtitleField:'status',    display:'Site' },
      { name:'suppliers',       labelField:'name',      subtitleField:'shop_name', display:'Supplier' },
      { name:'private_workers', labelField:'name',      subtitleField:'work_type', display:'Contractor' },
    ]

    for (const t of tables) {
      const { data, error } = await supabase
        .from(t.name)
        .select('*')
        .not('deleted_at','is',null)
        .order('deleted_at', { ascending: false })

      if (!error && data) {
        data.forEach((row: Record<string,unknown>) => {
          results.push({
            id: row.id as string,
            table: t.name,
            label: `${t.display}: ${row[t.labelField]}`,
            subtitle: (row[t.subtitleField] ?? '') as string,
            deleted_at: row.deleted_at as string,
          })
        })
      }
    }

    results.sort((a,b) => b.deleted_at.localeCompare(a.deleted_at))
    setItems(results)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const restore = async (item: TrashItem) => {
    const { error } = await supabase.from(item.table).update({ deleted_at: null }).eq('id', item.id)
    if (error) showToast(error.message, false)
    else { showToast(tss(lang,'restore') + '!'); load() }
  }

  const deletePermanent = async (item: TrashItem) => {
    if (!confirm('Permanently delete? This cannot be undone.')) return
    const { error } = await supabase.from(item.table).delete().eq('id', item.id)
    if (error) showToast(error.message, false)
    else { showToast('Permanently deleted'); load() }
  }

  const emptyTrash = async () => {
    if (!confirm('Empty entire recycle bin? All items will be permanently deleted.')) return
    for (const item of items) {
      await supabase.from(item.table).delete().eq('id', item.id)
    }
    showToast('Recycle bin emptied'); load()
  }

  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

  return (
    <div className="page">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>🗑️ {tss(lang,'trash')}</h1>
            <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>{tss(lang,'trashNote')}</p>
          </div>
          {items.length > 0 && (
            <button onClick={emptyTrash} className="btn-danger btn-sm">Empty All</button>
          )}
        </div>
      </div>
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"/></div>
        ) : items.length === 0 ? (
          // FIX: removed duplicate RecycleBinHelp call — was rendered twice (once here, once below)
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4 opacity-20">🗑️</div>
            <p className="font-bold" style={{color:'rgb(var(--muted))'}}>{tss(lang,'noTrash')}</p>
            <p className="text-sm mt-1" style={{color:'rgb(var(--muted))'}}>Deleted workers, sites, suppliers and contractors will appear here</p>
          </div>
        ) : items.map(item => (
          <div key={`${item.table}-${item.id}`} className="card mb-3 p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{color:'rgb(var(--text))'}}>{item.label}</p>
              {item.subtitle && <p className="text-xs truncate" style={{color:'rgb(var(--muted))'}}>{item.subtitle}</p>}
              <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>{daysSince(item.deleted_at)} days ago</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={()=>restore(item)} className="btn-ghost btn-sm text-green-600 dark:text-green-400">
                ↩ {tss(lang,'restore')}
              </button>
              <button onClick={()=>deletePermanent(item)} className="btn-danger btn-sm">
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
