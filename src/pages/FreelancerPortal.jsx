import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FileText, CalendarDays, FileCheck, Wrench, Upload, ExternalLink,
  Clock, CheckCircle2, Square, AlertTriangle, FolderOpen, ClipboardList,
  LayoutDashboard, User, Bell, Briefcase
} from "lucide-react";

import FreelancerSidebar from "@/components/freelancer/FreelancerSidebar";
import ProfileTab from "./freelancer/ProfileTab";
import ProjectsTab from "./freelancer/ProjectsTab";
import TasksTabComponent from "@/components/freelancer/TasksTab";
import FreelancerProjects from "@/components/freelancer/FreelancerProjects";
import NotificationsPanel from "@/components/freelancer/NotificationsPanel";



const TASK_STATUS = {
  "Non commencé": { color: "bg-slate-100 text-slate-600" },
  "En cours":     { color: "bg-blue-100 text-blue-700" },
  "Terminé":      { color: "bg-emerald-100 text-emerald-700" },
  "Bloqué":       { color: "bg-red-100 text-red-700" },
};

// ─── DASHBOARD TAB ─────────────────────────────────────────────────────────
function DashboardTab({ tasks, projects, freelancerName, onTabChange }) {
  const [time, setTime] = useState("");
  const today = format(new Date(), "EEEE, d MMMM yyyy", { locale: fr });

  useEffect(() => {
    const updateTime = () => setTime(format(new Date(), "HH:mm"));
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const urgentTasks = tasks
    .filter(t => t.status !== "Terminé")
    .sort((a, b) => {
      const priOrder = { "Urgente": 0, "Haute": 1, "Normale": 2, "Basse": 3 };
      return (priOrder[a.priority] ?? 2) - (priOrder[b.priority] ?? 2);
    })
    .slice(0, 5);

  const ongoingProjects = projects.filter(p =>
    p.editing_status === "En cours de montage" || p.editing_status === "À faire"
  );

  return (
    <div className="space-y-4">
      {/* Greeting & Time */}
      <div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
          Hello {freelancerName.split(" ")[0]}
        </h2>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginTop: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {today}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-1">
        <div style={{
          background: 'linear-gradient(145deg, #1a3a8f 0%, #2A69FF 60%, #5b8fff 100%)',
          borderRadius: 'var(--card-radius)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 220,
        }}>
          <div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.55)', marginBottom: 8, display: 'block' }}>Total Projects This Month</span>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '52px', fontWeight: 800, color: '#fff', letterSpacing: '-3px', lineHeight: 1.05 }}>
              {myProjects.length}
            </p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.60)', marginTop: 6 }}>
              assigned
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {[
              { label: 'Pending Projects', value: myProjects.filter(p => p.status === 'Pending acceptance').length },
              { label: 'In Progress', value: ongoingProjects.length },
              { label: 'Total Completed', value: myProjects.filter(p => p.status === 'Completed').length },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: 700, color: '#fff' }}>{s.value}</p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-3" style={{ gridTemplateRows: '1fr 1fr' }}>
          <div style={{
            background: 'var(--card-blue)',
            borderRadius: 'var(--card-radius)',
            boxShadow: 'var(--card-shadow)',
            padding: '20px',
            border: 'none',
            transition: 'all 200ms ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Tasks Pending</p>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '34px', fontWeight: 800, color: 'var(--brand)', letterSpacing: '-2px', lineHeight: 1.05 }}>
              {tasks.filter(t => t.status !== "Terminé").length}
            </p>
          </div>
          <div style={{
            background: 'var(--card-green)',
            borderRadius: 'var(--card-radius)',
            boxShadow: 'var(--card-shadow)',
            padding: '20px',
            border: 'none',
            transition: 'all 200ms ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Completed</p>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '34px', fontWeight: 800, color: 'var(--success)', letterSpacing: '-2px', lineHeight: 1.05 }}>
              {tasks.filter(t => t.status === "Terminé").length}
            </p>
          </div>
          <div style={{
            background: 'var(--card-amber)',
            borderRadius: 'var(--card-radius)',
            boxShadow: 'var(--card-shadow)',
            padding: '20px',
            border: 'none',
            transition: 'all 200ms ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Total Projects</p>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '34px', fontWeight: 800, color: 'var(--warning)', letterSpacing: '-2px', lineHeight: 1.05 }}>
              {projects.length}
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: 3 Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-1" style={{ alignItems: 'stretch' }}>
        {/* Urgent Tasks Card */}
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: 420,
          overflow: 'hidden',
          transition: 'box-shadow 200ms ease, transform 200ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Urgent Tasks</span>
            <button onClick={() => onTabChange("tasks")} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', textDecoration: 'none', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>View all →</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {urgentTasks.length === 0 ? (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>No pending tasks</p>
            ) : (
              urgentTasks.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList style={{ width: 14, height: 14, color: 'var(--brand)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{task.priority} {task.due_date && `· ${format(new Date(task.due_date), "d MMM", { locale: fr })}`}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Projects Card */}
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: 420,
          overflow: 'hidden',
          transition: 'box-shadow 200ms ease, transform 200ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Active Projects</span>
            <button onClick={() => onTabChange("projects")} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', textDecoration: 'none', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>View all →</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ongoingProjects.length === 0 ? (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>No active projects</p>
            ) : (
              ongoingProjects.slice(0, 4).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FolderOpen style={{ width: 14, height: 14, color: 'var(--brand)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || "Untitled"}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{p.client_name} {p.scheduled_date && `· ${format(new Date(p.scheduled_date), "d MMM", { locale: fr })}`}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Performance Stats Card */}
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: 420,
          justifyContent: 'space-between',
          transition: 'box-shadow 200ms ease, transform 200ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Performance</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>Completion</p>
                <div style={{ width: '100%', height: 6, background: 'var(--divider)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    background: 'var(--brand)',
                    width: `${tasks.length > 0 ? (tasks.filter(t => t.status === "Terminé").length / tasks.length * 100) : 0}%`,
                  }} />
                </div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginTop: 8 }}>
                  {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === "Terminé").length / tasks.length * 100)) : 0}%
                </p>
              </div>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>On Track</p>
                <div style={{ width: '100%', height: 6, background: 'var(--divider)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    background: 'var(--success)',
                    width: `${projects.length > 0 ? (ongoingProjects.length / projects.length * 100) : 0}%`,
                  }} />
                </div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginTop: 8 }}>
                  {projects.length > 0 ? Math.round((ongoingProjects.length / projects.length * 100)) : 0}%
                </p>
              </div>
            </div>
          </div>
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--divider)' }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Summary</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)' }}>Done</p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: 700, color: 'var(--brand)', marginTop: 4 }}>{tasks.filter(t => t.status === "Terminé").length}</p>
              </div>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)' }}>Active</p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>{ongoingProjects.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TOOLS TAB ────────────────────────────────────────────────────────────
