import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, CheckSquare, Square, Trash2, AlertTriangle, Clock, CheckCircle2, Circle } from "lucide-react";
import { format, isToday, isPast, isTomorrow } from "date-fns";
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

const PRIORITY_DOT = {
  "Basse": "🔵", "Normale": "🟢", "Haute": "🟠", "Urgente": "🔴"
};

const PRIORITY_LABEL = {
  "Basse": "Low", "Normale": "Normal", "Haute": "High", "Urgente": "Urgent"
};

const CATEGORY_LABEL = {
  "Commercial": "Commercial", "Contenu": "Content", "Administratif": "Admin",
  "Montage": "Editing", "Autre": "Other"
};

const STATUSES = ["Non commencé", "En cours", "Terminé", "Bloqué"];

function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Non commencé"];
  const doneCount = (task.checklist || []).filter((c) => c.done).length;
  const totalCount = (task.checklist || []).length;

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
      onClick={() => onEdit(task)} className="bg-[hsl(var(--card-hsl))] p-4 rounded-xl border border-slate-100 hover:shadow-sm hover:border-slate-200 transition-all cursor-pointer group">

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {e.stopPropagation();onStatusChange(task, task.status === "Terminé" ? "Non commencé" : "Terminé");}}
            className="shrink-0 text-slate-300 hover:text-emerald-500 transition-colors">
            {task.status === "Terminé" ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
          </button>
          <p className={`text-sm font-medium flex-1 truncate ${task.status === "Terminé" ? "line-through text-slate-400" : "text-slate-800"}`}>
            {task.title}
          </p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>
            {STATUS_LABEL[task.status] || task.status}
          </span>
          <button
            onClick={(e) => {e.stopPropagation();onDelete(task.id);}}
            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="pl-6 space-y-2">
          {task.description &&
          <p className="text-xs text-slate-400 line-clamp-1">{task.description}</p>
          }
          <div className="flex flex-wrap items-center gap-1.5">
            {task.priority && <span className="text-[10px]">{PRIORITY_DOT[task.priority]} {PRIORITY_LABEL[task.priority] || task.priority}</span>}
            {task.category && <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{CATEGORY_LABEL[task.category] || task.category}</span>}
            {task.client_name &&
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{task.client_name}</span>
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

export default function Tasks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [activeStatus, setActiveStatus] = useState("all");
  const [activeClient, setActiveClient] = useState("all");
  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date")
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: () => base44.entities.Client.filter({ status: "Actif" })
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Task.create(d),
    onSuccess: () => {qc.invalidateQueries({ queryKey: ["tasks"] });setDialogOpen(false);setEditTask(null);}
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Task.update(id, d),
    onSuccess: () => {qc.invalidateQueries({ queryKey: ["tasks"] });setDialogOpen(false);setEditTask(null);}
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

  const filtered = tasks.
  filter((t) => activeStatus === "all" || t.status === activeStatus).
  filter((t) => activeClient === "all" || t.client_name === activeClient);

  const countByStatus = (s) => tasks.filter((t) => t.status === s).length;
  const taskClients = [...new Set(tasks.map((t) => t.client_name).filter(Boolean))];

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Tasks" subtitle="Team task management">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New task
        </Button>
      </PageHeader>

      {/* Filtres statut */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setActiveStatus("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeStatus === "all" ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
          All <span className="ml-1 text-xs opacity-60">{tasks.length}</span>
        </button>
        {STATUSES.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeStatus === s ? cfg.color + " ring-1 ring-current" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {STATUS_LABEL[s] || s}
              <span className="text-xs opacity-60">{countByStatus(s)}</span>
            </button>);
        })}
      </div>

      {/* Filtres client */}
      {taskClients.length > 0 &&
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">Client:</span>
        <button
          onClick={() => setActiveClient("all")}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeClient === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
          All
        </button>
        {taskClients.map((c) =>
          <button
            key={c}
            onClick={() => setActiveClient(activeClient === c ? "all" : c)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeClient === c ? "bg-[#2A69FF] text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
            {c}
          </button>
        )}
      </div>
      }

      {/* Liste */}
      {filtered.length === 0 ?
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No tasks</p>
        </div> :

      <div className="grid grid-cols-3 gap-3">
          {filtered.map((task) =>
        <TaskCard
          key={task.id}
          task={task}
          onEdit={openEdit}
          onDelete={(id) => deleteMut.mutate(id)}
          onStatusChange={handleStatusChange} />

        )}
        </div>
      }

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {setDialogOpen(v);if (!v) setEditTask(null);}}
        task={editTask}
        onSave={handleSave} />
      
    </div>);

}