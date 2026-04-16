import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { Plus, RotateCcw, CheckCircle2, RefreshCw, Trash2, ImagePlus, X, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Real columns: id, title, status, client_name, description, notes,
//               freelancer_id, freelancer_name, created_at, updated_at

const STATUS_CONFIG = {
  "Unassigned":         { color: "bg-slate-100 text-slate-500", order: 0 },
  "Pending acceptance": { color: "bg-amber-100 text-amber-700", order: 1 },
  "Accepted":           { color: "bg-blue-100 text-blue-700", order: 2 },
  "In progress":        { color: "bg-indigo-100 text-indigo-700", order: 3 },
  "Delivered":          { color: "bg-violet-100 text-violet-700", order: 4 },
  "Revision requested": { color: "bg-red-100 text-red-700", order: 5 },
  "Completed":          { color: "bg-emerald-100 text-emerald-700", order: 6 },
};

const PIPELINE_STATUSES = ["Unassigned", "Pending acceptance", "Accepted", "In progress", "Delivered", "Completed"];

const emptyForm = { title: "", client_name: "", description: "", notes: "", freelancer_id: "", freelancer_name: "", url: "", images: [] };

export default function AdminProjects() {
  const [view, setView] = useState("list");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFreelancer, setFilterFreelancer] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(null);
  const [reassignOpen, setReassignOpen] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingEditImg, setUploadingEditImg] = useState(false);

  const uploadImage = async (e, setter, currentImages) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const flag = setter === setForm ? setUploadingImg : setUploadingEditImg;
    flag(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setter(prev => ({ ...prev, images: [...(prev.images || []), res.file_url] }));
    } catch (err) {
      alert("Upload failed: " + (err?.message || err));
    } finally {
      flag(false);
      e.target.value = "";
    }
  };

  const removeImage = (setter, idx) => {
    setter(prev => ({ ...prev, images: (prev.images || []).filter((_, i) => i !== idx) }));
  };

  const { data: projects = [], refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list(),
  });
  const { data: availableClients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
  });
  const { data: allFreelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: () => base44.entities.Freelancer.list(),
  });

  const filtered = projects
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => filterFreelancer === "all" || p.freelancer_id === filterFreelancer)
    .filter(p => filterClient === "all" || p.client_name === filterClient)
    .sort((a, b) => (STATUS_CONFIG[a.status]?.order ?? 0) - (STATUS_CONFIG[b.status]?.order ?? 0));

  const projectClientNames = [...new Set(projects.map(p => p.client_name).filter(Boolean))];

  const workload = allFreelancers.map(f => ({
    ...f,
    active: projects.filter(p => p.freelancer_id === f.id && !["Completed", "Unassigned"].includes(p.status)).length,
  }));

  const sendFreelancerNotif = async (freelancerId, title, message, type = 'message') => {
    if (!freelancerId) return;
    try {
      await supabase.from('notifications').insert({
        recipient_id: freelancerId,
        title,
        message,
        type,
        is_read: false,
        action_required: false,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to send freelancer notification:', e);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.client_name) return;
    try {
      setLoading(true);
      const payload = {
        title: form.title,
        client_name: form.client_name,
        status: form.freelancer_id ? "Pending acceptance" : "Unassigned",
        ...(form.description && { description: form.description }),
        ...(form.notes && { notes: form.notes }),
        ...(form.url && { url: form.url }),
        images: form.images || [],
        ...(form.freelancer_id && { freelancer_id: form.freelancer_id, freelancer_name: form.freelancer_name }),
      };
      await base44.entities.Project.create(payload);
      if (form.freelancer_id) {
        await sendFreelancerNotif(
          form.freelancer_id,
          `📋 New project: ${form.title}`,
          `You have been assigned the project "${form.title}"${form.client_name ? ` for ${form.client_name}` : ""}. Please review and accept or decline.`,
          'project_assigned'
        );
      }
      await refetch();
      setCreateOpen(false);
      setForm({ ...emptyForm });
    } catch (e) {
      alert("Error creating project: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (projectId, freelancerId, freelancerName) => {
    setLoading(true);
    try {
      const project = projects.find(p => p.id === projectId);
      await base44.entities.Project.update(projectId, { freelancer_id: freelancerId, freelancer_name: freelancerName, status: "Pending acceptance" });
      await sendFreelancerNotif(
        freelancerId,
        `📋 New project: ${project?.title || ""}`,
        `You have been assigned the project "${project?.title || ""}"${project?.client_name ? ` for ${project.client_name}` : ""}. Please review and accept or decline.`,
        'project_assigned'
      );
      refetch();
      setReassignOpen(null);
    } catch (e) {
      alert("Error assigning: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (projectId) => {
    try {
      const project = projects.find(p => p.id === projectId);
      await base44.entities.Project.update(projectId, { status: "Completed" });
      if (project?.freelancer_id) {
        await sendFreelancerNotif(
          project.freelancer_id,
          `🏆 Project completed: ${project.title}`,
          `Your project "${project.title}" has been marked as completed. Great work!`,
          'project_completed'
        );
      }
      refetch();
    } catch (e) {
      alert("Error: " + (e?.message || e));
    }
  };

  const handleRevision = async (projectId) => {
    try {
      const project = projects.find(p => p.id === projectId);
      await base44.entities.Project.update(projectId, { status: "Revision requested", notes: revisionNotes });
      if (project?.freelancer_id) {
        await sendFreelancerNotif(
          project.freelancer_id,
          `🔄 Revision requested: ${project.title}`,
          `A revision has been requested on "${project.title}".${revisionNotes ? ` Notes: ${revisionNotes}` : ""}`,
          'revision_requested'
        );
      }
      setRevisionOpen(null);
      setRevisionNotes("");
      refetch();
    } catch (e) {
      alert("Error: " + (e?.message || e));
    }
  };

  const handleDelete = (id) => setDeleteConfirmId(id);

  const doDelete = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await base44.functions.invoke('deleteProject', { projectId: id });
      refetch();
    } catch (e) {
      alert("Error deleting: " + (e?.message || e));
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject?.id) return;
    setLoading(true);
    try {
      const { id, created_at, updated_at, status, ...payload } = editingProject;
      await base44.entities.Project.update(id, payload);
      setEditingProject(null);
      refetch();
    } catch (e) {
      alert("Error updating: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      {/* Workload summary */}
      {workload.some(f => f.active > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {workload.filter(f => f.active > 0).map(f => (
            <div key={f.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs shadow-sm">
              <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-[9px]">{f.name?.charAt(0)}</div>
              <span className="font-medium text-slate-700">{f.name}</span>
              <span className="text-slate-400">·</span>
              <span className="font-semibold text-brand">{f.active} active</span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Button onClick={() => { setForm({ ...emptyForm }); setCreateOpen(true); }} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New project
        </Button>
        <div className="flex gap-1 bg-white border border-slate-100 rounded-lg p-1 shadow-sm ml-auto">
          {["list", "pipeline"].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${view === v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFreelancer} onValueChange={setFilterFreelancer}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Freelancer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All freelancers</SelectItem>
            {allFreelancers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {projectClientNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* PIPELINE VIEW */}
      {view === "pipeline" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STATUSES.map(status => {
            const cols = filtered.filter(p => p.status === status);
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className="shrink-0 w-60">
                <div className={`text-xs font-semibold px-2 py-1.5 rounded-t-lg mb-2 ${cfg.color}`}>
                  {status} <span className="opacity-60">({cols.length})</span>
                </div>
                <div className="space-y-2">
                  {cols.map(p => (
                    <div key={p.id} className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm text-xs">
                      <p className="font-semibold text-slate-800 mb-0.5">{p.title}</p>
                      <p className="text-slate-400">{p.client_name}</p>
                      {p.freelancer_name && <p className="text-slate-500 mt-1">👤 {p.freelancer_name}</p>}
                    </div>
                  ))}
                  {cols.length === 0 && <div className="text-xs text-slate-300 text-center py-4">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Project</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Freelancer</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">No projects found</td></tr>}
              {filtered.map(p => {
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG["Unassigned"];
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => setEditingProject({ ...p })}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{p.title}</p>
                      {p.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.client_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.freelancer_name || <span className="text-slate-300">Unassigned</span>}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                        {(p.status === "Unassigned" || p.status === "Pending acceptance") && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReassignOpen(p)}>
                            <RotateCcw className="w-3 h-3 mr-1" /> Assign
                          </Button>
                        )}
                        {p.status === "Delivered" && (
                          <>
                            <Button size="sm" className="h-7 text-xs bg-brand hover:bg-brand/90 text-brand-foreground" onClick={() => handleComplete(p.id)}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRevisionOpen(p)}>
                              <RefreshCw className="w-3 h-3 mr-1" /> Revision
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create project dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Client *</Label>
                <Select value={form.client_name || "_none"} onValueChange={v => setForm(f => ({ ...f, client_name: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Select —</SelectItem>
                    {availableClients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Assign to freelancer</Label>
              <Select value={form.freelancer_id || "_none"} onValueChange={v => {
                if (v === "_none") {
                  setForm(f => ({ ...f, freelancer_id: "", freelancer_name: "" }));
                } else {
                  const fl = allFreelancers.find(x => x.id === v);
                  setForm(f => ({ ...f, freelancer_id: v, freelancer_name: fl?.name || "" }));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="None (assign later)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None (assign later)</SelectItem>
                  {allFreelancers.map(fl => (
                    <SelectItem key={fl.id} value={fl.id}>
                      {fl.name} {fl.status === "Indisponible" ? "⚠️" : "✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div><Label>URL</Label><Input value={form.url || ""} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." /></div>
            {/* Images */}
            <div>
              <Label>Images</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {(form.images || []).map((url, i) => (
                  <div key={i} className="relative group">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-20 h-20 rounded-lg border border-slate-200 object-cover hover:opacity-90" />
                    </a>
                    <button type="button" onClick={() => removeImage(setForm, i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-colors ${uploadingImg ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploadingImg ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <ImagePlus className="w-5 h-5 text-slate-400" />}
                  <input type="file" accept="image/*" className="hidden" onChange={e => uploadImage(e, setForm)} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!form.title || !form.client_name || loading}>
                {loading ? "Creating..." : "Create project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign dialog */}
      <Dialog open={!!reassignOpen} onOpenChange={() => setReassignOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign: {reassignOpen?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            {allFreelancers.map(f => (
              <button key={f.id} onClick={() => handleAssign(reassignOpen.id, f.id, f.name)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 hover:border-brand/30 hover:bg-brand/5 transition-all text-left">
                <div>
                  <p className="text-sm font-medium text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.role || "Freelancer"}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === "Actif" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {f.status === "Actif" ? "Available" : "Unavailable"}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit project dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          {editingProject && (
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={editingProject.title || ""} onChange={e => setEditingProject(p => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Client</Label>
                  <Select value={editingProject.client_name || "_none"} onValueChange={v => setEditingProject(p => ({ ...p, client_name: v === "_none" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Select —</SelectItem>
                      {availableClients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Freelancer</Label>
                <Select value={editingProject.freelancer_id || "_none"} onValueChange={v => {
                  if (v === "_none") {
                    setEditingProject(p => ({ ...p, freelancer_id: "", freelancer_name: "" }));
                  } else {
                    const fl = allFreelancers.find(x => x.id === v);
                    setEditingProject(p => ({ ...p, freelancer_id: v, freelancer_name: fl?.name || "" }));
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {allFreelancers.map(fl => <SelectItem key={fl.id} value={fl.id}>{fl.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[editingProject.status]?.color || "bg-slate-100 text-slate-600"}`}>
                    {editingProject.status || "Unassigned"}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">Use the action buttons on the project card to change status.</p>
                </div>
              </div>
              <div><Label>Description</Label><Textarea value={editingProject.description || ""} onChange={e => setEditingProject(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
              <div><Label>URL</Label><Input value={editingProject.url || ""} onChange={e => setEditingProject(p => ({ ...p, url: e.target.value }))} placeholder="https://..." /></div>
              <div><Label>Notes</Label><Input value={editingProject.notes || ""} onChange={e => setEditingProject(p => ({ ...p, notes: e.target.value }))} /></div>
              {/* Images */}
              <div>
                <Label>Images</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {(editingProject.images || []).map((url, i) => (
                    <div key={i} className="relative group">
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="w-20 h-20 rounded-lg border border-slate-200 object-cover hover:opacity-90" />
                      </a>
                      <button type="button" onClick={() => removeImage(setEditingProject, i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-colors ${uploadingEditImg ? "opacity-50 pointer-events-none" : ""}`}>
                    {uploadingEditImg ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <ImagePlus className="w-5 h-5 text-slate-400" />}
                    <input type="file" accept="image/*" className="hidden" onChange={e => uploadImage(e, setEditingProject)} />
                  </label>
                </div>
              </div>
              {editingProject.delivery_url && (
                <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                  <p className="text-xs font-medium text-violet-700 mb-1">Delivery link</p>
                  <a href={editingProject.delivery_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 underline break-all hover:text-violet-800">{editingProject.delivery_url}</a>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { setEditingProject(null); handleDelete(editingProject.id); }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
                  <Button onClick={handleUpdateProject} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={loading}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this project?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This action is irreversible.</p>
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button onClick={doDelete} className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revision dialog */}
      <Dialog open={!!revisionOpen} onOpenChange={() => setRevisionOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request revision: {revisionOpen?.title}</DialogTitle></DialogHeader>
          <Textarea value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} rows={3} placeholder="Revision notes..." />
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="outline" onClick={() => setRevisionOpen(null)}>Cancel</Button>
            <Button onClick={() => handleRevision(revisionOpen.id)} className="bg-amber-600 hover:bg-amber-700 text-white">Send revision request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