function ToolsTab({ tools }) {
  const defaultTools = [
    { id: "_kapwing", name: "Kapwing", description: "Online video editing tool", url: "https://kapwing.com", logo_url: "https://www.kapwing.com/favicon.ico", category: "Vidéo" },
    { id: "_figma", name: "Figma", description: "Collaborative design tool", url: "https://figma.com", logo_url: "https://www.figma.com/favicon.ico", category: "Design" },
  ];
  const allTools = [...defaultTools, ...tools].sort((a, b) => (a.order || 0) - (b.order || 0));
  const CATEGORY_COLORS = {
    "Design": "bg-violet-50 text-violet-700",
    "Vidéo": "bg-pink-50 text-pink-700",
    "Communication": "bg-blue-50 text-blue-700",
    "Documents": "bg-amber-50 text-amber-700",
    "Autre": "bg-slate-100 text-slate-600",
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {allTools.map(tool => (
        <a key={tool.id} href={tool.url} target="_blank" rel="noopener noreferrer"
          className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group">
          <div className="flex items-start gap-3">
            {tool.logo_url
              ? <img src={tool.logo_url} alt={tool.name} className="w-9 h-9 rounded-lg object-contain bg-slate-50 p-1 border border-slate-100" />
              : <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><Wrench className="w-4 h-4 text-slate-400" /></div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-[#2A69FF] transition-colors">{tool.name}</p>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2A69FF] shrink-0" />
              </div>
              {tool.description && <p className="text-xs text-slate-500 mt-0.5">{tool.description}</p>}
              {tool.category && <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[tool.category] || CATEGORY_COLORS["Autre"]}`}>{tool.category}</span>}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── MEETINGS TAB ─────────────────────────────────────────────────────────
function MeetingsTab({ meetings }) {
  const upcoming = meetings.filter(m => m.status === "À venir").sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = meetings.filter(m => m.status !== "À venir").sort((a, b) => new Date(b.date) - new Date(a.date));
  const MeetingCard = ({ m }) => (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{m.title}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-500">{m.date ? format(new Date(m.date), "d MMMM yyyy", { locale: fr }) : "—"}{m.time && ` · ${m.time}`}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.format === "Remote" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{m.format}</span>
          </div>
          {m.notes && <p className="text-xs text-slate-400 mt-2 bg-slate-50 rounded-lg p-2">{m.notes}</p>}
        </div>
        {m.link && (
          <a href={m.link} target="_blank" rel="noopener noreferrer"
            className="shrink-0 ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A69FF] text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
            <ExternalLink className="w-3 h-3" /> Join
          </a>
        )}
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      {meetings.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No meetings scheduled yet</p>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Upcoming</p>
          <div className="space-y-3">{upcoming.map(m => <MeetingCard key={m.id} m={m} />)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Past</p>
          <div className="space-y-3 opacity-70">{past.map(m => <MeetingCard key={m.id} m={m} />)}</div>
        </div>
      )}
    </div>
  );
}

// ─── INVOICES TAB ─────────────────────────────────────────────────────────
function InvoicesTab({ payments, freelancerName, onPaymentAdded }) {
  const [uploading, setUploading] = useState(false);
  const createMut = useMutation({
    mutationFn: (d) => base44.entities.FreelancerPayment.create(d),
    onSuccess: (newPayment) => onPaymentAdded(newPayment),
  });
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    createMut.mutate({
      freelancer_name: freelancerName, amount: 0, status: "En attente",
      date: format(new Date(), "yyyy-MM-dd"), invoice_url: file_url,
      mission: file.name.replace(/\.[^/.]+$/, ""),
    });
    setUploading(false);
    e.target.value = "";
  };
  const STATUS_COLORS = {
    "En attente": "bg-amber-50 text-amber-700",
    "Payé": "bg-emerald-50 text-emerald-700",
    "En retard": "bg-red-50 text-red-700",
  };
  const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const paid = payments.filter(p => p.status === "Payé").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = payments.filter(p => p.status === "En attente").reduce((s, p) => s + (p.amount || 0), 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm"><p className="text-xs text-slate-400 uppercase">Total</p><p className="text-lg font-bold text-slate-900 mt-1">{total.toLocaleString("fr-FR")} €</p></div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm"><p className="text-xs text-slate-400 uppercase">Paid</p><p className="text-lg font-bold text-emerald-600 mt-1">{paid.toLocaleString("fr-FR")} €</p></div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm"><p className="text-xs text-slate-400 uppercase">Pending</p><p className="text-lg font-bold text-amber-600 mt-1">{pending.toLocaleString("fr-FR")} €</p></div>
      </div>
      <div className="flex justify-end mb-4">
        <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Submit an invoice"}
          <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </label>
      </div>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Mission</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Date</th>
            <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Status</th>
            <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Amount</th>
            <th className="px-5 py-3"></th>
          </tr></thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No invoices yet</td></tr>}
            {payments.map(p => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{p.mission || "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{p.date ? format(new Date(p.date), "d MMM yyyy", { locale: fr }) : "—"}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>{p.status}</span></td>
                <td className="px-5 py-3 text-sm font-semibold text-right text-slate-800">{p.amount ? `${p.amount.toLocaleString("fr-FR")} €` : "—"}</td>
                <td className="px-5 py-3">{p.invoice_url && <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-[#2A69FF] hover:underline text-xs flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> View</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CONTRACT TAB ─────────────────────────────────────────────────────────
function ContractTab({ profile }) {
  return (
    <div>
      {!profile?.contract_url ? (
        <div className="text-center py-16 text-slate-400">
          <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No contract available yet</p>
          <p className="text-xs mt-1">Please contact the Unchain Studio team.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 p-8 shadow-sm text-center max-w-md mx-auto mt-8">
          <FileCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">Your freelancer contract</h3>
          <p className="text-sm text-slate-500 mb-6">Document provided by Unchain Studio. Read only.</p>
          <a href={profile.contract_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
            <FileText className="w-4 h-4" /> View / Download
          </a>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PORTAL ──────────────────────────────────────────────────────────
const TAB_TITLES = {
  dashboard: "Dashboard",
  tasks: "My Tasks",
  myprojects: "My Projects",
  projects: "Editorial Projects",
  tools: "Tools",
  meetings: "Meetings",
  invoices: "Invoices & Payments",
  contract: "My Contract",
  profile: "My Profile",
  notifications: "Notifications",
};

export default function FreelancerPortal() {
  const [user, setUser] = useState(null);
  const [freelancerData, setFreelancerData] = useState(null); // { profile, tasks, projects, meetings, payments, tools }
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const init = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const res = await base44.functions.invoke('getFreelancerData', {});
        setFreelancerData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  const profile = freelancerData?.profile || null;
  const tasks = freelancerData?.tasks || [];
  const editorialProjects = freelancerData?.editorialProjects || [];
  const myProjects = freelancerData?.projects || [];
  const meetings = freelancerData?.meetings || [];
  const payments = freelancerData?.payments || [];
  const tools = freelancerData?.tools || [];
  const freelancerName = profile?.name || user?.full_name || user?.email;
  const unreadCount = myProjects.filter(p => p.status === "Pending acceptance").length;

  const handleUpdateTask = async (task, updates) => {
    if (updates.status) {
      await base44.functions.invoke('updateTaskStatus', { task_id: task.id, status: updates.status });
    }
    const res = await base44.functions.invoke('getFreelancerData', {});
    setFreelancerData(res.data);
  };

  const handlePaymentAdded = async () => {
    const res = await base44.functions.invoke('getFreelancerData', {});
    setFreelancerData(res.data);
  };

  const handleProjectUpdate = async () => {
    const res = await base44.functions.invoke('getFreelancerData', {});
    setFreelancerData(res.data);
  };

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardTab tasks={tasks} projects={editorialProjects} freelancerName={freelancerName} onTabChange={setActiveTab} />;
      case "tasks": return <TasksTabComponent tasks={tasks} onUpdateTask={handleUpdateTask} />;
      case "myprojects": return <FreelancerProjects projects={myProjects} onRefresh={handleProjectUpdate} freelancerName={freelancerName} />;
      case "projects": return <ProjectsTab projects={editorialProjects} onProjectUpdate={handleProjectUpdate} />;
      case "tools": return <ToolsTab tools={tools} />;
      case "meetings": return <MeetingsTab meetings={meetings} />;
      case "invoices": return <InvoicesTab payments={payments} freelancerName={freelancerName} onPaymentAdded={handlePaymentAdded} />;
      case "contract": return <ContractTab profile={profile} />;
      case "profile": return <ProfileTab user={user} freelancerProfile={profile} onProfileUpdate={(p) => setFreelancerData(d => ({ ...d, profile: p }))} />;
      case "notifications": return <NotificationsPanel recipientId={profile?.id} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', position: 'relative' }}>
      {/* Background blobs — hidden on mobile for perf */}
      <div className="hidden md:block" style={{ position: 'fixed', top: '-80px', right: '-80px', width: 400, height: 400, borderRadius: '50%', background: 'rgba(42,105,255,0.12)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div className="hidden md:block" style={{ position: 'fixed', bottom: '-60px', left: '-60px', width: 350, height: 350, borderRadius: '50%', background: 'rgba(168,130,255,0.10)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div className="hidden md:block" style={{ position: 'fixed', top: '45%', right: '15%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,180,130,0.08)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '100%',
          padding: '20px',
          paddingTop: 'max(28px, env(safe-area-inset-top))',
        }}
        className="pb-24 md:pb-5"
      >
        {/* Topbar */}
        <nav style={{ padding: '0 0 20px 0', position: 'relative', zIndex: 10 }}>
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5 shrink-0" style={{ textDecoration: 'none' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>U</span>
              </div>
              <span className="hidden sm:inline" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.2px' }}>
                Unchain Studio
              </span>
            </div>

            {/* Center nav pills — desktop only */}
            <div className="hidden lg:flex items-center gap-1 p-1" style={{
              background: 'var(--card)',
              borderRadius: 'var(--pill-radius)',
              boxShadow: 'var(--card-shadow)',
            }}>
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'tasks', label: 'Tasks' },
                { id: 'projects', label: 'Projects' },
                { id: 'tools', label: 'Tools' },
                { id: 'meetings', label: 'Meetings' },
                { id: 'invoices', label: 'Invoices' },
              ].map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '6px 14px',
                      borderRadius: 'var(--pill-radius)',
                      background: isActive ? 'var(--brand)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--muted)',
                      textDecoration: 'none',
                      transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
                      whiteSpace: 'nowrap',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Right: date + avatar — desktop */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '11px',
                color: 'var(--muted)',
                background: 'var(--card)',
                boxShadow: 'var(--card-shadow)',
                borderRadius: 'var(--pill-radius)',
                padding: '7px 14px',
              }}>
                Sun, Apr 5 · 16:25
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '12px',
              }}>
                {freelancerName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'US'}
              </div>
            </div>

            {/* Mobile: avatar only */}
            <div className="flex md:hidden items-center gap-2">
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>16:25</div>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '12px',
              }}>
                {freelancerName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'US'}
              </div>
            </div>
          </div>
        </nav>

        <main>
          {renderTab()}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 flex md:hidden">
        {[
          { id: "dashboard",     label: "Home",     Icon: LayoutDashboard },
          { id: "tasks",         label: "Tasks",    Icon: ClipboardList },
          { id: "projects",      label: "Projects", Icon: Briefcase },
          { id: "invoices",      label: "Invoices", Icon: FileText },
          { id: "profile",       label: "Profile",  Icon: User },
        ].map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          const badge = id === "notifications" && unreadCount > 0 ? unreadCount : null;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors relative ${isActive ? "text-[#2A69FF]" : "text-slate-500"}`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">{badge}</span>}
              </div>
              <span className="text-[9px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}