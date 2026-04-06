import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  FileText, CalendarDays, FileCheck, Wrench, Upload, ExternalLink,
  Clock, CheckCircle2, Square, AlertTriangle, FolderOpen, ClipboardList,
  LayoutDashboard, User, Bell, Briefcase, Plus, Trash2, ListTodo
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
function DashboardTab({ tasks, projects, freelancerName, onTabChange, userId }) {
  const [time, setTime] = useState("");
  const [personalTasks, setPersonalTasks] = useState([]);
  const today = format(new Date(), "EEEE, d MMMM yyyy", { locale: enUS });

  useEffect(() => {
    if (!userId) return;
    supabase.from('personal_tasks').select('*').order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setPersonalTasks(data || []));
  }, [userId]);

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
              {projects.length}
            </p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.60)', marginTop: 6 }}>
              assigned
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {[
              { label: 'Pending Projects', value: projects.filter(p => p.status === 'Pending acceptance').length },
              { label: 'In Progress', value: ongoingProjects.length },
              { label: 'Total Completed', value: projects.filter(p => p.status === 'Completed').length },
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
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{task.priority} {task.due_date && `· ${format(new Date(task.due_date), "d MMM", { locale: enUS })}`}</p>
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
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{p.client_name} {p.scheduled_date && `· ${format(new Date(p.scheduled_date), "d MMM", { locale: enUS })}`}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My To-Do Card */}
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
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>My To-Do</span>
            <button onClick={() => onTabChange("todo")} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>View all →</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {personalTasks.filter(t => t.status !== "Terminé").length === 0 ? (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>No pending to-dos</p>
            ) : (
              personalTasks.filter(t => t.status !== "Terminé").slice(0, 6).map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: task.priority === "Urgente" ? '#ef4444' : task.priority === "Haute" ? '#f59e0b' : task.priority === "Normale" ? '#3b82f6' : '#94a3b8' }} />
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 500, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                  {task.due_date && (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', flexShrink: 0 }}>
                      {format(new Date(task.due_date), "d MMM", { locale: enUS })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          {personalTasks.filter(t => t.status !== "Terminé").length > 0 && (
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--divider)', flexShrink: 0 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>
                {personalTasks.filter(t => t.status === "Terminé").length} done · {personalTasks.filter(t => t.status !== "Terminé").length} pending
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PERSONAL TASKS TAB ───────────────────────────────────────────────────
const PT_STATUS_CONFIG = {
  "Non commencé": { color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  "En cours":     { color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"  },
  "Terminé":      { color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  "Bloqué":       { color: "bg-red-100 text-red-700",     dot: "bg-red-500"   },
};
const PT_STATUSES = ["Non commencé", "En cours", "Terminé", "Bloqué"];
const PT_STATUS_LABEL = { "Non commencé": "Not started", "En cours": "In progress", "Terminé": "Done", "Bloqué": "Blocked" };
const PT_PRIORITY_DOT = { "Basse": "🔵", "Normale": "🟢", "Haute": "🟠", "Urgente": "🔴" };

function PersonalTasksTab({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [activeStatus, setActiveStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const emptyForm = { title: "", description: "", status: "Non commencé", priority: "Normale", due_date: "" };
  const [form, setForm] = useState(emptyForm);

  const fetchTasks = async () => {
    const { data } = await supabase.from('personal_tasks').select('*').order('created_at', { ascending: false });
    setTasks(data || []);
  };

  useEffect(() => { fetchTasks(); }, [userId]);

  const openNew = () => { setEditTask(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t) => { setEditTask(t); setForm({ title: t.title, description: t.description || "", status: t.status, priority: t.priority || "Normale", due_date: t.due_date || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    if (editTask) {
      await supabase.from('personal_tasks').update(form).eq('id', editTask.id);
    } else {
      await supabase.from('personal_tasks').insert({ user_id: userId, ...form });
    }
    setDialogOpen(false);
    await fetchTasks();
  };

  const handleDelete = async (id) => {
    await supabase.from('personal_tasks').delete().eq('id', id);
    setDialogOpen(false);
    await fetchTasks();
  };

  const handleStatusToggle = async (t) => {
    const next = t.status === "Terminé" ? "Non commencé" : "Terminé";
    await supabase.from('personal_tasks').update({ status: next }).eq('id', t.id);
    await fetchTasks();
  };

  const countByStatus = (s) => tasks.filter(t => t.status === s).length;
  const filtered = activeStatus === "all" ? tasks : tasks.filter(t => t.status === activeStatus);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My To-Do</h2>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-0.5">Personal task management</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--brand)' }}>
          <Plus className="w-4 h-4" /> New task
        </button>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button onClick={() => setActiveStatus("all")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeStatus === "all" ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
          All <span className="ml-1 text-xs opacity-60">{tasks.length}</span>
        </button>
        {PT_STATUSES.map(s => {
          const cfg = PT_STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setActiveStatus(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeStatus === s ? cfg.color + " ring-1 ring-current" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {PT_STATUS_LABEL[s]}
              <span className="text-xs opacity-60">{countByStatus(s)}</span>
            </button>
          );
        })}
      </div>

      {/* Task grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No tasks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(t => {
            const cfg = PT_STATUS_CONFIG[t.status] || PT_STATUS_CONFIG["Non commencé"];
            return (
              <div key={t.id} onClick={() => openEdit(t)} className="bg-white p-4 rounded-xl border border-slate-100 hover:shadow-sm hover:border-slate-200 transition-all cursor-pointer group">
                <div className="flex items-start gap-2">
                  <button onClick={e => { e.stopPropagation(); handleStatusToggle(t); }} className="shrink-0 mt-0.5 text-slate-300 hover:text-emerald-500 transition-colors">
                    {t.status === "Terminé" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium flex-1 truncate ${t.status === "Terminé" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>{PT_STATUS_LABEL[t.status]}</span>
                      <button onClick={e => { e.stopPropagation(); handleDelete(t.id); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {t.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.description}</p>}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {t.priority && <span className="text-[10px]">{PT_PRIORITY_DOT[t.priority]} {t.priority}</span>}
                      {t.due_date && <span className="text-[10px] text-slate-400">{format(new Date(t.due_date), "d MMM", { locale: enUS })}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDialogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-800 mb-4">{editTask ? "Edit task" : "New task"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Details..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                    {PT_STATUSES.map(s => <option key={s} value={s}>{PT_STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                    <option value="Basse">🔵 Low</option>
                    <option value="Normale">🟢 Normal</option>
                    <option value="Haute">🟠 High</option>
                    <option value="Urgente">🔴 Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Due date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="flex justify-between mt-5">
              {editTask ? (
                <button onClick={() => handleDelete(editTask.id)} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} disabled={!form.title.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--brand)' }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CALENDARS TAB ────────────────────────────────────────────────────────
const TYPE_COLORS_CAL = {
  Reel: "bg-pink-100 text-pink-700",
  Story: "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

function CalendarsTab({ visibleCalendars: initialCalendars }) {
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [editingItem, setEditingItem] = useState(null);
  const [descValue, setDescValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [localItems, setLocalItems] = useState(initialCalendars || []);

  const monthItems = localItems
    .filter(c => c.scheduled_date?.startsWith(currentMonth))
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

  const byClient = {};
  monthItems.forEach(item => {
    const key = item.client_name || "Unknown";
    if (!byClient[key]) byClient[key] = [];
    byClient[key].push(item);
  });

  const openEdit = (item) => { setEditingItem(item); setDescValue(item.description || ""); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('updateContentDescription', {
        body: { content_id: editingItem.id, description: descValue },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setLocalItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, description: descValue } : i));
      setEditingItem(null);
    } catch (e) {
      alert("Error saving: " + (e?.message || e));
    }
    setSaving(false);
  };

  const shiftMonth = (delta) => {
    const d = new Date(currentMonth + "-01");
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(format(d, "yyyy-MM"));
  };

  const monoStyle = { fontFamily: "'DM Mono', monospace" };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Editorial Calendars</h2>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-0.5" style={monoStyle}>Read-only · Descriptions editable</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 text-sm">‹</button>
          <span className="text-sm font-medium text-slate-700 w-32 text-center" style={monoStyle}>{format(new Date(currentMonth + "-01"), "MMMM yyyy", { locale: enUS })}</span>
          <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 text-sm">›</button>
        </div>
      </div>

      {monthItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{localItems.length === 0 ? "No calendars shared with you" : "No content this month"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byClient).map(([clientName, items]) => (
            <div key={clientName}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2" style={monoStyle}>{clientName}</h3>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 text-center w-10">
                        <p className="text-lg font-bold text-slate-700 leading-none">{format(new Date(item.scheduled_date), "d")}</p>
                        <p className="text-[9px] text-slate-400 uppercase" style={monoStyle}>{format(new Date(item.scheduled_date), "EEE", { locale: enUS })}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.post_type && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS_CAL[item.post_type] || "bg-slate-100 text-slate-600"}`}>{item.post_type}</span>}
                          <p className="text-sm font-medium text-slate-800 truncate flex-1">{item.title || "Untitled"}</p>
                        </div>
                        {item.description ? (
                          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{item.description}</p>
                        ) : (
                          <p className="text-xs text-slate-300 mt-1.5 italic">No description yet</p>
                        )}
                      </div>
                      <button
                        onClick={() => openEdit(item)}
                        className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center transition-colors"
                        title="Edit description"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-blue-500"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-800 mb-1">Edit description</h3>
            <p className="text-xs text-slate-400 mb-4" style={monoStyle}>{editingItem.client_name} · {editingItem.post_type} · {format(new Date(editingItem.scheduled_date), "d MMM yyyy", { locale: enUS })}</p>
            <p className="text-sm font-medium text-slate-700 mb-3">{editingItem.title}</p>
            <textarea
              value={descValue}
              onChange={e => setDescValue(e.target.value)}
              rows={5}
              placeholder="Write the description for this content..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingItem(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOOLS TAB ────────────────────────────────────────────────────────────
function ToolsTab({ tools }) {
  const allTools = [...tools].sort((a, b) => (a.order || 0) - (b.order || 0));
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
            <span className="text-xs text-slate-500">{m.date ? format(new Date(m.date), "d MMMM yyyy", { locale: enUS }) : "—"}{m.time && ` · ${m.time}`}</span>
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
                <td className="px-5 py-3 text-sm text-slate-500">{p.date ? format(new Date(p.date), "d MMM yyyy", { locale: enUS }) : "—"}</td>
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
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const init = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const res = await base44.functions.invoke('getFreelancerData', {});
        if (res.data?.error) throw new Error(res.data.error);
        setFreelancerData(res.data);
      } catch (e) {
        console.error(e);
        setLoadError(e.message || "Loading error");
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

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-700 font-medium mb-2">Unable to load the portal</p>
          <p className="text-sm text-red-500">{loadError}</p>
        </div>
      </div>
    );
  }

  const profile = freelancerData?.profile || null;
  const tasks = freelancerData?.tasks || [];
  const editorialProjects = freelancerData?.projects || [];
  const myProjects = freelancerData?.assignedProjects || [];
  const meetings = freelancerData?.meetings || [];
  const payments = freelancerData?.payments || [];
  const tools = freelancerData?.tools || [];
  const visibleCalendars = freelancerData?.visibleCalendars || [];
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
      case "dashboard": return <DashboardTab tasks={tasks} projects={editorialProjects} freelancerName={freelancerName} onTabChange={setActiveTab} userId={user?.id} />;
      case "todo": return <PersonalTasksTab userId={user?.id} />;
      case "tasks": return <TasksTabComponent tasks={tasks} onUpdateTask={handleUpdateTask} />;
      case "myprojects": return <FreelancerProjects projects={myProjects} onRefresh={handleProjectUpdate} freelancerName={freelancerName} />;
      case "projects": return <ProjectsTab projects={editorialProjects} onProjectUpdate={handleProjectUpdate} />;
      case "calendar": return <CalendarsTab visibleCalendars={visibleCalendars} />;
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
                { id: 'todo', label: 'My To-Do' },
                { id: 'tasks', label: 'Tasks' },
                { id: 'myprojects', label: 'Projects' },
                { id: 'projects', label: 'Editorial' },
                { id: 'calendar', label: 'Captions' },
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

            {/* Right: date + avatar + logout — desktop */}
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
              <button
                onClick={() => base44.auth.logout()}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '11px',
                  color: 'var(--muted)',
                  background: 'var(--card)',
                  boxShadow: 'var(--card-shadow)',
                  borderRadius: 'var(--pill-radius)',
                  padding: '7px 14px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>

            {/* Mobile: avatar + logout */}
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
              <button
                onClick={() => base44.auth.logout()}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '10px',
                  color: 'var(--muted)',
                  background: 'var(--card)',
                  boxShadow: 'var(--card-shadow)',
                  borderRadius: 'var(--pill-radius)',
                  padding: '6px 12px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
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
          { id: "dashboard",   label: "Home",      Icon: LayoutDashboard },
          { id: "myprojects",  label: "Projects",  Icon: Briefcase },
          { id: "projects",    label: "Editorial", Icon: FileText },
          { id: "invoices",    label: "Invoices",  Icon: FileText },
          { id: "profile",     label: "Profile",   Icon: User },
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