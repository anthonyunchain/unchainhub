import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Upload, X, ExternalLink, Trash2, GripVertical, Settings2, Check, Users, UserPlus, Send, Eye, EyeOff, CalendarDays, Shield, User as UserIcon, Building2, RefreshCw, Copy, KeyRound, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import Invoices from "./Invoices";
import Finance from "./Finance";
import Services from "./Services";
import Reports from "./Reports";
import Pipeline from "./Pipeline";
import Contracts from "./Contracts";
import Ideas from "./Ideas";
import MonthlyBriefs from "../components/admin/MonthlyBriefs";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useAuth } from "@/lib/AuthContext";


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
  const [activeAssignee, setActiveAssignee] = useState("all");
  const qc = useQueryClient();

  const { data: tasks = [], error: tasksError } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_tasks").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }
  });

  const [mutError, setMutError] = useState(null);
  const onMutError = (e) => setMutError(e?.message || "Error saving task");

  const createMut = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase.from("admin_tasks").insert(d);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tasks"] }); setOpen(false); setMutError(null); },
    onError: onMutError,
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { error } = await supabase.from("admin_tasks").update(d).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tasks"] }); setOpen(false); setMutError(null); },
    onError: onMutError,
  });
  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("admin_tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tasks"] }),
    onError: onMutError,
  });

  const empty = { title: "", description: "", category: "Autre", status: "À faire", priority: "Normale", due_date: "", assigned_to: "", notes: "" };
  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (t) => { setData({ ...t }); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = () => { if (data?.id && confirm("Supprimer cette tâche ?")) { deleteMut.mutate(data.id); setOpen(false); } };

  const toggleStatus = (task) => {
    const next = task.status === "Terminé" ? "À faire" : "Terminé";
    updateMut.mutate({ id: task.id, d: { status: next } });
  };

  const STATUS_COLORS = { "À faire": "bg-slate-100 text-slate-600", "En cours": "bg-blue-50 text-blue-700", "Terminé": "bg-emerald-50 text-emerald-700", "Bloqué": "bg-red-50 text-red-700" };
  const STATUS_DOT = { "À faire": "bg-slate-400", "En cours": "bg-blue-500", "Terminé": "bg-emerald-500", "Bloqué": "bg-red-500" };
  const PRIORITY_LABEL = { "Basse": "Low", "Normale": "Normal", "Haute": "High", "Urgente": "Urgent" };
  const STATUS_LABEL = { "À faire": "To do", "En cours": "In progress", "Terminé": "Done", "Bloqué": "Blocked" };
  const STATUSES = ["À faire", "En cours", "Terminé", "Bloqué"];
  const countByStatus = (s) => tasks.filter((t) => t.status === s).length;
  const sortByUrgency = (arr) => [...arr].sort((a, b) => {
    if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const assignees = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))].sort();
  const filtered = tasks
    .filter(t => activeStatus === "all" || t.status === activeStatus)
    .filter(t => activeAssignee === "all" || t.assigned_to === activeAssignee);
  const pending = sortByUrgency(filtered.filter(t => t.status !== "Terminé"));
  const done = sortByUrgency(filtered.filter(t => t.status === "Terminé"));
  return (
    <div>
      <div className="max-w-2xl mx-auto mb-6">
        <PageHeader title="Admin Tasks" subtitle="Governance & operations">
          <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />New task</Button>
        </PageHeader>
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap max-w-2xl mx-auto">
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
      {assignees.length > 0 && (
        <div className="hidden md:flex items-center gap-2 mb-6 flex-wrap max-w-2xl mx-auto">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mr-1">Assigné</span>
          <button
            onClick={() => setActiveAssignee("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeAssignee === "all" ? "bg-violet-600 text-white" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
            <UserIcon className="w-3 h-3" />Tous
          </button>
          {assignees.map(a => (
            <button
              key={a}
              onClick={() => setActiveAssignee(a)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeAssignee === a ? "bg-violet-50 text-violet-700 ring-1 ring-violet-300" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
              <UserIcon className="w-3 h-3" />{a}
              <span className="text-xs opacity-60">{tasks.filter(t => t.assigned_to === a).length}</span>
            </button>
          ))}
        </div>
      )}
      {assignees.length === 0 && <div className="mb-6" />}
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
                {t.assigned_to && <span className="text-[10px] text-violet-500 flex items-center gap-0.5"><UserIcon className="w-2.5 h-2.5" />{t.assigned_to}</span>}
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
              {mutError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{mutError}</p>}
              <div className="flex justify-between items-center pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setOpen(false); setMutError(null); }}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title || createMut.isPending || updateMut.isPending}>
                    {createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
                  </Button>
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

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────
function UserManagement() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "user", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", client_id: "" });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const activeClients = clients.filter(c => c.status === "Actif").sort((a, b) => a.company_name?.localeCompare(b.company_name));

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const openInvite = () => {
    setInviteForm({ email: "", client_id: "" });
    setInviteMsg("");
    setInvitePassword(generatePassword());
    setInviteOpen(true);
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.client_id) return;
    const client = clients.find(c => c.id === inviteForm.client_id);
    setInviting(true);
    setInviteMsg("");
    try {
      const { data } = await base44.functions.invoke('setClientPassword', {
        email: inviteForm.email, company_name: client?.company_name, client_id: inviteForm.client_id, password: invitePassword,
      });
      if (data?.error) {
        setInviteMsg("Error: " + data.error);
      } else {
        const confirmedPassword = data?.password || invitePassword;
        setInviteMsg(`✓ Account created.\n📧 ${inviteForm.email}\n🔑 ${confirmedPassword}`);
        qc.invalidateQueries({ queryKey: ["profiles"] });
      }
    } catch (e) {
      setInviteMsg("Error: " + (e?.message || "Unknown error"));
    } finally {
      setInviting(false);
    }
  };

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openNew = () => {
    setForm({ email: "", full_name: "", role: "user", password: "" });
    setError(null);
    setSuccess(null);
    setOpen(true);
  };

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);
    if (!form.email || !form.password) { setError("Email et mot de passe requis."); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnError } = await supabase.functions.invoke("createUser", {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (fnError) {
        let msg = fnError.message || "Erreur lors de la création.";
        try { const json = await fnError.context?.json(); if (json?.error) msg = json.error; } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setSuccess("Utilisateur créé avec succès.");
      qc.invalidateQueries({ queryKey: ["profiles"] });
      setForm({ email: "", full_name: "", role: "user", password: "" });
    } catch (e) {
      setError(e.message || "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  };

  const [deletingUserId, setDeletingUserId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [resetPwdUserId, setResetPwdUserId] = useState(null);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [settingPwd, setSettingPwd] = useState(false);
  const [resetPwdMsg, setResetPwdMsg] = useState(null);

  const handleDeleteUser = async (userId) => {
    setConfirmingDeleteId(null);
    setDeletingUserId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnError } = await supabase.functions.invoke("deleteUser", {
        body: { user_id: userId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (fnError) {
        let msg = fnError.message;
        try { const body = await fnError.context.json(); msg = body?.error || msg; } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (e) {
      alert("Error deleting user: " + (e.message || "Unknown error"));
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSetPassword = async () => {
    if (!resetPwdUserId || !resetPwdValue) return;
    setSettingPwd(true);
    setResetPwdMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnError } = await supabase.functions.invoke("setUserPassword", {
        body: { user_id: resetPwdUserId, password: resetPwdValue },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (fnError) {
        let msg = fnError.message;
        try { const body = await fnError.context.json(); msg = body?.error || msg; } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setResetPwdMsg({ ok: true, text: "Mot de passe mis à jour." });
    } catch (e) {
      setResetPwdMsg({ ok: false, text: e.message || "Erreur." });
    } finally {
      setSettingPwd(false);
    }
  };

  const ROLE_COLORS = { admin: "bg-violet-50 text-violet-700", user: "bg-blue-50 text-blue-700", freelancer: "bg-amber-50 text-amber-700" };

  return (
    <div>
      <PageHeader title="Users" subtitle="Governance & operations">
        <Button variant="outline" onClick={openInvite} className="h-9">
          <UserPlus className="w-4 h-4 mr-1" />New client profile
        </Button>
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" />New user
        </Button>
      </PageHeader>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Name</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Role</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">ID</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400">Loading...</td></tr>
            )}
            {!isLoading && profiles.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400">No users found</td></tr>
            )}
            {profiles.map(p => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{p.full_name || "—"}</p>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[p.role] || "bg-slate-100 text-slate-600"}`}>
                    {p.role || "user"}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-slate-400 font-mono">{p.id}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => { setResetPwdUserId(p.id); setResetPwdValue(""); setShowResetPwd(false); setResetPwdMsg(null); }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors mr-1"
                    title="Reset password"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  {confirmingDeleteId === p.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteUser(p.id)}
                        disabled={deletingUserId === p.id}
                        className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                      >
                        {deletingUserId === p.id ? "Deleting…" : "Confirm"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDeleteId(p.id)}
                      disabled={deletingUserId === p.id}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteMsg(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-500" />Client portal access</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-500">Create an account with a password directly. Share it with the client via SMS or in person. Works even if the email is already registered.</p>
            <div>
              <Label>Client *</Label>
              <Select value={inviteForm.client_id} onValueChange={v => setInviteForm({ ...inviteForm, client_id: v, email: clients.find(c => c.id === v)?.contact_email || inviteForm.email })}>
                <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
                <SelectContent>
                  {activeClients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="client@company.com" />
            </div>
            <div>
              <Label>Password</Label>
              <div className="flex gap-2 mt-1">
                <Input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setInvitePassword(generatePassword())} title="Regenerate">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(invitePassword)} title="Copy">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {inviteMsg && (
              <div className={`text-sm px-3 py-2 rounded-lg ${inviteMsg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                {inviteMsg.split('\n').map((line, i) => <p key={i} className="font-mono">{line}</p>)}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={inviting || !inviteForm.email || !inviteForm.client_id || !invitePassword} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                <KeyRound className="w-4 h-4 mr-1.5" />{inviting ? "Creating..." : "Create account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPwdUserId} onOpenChange={(o) => { if (!o) { setResetPwdUserId(null); setResetPwdMsg(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-blue-500" />Reset password</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-slate-400 font-mono">{resetPwdUserId}</p>
            <div>
              <Label>New password *</Label>
              <div className="relative mt-1">
                <Input
                  type={showResetPwd ? "text" : "password"}
                  value={resetPwdValue}
                  onChange={e => setResetPwdValue(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showResetPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {resetPwdMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${resetPwdMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {resetPwdMsg.text}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setResetPwdUserId(null); setResetPwdMsg(null); }}>Close</Button>
              <Button
                onClick={handleSetPassword}
                disabled={settingPwd || !resetPwdValue}
                className="bg-brand hover:bg-brand/90 text-brand-foreground"
              >
                {settingPwd ? "Saving…" : "Update password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New user</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Password *</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{success}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                className="bg-brand hover:bg-brand/90 text-brand-foreground"
                disabled={saving || !form.email || !form.password}
              >
                {saving ? "Creating..." : "Create user"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
const SUBSCRIPTION_CATEGORIES = ["Design", "Dev", "Marketing", "Productivity", "Finance", "Communication", "Storage", "Other"];
const SUBSCRIPTION_STATUSES = ["Actif", "Pausé", "Annulé"];
const STATUS_COLORS_SUB = { "Actif": "bg-emerald-50 text-emerald-700", "Pausé": "bg-amber-50 text-amber-700", "Annulé": "bg-slate-100 text-slate-500" };
const EMPTY_SUB = { name: "", amount: 0, category: "Other", renewal_date: "", status: "Actif", notes: "" };

function Subscriptions() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const qc = useQueryClient();

  const { data: subs = [] } = useQuery({ queryKey: ["subscriptions"], queryFn: () => base44.entities.Subscription.list() });

  const createMut = useMutation({ mutationFn: d => base44.entities.Subscription.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setOpen(false); }, onError: e => alert("Error: " + e.message) });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Subscription.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setOpen(false); }, onError: e => alert("Error: " + e.message) });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.Subscription.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setOpen(false); } });

  const openNew = () => { setData({ ...EMPTY_SUB }); setOpen(true); };
  const openEdit = s => { setData({ ...s }); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);

  const activeSubs = subs.filter(s => s.status === "Actif");
  const totalMonthly = activeSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalAnnual = totalMonthly * 12;

  const byCategory = SUBSCRIPTION_CATEGORIES.filter(cat => activeSubs.some(s => s.category === cat));

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Recurring expenses & tools">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />Add subscription</Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase">Monthly total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalMonthly.toLocaleString("fr-FR")} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase">Annual total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalAnnual.toLocaleString("fr-FR")} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase">Active subs</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeSubs.length}</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Renewal</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No subscriptions yet</td></tr>}
            {subs.map(s => (
              <tr key={s.id} onClick={() => openEdit(s)} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer">
                <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="px-5 py-3 text-slate-500">{s.category}</td>
                <td className="px-5 py-3 text-slate-500">{s.renewal_date ? format(new Date(s.renewal_date), "d MMM yyyy", { locale: enUS }) : "—"}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS_SUB[s.status] || "bg-slate-100 text-slate-600"}`}>{s.status}</span></td>
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{(s.amount || 0).toLocaleString("fr-FR")} €</td>
              </tr>
            ))}
            {activeSubs.length > 0 && (
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Total actif</td>
                <td className="px-5 py-3 text-right font-bold text-slate-900">{totalMonthly.toLocaleString("fr-FR")} € / mo</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{data?.id ? "Edit subscription" : "Add subscription"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-3 mt-2">
              <div><Label>Name</Label><Input value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Notion, Figma..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Monthly amount (€)</Label><Input type="number" value={data.amount || ""} onChange={e => setData(d => ({ ...d, amount: Number(e.target.value) }))} /></div>
                <div><Label>Renewal date</Label><Input type="date" value={data.renewal_date || ""} onChange={e => setData(d => ({ ...d, renewal_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={data.category} onValueChange={v => setData(d => ({ ...d, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBSCRIPTION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={data.status} onValueChange={v => setData(d => ({ ...d, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBSCRIPTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={data.notes || ""} onChange={e => setData(d => ({ ...d, notes: e.target.value }))} rows={2} /></div>
              <div className="flex justify-between pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => deleteMut.mutate(data.id)}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
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

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────
const FREELANCER_PERMISSIONS = [
  { key: 'ideas_access', label: 'Ideas', icon: Shield, description: 'Access to the brainstorm ideas board' },
];

const CLIENT_PERMISSIONS = [
  { key: 'editorial_visible', label: 'Calendar visible to freelancers', icon: CalendarDays, description: 'Freelancers can view this client\'s editorial calendar' },
];

function PermissionToggle({ enabled, onClick, label, icon: Icon, description }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left w-full ${
        enabled
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${enabled ? 'bg-emerald-100' : 'bg-slate-100'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}>{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{description}</p>
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${enabled ? 'bg-emerald-100' : 'bg-slate-100'}`}>
        {enabled ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
      </div>
    </button>
  );
}

function Permissions() {
  const qc = useQueryClient();
  const { data: freelancers = [], isLoading: loadingFL } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });
  const { data: clients = [], isLoading: loadingCL } = useQuery({ queryKey: ["clients-perm"], queryFn: () => base44.entities.Client.list() });

  const activeClients = [...clients].filter(c => c.status === 'Actif').sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));

  const updateFreelancer = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Freelancer.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["freelancers"] }),
  });

  const updateClient = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Client.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients-perm"] }),
  });

  const toggleClientAccess = (freelancer, clientName) => {
    const current = freelancer.editorial_client_names || [];
    const updated = current.includes(clientName)
      ? current.filter(n => n !== clientName)
      : [...current, clientName];
    updateFreelancer.mutate({ id: freelancer.id, d: { ...freelancer, editorial_client_names: updated } });
  };

  const toggleClientPerm = (client, key) => {
    updateClient.mutate({ id: client.id, d: { ...client, [key]: !client[key] } });
  };

  if (loadingFL || loadingCL) return <div className="text-center py-16 text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Freelancers */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Freelancers</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{freelancers.length}</span>
        </div>

        {freelancers.length === 0 && <p className="text-sm text-slate-400">No freelancers found.</p>}

        <div className="space-y-3">
          {freelancers.map(fl => {
            const calendarClients = fl.editorial_client_names || [];
            return (
              <div key={fl.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{fl.name || '—'}</p>
                    <p className="text-xs text-slate-400">{fl.email}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-slate-300" />
                    <span className="text-xs text-slate-400">{calendarClients.length} calendar{calendarClients.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Calendar access per client */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3" /> Calendar access per client
                  </p>
                  {activeClients.length === 0 && <p className="text-xs text-slate-300 italic">No active clients</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeClients.map(client => {
                      const hasAccess = calendarClients.includes(client.company_name);
                      return (
                        <button
                          key={client.id}
                          onClick={() => toggleClientAccess(fl, client.company_name)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                            hasAccess
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${hasAccess ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            <Building2 className={`w-3.5 h-3.5 ${hasAccess ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </div>
                          <span className={`text-xs font-medium flex-1 truncate ${hasAccess ? 'text-emerald-700' : 'text-slate-500'}`}>{client.company_name}</span>
                          {hasAccess
                            ? <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            : <EyeOff className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          }
                        </button>
                      );
                    })}
                  </div>

                  {/* Feature permissions */}
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5">
                    <Shield className="w-3 h-3" /> Feature access
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FREELANCER_PERMISSIONS.map(perm => (
                      <PermissionToggle
                        key={perm.key}
                        enabled={!!fl[perm.key]}
                        onClick={() => updateFreelancer.mutate({ id: fl.id, d: { ...fl, [perm.key]: !fl[perm.key] } })}
                        label={perm.label}
                        icon={perm.icon}
                        description={perm.description}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clients */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Clients</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{activeClients.length}</span>
        </div>

        {activeClients.length === 0 && <p className="text-sm text-slate-400">No active clients.</p>}

        <div className="space-y-2">
          {activeClients.map(client => (
            <div key={client.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">{client.company_name}</p>
                <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full ml-auto">{client.sector}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {CLIENT_PERMISSIONS.map(perm => (
                  <PermissionToggle
                    key={perm.key}
                    enabled={!!client[perm.key]}
                    onClick={() => toggleClientPerm(client, perm.key)}
                    label={perm.label}
                    icon={perm.icon}
                    description={perm.description}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  "Software", "Hardware", "Office", "Travel", "Meals", "Marketing", "Legal", "Accounting", "Other",
];

const EMPTY_EXPENSE = {
  date: format(new Date(), "yyyy-MM-dd"),
  description: "",
  category: "Other",
  amount: "",
  receipt_url: "",
  notes: "",
};

function AdminExpenses() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [mutError, setMutError] = useState(null);
  const [filterMonth, setFilterMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [filterCat, setFilterCat] = useState("all");
  const qc = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const { id, ...rest } = d;
      const { error } = await supabase.from("expenses").insert({ ...rest, amount: parseFloat(rest.amount) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setOpen(false); setMutError(null); },
    onError: (e) => setMutError(e.message),
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { id: _id, created_at, ...rest } = d;
      const { error } = await supabase.from("expenses").update({ ...rest, amount: parseFloat(rest.amount) || 0 }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setOpen(false); setMutError(null); },
    onError: (e) => setMutError(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setOpen(false); },
    onError: (e) => setMutError(e.message),
  });

  const openNew = () => { setData({ ...EMPTY_EXPENSE }); setMutError(null); setOpen(true); };
  const openEdit = (e) => { setData({ ...e }); setMutError(null); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);

  // All months from Feb 2025 to current month
  const allMonths = (() => {
    const months = [];
    const start = new Date(2025, 1, 1); // Feb 2025
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let d = new Date(end); d >= start; d.setMonth(d.getMonth() - 1)) {
      months.push(format(new Date(d), 'yyyy-MM'));
    }
    return months;
  })();

  const filtered = expenses.filter(e => {
    if (filterCat !== "all" && e.category !== filterCat) return false;
    if (filterMonth && !e.date?.startsWith(filterMonth)) return false;
    return true;
  });

  const total = filtered.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: filtered.filter(e => e.category === cat).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
  })).filter(x => x.total > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Expenses</h2>
          <p className="text-sm text-slate-400 mt-0.5">Company receipts & operational costs</p>
        </div>
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> Add expense
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-400 mb-1">Total</p>
          <p className="text-2xl font-bold text-slate-800">{total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </div>
        {byCategory.slice(0, 3).map(({ cat, total: t }) => (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-1">{cat}</p>
            <p className="text-lg font-semibold text-slate-700">{t.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Month navigator */}
        {(() => {
          const idx = allMonths.indexOf(filterMonth);
          const current = filterMonth || allMonths[0];
          const label = format(new Date(current + '-01'), 'MMMM yyyy', { locale: enUS });
          const canPrev = idx < allMonths.length - 1;
          const canNext = idx > 0;
          return (
            <div className="inline-flex self-start items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => canPrev && setFilterMonth(allMonths[idx + 1])}
                disabled={!canPrev}
                className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-r border-slate-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 capitalize whitespace-nowrap text-center" style={{ width: 130 }}>
                {label}
              </span>
              <button
                onClick={() => canNext && setFilterMonth(allMonths[idx - 1])}
                disabled={!canNext}
                className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })()}
        {/* Category filter */}
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="h-8 text-xs px-3 rounded-lg border border-slate-200 bg-white text-slate-700">
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {filterCat !== "all" && (
            <button onClick={() => setFilterCat("all")}
              className="h-8 px-3 text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg bg-white">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400 mb-3">No expenses yet</p>
            <button onClick={openNew} className="text-sm text-brand hover:underline font-medium">+ Add first expense</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Description</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Category</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-400">Amount</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-400">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(e => (
                <tr key={e.id} onClick={() => openEdit(e)} className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                    {e.date ? format(new Date(e.date), "d MMM yyyy", { locale: enUS }) : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-slate-800">{e.description || "—"}</p>
                    {e.notes && <p className="text-xs text-slate-400 truncate max-w-[200px]">{e.notes}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">{e.category || "—"}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                    {(parseFloat(e.amount) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {e.receipt_url
                      ? <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="text-brand hover:text-brand/80">
                          <ExternalLink className="w-4 h-4 inline" />
                        </a>
                      : <span className="text-slate-200">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setMutError(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{data?.id ? "Edit expense" : "New expense"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={data.date || ""} onChange={e => setData({ ...data, date: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={data.category} onValueChange={v => setData({ ...data, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Input value={data.description || ""} onChange={e => setData({ ...data, description: e.target.value })} placeholder="e.g. Figma subscription" />
              </div>

              <div>
                <Label>Amount (€)</Label>
                <Input type="number" value={data.amount || ""} placeholder="0.00"
                  onChange={e => setData({ ...data, amount: e.target.value })} />
              </div>

              <div>
                <Label>Receipt / PDF</Label>
                {data.receipt_url ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 mt-1">
                    <ExternalLink className="w-4 h-4 text-brand shrink-0" />
                    <a href={data.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex-1 truncate">
                      {decodeURIComponent(data.receipt_url.split("/").pop().split("?")[0])}
                    </a>
                    <button onClick={() => setData({ ...data, receipt_url: "" })} className="text-slate-300 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand border border-dashed border-slate-200 rounded-lg px-4 py-2.5 w-full justify-center hover:border-brand/40 transition-colors mt-1">
                    <Upload className="w-4 h-4" /> Attach receipt
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      setData(d => ({ ...d, receipt_url: file_url }));
                      e.target.value = "";
                    }} />
                  </label>
                )}
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} placeholder="Additional details…" />
              </div>

              {mutError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{mutError}</p>}

              <div className="flex justify-between items-center pt-2">
                {data.id
                  ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => { if (confirm("Delete this expense?")) deleteMut.mutate(data.id); }}>
                      <Trash2 className="w-4 h-4 mr-1" />Delete
                    </Button>
                  : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground"
                    disabled={!data.description || createMut.isPending || updateMut.isPending}>
                    {createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
                  </Button>
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
  { id: 'tasks',         label: 'Admin Tasks' },
  { id: 'briefs',        label: 'Monthly Briefs' },
  { id: 'ideas',         label: 'Ideas' },
  { id: 'analytics',     label: 'Analytics' },
  { id: 'sales',         label: 'Pipeline' },
  { id: 'finance',       label: 'Finance' },
  { id: 'expenses',      label: 'Expenses' },
  { id: 'services',      label: 'Services' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'invoices',      label: 'Invoices' },
  { id: 'salaries',      label: 'Salaries' },
  { id: 'contracts',     label: 'Contracts' },
  { id: 'meetings',      label: 'Board Meetings' },
  { id: 'legal',         label: 'Legal Docs' },
  { id: 'shareholders',  label: 'Shareholders' },
  { id: 'users',         label: 'Users' },
  { id: 'permissions',   label: 'Permissions' },
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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState(searchParams.get('s') || 'tasks');
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
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
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
                  {/* Mobile: dropdown */}
                  <div className="md:hidden p-3">
                    <Select value={section} onValueChange={setSection}>
                      <SelectTrigger className="w-full h-11 text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {navItems.map(item => (
                          <SelectItem key={item.id} value={item.id} className="text-sm py-2.5">
                            {item.label}{badges[item.id] ? ` · ${badges[item.id]}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
          {section === 'subscriptions' && <Subscriptions />}
          {section === 'invoices'     && <Invoices />}
          {section === 'finance'      && <Finance />}
          {section === 'expenses'     && <AdminExpenses />}
          {section === 'services'     && <Services />}
          {section === 'analytics'    && <Reports />}
          {section === 'sales'        && <Pipeline />}
          {section === 'contracts'    && <Contracts />}
          {section === 'users'        && <UserManagement />}
          {section === 'permissions'  && <Permissions />}
          {section === 'ideas'        && <Ideas currentUserId={user?.id} currentUserName={user?.full_name || user?.email} />}
          {section === 'briefs'       && <MonthlyBriefs />}
        </div>

      </div>
    </div>
  );
}