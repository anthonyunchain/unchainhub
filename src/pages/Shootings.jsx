import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Trash2, MapPin, Clock, Camera, Users, ImagePlus, X, Loader2,
  ChevronDown, CheckCircle2, XCircle, Calendar as CalendarIcon, Clapperboard, Link2
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, startOfDay, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";

const STATUS_CONFIG = {
  Planned:   { color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  Confirmed: { color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  Completed: { color: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  Cancelled: { color: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

const STATUSES = ["Planned", "Confirmed", "Completed", "Cancelled"];

const ASSIGNMENT_STATUS = {
  Pending:  "bg-amber-100 text-amber-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Declined: "bg-red-100 text-red-600",
};

const emptyForm = {
  title: "", client_name: "", date: "", time: "", location: "",
  status: "Planned", description: "", gear: "", notes: "", images: [],
  assignments: [], content_ids: [],
};

export default function Shootings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterClient, setFilterClient] = useState("all");
  const [view, setView] = useState("timeline");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const qc = useQueryClient();

  const { data: shootings = [] } = useQuery({
    queryKey: ["shootings"],
    queryFn: () => base44.entities.Shooting.list("-date"),
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["shooting-assignments"],
    queryFn: () => base44.entities.ShootingAssignment.list(),
  });
  const { data: contentLinks = [] } = useQuery({
    queryKey: ["shooting-content"],
    queryFn: () => base44.entities.ShootingContent.list(),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
  });
  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: () => base44.entities.Freelancer.list(),
  });
  const { data: editorial = [] } = useQuery({
    queryKey: ["editorial"],
    queryFn: () => base44.entities.EditorialContent.list(),
  });

  // Enrich shootings with assignments and content
  const enriched = shootings.map(s => ({
    ...s,
    assignments: assignments.filter(a => a.shooting_id === s.id),
    content_ids: contentLinks.filter(c => c.shooting_id === s.id).map(c => c.content_id),
    contentItems: contentLinks
      .filter(c => c.shooting_id === s.id)
      .map(c => editorial.find(e => e.id === c.content_id))
      .filter(Boolean),
  }));

  const filtered = enriched
    .filter(s => {
      if (filterStatus === "active") return s.status !== "Completed" && s.status !== "Cancelled";
      if (filterStatus === "all") return true;
      return s.status === filterStatus;
    })
    .filter(s => filterClient === "all" || s.client_name === filterClient)
    .sort((a, b) => {
      if (a.date && b.date) return new Date(a.date) - new Date(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });

  const shootingClients = [...new Set(shootings.map(s => s.client_name).filter(Boolean))];

  // ── CRUD ──
  const openNew = () => { setForm({ ...emptyForm }); setEditId(null); setDialogOpen(true); };
  const openEdit = (s) => {
    setForm({
      title: s.title || "", client_name: s.client_name || "", date: s.date || "",
      time: s.time || "", location: s.location || "", status: s.status || "Planned",
      description: s.description || "", gear: s.gear || "", notes: s.notes || "",
      images: s.images || [],
      assignments: s.assignments.map(a => ({ freelancer_id: a.freelancer_id, freelancer_name: a.freelancer_name, role: a.role || "" })),
      content_ids: s.content_ids || [],
    });
    setEditId(s.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        client_name: form.client_name || null,
        date: form.date || null,
        time: form.time || null,
        location: form.location || null,
        status: form.status,
        description: form.description || null,
        gear: form.gear || null,
        notes: form.notes || null,
        images: form.images || [],
      };

      let shootingId = editId;
      if (editId) {
        await base44.entities.Shooting.update(editId, payload);
      } else {
        const created = await base44.entities.Shooting.create(payload);
        shootingId = created.id;
      }

      // Sync assignments
      if (editId) {
        const existing = assignments.filter(a => a.shooting_id === editId);
        for (const ea of existing) {
          if (!form.assignments.some(fa => fa.freelancer_id === ea.freelancer_id)) {
            await base44.entities.ShootingAssignment.delete(ea.id);
          }
        }
        for (const fa of form.assignments) {
          if (!existing.some(ea => ea.freelancer_id === fa.freelancer_id)) {
            await base44.entities.ShootingAssignment.create({
              shooting_id: shootingId, freelancer_id: fa.freelancer_id,
              freelancer_name: fa.freelancer_name, role: fa.role || null, status: "Pending",
            });
          }
        }
      } else {
        for (const fa of form.assignments) {
          await base44.entities.ShootingAssignment.create({
            shooting_id: shootingId, freelancer_id: fa.freelancer_id,
            freelancer_name: fa.freelancer_name, role: fa.role || null, status: "Pending",
          });
        }
      }

      // Sync content links
      if (editId) {
        const existingLinks = contentLinks.filter(c => c.shooting_id === editId);
        for (const el of existingLinks) {
          if (!form.content_ids.includes(el.content_id)) {
            await base44.entities.ShootingContent.delete(el.id);
          }
        }
        for (const cid of form.content_ids) {
          if (!existingLinks.some(el => el.content_id === cid)) {
            await base44.entities.ShootingContent.create({ shooting_id: shootingId, content_id: cid });
          }
        }
      } else {
        for (const cid of form.content_ids) {
          await base44.entities.ShootingContent.create({ shooting_id: shootingId, content_id: cid });
        }
      }

      qc.invalidateQueries({ queryKey: ["shootings"] });
      qc.invalidateQueries({ queryKey: ["shooting-assignments"] });
      qc.invalidateQueries({ queryKey: ["shooting-content"] });
      setDialogOpen(false);
    } catch (e) {
      alert("Error: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await base44.entities.Shooting.delete(deleteConfirm);
      qc.invalidateQueries({ queryKey: ["shootings"] });
      qc.invalidateQueries({ queryKey: ["shooting-assignments"] });
      qc.invalidateQueries({ queryKey: ["shooting-content"] });
    } catch (e) { alert("Error: " + (e?.message || e)); }
    setDeleteConfirm(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, images: [...(f.images || []), res.file_url] }));
    } catch (err) { alert("Upload failed: " + (err?.message || err)); }
    finally { setUploadingImg(false); e.target.value = ""; }
  };

  const addAssignment = (freelancerId) => {
    if (form.assignments.some(a => a.freelancer_id === freelancerId)) return;
    const f = freelancers.find(fl => fl.id === freelancerId);
    setForm(prev => ({ ...prev, assignments: [...prev.assignments, { freelancer_id: freelancerId, freelancer_name: f?.name || "", role: "" }] }));
  };

  const removeAssignment = (idx) => setForm(f => ({ ...f, assignments: f.assignments.filter((_, i) => i !== idx) }));
  const setAssignmentRole = (idx, role) => setForm(f => ({ ...f, assignments: f.assignments.map((a, i) => i === idx ? { ...a, role } : a) }));

  const toggleContent = (contentId) => {
    setForm(f => ({
      ...f,
      content_ids: f.content_ids.includes(contentId)
        ? f.content_ids.filter(id => id !== contentId)
        : [...f.content_ids, contentId],
    }));
  };

  // Editorial content filtered by selected client
  const clientContent = editorial.filter(e => !form.client_name || e.client_name === form.client_name);

  // ── Date badge ──
  const dateBadge = (s) => {
    if (!s.date) return null;
    const d = startOfDay(parseISO(s.date));
    if (s.status === "Completed" || s.status === "Cancelled") return null;
    if (isToday(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Today</span>;
    if (isPast(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Past</span>;
    if (isTomorrow(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">Tomorrow</span>;
    return null;
  };

  // ── Group by month for timeline ──
  const grouped = {};
  filtered.forEach(s => {
    const key = s.date ? format(parseISO(s.date), "yyyy-MM") : "no-date";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });
  const monthKeys = Object.keys(grouped).sort();

  return (
    <div className="mx-auto px-4 md:px-6" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Shootings" subtitle="Organize photo & video shoots">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New shooting
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 bg-white border border-slate-100 rounded-lg p-1 shadow-sm">
          {["timeline", "list"].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${view === v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {shootingClients.length > 0 && (
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {shootingClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} shooting{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Camera className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No shootings</p>
        </div>
      ) : view === "timeline" ? (
        /* ── TIMELINE VIEW ── */
        <div className="space-y-8">
          {monthKeys.map(mk => (
            <div key={mk}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {mk === "no-date" ? "No date" : format(parseISO(mk + "-01"), "MMMM yyyy", { locale: enUS })}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {grouped[mk].map(s => {
                  const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.Planned;
                  return (
                    <div key={s.id} onClick={() => openEdit(s)}
                      className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm hover:border-slate-200 transition-all cursor-pointer group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{s.status}</span>
                            {dateBadge(s)}
                            {s.client_name && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{s.client_name}</span>}
                          </div>
                          <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirm(s.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {s.date && <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{format(parseISO(s.date), "d MMM", { locale: enUS })}{s.time ? ` · ${s.time}` : ""}</span>}
                        {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                      </div>
                      {s.gear && <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><Clapperboard className="w-3 h-3 shrink-0" />{s.gear}</p>}
                      {/* Freelancers */}
                      {s.assignments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {s.assignments.map(a => (
                            <span key={a.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ASSIGNMENT_STATUS[a.status] || "bg-slate-100 text-slate-500"}`}>
                              {a.freelancer_name}{a.role ? ` · ${a.role}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Content count */}
                      {s.contentItems.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />{s.contentItems.length} content{s.contentItems.length > 1 ? "s" : ""} linked
                        </p>
                      )}
                      {/* Image previews */}
                      {(s.images || []).length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {s.images.slice(0, 4).map((url, i) => (
                            <img key={i} src={url} alt="" className="w-10 h-10 rounded-md object-cover border border-slate-200" />
                          ))}
                          {s.images.length > 4 && <span className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-medium">+{s.images.length - 4}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Shooting</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Location</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Crew</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.Planned;
                return (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => openEdit(s)}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{s.title}</p>
                      {s.gear && <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{s.gear}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.client_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {s.date ? format(parseISO(s.date), "d MMM yyyy", { locale: enUS }) : "—"}
                      {s.time && <span className="text-slate-400 ml-1">{s.time}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.location || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.assignments.map(a => (
                          <span key={a.id} className={`text-[9px] px-1.5 py-0.5 rounded-full ${ASSIGNMENT_STATUS[a.status] || "bg-slate-100 text-slate-500"}`}>
                            {a.freelancer_name}
                          </span>
                        ))}
                        {s.assignments.length === 0 && <span className="text-xs text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{s.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CREATE / EDIT DIALOG ── */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="!max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Shooting" : "New Shooting"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Shooting name..." /></div>
              <div><Label>Client</Label>
                <Select value={form.client_name || "_none"} onValueChange={v => setForm(f => ({ ...f, client_name: v === "_none" ? "" : v, content_ids: [] }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>Time</Label><Input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="14:00" /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {/* Location + Gear */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Location</Label><Input value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Studio, outdoor, address..." /></div>
              <div><Label>Gear required</Label><Input value={form.gear || ""} onChange={e => setForm(f => ({ ...f, gear: e.target.value }))} placeholder="Drone, flash, gimbal..." /></div>
            </div>
            {/* Description */}
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>Notes</Label><Input value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." /></div>

            {/* ── Crew assignments ── */}
            <div>
              <Label>Crew</Label>
              <div className="space-y-2 mt-1.5">
                {form.assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                    <span className="text-sm font-medium text-slate-700 flex-1">{a.freelancer_name}</span>
                    <Input value={a.role} onChange={e => setAssignmentRole(i, e.target.value)} placeholder="Role (e.g. Photographer)" className="h-7 text-xs w-40" />
                    <button onClick={() => removeAssignment(i)} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <Select value="_add" onValueChange={v => { if (v !== "_add") addAssignment(v); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Add freelancer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_add" disabled>+ Add freelancer</SelectItem>
                    {freelancers.filter(f => !form.assignments.some(a => a.freelancer_id === f.id)).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Linked content ── */}
            {form.client_name && clientContent.length > 0 && (
              <div>
                <Label>Linked content ({form.content_ids.length})</Label>
                <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-lg mt-1.5 divide-y divide-slate-100">
                  {clientContent.map(c => {
                    const selected = form.content_ids.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleContent(c.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-brand border-brand text-white" : "border-slate-300"}`}>
                          {selected && <CheckCircle2 className="w-3 h-3" />}
                        </span>
                        <span className="flex-1 truncate font-medium text-slate-700">{c.title || "Untitled"}</span>
                        <span className="text-[10px] text-slate-400">{c.post_type}</span>
                        {c.scheduled_date && <span className="text-[10px] text-slate-400">{format(parseISO(c.scheduled_date), "d MMM", { locale: enUS })}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Images ── */}
            <div>
              <Label>Images</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {(form.images || []).map((url, i) => (
                  <div key={i} className="relative group">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-20 h-20 rounded-lg border border-slate-200 object-cover hover:opacity-90" />
                    </a>
                    <button type="button" onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-colors ${uploadingImg ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploadingImg ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <ImagePlus className="w-5 h-5 text-slate-400" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-2">
              {editId && (
                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { setDialogOpen(false); setDeleteConfirm(editId); }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              )}
              <div className={`flex gap-2 ${editId ? "" : "ml-auto"}`}>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!form.title || loading}>
                  {loading ? "Saving..." : (editId ? "Save" : "Create")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this shooting?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will also remove all crew assignments and content links.</p>
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button onClick={doDelete} className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
