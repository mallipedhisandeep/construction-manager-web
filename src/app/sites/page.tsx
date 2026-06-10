'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/auth'
import { tss } from '@/lib/strings'
import type { Site } from '@/lib/types'

// FileRow now stores the storage object path (for signing) + a runtime signedUrl
type FileRow     = { id:string; file_name:string; file_path:string; floor_no?:number; signedUrl?:string }
type SiteDetail  = Site & { id:string }
type SitePay     = { id:string; amount:number; description:string; mode:string; payment_date:string }
type ModalType   = 'add'|'edit'|'detail'|null
type TabType     = 'info'|'docs'|'payments'

// ── Storage helpers ───────────────────────────────────────────────────────────
const BUCKET = 'construction-files'

// Extract the storage object key from a stored path value.
// Handles both old public URLs and new raw storage paths.
function storageKey(filePath: string): string {
  // New format: raw path like "userId/agreement/siteId/timestamp_name.pdf"
  if (!filePath.startsWith('http')) return filePath
  // Old format: full public URL — extract everything after "/construction-files/"
  const marker = `/${BUCKET}/`
  const idx = filePath.indexOf(marker)
  return idx >= 0 ? filePath.slice(idx + marker.length) : filePath
}

// FIX P7: batch sign all URLs in one API call instead of N individual calls
// createSignedUrls (plural) returns all signed URLs in a single round-trip.
async function signRows(rows: FileRow[]): Promise<FileRow[]> {
  if (rows.length === 0) return []
  const keys = rows.map(r => storageKey(r.file_path))
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(keys, 3600) // batch: one request for all files
  if (error || !data) {
    // fallback: return rows with original paths if batch fails
    return rows.map(r => ({ ...r, signedUrl: r.file_path }))
  }
  return rows.map((r, i) => ({
    ...r,
    signedUrl: data[i]?.signedUrl ?? r.file_path,
  }))
}

