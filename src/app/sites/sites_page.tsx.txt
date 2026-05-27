'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import AppShell, { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { ts } from '@/lib/strings'
import type { Site } from '@/lib/types'

type FileRow  = { id:string; file_name:string; file_path:string; floor_no?:number }
type SitePayment2 = { id:string; amount:number; direction:string; description:string; mode:string; payment_date:string }
type SiteDetail = Site & { id:string }

function SitesPage() {
  const { lang } = useLang()
  const [sites,    setSites]    = useState<SiteDetail[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'All'|'Active'|'Completed'>('All')
  const [modal,    setModal]    = useState<'add'|'edit'|'detail'|null>(null)
  const [selected, setSelected] = useState<SiteDetail|null>(null)
  const [form,     setForm]     = useState<Partial<Site>>({status:'Active',floors_count:1,budget:0})
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{msg:string;type:'ok'|'err'}>()
  const [agreements,  setAgreements]  = useState<FileRow[]>([])
  const [floorFiles,  setFloorFiles]  = useState<FileRow[]>([])
  const [elevations,  setElevations]  = useState<FileRow[]>([])
  const [uploading,   setUploading]   = useState<string|null>(null)
  const [activeTab,   setActiveTab]   = useState<'info'|'docs'|'payments'>('info')
  const [sitePayments, setSitePayments] = useState<SitePayment2[]>([])
  const [payModal,     setPayModal]     = useState(false)
  const [pForm, setPForm] = useState({ amount:'', direction:'received', description:'', mode:'Cash', payment_date:new Date().toISOString().split('T')[0] })
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{type:'agreement'|'floor'|'elevation';floor?:number}|null>(null)

  const showToast = (msg:string, type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(undefined),3500) }

  const load = useCallback(async ()=>{
    setLoading(true)
    const { data, error } = await supabase.from('sites').select('*').order('site_name')
    if (error) { showToast(error.message,'err'); setLoading(false); return }
    setSites((data??[]) as SiteDetail[])
    setLoading(false)
  },[])

  useEffect(()=>{ load() },[load])

  const loadSitePayments = useCallback(async (siteId:string)=>{
    const { data } = await supabase.from('site_payments').select('*').eq('site_id',siteId).order('payment_date',{ascending:false})
    setSitePayments(data??[])
  },[])

  const loadFiles = useCallback(async (siteId:string)=>{
    const [{ data:ag },{ data:ff },{ data:el }] = await Promise.all([
      supabase.from('site_agreements').select('*').eq('site_id',siteId).order('created_at',{ascending:false}),
      supabase.from('site_floor_files').select('*').eq('site_id',siteId).order('floor_no'),
      supabase.from('site_elevations').select('*').eq('site_id',siteId).order('created_at',{ascending:false}),
    ])
    setAgreements(ag??[])
    setFloorFiles(ff??[])
    setElevations(el??[])
  },[])

  const openDetail = (s:SiteDetail)=>{ setSelected(s); setActiveTab('info'); loadFiles(s.id); loadSitePayments(s.id); setModal('detail') }

  const handleFileSelected = async (e:React.ChangeEvent<HTMLInputElement>)=>{
    const file = e.target.files?.[0]
    if (!file||!pendingUpload||!selected) return
    setUploading(pendingUpload.type)
    try {
      const path = `${pendingUpload.type}/${selected.id}/${Date.now()}_${file.name}`
      const { data:up, error:upErr } = await supabase.storage.from('construction-files').upload(path,file)
      if (upErr) throw upErr
      const { data:urlData } = supabase.storage.from('construction-files').getPublicUrl(up.path)
      const url = urlData.publicUrl
      if (pendingUpload.type==='agreement')
        await supabase.from('site_agreements').insert({site_id:selected.id,file_path:url,file_name:file.name})
      else if (pendingUpload.type==='floor')
        await supabase.from('site_floor_files').insert({site_id:selected.id,floor_no:pendingUpload.floor??0,file_name:file.name,file_path:url})
      else
        await supabase.from('site_elevations').insert({site_id:selected.id,file_name:file.name,file_path:url})
      await loadFiles(selected.id)
      showToast('File uploaded!')
    } catch(err:unknown) {
      showToast(err instanceof Error ? err.message : 'Upload failed','err')
    } finally { setUploading(null); setPendingUpload(null) }
    e.target.value=''
  }

  const triggerUpload = (type:'agreement'|'floor'|'elevation',floor?:number)=>{ setPendingUpload({type,floor}); fileRef.current?.click() }

  const deleteFile = async (table:string,id:string,path:string)=>{
    if (!confirm('Delete this file?')) return
    const key = path.split('/construction-files/')[1]
    if (key) await supabase.storage.from('construction-files').remove([key])
    await supabase.from(table).delete().eq('id',id)
    if (selected) await loadFiles(selected.id)
    showToast('File deleted')
  }

  const save = async ()=>{
    if (!form.site_name?.trim()) return
    setSaving(true)
    try {
      const data = {...form, site_name_search:form.site_name!.toLowerCase()}
      const { error } = modal==='add'
        ? await supabase.from('sites').insert(data)
        : await supabase.from('sites').update(data).eq('id',selected!.id)
      if (error) throw error
      setModal(null); load()
      showToast(modal==='add'?ts(lang,'siteAdded'):ts(lang,'siteUpdated'))
    } catch(e:unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed','err')
    } finally { setSaving(false) }
  }

  const del = async (s:SiteDetail)=>{
    if (!confirm(ts(lang,'deleteConfirm'))) return
    const { error } = await supabase.from('sites').delete().eq('id',s.id)
    if (error) { showToast(error.message,'err'); return }
    setModal(null); load()
    showToast('Site deleted')
  }

  const filtered = filter==='All' ? sites : sites.filter(s=>s.status===filter)
  const counts = { All:sites.length, Active:sites.filter(s=>s.status==='Active').length, Completed:sites.filter(s=>s.status==='Completed').length }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <div className={`fixed top-16 right-4 z-50 text-white text-sm px-4 py-2 rounded-xl shadow-lg ${toast.type==='ok'?'bg-green-500':'bg-red-500'}`}>{toast.msg}</div>}
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelected} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      <div className="bg-white border-b px-4 pt-5 pb-4 sticky top-14 z-30">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black text-gray-800">{ts(lang,'sites')}</h1>
          <button onClick={()=>{ setForm({status:'Active',floors_count:1,budget:0}); setModal('add') }} className="btn-primary text-sm">
            + {ts(lang,'addSite')}
          </button>
        </div>
        <div className="flex gap-2">
          {(['All','Active','Completed'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`chip ${filter===f?'chip-active':'chip-idle'}`}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"/></div>
        ) : filtered.length===0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-3 opacity-20">🏗️</div><p className="text-gray-400 font-medium">{ts(lang,'noSites')}</p></div>
        ) : filtered.map(s=>(
          <div key={s.id} className="card mb-3 hover:shadow-md transition-shadow cursor-pointer" onClick={()=>openDetail(s)}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${s.status==='Active'?'bg-green-50':'bg-blue-50'}`}>🏗️</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-800">{s.site_name}</h3>
                    <span className={s.status==='Active'?'badge-green':'badge-blue'}>{s.status}</span>
                  </div>
                  {s.location && <p className="text-sm text-gray-400 mt-0.5 truncate">📍 {s.location}</p>}
                </div>
                <span className="text-gray-200 text-xl flex-shrink-0">›</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
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
              <h2 className="font-black text-lg">{modal==='add'?ts(lang,'addSite'):'Edit Site'}</h2>
              <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <FI label={ts(lang,'siteName')}  value={form.site_name??''} onChange={v=>setForm({...form,site_name:v})} required />
              <FI label={ts(lang,'location')}  value={form.location??''} onChange={v=>setForm({...form,location:v})} />
              <div className="grid grid-cols-2 gap-3">
                <FI label={ts(lang,'budget')}  value={form.budget?.toString()??''} type="number" onChange={v=>setForm({...form,budget:+v})} />
                <FI label={ts(lang,'floors')}  value={form.floors_count?.toString()??''} type="number" onChange={v=>setForm({...form,floors_count:+v})} />
              </div>
              <FI label={ts(lang,'ownerName')} value={form.owner_name??''} onChange={v=>setForm({...form,owner_name:v})} />
              <FI label={ts(lang,'ownerPhone')} value={form.owner_phone??''} type="tel" maxLen={10} onChange={v=>setForm({...form,owner_phone:v.replace(/\D/g,'').slice(0,10)})} />
              <FI label={ts(lang,'startDate')} value={form.start_date??''} type="date" onChange={v=>setForm({...form,start_date:v})} />
              <div>
                <label className="label">{ts(lang,'status')}</label>
                <div className="flex gap-2">
                  {['Active','Completed'].map(st=>(
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

      {/* Detail modal - FIX 2: cleaner documents tab */}
      {modal==='detail' && selected && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal-box md:max-w-2xl" style={{maxHeight:'95vh'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="font-black text-lg">{selected.site_name}</h2>
                {selected.location && <p className="text-xs text-gray-400 mt-0.5">📍 {selected.location}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>{ setForm({...selected}); setModal('edit') }} className="btn-ghost text-sm py-1.5 px-3">✏️ Edit</button>
                <button onClick={()=>setModal(null)} className="text-gray-300 text-2xl leading-none">✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {([['info','📋 Info'],['docs','📁 Documents'],['payments','💳 Payments']] as const).map(([t,l])=>(
                <button key={t} onClick={()=>setActiveTab(t)}
                  className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${activeTab===t?'text-orange-600 border-orange-500':'text-gray-400 border-transparent'}`}>
                  {l}
                </button>
              ))}
            </div>

            {activeTab==='info' ? (
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {([
                    [ts(lang,'status'),    selected.status],
                    [ts(lang,'floors'),    `${selected.floors_count}`],
                    [ts(lang,'budget'),    `₹${(selected.budget/100000).toFixed(2)}L`],
                    [ts(lang,'startDate'), selected.start_date??'—'],
                    [ts(lang,'ownerName'), selected.owner_name??'—'],
                    [ts(lang,'ownerPhone'),selected.owner_phone??'—'],
                  ] as [string,string][]).map(([l,v])=>(
                    <div key={l} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{l}</p>
                      <p className="font-bold text-gray-800 mt-0.5 text-sm">{v}</p>
                    </div>
                  ))}
                </div>
                {selected.notes && <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3 mb-4">{selected.notes}</div>}
                <button onClick={()=>del(selected)} className="btn-danger w-full py-3">🗑️ Delete Site</button>
              </div>
            ) : activeTab==='docs' ? (
              <div /* Documents tab — clean card-per-section design */ className="divide-y divide-gray-100">

                {/* ── Agreements ── */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-lg">📄</div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">Agreements</p>
                        <p className="text-xs text-gray-400">{agreements.length} file{agreements.length!==1?'s':''}</p>
                      </div>
                    </div>
                    <button onClick={()=>triggerUpload('agreement')} disabled={!!uploading}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 transition">
                      {uploading==='agreement'?'⏳':'+ Upload'}
                    </button>
                  </div>
                  {agreements.length===0 ? (
                    <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                      <p className="text-sm text-blue-400 font-medium">No agreements yet</p>
                      <p className="text-xs text-blue-300 mt-1">Tap Upload to add PDF or image</p>
                    </div>
                  ) : (
                    <div className="space-y-2">{agreements.map(f=><FileItem key={f.id} f={f} onDelete={()=>deleteFile('site_agreements',f.id,f.file_path)}/>)}</div>
                  )}
                </div>

                {/* ── Floor Plans ── */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center text-white text-lg">🗺️</div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">Floor Plans</p>
                      <p className="text-xs text-gray-400">{selected.floors_count} floor{selected.floors_count!==1?'s':''} · {floorFiles.length} file{floorFiles.length!==1?'s':''}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Array.from({length:selected.floors_count},(_,i)=>{
                      const files = floorFiles.filter(f=>f.floor_no===i)
                      return (
                        <div key={i} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                          <div className="flex items-center justify-between px-3 py-2.5 bg-green-50 border-b border-green-100">
                            <span className="text-sm font-bold text-green-800">
                              {i===0?'🏠 Ground Floor':`🏢 Floor ${i}`}
                            </span>
                            <button onClick={()=>triggerUpload('floor',i)} disabled={!!uploading}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1 rounded-lg disabled:opacity-50 transition">
                              {uploading==='floor'?'⏳':'+ Upload'}
                            </button>
                          </div>
                          {files.length===0
                            ? <p className="text-xs text-gray-400 text-center py-3">No files uploaded</p>
                            : <div className="p-2 space-y-1.5">{files.map(f=><FileItem key={f.id} f={f} onDelete={()=>deleteFile('site_floor_files',f.id,f.file_path)}/>)}</div>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Elevations ── */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white text-lg">🖼️</div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">Elevations</p>
                        <p className="text-xs text-gray-400">{elevations.length} file{elevations.length!==1?'s':''}</p>
                      </div>
                    </div>
                    <button onClick={()=>triggerUpload('elevation')} disabled={!!uploading}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 transition">
                      {uploading==='elevation'?'⏳':'+ Upload'}
                    </button>
                  </div>
                  {elevations.length===0 ? (
                    <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
                      <p className="text-sm text-purple-400 font-medium">No elevations yet</p>
                      <p className="text-xs text-purple-300 mt-1">Tap Upload to add images</p>
                    </div>
                  ) : (
                    <div className="space-y-2">{elevations.map(f=><FileItem key={f.id} f={f} onDelete={()=>deleteFile('site_elevations',f.id,f.file_path)}/>)}</div>
                  )}
                </div>

              </div>
            ) : (
              /* Payments Tab */
              <div className="p-4 space-y-3">
                <button onClick={()=>{ setPForm({amount:'',direction:'received',description:'',mode:'Cash',payment_date:new Date().toISOString().split('T')[0]}); setPayModal(true) }}
                  className="btn-primary w-full">+ Add Payment Entry</button>
                {sitePayments.length>0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card p-3 text-center">
                      <p className="text-xl font-black text-green-600">₹{sitePayments.filter(p=>p.direction==='received').reduce((s,p)=>s+p.amount,0).toFixed(0)}</p>
                      <p className="text-xs text-gray-400">Received from Owner</p>
                    </div>
                    <div className="card p-3 text-center">
                      <p className="text-xl font-black text-red-500">₹{sitePayments.filter(p=>p.direction==='spent').reduce((s,p)=>s+p.amount,0).toFixed(0)}</p>
                      <p className="text-xs text-gray-400">Spent / Paid Out</p>
                    </div>
                  </div>
                )}
                {sitePayments.length===0 ? <div className="text-center py-10"><p className="text-4xl mb-2 opacity-20">💳</p><p className="text-gray-400 text-sm">No payments yet</p></div>
                : sitePayments.map(p=>(
                  <div key={p.id} className="card p-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${p.direction==='received'?'bg-green-100':'bg-red-100'}`}>
                      {p.direction==='received'?'💰':'💸'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">₹{p.amount}</span>
                        <span className={p.direction==='received'?'badge-green':'badge-red'}>{p.direction==='received'?'Received':'Spent'}</span>
                        <span className="badge-gray">{p.mode}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{p.description}</p>
                      <p className="text-xs text-gray-400">{p.payment_date}</p>
                    </div>
                    <button onClick={async()=>{ await supabase.from('site_payments').delete().eq('id',p.id); if(selected) loadSitePayments(selected.id) }} className="text-red-300 hover:text-red-500 p-1.5">🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Payment modal */}
      {payModal && selected && (
        <div className="modal-backdrop" onClick={()=>setPayModal(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h2 className="font-black text-lg">Add Payment — {selected.site_name}</h2><button onClick={()=>setPayModal(false)} className="text-gray-300 text-2xl">✕</button></div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">Direction</label>
                <div className="flex gap-2">
                  {([['received','💰 Received from Owner'],['spent','💸 Spent / Paid']] as const).map(([v,l])=>(
                    <button key={v} onClick={()=>setPForm(f=>({...f,direction:v}))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition ${pForm.direction===v?v==='received'?'bg-green-600 text-white border-green-600':'bg-red-500 text-white border-red-500':'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label">Amount ₹ *</label><input type="number" inputMode="decimal" value={pForm.amount} onChange={e=>setPForm(f=>({...f,amount:e.target.value}))} className="input" placeholder="0"/></div>
              <div><label className="label">Description</label><input value={pForm.description} onChange={e=>setPForm(f=>({...f,description:e.target.value}))} className="input" placeholder="e.g. First instalment, Material payment..."/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Mode</label>
                  <select value={pForm.mode} onChange={e=>setPForm(f=>({...f,mode:e.target.value}))} className="input">
                    {['Cash','Online','Cheque'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label">Date</label><input type="date" value={pForm.payment_date} onChange={e=>setPForm(f=>({...f,payment_date:e.target.value}))} className="input"/></div>
              </div>
              <button onClick={async()=>{
                if (!pForm.amount) return
                const { error } = await supabase.from('site_payments').insert({ site_id:selected.id, amount:parseFloat(pForm.amount)||0, direction:pForm.direction, description:pForm.description, mode:pForm.mode, payment_date:pForm.payment_date })
                if (!error) { setPayModal(false); loadSitePayments(selected.id); showToast('Payment saved!') }
                else showToast(error.message, 'err')
              }} className="btn-green btn-full">Save Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FileItem({ f, onDelete }: { f:FileRow; onDelete:()=>void }) {
  const ext = f.file_name.split('.').pop()?.toLowerCase()
  const icon = ['jpg','jpeg','png','webp'].includes(ext??'') ? '🖼️' : ext==='pdf' ? '📄' : '📎'
  return (
    <div className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 transition">
      <span className="text-xl flex-shrink-0">{icon}</span>
      <a href={f.file_path} target="_blank" rel="noreferrer"
        className="flex-1 text-sm text-blue-600 hover:text-blue-800 font-medium truncate">{f.file_name}</a>
      <a href={f.file_path} target="_blank" rel="noreferrer"
        className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 px-2 py-1 rounded-lg hover:bg-white transition">
        Open ↗
      </a>
      <button onClick={onDelete} className="text-red-300 hover:text-red-500 flex-shrink-0 text-lg transition">🗑️</button>
    </div>
  )
}

const FI = ({label,value,onChange,type='text',required=false,maxLen,multiline}:
  {label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean;maxLen?:number;multiline?:boolean})=>(
  <div>
    <label className="label">{label}{required&&<span className="text-red-400 ml-1">*</span>}</label>
    {multiline
      ? <textarea rows={2} value={value} onChange={e=>onChange(e.target.value)} className="input resize-none"/>
      : <input type={type} value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLen} className="input"/>}
  </div>
)

export default function Sites() { return <AppShell><SitesPage /></AppShell> }
