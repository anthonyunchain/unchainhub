import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clapperboard } from "lucide-react";

const STATUS_DOT = {
  "En cours":     "bg-blue-500",
  "Non commencé": "bg-slate-300",
};
const STATUS_LABEL = {
  "En cours":     "In progress",
  "Non commencé": "Not started",
};

export default function ProductionWidget() {
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
      const { data, error } = await supabase.from("tasks").select("id, status, client_id");
      if (error) throw error;
      return data || [];
    },
    enabled: projects.length > 0,
  });

  const enriched = projects.slice(0, 6).map(p => {
    const projectTasks = allTasks.filter(t => t.client_id === p.client_id);
    const done = projectTasks.filter(t => t.status === "Terminé").length;
    const total = projectTasks.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { ...p, done, total, pct };
  });

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 'var(--card-radius)',
      boxShadow: 'var(--card-shadow)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          fontWeight: 500,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>Production</span>
        <Link to="/Production" style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: "'DM Mono', monospace", fontSize: '10px',
          color: 'var(--brand)', textDecoration: 'none',
        }}>
          Voir tout <ArrowUpRight style={{ width: 12, height: 12 }} />
        </Link>
      </div>

      {/* Content */}
      {loadingProjects ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-2/3 mb-1.5" />
              <div className="h-1.5 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : enriched.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 0' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clapperboard style={{ width: 18, height: 18, color: 'var(--brand)' }} />
          </div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>No active projects</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {enriched.map(p => (
            <Link key={p.id} to={`/ClientDetail?id=${p.client_id}`} style={{ textDecoration: 'none' }}>
              <div className="group" style={{ cursor: 'pointer' }}>
                {/* Title + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span
                    style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }}
                    className={STATUS_DOT[p.status] || "bg-slate-300"}
                  />
                  <p style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    margin: 0,
                  }} className="group-hover:text-[#2A69FF] transition-colors">{p.title}</p>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--muted)', flexShrink: 0 }}>
                    {p.client_name}
                  </span>
                </div>
                {/* Progress bar */}
                {p.total > 0 ? (
                  <div>
                    <div style={{ height: 4, background: 'var(--divider)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: `${p.pct}%`,
                        background: p.pct === 100 ? '#22c55e' : p.pct > 50 ? '#2A69FF' : '#f59e0b',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>
                      {p.done}/{p.total} tasks · {p.pct}%
                      {p.freelancer_name && ` · ${p.freelancer_name}`}
                    </p>
                  </div>
                ) : (
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--muted)' }}>
                    No tasks · {STATUS_LABEL[p.status] || p.status}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