function SitesPage() {
  const { lang } = useLang()
  const t = (k: Parameters<typeof tss>[1]) => tss(lang, k)
  const [sites,        setSites]        = useState<SiteDetail[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<'All'|'Active'|'Completed'>('All')
  const [modal,        setModal]        = useState<ModalType>(null)
  const [selected,     setSelected]     = useState<SiteDetail|null>(null)
  const [form,         setForm]         = useState<Partial<Site>>({status:'Active',floors_count:1,budget:0})
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<{msg:string;ok:boolean}|undefined>()
  const [tab,          setTab]          = useState<TabType>('info')
  const [agreements,   setAgreements]   = useState<FileRow[]>([])
  const [floorFiles,   setFloorFiles]   = useState<FileRow[]>([])
  const [elevations,   setElevations]   = useState<FileRow[]>([])
  const [sitePayments, setSitePayments] = useState<SitePay[]>([])
  const [uploading,    setUploading]    = useState<string|null>(null)
  const [payModal,     setPayModal]     = useState(false)
  const [pForm,        setPForm]        = useState({
    amount:'', description:'', mode:'Cash',
    payment_date: new Date().toISOString().split('T')[0],
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{type:'agreement'|'floor'|'elevation';floor?:number}|null>(null)

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(undefined),3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('sites').select('*').is('deleted_at',null).order('status',{ascending:true}).order('site_name')
    if (error) showToast(error.message, false)
    setSites((data??[]) as SiteDetail[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Load files and immediately sign their URLs so they open correctly
  const loadFiles = useCallback(async (siteId:string) => {
    const [{ data:ag },{ data:ff },{ data:el }] = await Promise.all([
      supabase.from('site_agreements').select('*').eq('site_id',siteId).order('created_at',{ascending:false}),
      supabase.from('site_floor_files').select('*').eq('site_id',siteId).order('floor_no'),
      supabase.from('site_elevations').select('*').eq('site_id',siteId).order('created_at',{ascending:false}),
    ])
    // Sign all URLs in parallel
    const [signedAg, signedFf, signedEl] = await Promise.all([
      signRows(ag ?? []),
      signRows(ff ?? []),
      signRows(el ?? []),
    ])
    setAgreements(signedAg)
    setFloorFiles(signedFf)
    setElevations(signedEl)
  }, [])

  const loadPayments = useCallback(async (siteId:string) => {
    const { data } = await supabase.from('site_payments').select('*')
      .eq('site_id',siteId).eq('direction','received').order('payment_date',{ascending:false})
    setSitePayments(data??[])
  }, [])

  const openDetail = (s:SiteDetail) => {
    setSelected(s); setTab('info'); setModal('detail')
    loadFiles(s.id); loadPayments(s.id)
  }

  const handleFileSelected = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file||!pendingUpload||!selected) return
    setUploading(pendingUpload.type)
    try {
      const userId = await uid()
      if (!userId) throw new Error('Not logged in')

      // Path starts with userId/ so storage RLS policy allows the upload
      const path = `${userId}/${pendingUpload.type}/${selected.id}/${Date.now()}_${file.name}`

      const { data:up, error:upErr } = await supabase.storage.from(BUCKET).upload(path, file)
      if (upErr) throw upErr

      // Store the raw storage path (not a public URL) — we sign it on read
      const storagePath = up.path

      if (pendingUpload.type === 'agreement')
        await supabase.from('site_agreements').insert({
          site_id: selected.id, file_path: storagePath, file_name: file.name, user_id: userId,
        })
      else if (pendingUpload.type === 'floor')
        await supabase.from('site_floor_files').insert({
          site_id: selected.id, floor_no: pendingUpload.floor??0,
          file_name: file.name, file_path: storagePath, user_id: userId,
        })
      else
        await supabase.from('site_elevations').insert({
          site_id: selected.id, file_name: file.name, file_path: storagePath, user_id: userId,
        })

      await loadFiles(selected.id)
      showToast('File uploaded!')
    } catch(err:unknown) {
      showToast(err instanceof Error ? err.message : 'Upload failed', false)
    } finally {
      setUploading(null); setPendingUpload(null)
    }
    e.target.value = ''
  }

  const triggerUpload = (type:'agreement'|'floor'|'elevation', floor?:number) => {
    setPendingUpload({type,floor}); fileRef.current?.click()
  }

  const deleteFile = async (table:string, id:string, filePath:string) => {
    if (!confirm('Delete this file?')) return
    const key = storageKey(filePath)
    if (key) await supabase.storage.from(BUCKET).remove([key])
    await supabase.from(table).delete().eq('id',id)
    if (selected) await loadFiles(selected.id)
    showToast('Deleted')
  }

  const save = async () => {
    if (!form.site_name?.trim()) return
    setSaving(true)
    try {
      const userId = await uid()
      const data = { ...form, site_name_search: form.site_name!.toLowerCase() }
      const { error } = modal==='add'
        ? await supabase.from('sites').insert({...data, user_id: userId})
        : await supabase.from('sites').update(data).eq('id', selected!.id)
      if (error) throw error
      setModal(null); load(); showToast(modal==='add' ? t('siteAdded') : t('siteUpdated'))
    } catch(e:unknown) { showToast(e instanceof Error ? e.message : 'Save failed', false) }
    finally { setSaving(false) }
  }

  const del = async (s:SiteDetail) => {
    if (!confirm(t('deleteConfirm'))) return
    await supabase.from('sites').update({ deleted_at: new Date().toISOString() }).eq('id', s.id)
    setModal(null); load()
    showToast('Moved to recycle bin 🗑️', true)
  }

  const savePayment = async () => {
    if (!pForm.amount || !selected) return
    const userId = await uid()
    const { error } = await supabase.from('site_payments').insert({
      site_id:      selected.id,
      amount:       parseFloat(pForm.amount) || 0,
      direction:    'received',
      description:  pForm.description?.trim() || '',
      mode:         pForm.mode || 'Cash',
      payment_date: pForm.payment_date || new Date().toISOString().split('T')[0],
      user_id:      userId,
    })
    if (error) { showToast(error.message, false); return }
    setPayModal(false); loadPayments(selected.id); showToast(t('savedOk'))
  }

  const filtered = filter==='All' ? sites : sites.filter(s=>s.status===filter)
  const counts = {
    All:       sites.length,
    Active:    sites.filter(s=>s.status==='Active').length,
    Completed: sites.filter(s=>s.status==='Completed').length,
  }
  const totalReceived = sitePayments.reduce((s,p)=>s+p.amount,0)

  return (
    <div className="page">
      {toast && (
        <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.ok?'bg-green-500':'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelected}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black" style={{color:'rgb(var(--text))'}}>🏗️ {t('sites')}</h1>
          <button onClick={()=>{ setForm({status:'Active',floors_count:1,budget:0}); setSelected(null); setModal('add') }}
            className="btn-primary btn-sm">
            + {t('addSite')}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['All','Active','Completed'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`chip ${filter===f?'chip-active':'chip-idle'}`}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"/>
          </div>
        ) : filtered.length===0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3 opacity-20">🏗️</div>
            <p style={{color:'rgb(var(--muted))'}}>No sites</p>
          </div>
        ) : filtered.map(s=>(
          <div key={s.id} className="card-hover mb-3" onClick={()=>openDetail(s)}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">🏗️</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold" style={{color:'rgb(var(--text))'}}>{s.site_name}</h3>
                    <span className={s.status==='Active'?'badge-green':'badge-blue'}>{s.status}</span>
                  </div>
                  {s.location && <p className="text-sm mt-0.5 truncate" style={{color:'rgb(var(--muted))'}}>📍 {s.location}</p>}
                </div>
                <span className="text-xl" style={{color:'rgb(var(--border))'}}>›</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{color:'rgb(var(--muted))'}}>
                {s.owner_name && <span>👤 {s.owner_name}</span>}
                <span>🏢 {s.floors_count} floors</span>
                <span>💰 ₹{(s.budget/100000).toFixed(1)}L</span>
                {s.start_date && <span>📅 {s.start_date}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit modal */}
      {(modal==='add'||modal==='edit') && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{modal==='add'?t('addSite'):'Edit Site'}</h2>
              <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                {k:'site_name',   l:t('siteName'),   r:true,  tp:'text'},
                {k:'location',    l:t('location'),   r:false, tp:'text'},
                {k:'owner_name',  l:t('ownerName'),  r:false, tp:'text'},
                {k:'owner_phone', l:t('ownerPhone'), r:false, tp:'tel'},
                {k:'start_date',  l:t('startDate'),  r:false, tp:'date'},
              ].map(({k,l,r,tp})=>(
                <div key={k}>
                  <label className="label">{l}{r&&<span className="text-red-400 ml-1">*</span>}</label>
                  <input type={tp} value={(form as Record<string,string>)[k]??''}
                    maxLength={k==='owner_phone'?10:undefined}
                    onChange={e=>setForm({...form,[k]:e.target.value})} className="input"/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('budget')}</label>
                  <input type="number" value={form.budget?.toString()??''} onChange={e=>setForm({...form,budget:+e.target.value})} className="input"/>
                </div>
                <div><label className="label">{t('floors')}</label>
                  <input type="number" value={form.floors_count?.toString()??''} onChange={e=>setForm({...form,floors_count:+e.target.value})} className="input"/>
                </div>
              </div>
              <div>
                <label className="label">{t('status')}</label>
                <div className="flex gap-2">
                  {['Active','Completed'].map(st=>(
                    <button key={st} onClick={()=>setForm({...form,status:st})}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${form.status===st?st==='Active'?'bg-green-600 text-white border-green-600':'bg-blue-600 text-white border-blue-600':'border-slate-200 dark:border-slate-600'}`}
                      style={{color: form.status===st ? undefined : 'rgb(var(--muted))'}}>
                      {st==='Active'?t('active'):t('completed')}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label">{t('notes')}</label>
                <textarea rows={2} value={form.notes??''} onChange={e=>setForm({...form,notes:e.target.value})} className="input resize-none"/>
              </div>
              <button onClick={save} disabled={saving} className="btn-primary btn-full">
                {saving?'⏳ Saving...':t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modal==='detail' && selected && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-xl" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>{selected.site_name}</h2>
                {selected.location && <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>📍 {selected.location}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>{ setForm({...selected}); setModal('edit') }} className="btn-ghost btn-sm">✏️</button>
                <button onClick={()=>setModal(null)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
              </div>
            </div>

            <div className="flex border-b" style={{borderColor:'rgb(var(--border))'}}>
              {([['info','📋 Info'],['docs','📁 Docs'],['payments','💰 Payments']] as const).map(([tt,l])=>(
                <button key={tt} onClick={()=>setTab(tt)}
                  className={`flex-1 py-2.5 text-sm font-bold border-b-2 transition ${tab===tt?'text-amber-500 dark:text-amber-400 border-amber-400':'border-transparent'}`}
                  style={{color: tab===tt ? undefined : 'rgb(var(--muted))'}}>
                  {l}
                </button>
              ))}
            </div>

            {tab==='info' && (
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    [t('status'),     selected.status],
                    [t('floors'),     `${selected.floors_count}`],
                    [t('budget'),     `₹${(selected.budget/100000).toFixed(2)}L`],
                    [t('startDate'),  selected.start_date??'—'],
                    [t('ownerName'),  selected.owner_name??'—'],
                    [t('ownerPhone'), selected.owner_phone??'—'],
                  ].map(([l,v])=>(
                    <div key={l} className="rounded-xl p-3" style={{background:'rgb(var(--bg))'}}>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{color:'rgb(var(--muted))'}}>{l}</p>
                      <p className="font-bold text-sm mt-0.5" style={{color:'rgb(var(--text))'}}>{v}</p>
                    </div>
                  ))}
                </div>
                {selected.notes && (
                  <div className="text-sm rounded-xl p-3 mb-4" style={{background:'rgb(var(--bg))',color:'rgb(var(--muted))'}}>
                    {selected.notes}
                  </div>
                )}
                <button onClick={()=>del(selected)} className="btn-danger btn-full">🗑️ Delete Site</button>
              </div>
            )}

            {tab==='docs' && (
              <div className="divide-y" style={{borderColor:'rgb(var(--border))'}}>
                <DocSection title="📄 Agreements" color="bg-blue-600" files={agreements} uploading={uploading==='agreement'}
                  onUpload={()=>triggerUpload('agreement')} onDelete={f=>deleteFile('site_agreements',f.id,f.file_path)}/>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">🗺️</div>
                    <div>
                      <p className="font-bold text-sm" style={{color:'rgb(var(--text))'}}> Floor Plans</p>
                      <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{selected.floors_count} floors</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Array.from({length:selected.floors_count},(_,i)=>{
                      const files = floorFiles.filter(f=>f.floor_no===i)
                      return (
                        <div key={i} className="rounded-xl overflow-hidden border" style={{borderColor:'rgb(var(--border))'}}>
                          <div className="flex items-center justify-between px-3 py-2.5" style={{background:'rgb(var(--bg))'}}>
                            <span className="text-sm font-bold" style={{color:'rgb(var(--text))'}}>{i===0?'🏠 Ground Floor':`🏢 Floor ${i}`}</span>
                            <button onClick={()=>triggerUpload('floor',i)} disabled={!!uploading}
                              className="text-xs text-green-600 dark:text-green-400 font-bold hover:underline disabled:opacity-50">
                              {uploading==='floor'?'⏳':'+ Upload'}
                            </button>
                          </div>
                          {files.length===0
                            ? <p className="text-xs text-center py-2.5" style={{color:'rgb(var(--muted))'}}>No files</p>
                            : <div className="p-2 space-y-1.5">{files.map(f=><FileItem key={f.id} f={f} onDelete={()=>deleteFile('site_floor_files',f.id,f.file_path)}/>)}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <DocSection title="🖼️ Elevations" color="bg-purple-600" files={elevations} uploading={uploading==='elevation'}
                  onUpload={()=>triggerUpload('elevation')} onDelete={f=>deleteFile('site_elevations',f.id,f.file_path)}/>
              </div>
            )}

            {tab==='payments' && (
              <div className="p-4 space-y-3">
                <button onClick={()=>{ setPForm({amount:'',description:'',mode:'Cash',payment_date:new Date().toISOString().split('T')[0]}); setPayModal(true) }}
                  className="btn-green w-full">+ Add Payment Received</button>
                {sitePayments.length>0 && (
                  <div className="card p-3 flex items-center gap-3">
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-black text-green-600">₹{totalReceived.toFixed(0)}</p>
                      <p className="text-xs mt-0.5" style={{color:'rgb(var(--muted))'}}>Total Received from Owner</p>
                    </div>
                  </div>
                )}
                {sitePayments.length===0 ? (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2 opacity-20">💰</p>
                    <p style={{color:'rgb(var(--muted))'}}>No payments recorded</p>
                  </div>
                ) : sitePayments.map(p=>(
                  <div key={p.id} className="card p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0">💰</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold" style={{color:'rgb(var(--text))'}}>₹{p.amount}</span>
                        <span className="badge-green">Received</span>
                        <span className="badge-gray">{p.mode}</span>
                      </div>
                      {p.description && <p className="text-xs truncate mt-0.5" style={{color:'rgb(var(--muted))'}}>{p.description}</p>}
                      <p className="text-xs" style={{color:'rgb(var(--muted))'}}>{p.payment_date}</p>
                    </div>
                    <button onClick={async()=>{ await supabase.from('site_payments').update({deleted_at:new Date().toISOString()}).eq('id',p.id); loadPayments(selected.id) }}
                      className="text-red-400 hover:text-red-600 text-sm p-1.5">🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <div className="modal-backdrop" onClick={()=>setPayModal(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-black text-lg" style={{color:'rgb(var(--text))'}}>Payment Received</h2>
              <button onClick={()=>setPayModal(false)} className="text-2xl leading-none" style={{color:'rgb(var(--muted))'}}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 rounded-xl px-4 py-3">
                <span className="text-xl">💰</span>
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Payment received from site owner</span>
              </div>
              <div><label className="label">Amount ₹ *</label>
                <input type="number" inputMode="decimal" value={pForm.amount}
                  onChange={e=>setPForm(f=>({...f,amount:e.target.value}))} className="input" placeholder="0"/>
              </div>
              <div><label className="label">Description</label>
                <input value={pForm.description} onChange={e=>setPForm(f=>({...f,description:e.target.value}))}
                  className="input" placeholder="e.g. First instalment..."/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Mode</label>
                  <select value={pForm.mode} onChange={e=>setPForm(f=>({...f,mode:e.target.value}))} className="input">
                    {['Cash','Online','Cheque'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label">Date</label>
                  <input type="date" value={pForm.payment_date}
                    onChange={e=>setPForm(f=>({...f,payment_date:e.target.value}))} className="input"/>
                </div>
              </div>
              <button onClick={savePayment} className="btn-green btn-full">Save Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocSection({ title, color, files, uploading, onUpload, onDelete }:
  { title:string; color:string; files:FileRow[]; uploading:boolean; onUpload:()=>void; onDelete:(f:FileRow)=>void }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0`}>
            {title.split(' ')[0]}
          </div>
          <p className="font-bold text-sm" style={{color:'rgb(var(--text))'}}>{title.split(' ').slice(1).join(' ')}</p>
          {files.length>0 && <span className="badge-gray">{files.length}</span>}
        </div>
        <button onClick={onUpload} disabled={uploading} className="btn-primary btn-sm disabled:opacity-50">
          {uploading?'⏳':'+ Upload'}
        </button>
      </div>
      {files.length===0 ? (
        <div className="rounded-xl p-4 text-center border-2 border-dashed text-sm"
          style={{borderColor:'rgb(var(--border))',color:'rgb(var(--muted))'}}>No files uploaded yet</div>
      ) : (
        <div className="space-y-2">{files.map(f=><FileItem key={f.id} f={f} onDelete={()=>onDelete(f)}/>)}</div>
      )}
    </div>
  )
}

function FileItem({ f, onDelete }: { f:FileRow; onDelete:()=>void }) {
  const ext  = f.file_name.split('.').pop()?.toLowerCase()
  const icon = ['jpg','jpeg','png'].includes(ext??'') ? '🖼️' : ext==='pdf' ? '📄' : '📎'
  // Use signedUrl if available (private bucket), else fall back to file_path
  const href = f.signedUrl ?? f.file_path
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:opacity-90 transition"
      style={{background:'rgb(var(--bg))'}}>
      <span className="text-lg">{icon}</span>
      <a href={href} target="_blank" rel="noreferrer"
        className="flex-1 text-sm text-blue-600 dark:text-blue-400 font-medium truncate hover:underline">
        {f.file_name}
      </a>
      <a href={href} target="_blank" rel="noreferrer"
        className="text-xs font-bold text-blue-500 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition">
        Open ↗
      </a>
      <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm">🗑️</button>
    </div>
  )
}

export default function Sites() { return <AppShell><SitesPage /></AppShell> }
