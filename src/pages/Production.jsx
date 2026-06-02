import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { Link } from "react-router-dom";
import PageHeader from "../components/shared/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Clapperboard, Plus, Film, Layers, X, Search } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

// ─── Video projects (projects table) ─────────────────────────────────────────

const PROJECT_STATUS = {
  "Draft":              { label: "Draft",               bg: "bg-violet-50",  text: "text-violet-600", dot: "bg-violet-400"  },
  "Unassigned":         { label: "Unassigned",          bg: "bg-slate-50",   text: "text-slate-500",  dot: "bg-slate-400"   },
  "Pending acceptance": { label: "Pending",             bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400"   },
  "Accepted":           { label: "Accepted",            bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-400"    },
  "In progress":        { label: "In progress",         bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500"  },
  "Delivered":          { label: "Delivered",           bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500"  },
  "Revision requested": { label: "Revision",            bg: "bg-red-50",     text: "text-red-700",    dot: "bg-red-500"     },
  "Subtitles":          { label: "Subtitles",           bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-teal-500"    },
};

// 5-step production workflow
const PRODUCTION_STEPS = [
  { key: "Accepted",    label: "Accept"        },
  { key: "In progress", label: "Rough cut"     },
  { key: "Delivered",   label: "Final"         },
  { key: "Subtitles",   label: "Subtitles"     },
  { key: "Completed",   label: "Ready to post" },
];

function stepIndex(status) {
  if (status === "Completed") return 4;
  return PRODUCTION_STEPS.findIndex(s => s.key === status);
}

// ─── Editorial content (editorial_content table) ─────────────────────────────

const EDITING_STATUS = {
  "Non assigné":               { label: "Unassigned",      bg: "bg-slate-50",   text: "text-slate-500",  dot: "bg-slate-300"  },
  "En attente d'acceptation":  { label: "Pending",         bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400"  },
  "À faire":                   { label: "To do",           bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-400"   },
  "En cours de montage":       { label: "Editing",         bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500" },
  "En attente de retour":      { label: "Awaiting review", bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-500" },
};

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
  const current = stepIndex(status);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">Add editorial content</p>
            <p className="text-xs text-slate-400 mt-0.5">Pick the pieces to track in production</p>
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

        {/* List */}
        <div className="overflow-y-auto flex-1 px-3 py-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No content found</p>
          ) : filtered.map(e => {
            const active = currentIds.has(e.id);
            const statusCfg = EDITING_STATUS[e.editing_status];
            return (
              <button
                key={e.id}
                onClick={() => onToggle(e.id, !active)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
              >
                <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  active ? 'border-[#2A69FF] bg-[#2A69FF]' : 'border-slate-300'
                }`}>
                  {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{e.title || "Untitled"}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{e.client_name}{e.post_type ? ` · ${e.post_type}` : ""}</p>
                </div>
                {statusCfg && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusCfg.bg} ${statusCfg.text}`}>
                    {statusCfg.label}
                  </span>
                )}
              </button>
            );
          })}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Production() {
  const [tab, setTab] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterFreelancer, setFilterFreelancer] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const queryClient = useQueryClient();

  // ── Video projects ──────────────────────────────────────────────────────────
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

  // ── Editorial in production ─────────────────────────────────────────────────
  const { data: editorialItems = [], isLoading: loadingEditorial } = useQuery({
    queryKey: ["production-editorial"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("editorial_content")
        .select("id, title, client_name, post_type, editing_status, assigned_editor_name, scheduled_date, in_production")
        .eq("in_production", true)
        .neq("status", "Publié")
        .or(`scheduled_date.is.null,scheduled_date.gte.${today}`)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // ── All editorial for the picker (upcoming & not published only) ────────────
  const { data: allEditorial = [] } = useQuery({
    queryKey: ["all-editorial-picker"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("editorial_content")
        .select("id, title, client_name, post_type, editing_status, scheduled_date, in_production")
        .neq("status", "Publié")
        .or(`scheduled_date.is.null,scheduled_date.gte.${today}`)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: pickerOpen,
  });

  // ── Toggle in_production ────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }) => {
      const { error } = await supabase
        .from("editorial_content")
        .update({ in_production: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-editorial"] });
      queryClient.invalidateQueries({ queryKey: ["all-editorial-picker"] });
    },
  });

  const loading = loadingProjects || loadingEditorial;
  const inProductionIds = new Set(editorialItems.map(e => e.id));

  // Derive filter options
  const allClients = [...new Set([
    ...projects.map(p => p.client_name),
    ...editorialItems.map(e => e.client_name),
  ].filter(Boolean))].sort();

  const allFreelancers = [...new Set([
    ...projects.map(p => p.freelancer_name),
    ...editorialItems.map(e => e.assigned_editor_name),
  ].filter(Boolean))].sort();

  // Apply filters
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

  const showProjects = tab === "all" || tab === "projects";
  const showEditorial = tab === "all" || tab === "editorial";

  const totalActive = filteredProjects.filter(p => stepIndex(p.status) >= 0).length
    + filteredEditorial.length;

  return (
    <div className="mx-auto" style={{ maxWidth: "1400px" }}>
      <PageHeader title="Production" subtitle="Active projects & editorial">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 hidden sm:block">
            {totalActive} active
          </span>
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#2A69FF] hover:text-[#2A69FF] transition-colors bg-white"
          >
            <Layers className="w-3.5 h-3.5" /> Add editorial
          </button>
          <Link
            to="/FreelancerAdmin"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}
          >
            <Plus className="w-3.5 h-3.5" /> New project
          </Link>
        </div>
      </PageHeader>

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex gap-1 p-1 bg-white border border-slate-100 rounded-xl shadow-sm">
          {[
            { key: "all", label: "All" },
            { key: "projects", label: "Video projects" },
            { key: "editorial", label: "Editorial" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: tab === t.key ? 'var(--brand)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--muted)',
                fontFamily: "'DM Mono', monospace",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {allClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFreelancer} onValueChange={setFilterFreelancer}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All editors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All editors</SelectItem>
            {allFreelancers.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
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
      ) : (filteredProjects.length === 0 && filteredEditorial.length === 0) ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Clapperboard className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Nothing in production</p>
          <p className="text-xs text-slate-400 mb-4">Add editorial content or create a video project.</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#2A69FF] hover:text-[#2A69FF] transition-colors"
            >
              <Layers className="w-3.5 h-3.5" /> Add editorial
            </button>
            <Link to="/FreelancerAdmin"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}>
              <Plus className="w-3.5 h-3.5" /> New project
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* VIDEO PROJECTS */}
          {showProjects && filteredProjects.length > 0 && (
            <div>
              <SectionLabel icon={Film} label="Video projects" count={filteredProjects.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map(p => (
                  <Link key={p.id} to="/FreelancerAdmin" style={{ textDecoration: "none" }}>
                    <div className="group bg-white rounded-2xl border border-slate-100 hover:border-[#2A69FF]/30 hover:shadow-md p-5 transition-all cursor-pointer h-full flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-[#2A69FF] transition-colors truncate">{p.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{p.client_name}</p>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#2A69FF] shrink-0 mt-0.5 transition-colors" />
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <StatusPill status={p.status} map={PROJECT_STATUS} />
                        {p.end_date && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Due {format(new Date(p.end_date), "d MMM", { locale: enUS })}
                          </span>
                        )}
                      </div>
                      {p.freelancer_name && (
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                            {p.freelancer_name.charAt(0)}
                          </div>
                          <span className="text-[11px] text-slate-500 truncate">{p.freelancer_name}</span>
                        </div>
                      )}
                      <div className="mt-auto">
                        <StepProgress status={p.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* EDITORIAL CONTENT */}
          {showEditorial && filteredEditorial.length > 0 && (
            <div>
              <SectionLabel icon={Layers} label="Editorial" count={filteredEditorial.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEditorial.map(e => (
                  <div key={e.id} className="relative group">
                    <Link to="/Editorial" style={{ textDecoration: "none" }}>
                      <div className="bg-white rounded-2xl border border-slate-100 hover:border-[#2A69FF]/30 hover:shadow-md p-5 transition-all cursor-pointer h-full flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-[#2A69FF] transition-colors truncate">{e.title || "Untitled"}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{e.client_name}{e.post_type ? ` · ${e.post_type}` : ""}</p>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#2A69FF] shrink-0 mt-0.5 transition-colors" />
                        </div>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <StatusPill status={e.editing_status} map={EDITING_STATUS} />
                          {e.scheduled_date && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {format(new Date(e.scheduled_date), "d MMM", { locale: enUS })}
                            </span>
                          )}
                        </div>
                        {e.assigned_editor_name && (
                          <div className="flex items-center gap-1.5 mt-auto">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                              {e.assigned_editor_name.charAt(0)}
                            </div>
                            <span className="text-[11px] text-slate-500 truncate">{e.assigned_editor_name}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                    {/* Remove button */}
                    <button
                      onClick={() => toggleMutation.mutate({ id: e.id, value: false })}
                      title="Remove from production"
                      className="absolute top-3 right-3 w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 transition-all"
                    >
                      <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content picker modal */}
      {pickerOpen && (
        <ContentPicker
          onClose={() => setPickerOpen(false)}
          currentIds={inProductionIds}
          allContent={allEditorial}
          onToggle={(id, value) => toggleMutation.mutate({ id, value })}
        />
      )}
    </div>
  );
}
