import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Upload, X, Loader2, ImagePlus, ChevronRight, Plus } from "lucide-react";
import { EDITING_STATUS_OPTIONS, EDITING_STATUS_LABELS } from "@/lib/editorialStatus";

// Shared "video workflow" form for a single editorial_content row.
// Used both in the Editorial calendar dialog and the Production page so the two
// surfaces stay in sync. Operates on a plain object (`data`) + setter (`setData`).
export default function EditorialVideoFields({ data, setData, clients = [], videoEditors = [], readOnly = false }) {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);

  return (
    <div className="space-y-4">
      {/* Title + Client */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Title</Label>
          <Input value={data.title || ""} onChange={e => setData({ ...data, title: e.target.value })} disabled={readOnly} />
        </div>
        <div>
          <Label>Client</Label>
          {readOnly ? (
            <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700">{data.client_name || "—"}</div>
          ) : (
            <Select value={data.client_id || ""} onValueChange={v => { const cl = clients.find(c => c.id === v); setData({ ...data, client_id: v, client_name: cl?.company_name || "" }); }}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Assign to (video editor) */}
      <div>
        <Label>Assign to</Label>
        <Select value={data.assigned_editor_id || "__none__"} onValueChange={v => {
          const editorId = v === "__none__" ? null : v;
          const fl = videoEditors.find(f => f.id === editorId);
          const isReel = data.post_type === "Reel";
          setData({ ...data, assigned_editor_id: editorId, assigned_editor_name: fl?.name || "",
            editing_status: editorId ? (isReel ? "En attente d'acceptation" : (data.editing_status === "Non assigné" || !data.editing_status ? "À faire" : data.editing_status)) : "Non assigné",
            workflow_type: "video", in_production: true,
          });
        }}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {videoEditors.length === 0 && <SelectItem value="_none" disabled>No video editors</SelectItem>}
            {videoEditors.map(f => <SelectItem key={f.id} value={f.id}>{f.name}{f.status === "Indisponible" ? " — unavailable" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Status (editing) */}
      <div>
        <Label>Status</Label>
        <Select value={data.editing_status || "Non assigné"} onValueChange={v => setData({ ...data, editing_status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EDITING_STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{EDITING_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description → brief for the editor */}
      <div>
        <Label>Description</Label>
        <Textarea value={data.editing_instructions || ""} onChange={e => setData({ ...data, editing_instructions: e.target.value })} rows={4} placeholder="Brief for the editor — length, key moments, music, style…" />
      </div>

      {/* URL */}
      <div>
        <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" />URL</Label>
        <Input value={data.drive_link || ""} onChange={e => setData({ ...data, drive_link: e.target.value })} placeholder="https://drive.google.com/..." />
      </div>

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} placeholder="Internal notes…" />
      </div>

      {/* Brief files */}
      <div>
        <Label>Brief files</Label>
        <p className="text-[11px] text-slate-400 mb-1.5">Reference files for the freelancer (videos, PDFs, audio…)</p>
        <div className="space-y-1.5">
          {(data.editing_files || []).map((url, i) => {
            const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
            return (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2A69FF] hover:underline truncate max-w-[240px]">{name}</a>
                <button onClick={() => setData({ ...data, editing_files: data.editing_files.filter((_, idx) => idx !== i) })} className="text-slate-300 hover:text-red-400 ml-2"><X className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
          <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs text-[#2A69FF] hover:underline ${uploadingFile ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-3 h-3" />{uploadingFile ? "Uploading..." : "Add a file"}
            <input type="file" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setUploadingFile(true);
              try {
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                setData(d => ({ ...d, editing_files: [...(d.editing_files || []), file_url] }));
              } finally { setUploadingFile(false); e.target.value = ""; }
            }} />
          </label>
        </div>
      </div>

      {/* Images */}
      <div>
        <Label>Images</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {(data.editing_images || []).map((url, i) => (
            <div key={i} className="relative group">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="" className="w-20 h-20 rounded-lg border border-slate-200 object-cover hover:opacity-90" />
              </a>
              <button type="button" onClick={() => setData({ ...data, editing_images: (data.editing_images || []).filter((_, idx) => idx !== i) })} className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-colors ${uploadingImg ? "opacity-50 pointer-events-none" : ""}`}>
            {uploadingImg ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <ImagePlus className="w-5 h-5 text-slate-400" />}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setUploadingImg(true);
              try {
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                setData(d => ({ ...d, editing_images: [...(d.editing_images || []), file_url] }));
              } finally { setUploadingImg(false); e.target.value = ""; }
            }} />
          </label>
        </div>
      </div>

      {/* Scheduling */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={data.post_type} onValueChange={v => setData({ ...data, post_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Reel">Reel</SelectItem>
              <SelectItem value="Story">Story</SelectItem>
              <SelectItem value="Carousel">Carousel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scheduled date</Label>
          <Input type="date" value={data.scheduled_date || ""} onChange={e => setData({ ...data, scheduled_date: e.target.value })} />
        </div>
      </div>

      {/* Collapsible: client portal & delivery (Portal V2) */}
      <div className="pt-2 border-t border-slate-100">
        <button type="button" onClick={() => setShowDelivery(s => !s)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDelivery ? "rotate-90" : ""}`} /> Client portal &amp; delivery
        </button>
        {showDelivery && (
          <div className="space-y-4 mt-3">
            <div>
              <Label>Drive / content link (Portal V2)</Label>
              <input type="url" value={data.drive_url || ""} onChange={e => setData({ ...data, drive_url: e.target.value })} placeholder="https://drive.google.com/…" className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2A69FF]" />
            </div>
            <div>
              <Label>Cover image URL (Portal V2)</Label>
              <input type="url" value={data.cover_image_url || ""} onChange={e => setData({ ...data, cover_image_url: e.target.value })} placeholder="https://…" className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2A69FF]" />
            </div>
            <div>
              <Label>Reel caption / description (Portal V2)</Label>
              <Textarea value={data.reel_description || ""} onChange={e => setData({ ...data, reel_description: e.target.value })} rows={3} placeholder="Caption to copy-paste for this reel…" />
            </div>
            <div>
              <Label>Downloadable files (Portal V2)</Label>
              <p className="text-xs text-slate-400 mt-0.5 mb-2">Cover, reel video, or carousel slides — the client downloads each one in the portal.</p>
              <div className="space-y-1.5">
                {(data.media_files || []).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                    <input value={f.label || ""} onChange={e => { const mf = [...(data.media_files || [])]; mf[i] = { ...mf[i], label: e.target.value }; setData({ ...data, media_files: mf }); }} placeholder="Label (Cover, Reel, Slide 1…)" className="text-xs px-2 py-1 rounded border border-slate-200 w-32 shrink-0" />
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2A69FF] hover:underline truncate flex-1">{decodeURIComponent((f.url || "").split("/").pop().split("?")[0]) || f.url}</a>
                    <button onClick={() => setData({ ...data, media_files: (data.media_files || []).filter((_, idx) => idx !== i) })} className="text-slate-300 hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs text-[#2A69FF] hover:underline ${uploadingFile ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-3 h-3" />{uploadingFile ? "Uploading..." : "Upload a file"}
                    <input type="file" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploadingFile(true);
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        const guess = /\.(mp4|mov|webm)$/i.test(file.name) ? "Reel video" : ((data.media_files || []).length === 0 ? "Cover" : `Slide ${data.media_files.length}`);
                        setData(d => ({ ...d, media_files: [...(d.media_files || []), { label: guess, url: file_url }] }));
                      } finally { setUploadingFile(false); e.target.value = ""; }
                    }} />
                  </label>
                  <button type="button" onClick={() => setData(d => ({ ...d, media_files: [...(d.media_files || []), { label: "", url: "" }] }))} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                    <Plus className="w-3 h-3" /> Add a link
                  </button>
                </div>
                {(data.media_files || []).some(f => !f.url) && (
                  <p className="text-[11px] text-slate-400">Tip: paste a URL below for manual links.</p>
                )}
                {(data.media_files || []).map((f, i) => (!f.url ? (
                  <input key={`u-${i}`} value={f.url || ""} onChange={e => { const mf=[...(data.media_files||[])]; mf[i]={...mf[i], url:e.target.value}; setData({...data, media_files: mf}); }} placeholder="https://… (paste link)" className="w-full text-xs px-2 py-1.5 rounded border border-slate-200" />
                ) : null))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
