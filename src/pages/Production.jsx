import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { Link } from "react-router-dom";
import PageHeader from "../components/shared/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Clapperboard, Plus, Film, Layers } from "lucide-react";
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
};
const ACTIVE_PROJECT_STATUSES = Object.keys(PROJECT_STATUS);

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

function ProgressBar({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-400 font-mono">{done}/{total} tasks</span>
        <span className="text-[10px] font-semibold text-slate-600 font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{
          width: `${pct}%`,
          background: pct === 100 ? '#22c55e' : pct > 50 ? '#2A69FF' : '#f59e0b',
        }} />
      </div>
    </div>
  );
}

// Section header
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

export default function Production() {
  const [tab, setTab] = useState("all"); // "all" | "projects" | "editorial"
  const [filterClient, setFilterClient] = useState("all");
  const [filterFreelancer, setFilterFreelancer] = useState("all");

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

  const { data: allTasks = [] } = useQuery({
    queryKey: ["production-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id, status, client_name");
      if (error) throw error;
      return data || [];
    },
    enabled: projects.length > 0,
  });

  // ── Editorial content to edit ───────────────────────────────────────────────
  const { data: editorialItems = [], isLoading: loadingEditorial } = useQuery({
    queryKey: ["production-editorial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editorial_content")
        .select("id, title, client_name, post_type, editing_status, assigned_editor_name, scheduled_date")
        .not("editing_status", "is", null)
        .neq("editing_status", "Terminé")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const loading = loadingProjects || loadingEditorial;

  // Enrich projects with task counts
  const enriched = projects.map(p => {
    const pt = allTasks.filter(t => t.client_name && p.client_name && t.client_name === p.client_name);
    const done = pt.filter(t => t.status === "Terminé").length;
    return { ...p, totalTasks: pt.length, doneTasks: done };
  });

  // Derive filter options
  const allClients = [...new Set([
    ...enriched.map(p => p.client_name),
    ...editorialItems.map(e => e.client_name),
  ].filter(Boolean))].sort();

  const allFreelancers = [...new Set([
    ...enriched.map(p => p.freelancer_name),
    ...editorialItems.map(e => e.assigned_editor_name),
  ].filter(Boolean))].sort();

  // Apply filters
  const filteredProjects = enriched.filter(p => {
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

  const totalActive = filteredProjects.filter(p => p.status === "In progress").length
    + filteredEditorial.filter(e => e.editing_status === "En cours de montage").length;

  return (
    <div className="mx-auto" style={{ maxWidth: "1400px" }}>
      <PageHeader title="Production" subtitle="Active projects & editorial">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 hidden sm:block">
            {totalActive} editing now
          </span>
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
        {/* Tab pills */}
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

        {/* Filters */}
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
          <p className="text-xs text-slate-400 mb-4">Create a project or assign editing to a freelancer to track it here.</p>
          <Link to="/FreelancerAdmin"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}>
            <Plus className="w-3.5 h-3.5" /> Go to FreelancerAdmin
          </Link>
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
                        {p.totalTasks > 0
                          ? <ProgressBar done={p.doneTasks} total={p.totalTasks} />
                          : <p className="text-[10px] text-slate-300 font-mono">No tasks linked</p>
                        }
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
              <SectionLabel icon={Layers} label="Editorial to edit" count={filteredEditorial.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEditorial.map(e => (
                  <Link key={e.id} to="/Editorial" style={{ textDecoration: "none" }}>
                    <div className="group bg-white rounded-2xl border border-slate-100 hover:border-[#2A69FF]/30 hover:shadow-md p-5 transition-all cursor-pointer h-full flex flex-col">
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
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
