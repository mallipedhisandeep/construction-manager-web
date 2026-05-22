'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Site } from '@/lib/types'

type FileRow = { id: string; file_name: string; file_path: string; created_at?: string }
type SiteDetail = Site & { id: string }

function SitesPage() {
  const { lang }   = useLang()
  const [sites,    setSites]    = useState<SiteDetail[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'All'|'Active'|'Completed'>('All')
  const [modal,    setModal]    = useState<'add'|'edit'|'detail'|null>(null)
  const [selected, setSelected] = useState<SiteDetail|null>(null)
  const [form,     setForm]     = useState<Partial<Site>>({ status:'Active', floors_count:1, budget:0 })
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState('')
  // File states
  const [agreements,  setAgreements]  = useState<FileRow[]>([])
  const [floorFiles,  setFloorFiles]  = useState<FileRow[]>([])
  const [elevations,  setElevations]  = useState<FileRow[]>([])
  const [uploading,   setUploading]   = useState<string|null>(null)
  const [activeTab,   setActiveTab]   = useState<'info'|'docs'>('info')
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{type:'agreement'|'floor'|'elevation'; floor?:number}|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sites').select('*').order('site_name')
    setSites((data ?? []) as SiteDetail[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''), 3000) }

  const loadFiles = useCallback(async (siteId: string) => {
    const [{ data: ag }, { data: ff }, { data: el }] = await Promise.all([
      supabase.from('site_agreements').select('*').eq('site_id', siteId).order('created_at', {ascending:false}),
      supabase.from('site_floor_files').select('*').eq('site_id', siteId).order('floor_no'),
      supabase.from('site_elevations').select('*').eq('site_id', siteId).order('created_at', {ascending:false}),
    ])
    setAgreements(ag ?? [])
    setFloorFiles(ff ?? [])
    setElevations(el ?? [])
  }, [])

  const openDetail = (s: SiteDetail) => {
    setSelected(s); setActiveTab('info')
    loadFiles(s.id); setModal('detail')
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload || !selected) return
    setUploading(pendingUpload.type)
    try {
      const path = `${pendingUpload.type}/${selected.id}/${Date.now()}_${file.name}`
      const { data: up, error } = await supabase.storage.from('construction-files').upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from('construction-files').getPublicUrl(up.path)
      const url = urlData.publicUrl
      if (pendingUpload.type === 'agreement')
        await supabase.from('site_agreements').insert({ site_id: selected.id, file_path: url, file_name: file.name })
      else if (pendingUpload.type === 'floor')
        await supabase.from('site_floor_files').insert({ site_id: selected.id, floor_no: pendingUpload.floor ?? 0, file_name: file.name, file_path: url })
      else
        await supabase.from('site_elevations').insert({ site_id: selected.id, file_name: file.name, file_path: url })
      await loadFiles(selected.id)
      showToast('File uploaded!')
    } catch (err: unknown) {
      showToast(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setUploading(null); setPendingUpload(null) }
    e.target.value = ''
  }

  const triggerUpload = (type: 'agreement'|'floor'|'elevation', floor?: number) => {
    setPendingUpload({ type, floor }); fileRef.current?.click()
  }

  const deleteFile = async (table: string, id: string, path: string) => {
    if (!confirm('Delete this file?')) return
    const key = path.split('/construction-files/')[1]
    if (key) await supabase.storage.from('construction-files').remove([key])
    await supabase.from(table).delete().eq('id', id)
    if (selected) await loadFiles(selected.id)
  }

  const save = async () => {
    if (!form.site_name?.trim()) return
    setSaving(true)
    const data = { ...form, site_name_search: form.site_name!.toLowerCase() }
    if (modal==='add') { await supabase.from('sites').insert(data); showToast(ts(lang,'siteAdded')) }
    else if (selected) { await supabase.from('sites').update(data).eq('id', selected.id); showToast(ts(lang,'siteUpdated')) }
    setSaving(false); setModal(null); load()
  }

  const del = async (s: SiteDetail) => {
    if (!confirm(ts(lang,'deleteConfirm'))) return
    await supabase.from('sites').delete().eq('id', s.id)
    setModal(null); load()
  }

  const filtered = filter === 'All' ? sites : sites.filter(s => s.status === filter)
  const counts = { All: sites.length, Active: sites.filter(s=>s.status==='Active').length, Completed: sites.filter(s=>s.status==='Completed').length }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <div className="fixed top-16 right-4 z-50 bg-green-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg">{toast}</div>}
      {/* Hidden file input for FIX 3 */}
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelected}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      <div className="bg-white border-b border-gray-100 px-4 pt-5 pb-4 sticky top-14 z-30">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black text-gray-800">{ts(lang,'sites')}</h1>
          <button onClick={() => { setForm({status:'Active',floors_count:1,budget:0}); setModal('add') }} className="btn-primary text-sm">
            + {ts(lang,'addSite')}
          </button>
        </div>
        <div className="flex gap-2">
          {(['All','Active','Completed'] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              className={`chip ${filter===f?'chip-active':'chip-idle'}`}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" /></div> :
         filtered.length === 0 ? <div className="text-center py-16"><div className="text-5xl mb-3 opacity-30">🏗️</div><p className="text-gray-400 font-medium">{ts(lang,'noSites')}</p></div> :
         filtered.map(s => (
          <div key={s.id} className="card mb-3 overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={()=>openDetail(s)}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${s.status==='Active'?'bg-green-50':'bg-blue-50'}`}>🏗️</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-800">{s.site_name}</h3>
                    <span className={s.status==='Active'?'badge-green':'badge-blue'}>{s.status}</span>
                  </div>
                  {s.location && <p className="text-sm text-gray-500 mt-0.5 truncate">📍 {s.location}</p>}
                </div>
                <span className="text-gray-300 text-lg flex-shrink-0">›</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-500">
                {s.owner_name && <span>👤 {s.owner_name}</span>}
                <span>🏢 {s.floors_count} floors</span>
                <span>💰 ₹{(s.budget/100000).toFixed(1)}L</span>
                {s.start_date && <span>📅 {s.start_date}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add/Edit Modal ─────────────────── */}
      {(modal==='add'||modal==='edit') && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg">{modal==='add'?ts(lang,'addSite'):'Edit Site'}</h2>
              <button onClick={()=>setModal(null)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <FI label={ts(lang,'siteName')}  value={form.site_name??''}   onChange={v=>setForm({...form,site_name:v})}   required />
              <FI label={ts(lang,'location')}  value={form.location??''}    onChange={v=>setForm({...form,location:v})} />
              <div className="grid grid-cols-2 gap-3">
                <FI label={ts(lang,'budget')}  value={form.budget?.toString()??''} type="number" onChange={v=>setForm({...form,budget:+v})} />
                <FI label={ts(lang,'floors')}  value={form.floors_count?.toString()??''} type="number" onChange={v=>setForm({...form,floors_count:+v})} />
              </div>
              <FI label={ts(lang,'ownerName')} value={form.owner_name??''}  onChange={v=>setForm({...form,owner_name:v})} />
              <FI label={ts(lang,'ownerPhone')} value={form.owner_phone??''} type="tel" maxLen={10} onChange={v=>setForm({...form,owner_phone:v.replace(/\D/g,'').slice(0,10)})} />
              <FI label={ts(lang,'startDate')} value={form.start_date??''} type="date" onChange={v=>setForm({...form,start_date:v})} />
              <div>
                <label className="label">{ts(lang,'status')}</label>
                <div className="flex gap-2">
                  {['Active','Completed'].map(st => (
                    <button key={st} onClick={()=>setForm({...form,status:st})}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${form.status===st?st==='Active'?'bg-green-600 text-white border-green-600':'bg-blue-600 text-white border-blue-600':'bg-white border-gray-200 text-gray-500'}`}>
                      {st==='Active'?ts(lang,'active'):ts(lang,'completed')}
                    </button>
                  ))}
                </div>
              </div>
              <FI label={ts(lang,'notes')} value={form.notes??''} onChange={v=>setForm({...form,notes:v})} multiline />
              <button onClick={save} disabled={saving} className="btn-primary w-full py-3">
                {saving?'⏳ Saving...':ts(lang,'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Site Detail Modal (FIX 3) ──────── */}
      {modal==='detail' && selected && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box md:max-w-2xl" onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <div>
                <h2 className="font-black text-lg">{selected.site_name}</h2>
                <p className="text-sm text-gray-400">{selected.location}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{ setForm({...selected}); setModal('edit') }} className="btn-ghost text-sm py-1.5 px-3">✏️ Edit</button>
                <button onClick={()=>setModal(null)} className="text-gray-400 text-2xl leading-none">✕</button>
              </div>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {([['info','📋 Info'],['docs','📁 Documents']] as const).map(([t,l]) => (
                <button key={t} onClick={()=>setActiveTab(t)}
                  className={`flex-1 py-3 text-sm font-semibold transition ${activeTab===t?'text-orange-600 border-b-2 border-orange-500':'text-gray-400'}`}>
                  {l}
                </button>
              ))}
            </div>

            {activeTab==='info' ? (
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [ts(lang,'status'),selected.status],[ts(lang,'floors'),`${selected.floors_count}`],
                    [ts(lang,'budget'),`₹${(selected.budget/100000).toFixed(2)}L`],[ts(lang,'startDate'),selected.start_date??'—'],
                    [ts(lang,'ownerName'),selected.owner_name??'—'],[ts(lang,'ownerPhone'),selected.owner_phone??'—'],
                  ].map(([l,v]) => (
                    <div key={l} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{l}</p>
                      <p className="font-bold text-gray-800 mt-0.5 text-sm">{v}</p>
                    </div>
                  ))}
                </div>
                {selected.notes && <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{selected.notes}</div>}
                <button onClick={()=>del(selected)} className="btn-danger w-full py-3">🗑️ Delete Site</button>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Agreements */}
                <FileSection title="📄 Agreements" files={agreements} uploading={uploading==='agreement'}
                  onUpload={()=>triggerUpload('agreement')}
                  onDelete={(f)=>deleteFile('site_agreements',f.id,f.file_path)} />
                {/* Floor Plans */}
                <div>
                  <p className="section-title">🗺️ Floor Plans</p>
                  {Array.from({length: selected.floors_count}, (_,i) => {
                    const flFiles = floorFiles.filter(f=>(f as FileRow & {floor_no:number}).floor_no === i)
                    return (
                      <div key={i} className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">{i===0?'Ground Floor':`Floor ${i}`}</p>
                        {flFiles.map(f => (
                          <FileItem key={f.id} f={f} onDelete={()=>deleteFile('site_floor_files',f.id,f.file_path)} />
                        ))}
                        <button onClick={()=>triggerUpload('floor',i)} disabled={!!uploading}
                          className="text-xs text-orange-600 font-semibold hover:underline disabled:opacity-50">
                          {uploading==='floor'?'Uploading...':'+ Upload file'}
                        </button>
                      </div>
                    )
                  })}
                </div>
                {/* Elevations */}
                <FileSection title="🖼️ Elevations" files={elevations} uploading={uploading==='elevation'}
                  onUpload={()=>triggerUpload('elevation')}
                  onDelete={(f)=>deleteFile('site_elevations',f.id,f.file_path)} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FileSection({ title,files,uploading,onUpload,onDelete }:
  { title:string; files:FileRow[]; uploading:boolean; onUpload:()=>void; onDelete:(f:FileRow)=>void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="section-title m-0">{title}</p>
        <button onClick={onUpload} disabled={uploading}
          className="text-xs btn bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-1.5 disabled:opacity-50">
          {uploading?'⏳ Uploading...':'+ Upload'}
        </button>
      </div>
      {files.length===0 && <p className="text-xs text-gray-400 italic py-2">No files uploaded yet</p>}
      {files.map(f => <FileItem key={f.id} f={f} onDelete={()=>onDelete(f)} />)}
    </div>
  )
}

function FileItem({ f, onDelete }: { f:FileRow; onDelete:()=>void }) {
  const ext = f.file_name.split('.').pop()?.toLowerCase()
  const icon = ['jpg','jpeg','png'].includes(ext??'') ? '🖼️' : ext==='pdf' ? '📄' : '📎'
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-1.5">
      <span className="text-base">{icon}</span>
      <a href={f.file_path} target="_blank" rel="noreferrer"
        className="flex-1 text-sm text-blue-600 hover:underline font-medium truncate">{f.file_name}</a>
      <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">🗑️</button>
    </div>
  )
}

const FI = ({ label,value,onChange,type='text',required=false,maxLen,multiline }:
  { label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean;maxLen?:number;multiline?:boolean }) => (
  <div>
    <label className="label">{label}{required&&<span className="text-red-400 ml-1">*</span>}</label>
    {multiline
      ? <textarea rows={2} value={value} onChange={e=>onChange(e.target.value)} className="input resize-none" />
      : <input type={type} value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLen} className="input" />}
  </div>
)

export default function Sites() { return <AppShell><SitesPage /></AppShell> }
