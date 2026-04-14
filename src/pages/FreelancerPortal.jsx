import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { getGreeting } from "@/lib/greeting";
import {
  FileText, CalendarDays, FileCheck, Wrench, Upload, ExternalLink,
  Clock, CheckCircle2, Square, AlertTriangle, FolderOpen, ClipboardList,
  LayoutDashboard, User, Bell, Briefcase, Plus, Trash2, ListTodo, Lightbulb, X,
  MoreHorizontal, AlignLeft
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Ideas from "./Ideas";

import FreelancerSidebar from "@/components/freelancer/FreelancerSidebar";
import UserMenu from "@/components/layout/UserMenu";
import NotificationBell from "@/components/layout/NotificationBell";
import ProfileTab from "./freelancer/ProfileTab";
import ProjectsTab from "./freelancer/ProjectsTab";
import CaptionsTab from "./freelancer/CaptionsTab";
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
function DashboardTab({ tasks, projects, payments, freelancerName, freelancerFirstName, onTabChange, userId }) {
  const [personalTasks, setPersonalTasks] = useState([]);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy", { locale: enUS });
  const thisMonthStr = format(new Date(), "yyyy-MM");
  const greeting = useMemo(() => getGreeting(freelancerFirstName || freelancerName?.split(" ")[0] || ""), [freelancerFirstName, freelancerName]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('personal_tasks').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setPersonalTasks(data || []));
  }, [userId]);

  const priOrder = { "Urgente": 0, "Haute": 1, "Normale": 2, "Basse": 3 };

  // Most urgent task (blue hero)
  const nextTask = tasks
    .filter(t => t.status !== "Terminé")
    .sort((a, b) => {
      const pDiff = (priOrder[a.priority] ?? 2) - (priOrder[b.priority] ?? 2);
      if (pDiff !== 0) return pDiff;
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })[0] || null;

  // Tasks due today
  const todayTasks = tasks
    .filter(t => t.status !== "Terminé" && t.due_date && t.due_date.slice(0, 10) === todayStr)
    .sort((a, b) => (priOrder[a.priority] ?? 2) - (priOrder[b.priority] ?? 2));

  const pendingCount = tasks.filter(t => t.status !== "Terminé").length;
  const completedCount = tasks.filter(t => t.status === "Terminé").length;

  const ongoingProjects = projects.filter(p =>
    p.editing_status === "En cours de montage" || p.editing_status === "À faire"
  );

  // Revenues this month
  const monthPayments = (payments || []).filter(p => p.date && p.date.slice(0, 7) === thisMonthStr);
  const revenueTotal = monthPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const revenuePaid = monthPayments.filter(p => p.status === "Paid" || p.status === "Payé").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const revenuePending = monthPayments.filter(p => p.status === "Pending" || p.status === "En attente").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const priColor = { "Urgente": "#ef4444", "Haute": "#f59e0b", "Normale": "#3b82f6", "Basse": "#94a3b8" };

  const cardBase = {
    background: 'var(--card)',
    borderRadius: 'var(--card-radius)',
    boxShadow: 'var(--card-shadow)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(20px, 5.5vw, 28px)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
          {greeting}
        </h2>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginTop: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {todayLabel}
        </p>
      </div>

      {/* Row 1: Blue hero + Today's Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Blue card — next urgent task */}
        <div style={{
          background: 'linear-gradient(145deg, #1a3a8f 0%, #2A69FF 60%, #5b8fff 100%)',
          borderRadius: 'var(--card-radius)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 180,
        }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Next up
          </span>
          {nextTask ? (
            <>
              <div style={{ margin: '16px 0 8px' }}>
                {nextTask.priority && (
                  <span style={{
                    display: 'inline-block', marginBottom: 8,
                    fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: '#fff', background: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '3px 8px',
                  }}>
                    {nextTask.priority}
                  </span>
                )}
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 700, color: '#fff', lineHeight: 1.3, margin: 0 }}>
                  {nextTask.title}
                </p>
              </div>
              {nextTask.due_date && (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                  Due {format(new Date(nextTask.due_date), "d MMM yyyy", { locale: enUS })}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>
              No pending tasks
            </p>
          )}
        </div>

        {/* Today's Focus */}
        <div className="lg:col-span-2" style={{ ...cardBase, minHeight: 180 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Today's Focus</span>
            <button onClick={() => onTabChange("tasks")} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>
              See all tasks →
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayTasks.length === 0 ? (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>Nothing due today</p>
            ) : (
              todayTasks.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: priColor[task.priority] || '#94a3b8' }} />
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {task.title}
                  </p>
                  {task.priority && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', flexShrink: 0 }}>
                      {task.priority}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Tasks stats + Active Projects + My To-Do */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Tasks Pending + Completed */}
        <div style={cardBase}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16, display: 'block' }}>Tasks</span>
          <div className="grid grid-cols-2 gap-3" style={{ flex: 1 }}>
            <div style={{ background: 'var(--card-blue)', borderRadius: 12, padding: '16px 14px' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Pending</p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '36px', fontWeight: 800, color: 'var(--brand)', letterSpacing: '-2px', lineHeight: 1, margin: 0 }}>
                {pendingCount}
              </p>
            </div>
            <div style={{ background: 'var(--card-green)', borderRadius: 12, padding: '16px 14px' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Completed</p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '36px', fontWeight: 800, color: 'var(--success)', letterSpacing: '-2px', lineHeight: 1, margin: 0 }}>
                {completedCount}
              </p>
            </div>
          </div>
        </div>

        {/* Active Projects */}
        <div style={{ ...cardBase, minHeight: 220 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Active Projects</span>
            <button onClick={() => onTabChange("myprojects")} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>
              View all →
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ongoingProjects.length === 0 ? (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>No active projects</p>
            ) : (
              ongoingProjects.slice(0, 5).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FolderOpen style={{ width: 13, height: 13, color: 'var(--brand)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                      {p.title || "Untitled"}
                    </p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
                      {p.client_name}{p.scheduled_date && ` · ${format(new Date(p.scheduled_date), "d MMM", { locale: enUS })}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My To-Do */}
        <div style={{ ...cardBase, minHeight: 220 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>My To-Do</span>
            <button onClick={() => onTabChange("todo")} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>
              View all →
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {personalTasks.filter(t => t.status !== "Terminé").length === 0 ? (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>No pending to-dos</p>
            ) : (
              personalTasks.filter(t => t.status !== "Terminé").slice(0, 6).map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: priColor[task.priority] || '#94a3b8' }} />
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 500, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {task.title}
                  </p>
                  {task.due_date && (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', flexShrink: 0, margin: 0 }}>
                      {format(new Date(task.due_date), "d MMM", { locale: enUS })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          {personalTasks.length > 0 && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--divider)', flexShrink: 0, marginTop: 8 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
                {personalTasks.filter(t => t.status === "Terminé").length} done · {personalTasks.filter(t => t.status !== "Terminé").length} pending
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Revenues this month */}
      <div style={{ ...cardBase }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16, flexShrink: 0 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Revenues — {format(new Date(), "MMMM yyyy", { locale: enUS })}
          </span>
          <button onClick={() => onTabChange("invoices")} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>
            View invoices →
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: revenueTotal, color: 'var(--ink)' },
            { label: 'Paid', value: revenuePaid, color: 'var(--success)' },
            { label: 'Pending', value: revenuePending, color: 'var(--warning)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--card-blue)', borderRadius: 12, padding: '16px 14px' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, margin: '0 0 8px' }}>{label}</p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 800, color, letterSpacing: '-1px', lineHeight: 1, margin: 0 }}>
                {value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
            </div>
          ))}
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

function PersonalTasksTab({ userId, newTrigger }) {
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

  useEffect(() => {
    if (newTrigger > 0) { setEditTask(null); setForm(emptyForm); setDialogOpen(true); }
  }, [newTrigger]);

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
  const [expandedIds, setExpandedIds] = useState(new Set());
  const toggleExpand = (id) => setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-end mb-5">
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
                          <div className="mt-1.5">
                            <p className={`text-xs text-slate-500 whitespace-pre-wrap ${expandedIds.has(item.id) ? '' : 'line-clamp-2'}`}>{item.description}</p>
                            <button onClick={() => toggleExpand(item.id)} className="text-[10px] text-slate-300 hover:text-slate-500 mt-0.5">
                              {expandedIds.has(item.id) ? '↑ less' : '↓ more'}
                            </button>
                          </div>
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
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-base font-semibold text-slate-800">
                {descValue ? "Edit caption" : "Write caption"}
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${descValue ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`} style={monoStyle}>
                {descValue ? "Editing draft" : "From scratch"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-1" style={monoStyle}>{editingItem.client_name} · {editingItem.post_type} · {format(new Date(editingItem.scheduled_date), "d MMM yyyy", { locale: enUS })}</p>
            <p className="text-sm font-medium text-slate-700 mb-3">{editingItem.title}</p>
            <textarea
              value={descValue}
              onChange={e => setDescValue(e.target.value)}
              rows={7}
              autoFocus
              placeholder="Write your caption here — start from scratch or build on the draft above..."
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
          {m.link && (
            <a href={m.link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-[#2A69FF] hover:underline break-all">
              <ExternalLink className="w-3 h-3 shrink-0" />{m.link}
            </a>
          )}
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

// ─── INVOICES & CONTRACT TAB ──────────────────────────────────────────────
function InvoicesTab({ payments, freelancerName, freelancerId, onPaymentAdded, openTrigger, profile }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (openTrigger > 0) openNew();
  }, [openTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setFormData({
      mission: "", client_name: "", amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      invoice_url: "",
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.mission) { setError("Mission is required."); return; }
    setSaving(true); setError(null);
    try {
      const { error: err } = await supabase.from("freelancer_payments").insert({
        freelancer_id: freelancerId,
        freelancer_name: freelancerName,
        mission: formData.mission,
        client_name: formData.client_name,
        amount: parseFloat(formData.amount) || 0,
        date: formData.date,
        status: "Pending",
        invoice_url: formData.invoice_url,
      });
      if (err) throw err;
      qc.invalidateQueries({ queryKey: ["freelancer-payments"] });
      onPaymentAdded();
      setDialogOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const STATUS_COLORS = {
    "Pending": "bg-amber-50 text-amber-700",
    "Paid": "bg-emerald-50 text-emerald-700",
    "Overdue": "bg-red-50 text-red-700",
    "En attente": "bg-amber-50 text-amber-700",
    "Payé": "bg-emerald-50 text-emerald-700",
  };

  const total = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const paid = payments.filter(p => p.status === "Paid" || p.status === "Payé").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const pending = payments.filter(p => p.status === "Pending" || p.status === "En attente").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Contract section */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <FileCheck className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Freelancer Contract</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {profile?.contract_url ? "Document provided by Unchain Studio. Read only." : "No contract available yet — contact the Unchain Studio team."}
          </p>
        </div>
        {profile?.contract_url && (
          <a href={profile.contract_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors shrink-0">
            <FileText className="w-3.5 h-3.5" /> View
          </a>
        )}
      </div>

      <div>
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-medium">Total</p>
          <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">{total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-medium">Paid</p>
          <p className="text-base sm:text-lg font-bold text-emerald-600 mt-1">{paid.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-medium">Pending</p>
          <p className="text-base sm:text-lg font-bold text-amber-600 mt-1">{pending.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
        </div>
      </div>

      {/* Empty state */}
      {payments.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-10 text-center text-sm text-slate-400">
          No invoices yet — <button onClick={openNew} className="text-brand hover:underline font-medium">submit your first one</button>
        </div>
      )}

      {/* ── Mobile: card list ── */}
      {payments.length > 0 && (
        <div className="sm:hidden space-y-3">
          {payments.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-800 leading-snug flex-1">{p.mission || p.description || "—"}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>{p.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  {p.client_name && <p className="text-xs text-slate-500">{p.client_name}</p>}
                  {p.date && <p className="text-xs text-slate-400">{format(new Date(p.date), "d MMM yyyy", { locale: enUS })}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {p.amount ? <p className="text-sm font-bold text-slate-800">{parseFloat(p.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p> : <p className="text-sm text-slate-400">—</p>}
                  {p.invoice_url && (
                    <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-brand flex items-center gap-1 text-xs font-medium">
                      <FileText className="w-3.5 h-3.5" /> PDF
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop: table ── */}
      {payments.length > 0 && (
        <div className="hidden sm:block bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Mission</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Date</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Status</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Amount</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-800">{p.mission || p.description || "—"}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{p.client_name || "—"}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{p.date ? format(new Date(p.date), "d MMM yyyy", { locale: enUS }) : "—"}</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>{p.status}</span></td>
                  <td className="px-5 py-3 text-sm font-semibold text-right text-slate-800">{p.amount ? `${parseFloat(p.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—"}</td>
                  <td className="px-5 py-3">{p.invoice_url && <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline text-xs flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> PDF</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setError(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit an invoice</DialogTitle></DialogHeader>
          {formData && (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Mission / Description *</Label>
                <Input value={formData.mission} onChange={e => setFormData({ ...formData, mission: e.target.value })} placeholder="e.g. Video editing — April 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount (€)</Label>
                  <Input type="number" value={formData.amount} placeholder="0.00" onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Client (optional)</Label>
                <Input value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} placeholder="Client name" />
              </div>
              <div>
                <Label>Invoice PDF</Label>
                {formData.invoice_url ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 mt-1">
                    <FileText className="w-4 h-4 text-brand shrink-0" />
                    <a href={formData.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex-1 truncate">
                      {decodeURIComponent(formData.invoice_url.split("/").pop().split("?")[0])}
                    </a>
                    <button onClick={() => setFormData({ ...formData, invoice_url: "" })} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className={`cursor-pointer flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand border border-dashed border-slate-200 rounded-lg px-4 py-2.5 w-full justify-center hover:border-brand/40 transition-colors mt-1 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Attach PDF"}
                    <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploading(true);
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setFormData(d => ({ ...d, invoice_url: file_url }));
                      } catch (err) { setError(err.message); }
                      finally { setUploading(false); e.target.value = ""; }
                    }} />
                  </label>
                )}
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} className="bg-slate-800 hover:bg-slate-700 text-white" disabled={saving || !formData.mission}>
                  {saving ? "Submitting…" : "Submit invoice"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

// ─── PER-FREELANCER HIDDEN NAV ITEMS (fallback until DB migration is applied) ─
const HIDDEN_NAV_BY_ID = {
  'a83475b8-6afe-45c8-bbfb-7afcbbabfe54': ['projects', 'tools', 'meetings'], // Domnin
  '2ba918c3-a88e-4b9f-a570-68d8e6b0c1ed': ['tools'],
};
function getHiddenNav(profile) {
  if (profile?.hidden_nav_items?.length) return profile.hidden_nav_items;
  return HIDDEN_NAV_BY_ID[profile?.id] || [];
}

// ─── MAIN PORTAL ──────────────────────────────────────────────────────────
const TAB_TITLES = {
  dashboard: "Dashboard",
  tasks: "My Tasks",
  myprojects: "My Projects",
  projects: "Editorial Projects",
  tools: "Tools",
  meetings: "Meetings",
  invoices: "Invoices & Contract",
  contract: "Invoices & Contract",
  profile: "My Profile",
  notifications: "Notifications",
};

export default function FreelancerPortal() {
  const [user, setUser] = useState(null);
  const [freelancerData, setFreelancerData] = useState(null); // { profile, tasks, projects, meetings, payments, tools }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [todoNewTrigger, setTodoNewTrigger] = useState(0);
  const [invoiceOpenTrigger, setInvoiceOpenTrigger] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [time, setTime] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      const diff = current - lastScrollY.current;
      if (diff > 6) setNavVisible(false);
      else if (diff < -4) setNavVisible(true);
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Helsinki" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
  const freelancerFirstName = profile?.first_name || freelancerName?.split(" ")[0] || "";
  const unreadCount = myProjects.filter(p => p.status === "Pending acceptance").length;

  const handleUpdateTask = async (task, updates) => {
    // Optimistic update so the UI responds immediately
    setFreelancerData(prev => ({
      ...prev,
      tasks: (prev?.tasks || []).map(t => t.id === task.id ? { ...t, ...updates } : t),
    }));
    const payload = updates.status
      ? { update_task_id: task.id, update_task_status: updates.status }
      : {};
    const res = await base44.functions.invoke('getFreelancerData', payload);
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
      case "dashboard": return <DashboardTab tasks={tasks} projects={editorialProjects} payments={payments} freelancerName={freelancerName} freelancerFirstName={freelancerFirstName} onTabChange={setActiveTab} userId={user?.id} />;
      case "todo": return <PersonalTasksTab userId={user?.id} newTrigger={todoNewTrigger} />;
      case "tasks": return <TasksTabComponent tasks={tasks} onUpdateTask={handleUpdateTask} />;
      case "myprojects": return <FreelancerProjects projects={myProjects} editorialItems={editorialProjects} onRefresh={handleProjectUpdate} freelancerName={freelancerName} />;
      case "projects": return <ProjectsTab projects={[...editorialProjects, ...visibleCalendars.filter(vc => !editorialProjects.find(ep => ep.id === vc.id))]} />;
      case "captions": return <CaptionsTab items={[...editorialProjects, ...visibleCalendars.filter(vc => !editorialProjects.find(ep => ep.id === vc.id))]} />;
      case "calendar": return <CalendarsTab visibleCalendars={visibleCalendars} />;
      case "ideas": return <Ideas currentUserId={user?.id} currentUserName={profile?.name || user?.email} isFreelancer={true} />;
      case "tools": return <ToolsTab tools={tools} />;
      case "meetings": return <MeetingsTab meetings={meetings} />;
      case "invoices":
      case "contract": return <InvoicesTab payments={payments} freelancerName={freelancerName} freelancerId={profile?.id} onPaymentAdded={handlePaymentAdded} openTrigger={invoiceOpenTrigger} profile={profile} />;
      case "profile": return <ProfileTab user={user} freelancerProfile={profile} onProfileUpdate={(p) => setFreelancerData(d => ({ ...d, profile: p }))} />;
      case "notifications": return <NotificationsPanel freelancerId={profile?.id} onAccept={(pid) => handleProjectUpdate()} onDecline={(pid) => handleProjectUpdate()} />;
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
          paddingLeft: '20px',
          paddingRight: '20px',
          paddingTop: 'max(28px, env(safe-area-inset-top))',
        }}
        className="pb-36 md:pb-5"
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
                { id: 'projects', label: 'Calendar' },

                ...(profile?.ideas_access ? [{ id: 'ideas', label: 'Ideas' }] : []),
                { id: 'tools', label: 'Tools' },
                { id: 'meetings', label: 'Meetings' },
                { id: 'invoices', label: 'Invoices' },
              ].filter(item => !getHiddenNav(profile).includes(item.id)).map(item => {
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

            {/* Right: date + bell + avatar menu — desktop */}
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
                {format(new Date(), "EEE, MMM d", { locale: enUS })} · {time}
              </div>
              <NotificationBell recipientId={profile?.id} />
              <UserMenu
                userName={freelancerName}
                userEmail={user?.email}
                initials={freelancerName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'US'}
                onSettingsClick={() => setActiveTab('profile')}
              />
            </div>

            {/* Mobile: time + bell + avatar menu */}
            <div className="flex md:hidden items-center gap-2">
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{time}</div>
              <NotificationBell recipientId={profile?.id} />
              <UserMenu
                userName={freelancerName}
                userEmail={user?.email}
                initials={freelancerName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'US'}
                onSettingsClick={() => setActiveTab('profile')}
              />
            </div>
          </div>
        </nav>

        <main>
          <div className="mx-auto" style={{ maxWidth: '1400px' }}>
            {activeTab !== 'dashboard' && (() => {
              const TAB_TITLES = {
                todo:        { title: 'My To-Do',       subtitle: 'Your personal task list' },
                tasks:       { title: 'Tasks',           subtitle: 'Tasks assigned to you' },
                myprojects:  { title: 'Projects',        subtitle: 'Projects assigned to you' },
                projects:    { title: 'Editorial Calendar', subtitle: 'Content schedule & captions' },
                calendar:    { title: 'Shared Calendars', subtitle: 'Editorial calendars shared with you' },
                captions:    { title: 'Captions',         subtitle: 'Write captions for this month\'s content' },
                ideas:       { title: 'Ideas',           subtitle: 'Brainstorm content ideas' },
                tools:       { title: 'Tools',           subtitle: 'Your tools & resources' },
                meetings:    { title: 'Meetings',        subtitle: 'Upcoming & past meetings' },
                invoices:    { title: 'Invoices & Contract', subtitle: 'Your payments and contract' },
                contract:    { title: 'Invoices & Contract', subtitle: 'Your payments and contract' },
                profile:     { title: 'Profile',         subtitle: 'Your information & settings' },
                notifications: { title: 'Notifications', subtitle: 'Your latest updates' },
              };
              const meta = TAB_TITLES[activeTab];
              if (!meta) return null;
              return (
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h1 className="text-xl sm:text-2xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0 }}>
                      {meta.title}
                    </h1>
                    <p className="hidden sm:block" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {meta.subtitle}
                    </p>
                  </div>
                  {activeTab === 'todo' && (
                    <button
                      onClick={() => setTodoNewTrigger(n => n + 1)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 12, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      <Plus style={{ width: 14, height: 14 }} /> <span className="hidden sm:inline">New task</span><span className="sm:hidden">New</span>
                    </button>
                  )}
                  {activeTab === 'projects' && (
                    <button
                      onClick={() => setActiveTab('captions')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 12, background: 'var(--card)', color: 'var(--brand)', border: '1px solid var(--divider)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      Captions →
                    </button>
                  )}
                  {activeTab === 'captions' && (
                    <button
                      onClick={() => setActiveTab('projects')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 12, background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--divider)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      ← <span className="hidden sm:inline">Calendar</span><span className="sm:hidden">Cal.</span>
                    </button>
                  )}
                  {activeTab === 'invoices' && (
                    <button
                      onClick={() => setInvoiceOpenTrigger(n => n + 1)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 12, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      <Plus style={{ width: 14, height: 14 }} /> <span className="hidden sm:inline">Submit an invoice</span><span className="sm:hidden">Invoice</span>
                    </button>
                  )}
                </div>
              );
            })()}
            {renderTab()}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav — liquid glass */}
      <>
        <nav
          className="fixed left-4 right-4 z-50 flex md:hidden items-center"
          style={{
            bottom: `calc(12px + env(safe-area-inset-bottom))`,
            height: 64,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,1) inset',
            transform: navVisible ? 'translateY(0)' : 'translateY(calc(100% + 20px))',
            transition: 'transform 320ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Top specular shimmer */}
          <div style={{
            position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,1) 60%, transparent)',
            pointerEvents: 'none',
          }} />

          {(profile?.id === 'a83475b8-6afe-45c8-bbfb-7afcbbabfe54' ? [
            { id: "dashboard",  label: "Home",     Icon: LayoutDashboard },
            { id: "todo",       label: "My To-Do", Icon: ListTodo },
            { id: "tasks",      label: "Tasks",    Icon: ClipboardList },
            { id: "myprojects", label: "Projects", Icon: Briefcase },
            { id: "invoices",   label: "Invoices", Icon: FileText },
          ] : [
            { id: "dashboard",  label: "Home",      Icon: LayoutDashboard },
            { id: "myprojects", label: "Projects",  Icon: Briefcase },
            { id: "projects",   label: "Editorial", Icon: CalendarDays },
            { id: "invoices",   label: "Invoices",  Icon: FileText },
          ]).map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button key={id} onClick={() => { setActiveTab(id); setMoreOpen(false); }}
                className="flex-1 flex flex-col items-center justify-center gap-1 relative"
                style={{ background: 'none', border: 'none', cursor: 'pointer', height: '100%' }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', width: 64, height: 52, borderRadius: 16,
                    background: 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)',
                    boxShadow: '0 4px 12px rgba(42,105,255,0.35)',
                    top: '50%', transform: 'translateY(-50%)',
                  }} />
                )}
                <Icon className="w-[19px] h-[19px] relative z-10"
                  style={{ color: isActive ? '#fff' : 'rgba(30,40,70,0.5)', strokeWidth: isActive ? 2.2 : 1.8 }} />
                <span className="relative z-10" style={{ fontSize: '9px', fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: '0.04em', color: isActive ? '#fff' : 'rgba(30,40,70,0.5)' }}>
                  {label}
                </span>
              </button>
            );
          })}

          {/* More button */}
          {profile?.id !== 'a83475b8-6afe-45c8-bbfb-7afcbbabfe54' && ((() => {
            const moreActive = moreOpen || ['profile','tasks','todo','captions','ideas','tools','meetings'].includes(activeTab);
            return (
              <button onClick={() => setMoreOpen(v => !v)}
                className="flex-1 flex flex-col items-center justify-center gap-1 relative"
                style={{ background: 'none', border: 'none', cursor: 'pointer', height: '100%' }}
              >
                {moreActive && (
                  <div style={{
                    position: 'absolute', width: 64, height: 52, borderRadius: 16,
                    background: 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)',
                    boxShadow: '0 4px 12px rgba(42,105,255,0.35)',
                    top: '50%', transform: 'translateY(-50%)',
                  }} />
                )}
                {moreOpen
                  ? <X className="w-[19px] h-[19px] relative z-10" style={{ color: moreActive ? '#fff' : 'rgba(30,40,70,0.5)', strokeWidth: 2 }} />
                  : <MoreHorizontal className="w-[19px] h-[19px] relative z-10" style={{ color: moreActive ? '#fff' : 'rgba(30,40,70,0.5)', strokeWidth: 1.8 }} />
                }
                <span className="relative z-10" style={{ fontSize: '9px', fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: '0.04em', color: moreActive ? '#fff' : 'rgba(30,40,70,0.5)' }}>
                  More
                </span>
              </button>
            );
          })())}
        </nav>

        {/* More sheet */}
        {moreOpen && (
          <>
            <div
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
              onClick={() => setMoreOpen(false)}
            />
            <div
              className="fixed left-4 right-4 z-40 md:hidden"
              style={{
                bottom: `calc(88px + env(safe-area-inset-bottom))`,
                borderRadius: 24,
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.95)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
                padding: '20px 16px 16px',
              }}
            >
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(30,40,70,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, paddingLeft: 4 }}>
                More
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'profile',   label: 'Profile',   Icon: User },
                  { id: 'tasks',     label: 'Tasks',     Icon: ClipboardList },
                  { id: 'todo',      label: 'To-Do',     Icon: ListTodo },
                  { id: 'captions',  label: 'Captions',  Icon: AlignLeft },
                  ...(profile?.ideas_access ? [{ id: 'ideas', label: 'Ideas', Icon: Lightbulb }] : []),
                  { id: 'tools',     label: 'Tools',     Icon: Wrench },
                  { id: 'meetings',  label: 'Meetings',  Icon: CalendarDays },
                ].filter(item => !getHiddenNav(profile).includes(item.id)).map(({ id, label, Icon }) => {
                  const isActive = activeTab === id;
                  return (
                    <button key={id}
                      onClick={() => { setActiveTab(id); setMoreOpen(false); }}
                      className="flex flex-col items-center gap-1.5 py-3.5"
                      style={{
                        borderRadius: 16,
                        background: isActive ? 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)' : 'rgba(30,40,70,0.05)',
                        border: isActive ? 'none' : '1px solid rgba(30,40,70,0.08)',
                        boxShadow: isActive ? '0 4px 12px rgba(42,105,255,0.3)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: isActive ? '#fff' : 'rgba(30,40,70,0.55)', strokeWidth: isActive ? 2.2 : 1.8 }} />
                      <span style={{ fontSize: '9px', fontFamily: "'DM Mono', monospace", fontWeight: 500, textAlign: 'center', color: isActive ? '#fff' : 'rgba(30,40,70,0.55)' }}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </>
    </div>
  );
}