import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";

// Only columns that exist in the tasks table
const toTaskPayload = (d) => ({
  title: d.title,
  description: d.description || null,
  status: d.status || "Non commencé",
  category: d.category || "Update",
  client_name: d.client_name || null,
  assigned_to: d.assigned_to || null,
  assigned_freelancer_id:
    d.assigned_freelancer_id && d.assigned_freelancer_id !== "_me" && d.assigned_freelancer_id !== "_none"
      ? d.assigned_freelancer_id
      : null,
  due_date: d.due_date || null,
  images: d.images || [],
});
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, CheckSquare, Square, Trash2, AlertTriangle, Clock, CheckCircle2, Circle, MessageCircle, ChevronDown } from "lucide-react";
import { format, isToday, isPast, isTomorrow, isThisWeek, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import TaskFormDialog from "../components/tasks/TaskFormDialog";

const STATUS_CONFIG = {
  "Non commencé": { color: "bg-slate-100 text-slate-600", icon: Circle, dot: "bg-slate-400" },
  "En cours": { color: "bg-blue-100 text-blue-700", icon: Clock, dot: "bg-blue-500" },
  "Terminé": { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, dot: "bg-emerald-500" },
  "Bloqué": { color: "bg-red-100 text-red-700", icon: AlertTriangle, dot: "bg-red-500" }
};

const STATUS_LABEL = {
  "Non commencé": "Not started", "En cours": "In progress",
  "Terminé": "Done", "Bloqué": "Blocked"
};

const CATEGORY_LABEL = {
  "Design": "Design",
  "Video Editing": "Video Editing",
  "Web": "Web",
  "Merch": "Merch",
  "Analytics": "Analytics",
  "Administrative": "Administrative",
  "Posting": "Posting",
  "Update": "Update",
  "Personal": "Personal",
  // legacy values (still displayed if present in DB)
  "Commercial": "Commercial", "Contenu": "Content", "Administratif": "Administrative",
  "Montage": "Video Editing", "Vie perso": "Personal", "Autre": "Other"
};

const CATEGORY_STYLE = {
  "Personal": "bg-purple-50 text-purple-600",
  "Vie perso": "bg-purple-50 text-purple-600"
};

const STATUSES = ["Non commencé", "En cours", "Terminé", "Bloqué"];

function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Non commencé"];
  const doneCount = (task.checklist || []).filter((c) => c.done).length;
  const totalCount = (task.checklist || []).length;

  const thread = Array.isArray(task.note_thread) ? task.note_thread : [];
  const hasMessages = thread.length > 0;
  const lastMessage = hasMessages ? thread[thread.length - 1] : null;
  const lastFromFreelancer = lastMessage?.author_role === "freelancer";

  const dueBadge = () => {
    if (!task.due_date) return null;
    const d = new Date(task.due_date);
    if (task.status === "Terminé") return null;
    if (isToday(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Today</span>;
    if (isPast(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Overdue</span>;
    if (isTomorrow(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">Tomorrow</span>;
    return <span className="text-[10px] text-slate-400">{format(d, "d MMM", { locale: enUS })}</span>;
  };

  return (
    <div
      onClick={() => onEdit(task)} className="bg-[hsl(var(--card-hsl))] p-5 rounded-xl border border-slate-100 hover:shadow-sm hover:border-slate-200 transition-all cursor-pointer group">

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <button
            onClick={(e) => {e.stopPropagation();onStatusChange(task, task.status === "Terminé" ? "Non commencé" : "Terminé");}}
            className="shrink-0 mt-0.5 text-slate-300 hover:text-emerald-500 transition-colors">
            {task.status === "Terminé" ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
          </button>
          <p className={`text-sm font-medium flex-1 ${task.status === "Terminé" ? "line-through text-slate-400" : "text-slate-800"}`}>
            {task.title}
          </p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>
            {STATUS_LABEL[task.status] || task.status}
          </span>
          {hasMessages && (
            <span
              title={lastFromFreelancer ? `Note from ${task.assigned_to || "freelancer"}` : "Conversation"}
              className={`relative shrink-0 inline-flex items-center justify-center rounded-full p-1 ${
                lastFromFreelancer ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {lastFromFreelancer && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-white" />
              )}
            </span>
          )}
          <button
            onClick={(e) => {e.stopPropagation();onDelete(task.id);}}
            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="pl-6 space-y-2 mt-1">
          {task.description &&
          <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
          }
          <div className="flex flex-wrap items-center gap-2">
            {task.category && <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_STYLE[task.category] || "text-slate-400 bg-slate-50"}`}>{CATEGORY_LABEL[task.category] || task.category}</span>}
            {task.client_name &&
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{task.client_name}</span>
            }
            {task.assigned_to &&
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">{task.assigned_to}</span>
            }
            {dueBadge()}
          </div>
          {task.blocking_reason &&
          <p className="text-[10px] text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {task.blocking_reason}
          </p>
          }
          {totalCount > 0 &&
          <div className="flex items-center gap-1.5">
            <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${doneCount / totalCount * 100}%` }} />
            </div>
            <span className="text-[10px] text-slate-400">{doneCount}/{totalCount}</span>
          </div>
          }
        </div>
      </div>
    </div>);
}

function groupTasksByDate(tasks) {
  const today = startOfDay(new Date());
  const groups = {
    overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], noDate: [], done: []
  };
  for (const t of tasks) {
    if (t.status === "Terminé") { groups.done.push(t); continue; }
    if (!t.due_date) { groups.noDate.push(t); continue; }
    const d = startOfDay(new Date(t.due_date));
    if (isToday(d)) groups.today.push(t);
    else if (isPast(d)) groups.overdue.push(t);
    else if (isTomorrow(d)) groups.tomorrow.push(t);
    else if (isThisWeek(d, { weekStartsOn: 1 })) groups.thisWeek.push(t);
    else groups.later.push(t);
  }
  return groups;
}

const GROUP_CONFIG = [
  { key: "overdue", label: "Overdue", headerClass: "text-red-600", dotClass: "bg-red-500" },
  { key: "today", label: "Today", headerClass: "text-amber-600", dotClass: "bg-amber-500" },
  { key: "tomorrow", label: "Tomorrow", headerClass: "text-blue-600", dotClass: "bg-blue-500" },
  { key: "thisWeek", label: "This week", headerClass: "text-indigo-600", dotClass: "bg-indigo-400" },
  { key: "later", label: "Later", headerClass: "text-slate-500", dotClass: "bg-slate-400" },
  { key: "noDate", label: "No date", headerClass: "text-slate-400", dotClass: "bg-slate-300" },
];

function TaskGroups({ tasks, onEdit, onDelete, onStatusChange, filteringDone }) {
  // When filtering by "Done", don't separate into done section — group all by date
  const groups = filteringDone ? (() => {
    const g = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], noDate: [], done: [] };
    for (const t of tasks) {
      if (!t.due_date) { g.noDate.push(t); continue; }
      const d = startOfDay(new Date(t.due_date));
      if (isToday(d)) g.today.push(t);
      else if (isPast(d)) g.overdue.push(t);
      else if (isTomorrow(d)) g.tomorrow.push(t);
      else if (isThisWeek(d, { weekStartsOn: 1 })) g.thisWeek.push(t);
      else g.later.push(t);
    }
    return g;
  })() : groupTasksByDate(tasks);

  return (
    <div className="space-y-6">
      {GROUP_CONFIG.map(({ key, label, headerClass, dotClass }) => {
        const items = groups[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`w-2 h-2 rounded-full ${dotClass}`} />
              <h3 className={`text-sm font-semibold ${headerClass}`}>{label}</h3>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={(id) => onDelete(id)} onStatusChange={onStatusChange} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Done — collapsible (only when not already filtering by Done) */}
      {!filteringDone && groups.done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center gap-2 mb-2.5 list-none select-none py-1">
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-600">Done</h3>
            <span className="text-xs text-slate-400">{groups.done.length}</span>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1 opacity-70">
            {groups.done.map((task) => (
              <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={(id) => onDelete(id)} onStatusChange={onStatusChange} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function Tasks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [activeStatus, setActiveStatus] = useState("all");
  const [activeClient, setActiveClient] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeAssignee, setActiveAssignee] = useState("all");
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [mutError, setMutError] = useState(null);
  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_at")
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: () => base44.entities.Client.filter({ status: "Actif" })
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase.from('tasks').insert(toTaskPayload(d));
      if (error) throw error;
    },
    onSuccess: () => { setMutError(null); qc.invalidateQueries({ queryKey: ["tasks"] }); setDialogOpen(false); setEditTask(null); },
    onError: (e) => setMutError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { error } = await supabase.from('tasks').update(toTaskPayload(d)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { setMutError(null); qc.invalidateQueries({ queryKey: ["tasks"] }); setDialogOpen(false); setEditTask(null); },
    onError: (e) => setMutError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] })
  });

  const openNew = () => {setEditTask(null);setDialogOpen(true);};
  const openEdit = (task) => {setEditTask(task);setDialogOpen(true);};

  const handleSave = (data) => {
    if (data.id) updateMut.mutate({ id: data.id, d: data });else
    createMut.mutate(data);
  };

  const handleStatusChange = (task, newStatus) => {
    updateMut.mutate({ id: task.id, d: { ...task, status: newStatus } });
  };

  const taskAssignees = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))].sort();

  const noteNeedingAttention = (t) => {
    const thread = Array.isArray(t.note_thread) ? t.note_thread : [];
    if (thread.length === 0) return false;
    return thread[thread.length - 1]?.author_role === "freelancer";
  };

  const unansweredNotesCount = tasks.filter(noteNeedingAttention).length;

  const filtered = tasks
    .filter((t) => !onlyWithNotes || noteNeedingAttention(t))
    .filter((t) => activeStatus === "all" || t.status === activeStatus)
    .filter((t) => activeClient === "all" || t.client_name === activeClient)
    .filter((t) => activeCategory === "all" || t.category === activeCategory || (activeCategory === "Personal" && t.category === "Vie perso"))
    .filter((t) => activeAssignee === "all" || t.assigned_to === activeAssignee)
    .sort((a, b) => {
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const countByStatus = (s) => tasks.filter((t) => t.status === s).length;
  const taskClients = [...new Set(tasks.map((t) => t.client_name).filter(Boolean))];

  return (
    <div className="mx-auto px-4 md:px-6" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Tasks" subtitle="Team task management">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyWithNotes(v => !v)}
            title={onlyWithNotes ? "Showing notes" : "Notes to answer"}
            className={`inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg text-sm font-medium transition-all border ${
              onlyWithNotes
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{onlyWithNotes ? "Showing notes" : "Notes to answer"}</span>
            {unansweredNotesCount > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${onlyWithNotes ? "bg-white/25" : "bg-amber-100 text-amber-700"}`}>
                {unansweredNotesCount}
              </span>
            )}
          </button>
          <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
            <Plus className="w-4 h-4 mr-1" /> New task
          </Button>
        </div>
      </PageHeader>

      {/* Filtres statut */}
      <div className="relative mb-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          onClick={() => setActiveStatus("all")}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeStatus === "all" ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
          All <span className="ml-1 text-xs opacity-60">{tasks.length}</span>
        </button>
        {STATUSES.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeStatus === s ? cfg.color + " ring-1 ring-current" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {STATUS_LABEL[s] || s}
              <span className="text-xs opacity-60">{countByStatus(s)}</span>
            </button>);
        })}
      </div>

      {/* right fade hint */}
      </div>

      {/* Filtres client / assigned / catégorie — stacked */}
      <div className="space-y-2 mb-6">
        {/* Client */}
        {taskClients.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              <span className="shrink-0 text-xs text-slate-400 font-medium w-16">Client</span>
              <button onClick={() => setActiveClient("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeClient === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>All</button>
              {taskClients.map((c) =>
                <button key={c} onClick={() => setActiveClient(activeClient === c ? "all" : c)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeClient === c ? "bg-[#2A69FF] text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>{c}</button>
              )}
            </div>
                </div>
        )}
        {/* Assigned */}
        {taskAssignees.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              <span className="shrink-0 text-xs text-slate-400 font-medium w-16">Assigned</span>
              <button onClick={() => setActiveAssignee("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeAssignee === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>All</button>
              {taskAssignees.map((a) =>
                <button key={a} onClick={() => setActiveAssignee(activeAssignee === a ? "all" : a)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeAssignee === a ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100"}`}>
                  {a}<span className="ml-1 text-[10px] opacity-70">{tasks.filter(t => t.assigned_to === a).length}</span>
                </button>
              )}
            </div>
                </div>
        )}
        {/* Category */}
        <div className="relative">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="shrink-0 text-xs text-slate-400 font-medium w-16">Category</span>
            <button onClick={() => setActiveCategory("all")}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeCategory === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>All</button>
            <button onClick={() => setActiveCategory(activeCategory === "Personal" ? "all" : "Personal")}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${activeCategory === "Personal" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${activeCategory === "Personal" ? "bg-white" : "bg-purple-400"}`} />
              Personal<span className="text-[10px] opacity-70">{tasks.filter(t => t.category === "Personal" || t.category === "Vie perso").length}</span>
            </button>
            {["Design", "Video Editing", "Web", "Merch", "Analytics", "Administrative", "Posting", "Update"].filter(k => tasks.some(t => t.category === k)).map((k) =>
              <button key={k} onClick={() => setActiveCategory(activeCategory === k ? "all" : k)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeCategory === k ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {CATEGORY_LABEL[k] || k}<span className="ml-1 text-[10px] opacity-60">{tasks.filter(t => t.category === k).length}</span>
              </button>
            )}
          </div>
            </div>
      </div>

      {/* Liste groupée par période */}
      {filtered.length === 0 ?
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No tasks</p>
        </div> :

      <TaskGroups
        tasks={filtered}
        onEdit={openEdit}
        onDelete={(id) => deleteMut.mutate(id)}
        onStatusChange={handleStatusChange}
        filteringDone={activeStatus === "Terminé"}
      />
      }

      {mutError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl shadow-lg z-50 max-w-sm">
          <strong>Error:</strong> {mutError}
        </div>
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {setDialogOpen(v);if (!v) { setEditTask(null); setMutError(null); }}}
        task={editTask}
        onSave={handleSave} />
      
    </div>);

}