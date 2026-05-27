import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { Link } from "react-router-dom";
import PageHeader from "../components/shared/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Clapperboard, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

const STATUS_CONFIG = {
  "En cours":      { label: "In progress", bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"   },
  "Non commencé":  { label: "Not started", bg: "bg-slate-50",  text: "text-slate-500",  dot: "bg-slate-400"  },
  "Draft":         { label: "Draft",       bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400"  },
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Non commencé"];
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
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? '#22c55e' : pct > 50 ? '#2A69FF' : '#f59e0b',
          }}
        />
      </div>
    </div>
  );
}

export default function Production() {
  const [filterClient, setFilterClient] = useState("all");
  const [filterFreelancer, setFilterFreelancer] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Active projects
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

  // All tasks (to count per project via client_id)
  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["production-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, client_id, client_name");
      if (error) throw error;
      return data || [];
    },
    enabled: projects.length > 0,
  });

  const loading = loadingProjects || loadingTasks;

  // Enrich projects with task counts
  const enriched = projects.map(p => {
    const projectTasks = allTasks.filter(t => t.client_id === p.client_id);
    const done = projectTasks.filter(t => t.status === "Terminé").length;
    return { ...p, totalTasks: projectTasks.length, doneTasks: done };
  });

  // Derive filter options
  const clients = [...new Set(enriched.map(p => p.client_name).filter(Boolean))].sort();
  const freelancers = [...new Set(enriched.map(p => p.freelancer_name).filter(Boolean))].sort();

  // Apply filters
  const filtered = enriched.filter(p => {
    if (filterClient !== "all" && p.client_name !== filterClient) return false;
    if (filterFreelancer !== "all" && p.freelancer_name !== filterFreelancer) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  const inProgress = enriched.filter(p => p.status === "En cours").length;
  const notStarted = enriched.filter(p => p.status === "Non commencé").length;

  return (
    <div className="mx-auto" style={{ maxWidth: "1400px" }}>
      <PageHeader title="Production" subtitle="Active projects">
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">
            {inProgress} in progress · {notStarted} not started
          </span>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFreelancer} onValueChange={setFilterFreelancer}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All freelancers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All freelancers</SelectItem>
            {freelancers.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="En cours">In progress</SelectItem>
            <SelectItem value="Non commencé">Not started</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
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
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Clapperboard className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No active projects</p>
          <p className="text-xs text-slate-400">Projects with status "En cours" or "Non commencé" will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link
              key={p.id}
              to={`/ClientDetail?id=${p.client_id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="group bg-white rounded-2xl border border-slate-100 hover:border-[#2A69FF]/30 hover:shadow-md p-5 transition-all cursor-pointer h-full flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-[#2A69FF] transition-colors truncate">{p.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{p.client_name}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#2A69FF] transition-colors shrink-0 mt-0.5" />
                </div>

                {/* Status + deadline */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <StatusPill status={p.status} />
                  {p.end_date && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Due {format(new Date(p.end_date), "d MMM", { locale: enUS })}
                    </span>
                  )}
                </div>

                {/* Freelancer */}
                {p.freelancer_name && (
                  <div className="flex items-center gap-1.5 mb-4">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                      {p.freelancer_name.charAt(0)}
                    </div>
                    <span className="text-[11px] text-slate-500 truncate">{p.freelancer_name}</span>
                  </div>
                )}

                {/* Task progress */}
                <div className="mt-auto">
                  {p.totalTasks > 0 ? (
                    <ProgressBar done={p.doneTasks} total={p.totalTasks} />
                  ) : (
                    <p className="text-[10px] text-slate-300 font-mono">No tasks yet</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
