import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Plus, ChevronDown, RotateCcw, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const CONTENT_TYPES = ["Video", "Photo", "Design", "Copywriting", "Website", "Other"];

export default function AdminProjects() {
  const [view, setView] = useState("list");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFreelancer, setFilterFreelancer] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(null);
  const [reassignOpen, setReassignOpen] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const adminQuery = useQuery({ queryKey: ["admin-data"], queryFn: async () => { const res = await base44.functions.invoke('getAdminData', {}); return res.data; } });
  const projects = adminQuery.data?.projects || [];
  const freelancers = adminQuery.data?.freelancers || [];
  const availableClients = adminQuery.data?.clients || [];
  const projectsQuery = { refetch: () => adminQuery.refetch() };

  const refresh = () => projectsQuery.refetch();

  const handleCreate = async () => {
    if (!form.title || !form.client_name) return;
    try {
      setLoading(true);
      await base44.entities.Project.create({ ...form, status: 'Unassigned' });
      await projectsQuery.refetch();
      setCreateOpen(false);
      setForm({});
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (projectId, freelancerId, freelancerName) => {
    setLoading(true);
    await base44.functions.invoke('projectAction', { action: 'assign', project_id: projectId, freelancer_id: freelancerId, freelancer_name: freelancerName });
    refresh();
    setReassignOpen(null);
    setLoading(false);
  };

  const handleComplete = async (projectId) => {
    await base44.functions.invoke('projectAction', { action: 'complete', project_id: projectId });
    refresh();
  };

  const handleRevision = async (projectId) => {
    await base44.functions.invoke('projectAction', { action: 'request_revision', project_id: projectId, notes: revisionNotes });
    setRevisionOpen(null);
    setRevisionNotes("");
    refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this project?")) return;
    await base44.entities.Project.delete(id);
    refresh();
  };

  const handleUpdateProject = async () => {
    if (!editingProject?.id) return;
    setLoading(true);
    await base44.functions.invoke('projectAction', { action: 'update', project_id: editingProject.id, ...editingProject });
    setEditingProject(null);
    refresh();
    setLoading(false);
  };

  const projectClientNames = [...new Set(projects.map(p => p.client_name).filter(Boolean))];
  const filtered = projects
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => filterFreelancer === "all" || p.assigned_freelancer_id === filterFreelancer)
    .filter(p => filterClient === "all" || p.client_name === filterClient)
    .filter(p => filterType === "all" || p.content_type === filterType)
    .sort((a, b) => (STATUS_CONFIG[a.status]?.order ?? 0) - (STATUS_CONFIG[b.status]?.order ?? 0));

  // Workload per freelancer
  const workload = freelancers.map(f => ({
    ...f,
    active: projects.filter(p => p.assigned_freelancer_id === f.id && !["Completed", "Unassigned"].includes(p.status)).length,
  }));

  const emptyForm = { title: "", client_name: "", content_type: "Video", brief: "", description: "", deadline: "", assigned_freelancer_id: "", assigned_freelancer_name: "" };

  return (
    <div>
      {/* Workload summary */}
      {workload.some(f => f.active > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {workload.filter(f => f.active > 0).map(f => (
            <div key={f.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs shadow-sm">
              <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-[9px]">
                {f.name?.charAt(0)}
              </div>
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
            {freelancers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {projectClientNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                      {p.assigned_freelancer_name && <p className="text-slate-500 mt-1">👤 {p.assigned_freelancer_name}</p>}
                      {p.deadline && <p className="text-slate-400 mt-0.5">📅 {format(new Date(p.deadline), "d MMM")}</p>}
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Project</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Freelancer</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Deadline</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No projects found</td></tr>}
              {filtered.map(p => {
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG["Unassigned"];
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => setEditingProject({ ...p })}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{p.title}</p>
                      {p.content_type && <p className="text-xs text-slate-400">{p.content_type}</p>}
                      {p.decline_reason && <p className="text-xs text-red-500 mt-0.5">Declined: {p.decline_reason}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.client_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.assigned_freelancer_name || <span className="text-slate-300">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{p.deadline ? format(new Date(p.deadline), "d MMM yyyy") : "—"}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(p.status === "Unassigned" || p.decline_reason) && (
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
              <div><Label>Title *</Label><Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Client *</Label>
                <Select value={form.client_name || ""} onValueChange={v => setForm(f => ({ ...f, client_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {availableClients.filter(c => c.status === "Actif").map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Content type</Label>
                <Select value={form.content_type || "Video"} onValueChange={v => setForm(f => ({ ...f, content_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Deadline</Label><Input type="date" value={form.deadline || ""} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            </div>
            <div><Label>Brief</Label><Input value={form.brief || ""} onChange={e => setForm(f => ({ ...f, brief: e.target.value }))} placeholder="Short brief..." /></div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div><Label>Assign to freelancer</Label>
              <Select value={form.assigned_freelancer_id || ""} onValueChange={v => {
                const f = freelancers.find(x => x.id === v);
                setForm(prev => ({ ...prev, assigned_freelancer_id: v, assigned_freelancer_name: f?.name || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select freelancer (optional)" /></SelectTrigger>
                <SelectContent>
                  {freelancers.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} {f.status === "Indisponible" ? "⚠️ Unavailable" : "✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!form.title || !form.client_name || loading}>
                Create project
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
            {freelancers.map(f => (
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
                <div><Label>Client</Label><Input value={editingProject.client_name || ""} onChange={e => setEditingProject(p => ({ ...p, client_name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Content type</Label>
                  <Select value={editingProject.content_type || "Video"} onValueChange={v => setEditingProject(p => ({ ...p, content_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Deadline</Label><Input type="date" value={editingProject.deadline || ""} onChange={e => setEditingProject(p => ({ ...p, deadline: e.target.value }))} /></div>
              </div>
              <div><Label>Brief</Label><Input value={editingProject.brief || ""} onChange={e => setEditingProject(p => ({ ...p, brief: e.target.value }))} /></div>
              <div><Label>Description</Label><Textarea value={editingProject.description || ""} onChange={e => setEditingProject(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
              <div><Label>Status</Label>
                <Select value={editingProject.status || "Unassigned"} onValueChange={v => setEditingProject(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
                <Button onClick={handleUpdateProject} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={loading}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revision dialog */}
      <Dialog open={!!revisionOpen} onOpenChange={() => setRevisionOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request revision: {revisionOpen?.title}</DialogTitle></DialogHeader>
          <Textarea value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} rows={3} placeholder="Revision notes..." />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRevisionOpen(null)}>Cancel</Button>
            <Button onClick={() => handleRevision(revisionOpen.id)} className="bg-amber-600 hover:bg-amber-700">Send revision request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}