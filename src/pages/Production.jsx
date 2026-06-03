import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clapperboard, Film, Layers, X, Search, Calendar, User, Tag, Users, Wrench, FileText, CalendarDays, ArrowUpRight, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import AdminProjects from "@/components/admin/AdminProjects";
import { FreelancerProfiles, ToolsManagement, InvoicesManagement, MeetingsManagement } from "./FreelancerAdmin";
import { EDITING_STATUS, EDITING_STATUS_OPTIONS, EDITING_STATUS_LABELS, EDITING_STEPS, editingStepIndex } from "@/lib/editorialStatus";
import { PROJECT_STATUS, PRODUCTION_STEPS, productionStepIndex } from "@/lib/projectStatus";

// ─── Video projects (projects table) ─────────────────────────────────────────
// Project status taxonomy + production steps live in @/lib/projectStatus.

// ─── Editorial content (editorial_content table) ─────────────────────────────
// Editing-status taxonomy now lives in @/lib/editorialStatus (single source of truth).

function StatusPill({ status, map }) {
  const cfg = map[status] || map[Object.keys(map)[0]];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StepProgress({ status }) {
  const current = productionStepIndex(status);
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        {PRODUCTION_STEPS.map((s, i) => (
          <div key={s.key} className="flex-1 h-1 rounded-full transition-all" style={{
            background: i < current ? '#22c55e' : i === current ? '#2A69FF' : '#e2e8f0',
          }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-mono">
          {current >= 0 ? `Step ${current + 1}/5 · ${PRODUCTION_STEPS[current]?.label}` : "Not started"}
        </span>
        {current === 4 && <span className="text-[10px] text-green-600 font-mono font-semibold">Done</span>}
      </div>
    </div>
  );
}

function EditingStepProgress({ status }) {
  const current = editingStepIndex(status);
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        {EDITING_STEPS.map((s, i) => (
          <div key={s.key} className="flex-1 h-1 rounded-full transition-all" style={{
            background: i < current ? '#22c55e' : i === current ? '#2A69FF' : '#e2e8f0',
          }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-mono">
          {current >= 0 ? `Step ${current + 1}/${EDITING_STEPS.length} · ${EDITING_STEPS[current]?.label}` : (EDITING_STATUS_LABELS[status] || "Not started")}
        </span>
        {status === "Terminé" && <span className="text-[10px] text-green-600 font-mono font-semibold">Done</span>}
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span className="text-[10px] font-mono text-slate-400">({count})</span>
    </div>
  );
}

// ─── Project modal ────────────────────────────────────────────────────────────

const PROJECT_STATUS_OPTIONS = Object.keys(PROJECT_STATUS);

function ProjectModal({ project, onClose, onSaved, onDeleted }) {
  const [title, setTitle] = useState(project.title || "");
  const [status, setStatus] = useState(project.status || "Unassigned");
  const [freelancerId, setFreelancerId] = useState(project.freelancer_id || "");
  const [freelancerName, setFreelancerName] = useState(project.freelancer_name || "");
  const [endDate, setEndDate] = useState(project.end_date || "");
  const [notes, setNotes] = useState(project.notes || "");
  const [deliveryUrl, setDeliveryUrl] = useState(project.delivery_url || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancers").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        title,
        status,
        freelancer_id: freelancerId || null,
        freelancer_name: freelancerName || null,
        end_date: endDate || null,
        notes: notes || null,
        delivery_url: deliveryUrl || null,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) {
      console.error("Project save failed:", error);
      toast.error("Could not save the project: " + (error.message || error.code || "unknown error"));
      return;
    }
    onSaved();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await base44.functions.invoke("deleteProject", { projectId: project.id });
      onDeleted?.();
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setDeleting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono mb-1">{project.client_name}</p>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-base font-semibold text-slate-800 bg-transparent border-none outline-none w-full"
                placeholder="Project title"
              />
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0 mt-0.5">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Status */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Tag className="w-3 h-3" /> Status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROJECT_STATUS_OPTIONS.map(s => {
                const cfg = PROJECT_STATUS[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left"
                    style={{
                      borderColor: active ? '#2A69FF' : '#e2e8f0',
                      background: active ? '#eff4ff' : '#fff',
                      color: active ? '#2A69FF' : '#64748b',
                    }}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Freelancer */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <User className="w-3 h-3" /> Assign freelancer
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { setFreelancerId(""); setFreelancerName(""); }}
                className="px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left"
                style={{
                  borderColor: !freelancerId ? '#2A69FF' : '#e2e8f0',
                  background: !freelancerId ? '#eff4ff' : '#fff',
                  color: !freelancerId ? '#2A69FF' : '#64748b',
                }}
              >
                Unassigned
              </button>
              {freelancers.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setFreelancerId(f.id); setFreelancerName(f.name); }}
                  className="px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left"
                  style={{
                    borderColor: freelancerId === f.id ? '#2A69FF' : '#e2e8f0',
                    background: freelancerId === f.id ? '#eff4ff' : '#fff',
                    color: freelancerId === f.id ? '#2A69FF' : '#64748b',
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Calendar className="w-3 h-3" /> Due date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-[#2A69FF]"
            />
          </div>

          {/* Delivery URL */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <ArrowUpRight className="w-3 h-3" /> Delivery URL
            </label>
            <input
              type="url"
              value={deliveryUrl}
              onChange={e => setDeliveryUrl(e.target.value)}
              placeholder="https://…"
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-[#2A69FF]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 resize-none focus:outline-none focus:border-[#2A69FF]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-2 shrink-0">
          {confirmDelete ? (
            <>
              <span className="flex-1 text-xs text-red-600 font-medium self-center">Delete this project?</span>
              <button onClick={() => setConfirmDelete(false)} className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="h-9 px-3 rounded-xl text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)}
                className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
              </button>
              <button onClick={onClose} className="flex-1 h-9 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-9 rounded-xl text-xs font-medium text-white transition-colors"
                style={{ background: 'var(--brand)', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Content Picker Modal ─────────────────────────────────────────────────────

function ContentPicker({ onClose, currentIds, allContent, onToggle }) {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");

  const clients = [...new Set(allContent.map(e => e.client_name).filter(Boolean))].sort();

  const filtered = allContent.filter(e => {
    if (clientFilter !== "all" && e.client_name !== clientFilter) return false;
    if (search && !`${e.title} ${e.client_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedCount = filtered.filter(e => currentIds.has(e.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">Add editorial content</p>
            <p className="text-xs text-slate-400 mt-0.5">{selectedCount} selected · click to toggle</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Search + filter */}
        <div className="px-5 py-3 flex gap-2 shrink-0 border-b border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#2A69FF]"
            />
          </div>
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="h-8 text-xs rounded-lg border border-slate-200 px-2 focus:outline-none focus:border-[#2A69FF]"
          >
            <option value="all">All clients</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-4">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No content found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(e => {
                const active = currentIds.has(e.id);
                const statusCfg = EDITING_STATUS[e.editing_status];
                return (
                  <button
                    key={e.id}
                    onClick={() => onToggle(e.id, !active)}
                    className="relative text-left rounded-xl border-2 p-3 transition-all hover:shadow-md flex flex-col gap-2"
                    style={{
                      borderColor: active ? '#2A69FF' : '#e2e8f0',
                      background: active ? '#f0f5ff' : '#fff',
                    }}
                  >
                    {/* Checkbox badge */}
                    <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${
                      active ? 'border-[#2A69FF] bg-[#2A69FF]' : 'border-slate-300 bg-white'
                    }`}>
                      {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>

                    <div className="pr-5">
                      <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">{e.title || "Untitled"}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{e.client_name}</p>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-auto">
                      {e.post_type && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">{e.post_type}</span>
                      )}
                      {statusCfg && (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${statusCfg.bg} ${statusCfg.text}`}>{statusCfg.label}</span>
                      )}
                      {e.scheduled_date && (
                        <span className="text-[9px] font-mono text-slate-400">{format(new Date(e.scheduled_date), "d MMM", { locale: enUS })}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 shrink-0">
          <button onClick={onClose}
            className="w-full h-8 rounded-lg text-xs font-medium text-white transition-colors"
            style={{ background: 'var(--brand)' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Editorial detail modal ───────────────────────────────────────────────────

function EditorialModal({ item, onClose, onSaved }) {
  const [editingStatus, setEditingStatus] = useState(item.editing_status || "Non assigné");
  const [editorId, setEditorId] = useState(item.assigned_editor_id || "");
  const [editorName, setEditorName] = useState(item.assigned_editor_name || "");
  const [workflowType, setWorkflowType] = useState(item.workflow_type || "editorial");
  const [saving, setSaving] = useState(false);

  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancers").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  async function handleSave() {
    setSaving(true);

    // Option A: video editing is tracked entirely on editorial_content via
    // editing_status — no linked projects table row. When an editor is assigned
    // on a video item, surface it in production and default an open status.
    const wantsEditing = workflowType === "video";
    const nextEditingStatus =
      wantsEditing && editorId && editingStatus === "Non assigné" ? "À faire" : editingStatus;

    const { error } = await supabase
      .from("editorial_content")
      .update({
        editing_status: nextEditingStatus,
        assigned_editor_id: editorId || null,
        assigned_editor_name: editorName || null,
        workflow_type: workflowType,
      })
      .eq("id", item.id);
    setSaving(false);
    if (error) {
      console.error("Editorial save failed:", error);
      toast.error("Could not save: " + (error.message || error.code || "unknown error"));
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 leading-snug">{item.title || "Untitled"}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.client_name}{item.post_type ? ` · ${item.post_type}` : ""}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          {item.scheduled_date && (
            <div className="flex items-center gap-1.5 mt-3">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">{format(new Date(item.scheduled_date), "d MMMM yyyy", { locale: enUS })}</span>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4">
          {/* Workflow type toggle */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Film className="w-3 h-3" /> Workflow
            </label>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              {[
                { key: "editorial", label: "Editorial" },
                { key: "video",     label: "Video editing" },
              ].map(w => (
                <button key={w.key} onClick={() => setWorkflowType(w.key)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: workflowType === w.key ? '#fff' : 'transparent',
                    color: workflowType === w.key ? '#1e293b' : '#94a3b8',
                    boxShadow: workflowType === w.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <Tag className="w-3 h-3" /> Editing status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {EDITING_STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setEditingStatus(s)}
                  className="text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all"
                  style={{
                    borderColor: editingStatus === s ? '#2A69FF' : '#e2e8f0',
                    background: editingStatus === s ? '#eff4ff' : '#fff',
                    color: editingStatus === s ? '#2A69FF' : '#64748b',
                  }}
                >
                  {EDITING_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <User className="w-3 h-3" /> Assign editor
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { setEditorId(""); setEditorName(""); }}
                className="text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all"
                style={{
                  borderColor: !editorId ? '#2A69FF' : '#e2e8f0',
                  background: !editorId ? '#eff4ff' : '#fff',
                  color: !editorId ? '#2A69FF' : '#64748b',
                }}
              >
                Unassigned
              </button>
              {freelancers.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setEditorId(f.id); setEditorName(f.name); }}
                  className="text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all"
                  style={{
                    borderColor: editorId === f.id ? '#2A69FF' : '#e2e8f0',
                    background: editorId === f.id ? '#eff4ff' : '#fff',
                    color: editorId === f.id ? '#2A69FF' : '#64748b',
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-9 rounded-xl text-xs font-medium text-white transition-colors"
            style={{ background: 'var(--brand)', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [contentTab, setContentTab] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterFreelancer, setFilterFreelancer] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedEditorial, setSelectedEditorial] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["production-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .not("status", "eq", "Completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: editorialItems = [], isLoading: loadingEditorial } = useQuery({
    queryKey: ["production-editorial"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("editorial_content")
        .select("id, title, client_name, post_type, editing_status, assigned_editor_id, assigned_editor_name, scheduled_date, in_production, workflow_type")
        .eq("in_production", true)
        .not("status", "in", '("Publié","Annulé")')
        .or(`scheduled_date.is.null,scheduled_date.gte.${today}`)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allEditorial = [] } = useQuery({
    queryKey: ["all-editorial-picker"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("editorial_content")
        .select("id, title, client_name, post_type, editing_status, scheduled_date, in_production")
        .not("status", "in", '("Publié","Annulé")')
        .or(`scheduled_date.is.null,scheduled_date.gte.${today}`)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: pickerOpen,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }) => {
      const { error } = await supabase.from("editorial_content").update({ in_production: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-editorial"] });
      queryClient.invalidateQueries({ queryKey: ["all-editorial-picker"] });
    },
  });

  const loading = loadingProjects || loadingEditorial;
  const inProductionIds = new Set(editorialItems.map(e => e.id));

  const allClients = [...new Set([...projects.map(p => p.client_name), ...editorialItems.map(e => e.client_name)].filter(Boolean))].sort();
  const allFreelancers = [...new Set([...projects.map(p => p.freelancer_name), ...editorialItems.map(e => e.assigned_editor_name)].filter(Boolean))].sort();

  const filteredProjects = projects.filter(p => {
    if (filterClient !== "all" && p.client_name !== filterClient) return false;
    if (filterFreelancer !== "all" && p.freelancer_name !== filterFreelancer) return false;
    return true;
  });
  const filteredEditorial = editorialItems.filter(e => {
    if (filterClient !== "all" && e.client_name !== filterClient) return false;
    if (filterFreelancer !== "all" && e.assigned_editor_name !== filterFreelancer) return false;
    return true;
  });

  // Split editorial into video workflow vs editorial workflow
  const filteredVideoEditorial = filteredEditorial.filter(e => e.workflow_type === "video");
  const filteredEditorialOnly  = filteredEditorial.filter(e => e.workflow_type !== "video");

  const showProjects = contentTab === "all" || contentTab === "projects";
  const showEditorial = contentTab === "all" || contentTab === "editorial";

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex gap-1 p-1 bg-white border border-slate-100 rounded-xl shadow-sm">
          {[{ key: "all", label: "All" }, { key: "projects", label: "Video" }, { key: "editorial", label: "Editorial" }].map(t => (
            <button key={t.key} onClick={() => setContentTab(t.key)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={{ background: contentTab === t.key ? 'var(--brand)' : 'transparent', color: contentTab === t.key ? '#fff' : 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>
              {t.label}
            </button>
          ))}
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {allClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFreelancer} onValueChange={setFilterFreelancer}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All editors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All editors</SelectItem>
            {allFreelancers.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#2A69FF] hover:text-[#2A69FF] transition-colors bg-white">
            <Layers className="w-3.5 h-3.5" /> Add editorial
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-6" />
              <div className="h-2 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 && filteredEditorial.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Clapperboard className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Nothing in production</p>
          <p className="text-xs text-slate-400 mb-4">Add editorial content or create a video project.</p>
          <button onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#2A69FF] hover:text-[#2A69FF] transition-colors">
            <Layers className="w-3.5 h-3.5" /> Add editorial
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {showProjects && (filteredProjects.length > 0 || filteredVideoEditorial.length > 0) && (
            <div>
              <SectionLabel icon={Film} label="Video projects" count={filteredProjects.length + filteredVideoEditorial.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map(p => (
                  <div key={p.id} onClick={() => setSelectedProject(p)}
                    className="group bg-white rounded-2xl border border-slate-100 hover:border-[#2A69FF]/30 hover:shadow-md p-5 transition-all cursor-pointer flex flex-col">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-[#2A69FF] transition-colors truncate">{p.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{p.client_name}</p>
                    </div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <StatusPill status={p.status} map={PROJECT_STATUS} />
                      {p.end_date && <span className="text-[10px] text-slate-400 font-mono">Due {format(new Date(p.end_date), "d MMM", { locale: enUS })}</span>}
                    </div>
                    {p.freelancer_name ? (
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">{p.freelancer_name.charAt(0)}</div>
                        <span className="text-[11px] text-slate-500 truncate">{p.freelancer_name}</span>
                      </div>
                    ) : <p className="text-[10px] text-slate-300 font-mono mb-3">No freelancer assigned</p>}
                    <div className="mt-auto"><StepProgress status={p.status} /></div>
                  </div>
                ))}
                {/* Video-editing content — tracked on editorial_content via editing_status */}
                {showProjects && filteredVideoEditorial.map(e => {
                  return (
                    <div key={e.id} className="relative group">
                      <div
                        onClick={() => setSelectedEditorial(e)}
                        className="bg-white rounded-2xl border border-slate-100 hover:border-[#2A69FF]/30 hover:shadow-md p-5 transition-all cursor-pointer flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-[#2A69FF] transition-colors truncate">{e.title || "Untitled"}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{e.client_name}{e.post_type ? ` · ${e.post_type}` : ""}</p>
                          </div>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-500 shrink-0 font-mono">VIDEO</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <StatusPill status={e.editing_status} map={EDITING_STATUS} />
                          {e.scheduled_date && <span className="text-[10px] text-slate-400 font-mono">Due {format(new Date(e.scheduled_date), "d MMM", { locale: enUS })}</span>}
                        </div>
                        {e.assigned_editor_name ? (
                          <div className="flex items-center gap-1.5 mb-3">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">{e.assigned_editor_name.charAt(0)}</div>
                            <span className="text-[11px] text-slate-500 truncate">{e.assigned_editor_name}</span>
                          </div>
                        ) : <p className="text-[10px] text-slate-300 font-mono mb-3">No editor assigned</p>}
                        <div className="mt-auto"><EditingStepProgress status={e.editing_status} /></div>
                      </div>
                      <button onClick={ev => { ev.stopPropagation(); toggleMutation.mutate({ id: e.id, value: false }); }}
                        title="Remove from production"
                        className="absolute top-3 right-3 w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 transition-all z-10">
                        <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showEditorial && filteredEditorialOnly.length > 0 && (
            <div>
              <SectionLabel icon={Layers} label="Editorial" count={filteredEditorialOnly.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEditorialOnly.map(e => (
                  <div key={e.id} className="relative group">
                    <div onClick={() => setSelectedEditorial(e)}
                      className="bg-white rounded-2xl border border-slate-100 hover:border-[#2A69FF]/30 hover:shadow-md p-5 transition-all cursor-pointer h-full flex flex-col">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-[#2A69FF] transition-colors truncate">{e.title || "Untitled"}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{e.client_name}{e.post_type ? ` · ${e.post_type}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <StatusPill status={e.editing_status} map={EDITING_STATUS} />
                        {e.scheduled_date && <span className="text-[10px] text-slate-400 font-mono">{format(new Date(e.scheduled_date), "d MMM", { locale: enUS })}</span>}
                      </div>
                      {e.assigned_editor_name ? (
                        <div className="flex items-center gap-1.5 mt-auto">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">{e.assigned_editor_name.charAt(0)}</div>
                          <span className="text-[11px] text-slate-500 truncate">{e.assigned_editor_name}</span>
                        </div>
                      ) : <p className="text-[10px] text-slate-300 font-mono mt-auto">No editor assigned</p>}
                    </div>
                    <button
                      onClick={ev => { ev.stopPropagation(); toggleMutation.mutate({ id: e.id, value: false }); }}
                      title="Remove from production"
                      className="absolute top-3 right-3 w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 transition-all z-10">
                      <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["production-projects"] });
            setSelectedProject(null);
          }}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["production-projects"] });
            queryClient.invalidateQueries({ queryKey: ["production-editorial"] });
            setSelectedProject(null);
          }}
        />
      )}
      {selectedEditorial && (
        <EditorialModal item={selectedEditorial} onClose={() => setSelectedEditorial(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["production-editorial"] });
            setSelectedEditorial(null);
          }} />
      )}
      {pickerOpen && (
        <ContentPicker onClose={() => setPickerOpen(false)} currentIds={inProductionIds} allContent={allEditorial}
          onToggle={(id, value) => toggleMutation.mutate({ id, value })} />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const MAIN_TABS = [
  { key: "overview",    label: "Overview",    icon: Film         },
  { key: "projects",    label: "Projects",    icon: Clapperboard },
  { key: "freelancers", label: "Freelancers", icon: Users        },
  { key: "tools",       label: "Tools",       icon: Wrench       },
  { key: "invoices",    label: "Invoices",    icon: FileText     },
  { key: "meetings",    label: "Meetings",    icon: CalendarDays },
];

function ProductionNav({ tab, setTab }) {
  return (
    <>
      {/* Mobile dropdown */}
      <div className="md:hidden mb-4">
        <select
          value={tab}
          onChange={e => setTab(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-[#2A69FF]"
        >
          {MAIN_TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {/* Desktop vertical sidebar */}
      <nav className="hidden md:flex flex-col w-48 shrink-0 gap-0.5" style={{ position: 'sticky', top: 16 }}>
        {MAIN_TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                active ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'opacity-90' : 'opacity-60'}`} />
              {t.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default function Production() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="mx-auto" style={{ maxWidth: "1400px" }}>
      <PageHeader title="Production" subtitle="Projects, freelancers & tools" />

      <div className="flex gap-6 items-start">
        <ProductionNav tab={tab} setTab={setTab} />

        <div className="flex-1 min-w-0">
          {tab === "overview"    && <OverviewTab />}
          {tab === "projects"    && <AdminProjects />}
          {tab === "freelancers" && <FreelancerProfiles />}
          {tab === "tools"       && <ToolsManagement />}
          {tab === "invoices"    && <InvoicesManagement />}
          {tab === "meetings"    && <MeetingsManagement />}
        </div>
      </div>
    </div>
  );
}
