import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Upload, X, ExternalLink, Trash2, GripVertical, Settings2, Check } from "lucide-react";
import { motion } from "framer-motion";
import Invoices from "./Invoices";
import Finance from "./Finance";
import Services from "./Services";
import Reports from "./Reports";
import Pipeline from "./Pipeline";
import Contracts from "./Contracts";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";


// ─── BOARD MEETINGS ─────────────────────────────────────────────────────────
function BoardMeetings() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newAttendee, setNewAttendee] = useState("");
  const qc = useQueryClient();

  const { data: meetings = [] } = useQuery({ queryKey: ["board-meetings"], queryFn: () => base44.entities.BoardMeeting.list("-date") });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.BoardMeeting.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["board-meetings"] }); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.BoardMeeting.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["board-meetings"] }); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.BoardMeeting.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["board-meetings"] }) });

  const empty = { title: "", date: "", location: "", attendees: [], agenda: "", minutes: "", status: "Planifiée", documents: [], notes: "" };

  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (m) => { setData({ ...m, attendees: m.attendees || [], documents: m.documents || [] }); setOpen(true); };

  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);

  const handleDelete = () => {
    if (data?.id && confirm("Supprimer cette réunion ?")) { deleteMut.mutate(data.id); setOpen(false); }
  };

  const addAttendee = () => {
    if (newAttendee.trim()) { setData(d => ({ ...d, attendees: [...(d.attendees || []), newAttendee.trim()] })); setNewAttendee(""); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setData(d => ({ ...d, documents: [...(d.documents || []), file_url] }));
    setUploading(false); e.target.value = "";
  };

  const STATUS_COLORS = { "Planifiée": "bg-blue-50 text-blue-700", "Terminée": "bg-emerald-50 text-emerald-700", "Annulée": "bg-red-50 text-red-700" };

  return (
    <div>
      <PageHeader title="Board Meetings" subtitle="Governance & operations">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />New meeting</Button>
      </PageHeader>
      <div className="space-y-3">
        {meetings.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">No meetings recorded</p>}
        {meetings.map(m => (
          <div key={m.id} onClick={() => openEdit(m)} className="bg-white rounded-xl border border-slate-100 p-5 cursor-pointer hover:shadow-sm transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{m.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{m.date ? format(new Date(m.date), "d MMMM yyyy", { locale: enUS }) : "—"} {m.location && `· ${m.location}`}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[m.status]}`}>{m.status}</span>
            </div>
            {m.attendees?.length > 0 && (
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {m.attendees.map((a, i) => <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{a}</span>)}
              </div>
            )}
            {m.documents?.length > 0 && <p className="text-[10px] text-slate-400 mt-2">{m.documents.length} file(s) attached</p>}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{data?.id ? "Edit meeting" : "New meeting"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div><Label>Title *</Label><Input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={data.date || ""} onChange={e => setData({ ...data, date: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={data.location || ""} onChange={e => setData({ ...data, location: e.target.value })} placeholder="e.g. Main office, Zoom..." /></div>
              </div>
              <div><Label>Status</Label>
                <Select value={data.status} onValueChange={v => setData({ ...data, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Planifiée">Scheduled</SelectItem><SelectItem value="Terminée">Done</SelectItem><SelectItem value="Annulée">Cancelled</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Attendees</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={newAttendee} onChange={e => setNewAttendee(e.target.value)} placeholder="Add attendee..." onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAttendee())} />
                  <Button type="button" variant="outline" size="sm" onClick={addAttendee}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(data.attendees || []).map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {a} <button onClick={() => setData(d => ({ ...d, attendees: d.attendees.filter((_, idx) => idx !== i) }))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div><Label>Agenda</Label><Textarea value={data.agenda || ""} onChange={e => setData({ ...data, agenda: e.target.value })} rows={4} placeholder="Points to discuss..." /></div>
              <div><Label>Minutes</Label><Textarea value={data.minutes || ""} onChange={e => setData({ ...data, minutes: e.target.value })} rows={5} placeholder="Summary of decisions made..." /></div>
              <div><Label>Notes</Label><Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} /></div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Documents joints</Label>
                  <label className={`cursor-pointer text-xs text-[#2A69FF] hover:underline flex items-center gap-1 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-3 h-3" />{uploading ? "Uploading..." : "Attach file"}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xlsx,.pptx" onChange={handleUpload} />
                  </label>
                </div>
                <div className="space-y-1">
                  {(data.documents || []).map((url, i) => {
                    const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#2A69FF] hover:underline flex items-center gap-1 truncate max-w-[300px]"><ExternalLink className="w-3 h-3" />{name}</a>
                        <button onClick={() => setData(d => ({ ...d, documents: d.documents.filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-400 ml-2"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── LEGAL DOCUMENTS ────────────────────────────────────────────────────────
function LegalDocuments() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const { data: docs = [] } = useQuery({ queryKey: ["legal-docs"], queryFn: () => base44.entities.LegalDocument.list("-created_date") });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.LegalDocument.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-docs"] }); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.LegalDocument.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-docs"] }); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.LegalDocument.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["legal-docs"] }) });

  const empty = { title: "", type: "Autre", description: "", file_url: "", signed_date: "", expiry_date: "", parties: [], status: "Brouillon", notes: "" };
  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (d) => { setData({ ...d }); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = () => { if (data?.id && confirm("Supprimer ce document ?")) { deleteMut.mutate(data.id); setOpen(false); } };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setData(d => ({ ...d, file_url }));
    setUploading(false); e.target.value = "";
  };

  return (
    <div>
      <PageHeader title="Legal Documents" subtitle="Governance & operations">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />New document</Button>
      </PageHeader>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <table className="w-full min-w-[580px]">
          <thead><tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Document</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Type</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Signed date</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">File</th>
          </tr></thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No documents</td></tr>}
            {docs.map(d => (
              <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(d)}>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{d.title}</p>
                  {d.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{d.description}</p>}
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">{d.type}</td>
                <td className="px-5 py-3"><span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">{d.status}</span></td>
                <td className="px-5 py-3 text-sm text-slate-400">{d.signed_date ? format(new Date(d.signed_date), "d MMM yyyy", { locale: enUS }) : "—"}</td>
                <td className="px-5 py-3">
                  {d.file_url ? (
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[#2A69FF] hover:underline flex items-center gap-1 text-xs"><ExternalLink className="w-3 h-3" />Voir</a>
                  ) : <span className="text-xs text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{data?.id ? "Edit document" : "New legal document"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div><Label>Title *</Label><Input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={data.type} onValueChange={v => setData({ ...data, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Shareholder Agreement", "Statuts", "Contrat interne", "PV d'assemblée", "Autre"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={data.status} onValueChange={v => setData({ ...data, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Brouillon", "En révision", "Signé", "Archivé"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea value={data.description || ""} onChange={e => setData({ ...data, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Signed date</Label><Input type="date" value={data.signed_date || ""} onChange={e => setData({ ...data, signed_date: e.target.value })} /></div>
                <div><Label>Expiry date</Label><Input type="date" value={data.expiry_date || ""} onChange={e => setData({ ...data, expiry_date: e.target.value })} /></div>
              </div>
              <div>
              <Label>File (PDF / Word)</Label>
              <div className="mt-1">
                {data.file_url ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <a href={data.file_url} target="_blank" rel="noopener noreferrer" className="text-[#2A69FF] hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{decodeURIComponent(data.file_url.split("/").pop().split("?")[0])}</a>
                    <button onClick={() => setData(d => ({ ...d, file_url: "" }))} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs text-[#2A69FF] hover:underline ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-3 h-3" />{uploading ? "Uploading..." : "Attach file"}
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleUpload} />
                    </label>
                  )}
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-between items-center pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SHAREHOLDERS ────────────────────────────────────────────────────────────
function Shareholders() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const qc = useQueryClient();

  const { data: shareholders = [] } = useQuery({ queryKey: ["shareholders"], queryFn: () => base44.entities.Shareholder.list() });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.Shareholder.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["shareholders"] }); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Shareholder.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["shareholders"] }); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.Shareholder.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["shareholders"] }) });

  const empty = { name: "", email: "", type: "Fondateur", shares: 0, share_percentage: 0, investment_amount: 0, entry_date: "", share_class: "Ordinaire", notes: "" };
  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (s) => { setData({ ...s }); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = () => { if (data?.id && confirm("Supprimer cet actionnaire ?")) { deleteMut.mutate(data.id); setOpen(false); } };

  const totalShares = shareholders.reduce((s, sh) => s + (sh.shares || 0), 0);
  const totalInvested = shareholders.reduce((s, sh) => s + (sh.investment_amount || 0), 0);
  const TYPE_COLORS = { "Fondateur": "bg-violet-50 text-violet-700", "Investisseur": "bg-blue-50 text-blue-700", "Business Angel": "bg-amber-50 text-amber-700", "Autre": "bg-slate-100 text-slate-600" };

  return (
    <div>
      <PageHeader title="Shareholders" subtitle="Governance & operations">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />Add shareholder</Button>
      </PageHeader>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Shareholders</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{shareholders.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total shares</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalShares.toLocaleString("en")}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Capital invested</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalInvested.toLocaleString("fr-FR")} €</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <table className="w-full min-w-[580px]">
          <thead><tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Name</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Type</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Shares</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">%</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Investment</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Class</th>
          </tr></thead>
          <tbody>
            {shareholders.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No shareholders registered</td></tr>}
            {shareholders.map(s => (
              <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(s)}>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  {s.email && <p className="text-xs text-slate-400">{s.email}</p>}
                </td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[s.type]}`}>{s.type}</span></td>
                <td className="px-5 py-3 text-sm text-slate-700">{(s.shares || 0).toLocaleString("fr-FR")}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full"><div className="h-1.5 bg-[#2A69FF] rounded-full" style={{ width: `${Math.min(s.share_percentage || 0, 100)}%` }} /></div>
                    <span className="text-xs text-slate-600">{s.share_percentage || 0}%</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-slate-700">{s.investment_amount ? `${s.investment_amount.toLocaleString("fr-FR")} €` : "—"}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{s.share_class}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{data?.id ? "Edit shareholder" : "New shareholder"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div><Label>Name *</Label><Input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={data.email || ""} onChange={e => setData({ ...data, email: e.target.value })} /></div>
                <div><Label>Type</Label>
                  <Select value={data.type} onValueChange={v => setData({ ...data, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Fondateur", "Investisseur", "Business Angel", "Autre"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Parts</Label><Input type="number" value={data.shares || 0} onChange={e => setData({ ...data, shares: Number(e.target.value) })} /></div>
                <div><Label>% ownership</Label><Input type="number" min={0} max={100} value={data.share_percentage || 0} onChange={e => setData({ ...data, share_percentage: Number(e.target.value) })} /></div>
                <div><Label>Investment €</Label>
                <Input type="number" value={data.investment_amount || 0} onChange={e => setData({ ...data, investment_amount: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Entry date</Label><Input type="date" value={data.entry_date || ""} onChange={e => setData({ ...data, entry_date: e.target.value })} /></div>
                <div><Label>Share class</Label>
                  <Select value={data.share_class} onValueChange={v => setData({ ...data, share_class: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Ordinaire", "Préférentielle", "Autre"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-between items-center pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ADMIN TASKS ─────────────────────────────────────────────────────────────
function AdminTasks() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [activeStatus, setActiveStatus] = useState("all");
  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({ queryKey: ["admin-tasks"], queryFn: () => base44.entities.AdminTask.list("-created_date") });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.AdminTask.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tasks"] }); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.AdminTask.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tasks"] }); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.AdminTask.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tasks"] }) });

  const empty = { title: "", description: "", category: "Autre", status: "À faire", priority: "Normale", due_date: "", assigned_to: "", notes: "" };
  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (t) => { setData({ ...t }); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = () => { if (data?.id && confirm("Supprimer cette tâche ?")) { deleteMut.mutate(data.id); setOpen(false); } };

  const toggleStatus = (task) => {
    const next = task.status === "Terminé" ? "À faire" : "Terminé";
    updateMut.mutate({ id: task.id, d: { ...task, status: next } });
  };

  const STATUS_COLORS = { "À faire": "bg-slate-100 text-slate-600", "En cours": "bg-blue-50 text-blue-700", "Terminé": "bg-emerald-50 text-emerald-700", "Bloqué": "bg-red-50 text-red-700" };
  const STATUS_DOT = { "À faire": "bg-slate-400", "En cours": "bg-blue-500", "Terminé": "bg-emerald-500", "Bloqué": "bg-red-500" };
  const PRIORITY_LABEL = { "Basse": "Low", "Normale": "Normal", "Haute": "High", "Urgente": "Urgent" };
  const STATUS_LABEL = { "À faire": "To do", "En cours": "In progress", "Terminé": "Done", "Bloqué": "Blocked" };
  const STATUSES = ["À faire", "En cours", "Terminé", "Bloqué"];
  const countByStatus = (s) => tasks.filter((t) => t.status === s).length;
  const filtered = activeStatus === "all" ? tasks : tasks.filter(t => t.status === activeStatus);
  const pending = filtered.filter(t => t.status !== "Terminé");
  const done = filtered.filter(t => t.status === "Terminé");
  return (
    <div>
      <div className="max-w-2xl mx-auto mb-6">
        <PageHeader title="Admin Tasks" subtitle="Governance & operations">
          <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />New task</Button>
        </PageHeader>
      </div>
      <div className="flex items-center gap-2 mb-6 flex-wrap max-w-2xl mx-auto">
        <button
          onClick={() => setActiveStatus("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeStatus === "all" ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
          All <span className="ml-1 text-xs opacity-60">{tasks.length}</span>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeStatus === s ? STATUS_COLORS[s] + " ring-1 ring-current" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
            {STATUS_LABEL[s]}
            <span className="text-xs opacity-60">{countByStatus(s)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2 max-w-2xl mx-auto">
        {pending.length === 0 && done.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">No admin tasks</p>}
        {[...pending, ...done].map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-all">
            <button onClick={() => toggleStatus(t)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${t.status === "Terminé" ? "bg-[#2A69FF] border-[#2A69FF]" : "border-slate-300 hover:border-[#2A69FF]"}`}>
              {t.status === "Terminé" && <span className="text-white text-[10px]">✓</span>}
            </button>
            <div className="flex-1 cursor-pointer" onClick={() => openEdit(t)}>
              <p className={`text-sm font-medium ${t.status === "Terminé" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>{STATUS_LABEL[t.status] || t.status}</span>
                <span className="text-[10px] text-slate-400">{PRIORITY_LABEL[t.priority] || t.priority}</span>
                {t.category && <span className="text-[10px] text-slate-400">{t.category}</span>}
                {t.due_date && <span className="text-[10px] text-slate-400">· {format(new Date(t.due_date), "d MMM", { locale: enUS })}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{data?.id ? "Edit task" : "New admin task"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div><Label>Title *</Label><Input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={data.category} onValueChange={v => setData({ ...data, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Juridique", "Comptabilité", "RH", "Réglementation", "Stratégie", "Autre"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Priority</Label>
                  <Select value={data.priority} onValueChange={v => setData({ ...data, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Basse", "Normale", "Haute", "Urgente"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Status</Label>
                  <Select value={data.status} onValueChange={v => setData({ ...data, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["À faire", "En cours", "Terminé", "Bloqué"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date limite</Label><Input type="date" value={data.due_date || ""} onChange={e => setData({ ...data, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Assigned to</Label><Input value={data.assigned_to || ""} onChange={e => setData({ ...data, assigned_to: e.target.value })} placeholder="Person's name..." /></div>
              <div><Label>Description</Label><Textarea value={data.description || ""} onChange={e => setData({ ...data, description: e.target.value })} rows={3} /></div>
              <div className="flex justify-between items-center pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SHAREHOLDER SALARIES ─────────────────────────────────────────────────────
function ShareholderSalaries() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const qc = useQueryClient();

  const { data: salaries = [] } = useQuery({ queryKey: ["shareholder-salaries"], queryFn: () => base44.entities.ShareholderSalary.list("-date") });
  const { data: shareholders = [] } = useQuery({ queryKey: ["shareholders"], queryFn: () => base44.entities.Shareholder.list() });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.ShareholderSalary.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["shareholder-salaries"] }); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.ShareholderSalary.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["shareholder-salaries"] }); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.ShareholderSalary.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["shareholder-salaries"] }) });

  const empty = { shareholder_name: "", role: "", amount: 0, date: format(new Date(), "yyyy-MM-dd"), period: "", type: "Salaire", notes: "" };
  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (s) => { setData({ ...s }); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = () => { if (data?.id && confirm("Supprimer ce paiement ?")) { deleteMut.mutate(data.id); setOpen(false); } };

  const totalByShareholder = shareholders.map(sh => ({
    name: sh.name,
    total: salaries.filter(s => s.shareholder_name === sh.name).reduce((acc, s) => acc + (s.amount || 0), 0)
  })).filter(s => s.total > 0);

  const grandTotal = salaries.reduce((acc, s) => acc + (s.amount || 0), 0);

  const TYPE_COLORS = { "Salaire": "bg-blue-50 text-blue-700", "Dividende": "bg-violet-50 text-violet-700", "Remboursement frais": "bg-amber-50 text-amber-700" };

  return (
    <div>
      <PageHeader title="Shareholder Salaries" subtitle="Governance & operations">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />New payment</Button>
      </PageHeader>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 md:col-span-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total paid</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{grandTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </div>
        {totalByShareholder.map(s => (
          <div key={s.name} className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider truncate">{s.name}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{s.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <table className="w-full min-w-[580px]">
          <thead><tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Recipient</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Role</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Period</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Type</th>
            <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Montant</th>
          </tr></thead>
          <tbody>
            {salaries.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No payments recorded</td></tr>}
            {salaries.map(s => (
              <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(s)}>
                <td className="px-5 py-3 text-sm text-slate-500">{s.date ? format(new Date(s.date), "d MMM yyyy", { locale: enUS }) : "—"}</td>
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{s.shareholder_name}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{s.role || "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{s.period || "—"}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[s.type] || "bg-slate-100 text-slate-600"}`}>{s.type}</span></td>
                <td className="px-5 py-3 text-sm font-semibold text-right text-slate-800">{(s.amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{data?.id ? "Edit payment" : "New payment"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Recipient *</Label>
                  <Select value={data.shareholder_name} onValueChange={v => setData({ ...data, shareholder_name: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {shareholders.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      <SelectItem value="_autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  {data.shareholder_name === "_autre" && (
                    <Input className="mt-1" placeholder="Nom..." onChange={e => setData({ ...data, shareholder_name: e.target.value })} />
                  )}
                </div>
                <div><Label>Role</Label><Input value={data.role || ""} onChange={e => setData({ ...data, role: e.target.value })} placeholder="CEO, Co-Partner..." /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={data.type} onValueChange={v => setData({ ...data, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Salaire">Salaire</SelectItem>
                      <SelectItem value="Dividende">Dividende</SelectItem>
                      <SelectItem value="Remboursement frais">Remboursement frais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Amount (€) *</Label><Input type="number" value={data.amount || ""} onChange={e => setData({ ...data, amount: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={data.date || ""} onChange={e => setData({ ...data, date: e.target.value })} /></div>
                <div><Label>Period</Label><Input value={data.period || ""} onChange={e => setData({ ...data, period: e.target.value })} placeholder="e.g. March 2026" /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-between items-center pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.shareholder_name || !data.amount}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const DEFAULT_NAV_ITEMS = [
  { id: 'tasks',        label: 'Admin Tasks' },
  { id: 'meetings',     label: 'Board Meetings' },
  { id: 'legal',        label: 'Legal Docs' },
  { id: 'shareholders', label: 'Shareholders' },
  { id: 'salaries',     label: 'Salaries' },
  { id: 'invoices',     label: 'Invoices' },
  { id: 'finance',      label: 'Finance' },
  { id: 'services',     label: 'Services' },
  { id: 'analytics',    label: 'Analytics' },
  { id: 'sales',        label: 'Pipeline' },
  { id: 'contracts',    label: 'Contracts' },
];

const ADMIN_NAV_KEY = "admin_nav_order_v2";

function loadAdminNav() {
  try {
    const saved = localStorage.getItem(ADMIN_NAV_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const validIds = new Set(DEFAULT_NAV_ITEMS.map(i => i.id));
      const filtered = parsed.filter(i => validIds.has(i.id));
      const missing = DEFAULT_NAV_ITEMS.filter(i => !filtered.some(f => f.id === i.id));
      return [...filtered, ...missing];
    }
  } catch {}
  return DEFAULT_NAV_ITEMS;
}

export default function Admin() {
  const [section, setSection] = useState('tasks');
  const [navItems, setNavItems] = useState(loadAdminNav);
  const [editingNav, setEditingNav] = useState(false);

  useEffect(() => {
    localStorage.setItem(ADMIN_NAV_KEY, JSON.stringify(navItems));
  }, [navItems]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(navItems);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setNavItems(items);
  };

  const { data: tasks = [] } = useQuery({ queryKey: ["admin-tasks"], queryFn: () => base44.entities.AdminTask.list("-created_date") });
  const { data: meetings = [] } = useQuery({ queryKey: ["board-meetings"], queryFn: () => base44.entities.BoardMeeting.list("-date") });
  const { data: docs = [] } = useQuery({ queryKey: ["legal-docs"], queryFn: () => base44.entities.LegalDocument.list("-created_date") });
  const { data: shareholders = [] } = useQuery({ queryKey: ["shareholders"], queryFn: () => base44.entities.Shareholder.list() });
  const { data: salaries = [] } = useQuery({ queryKey: ["shareholder-salaries"], queryFn: () => base44.entities.ShareholderSalary.list("-date") });

  const pendingTasks = tasks.filter(t => t.status !== "Terminé");
  const totalSalaries = salaries.reduce((s, sal) => s + (sal.amount || 0), 0);

  const badges = {
    tasks:        pendingTasks.length || null,
    meetings:     meetings.length || null,
    legal:        docs.length || null,
    shareholders: shareholders.length || null,
    salaries:     totalSalaries > 0 ? `${(totalSalaries / 1000).toFixed(0)}k €` : null,
    invoices:     null,
  };

  return (
    <div>
      <PageHeader title="Administration" subtitle="Governance & operations" />
      <div className="flex flex-col md:flex-row gap-4 md:gap-6" style={{ maxWidth: '100%' }}>

        {/* ── Left sidebar ── */}
        <div className="w-full md:w-52 md:shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1 flex items-center justify-between">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest px-1">Internal</p>
              {editingNav ? (
                <button onClick={() => setEditingNav(false)} className="flex items-center gap-1 text-[10px] font-semibold text-[#2A69FF] px-2 py-0.5 rounded-full bg-blue-50">
                  <Check className="w-3 h-3" /> Done
                </button>
              ) : (
                <button onClick={() => setEditingNav(true)} className="text-slate-300 hover:text-slate-500 transition-colors">
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <nav className="pb-3 relative">
              {editingNav ? (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="admin-nav">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {navItems.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="flex items-center gap-2 px-4 py-2.5 select-none"
                                style={{ background: snapshot.isDragging ? '#f0f7ff' : 'transparent', ...provided.draggableProps.style }}
                              >
                                <div {...provided.dragHandleProps} className="text-slate-300 cursor-grab">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-sm text-slate-500 truncate">{item.label}</span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <>
                  {/* Mobile: horizontal scroll tabs */}
                  <div className="flex md:hidden overflow-x-auto gap-1.5 p-2 scrollbar-none">
                    {navItems.map(item => {
                      const isActive = section === item.id;
                      return (
                        <button key={item.id} onClick={() => setSection(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${isActive ? 'bg-[#2A69FF] text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {item.label}
                          {badges[item.id] && <span className="ml-1 opacity-70 text-[10px]">{badges[item.id]}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {/* Desktop: vertical nav */}
                  <div className="hidden md:block">
                    {navItems.map((item, idx) => {
                      const isActive = section === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSection(item.id)}
                          className="relative w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors duration-200"
                          style={{ color: isActive ? '#2A69FF' : undefined }}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="admin-nav-pill"
                              className="absolute inset-0 bg-blue-50 rounded-none"
                              style={{ borderLeft: '3px solid #2A69FF' }}
                              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                          )}
                          <span className={`relative z-10 ${isActive ? 'text-[#2A69FF] font-semibold' : 'text-slate-600 hover:text-slate-900'}`}>{item.label}</span>
                          {badges[item.id] && (
                            <span className={`relative z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              isActive ? 'bg-blue-100 text-[#2A69FF]' : 'bg-slate-100 text-slate-500'
                            }`}>{badges[item.id]}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              </nav>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          {section === 'tasks'        && <AdminTasks />}
          {section === 'meetings'     && <BoardMeetings />}
          {section === 'legal'        && <LegalDocuments />}
          {section === 'shareholders' && <Shareholders />}
          {section === 'salaries'     && <ShareholderSalaries />}
          {section === 'invoices'     && <Invoices />}
          {section === 'finance'      && <Finance />}
          {section === 'services'     && <Services />}
          {section === 'analytics'    && <Reports />}
          {section === 'sales'        && <Pipeline />}
          {section === 'contracts'    && <Contracts />}
        </div>

      </div>
    </div>
  );
}