import { useState } from "react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckSquare, Square, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_CONFIG = {
  "Non commencé": { color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  "En cours":     { color: "bg-blue-100 text-blue-700",  dot: "bg-blue-500" },
  "Terminé":      { color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  "Bloqué":       { color: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

const STATUS_LABEL = {
  "Non commencé": "Not started",
  "En cours":     "In progress",
  "Terminé":      "Done",
  "Bloqué":       "Blocked",
};

const PRIORITY_LABEL = {
  "Urgente": "Urgent",
  "Haute":   "High",
  "Normale": "Normal",
  "Basse":   "Low",
};

const PRIORITY_COLOR = {
  "Urgente": "text-red-500", "Haute": "text-orange-500", "Normale": "text-blue-500", "Basse": "text-slate-400"
};

function DueBadge({ task }) {
  if (!task.due_date || task.status === "Terminé") return null;
  const d = new Date(task.due_date);
  if (isToday(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Today</span>;
  if (isPast(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Overdue</span>;
  if (isTomorrow(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">Tomorrow</span>;
  return <span className="text-[10px] text-slate-400">{format(d, "d MMM", { locale: enUS })}</span>;
}

function TaskRow({ task, onUpdateTask }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Non commencé"];
  const doneCount = (task.checklist || []).filter(c => c.done).length;
  const totalCount = (task.checklist || []).length;
  const isDone = task.status === "Terminé";
  const hasDetails = task.description || task.blocking_reason || task.notes || totalCount > 0;

  const cycleStatus = () => {
    const order = ["Non commencé", "En cours", "Terminé"];
    const idx = order.indexOf(task.status);
    const next = order[(idx + 1) % order.length];
    onUpdateTask(task, { status: next });
  };

  return (
    <div className={`bg-white rounded-xl border transition-all ${isDone ? "border-slate-100 opacity-70" : "border-slate-100 hover:border-slate-200"} shadow-sm overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={cycleStatus}
            className="shrink-0 mt-0.5 transition-colors"
          >
            {isDone
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : task.status === "En cours"
                ? <Clock className="w-5 h-5 text-blue-500" />
                : task.status === "Bloqué"
                  ? <AlertTriangle className="w-5 h-5 text-red-500" />
                  : <Circle className="w-5 h-5 text-slate-300 hover:text-slate-500" />
            }
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
              {task.title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{STATUS_LABEL[task.status] || task.status}</span>
              {task.priority && (
                <span className={`text-[10px] font-medium ${PRIORITY_COLOR[task.priority] || ""}`}>{PRIORITY_LABEL[task.priority] || task.priority}</span>
              )}
              {task.client_name && (
                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{task.client_name}</span>
              )}
              <DueBadge task={task} />
              {totalCount > 0 && (
                <span className="text-[10px] text-slate-400">{doneCount}/{totalCount} subtasks</span>
              )}
            </div>
            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[120px]">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${(doneCount / totalCount) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Expand toggle */}
          {hasDetails && (
            <button onClick={() => setExpanded(v => !v)} className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Accordion */}
      {expanded && hasDetails && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-3">
          {task.description && (
            <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
          )}
          {task.blocking_reason && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{task.blocking_reason}</span>
            </div>
          )}
          {totalCount > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subtasks</p>
              {(task.checklist || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.done
                    ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  }
                  <span className={`text-xs ${item.done ? "line-through text-slate-400" : "text-slate-600"}`}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
          {task.notes && (
            <div className="text-xs text-slate-500 bg-white rounded-lg border border-slate-100 p-2.5">
              {task.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "deadline", label: "Deadline" },
  { value: "priority", label: "Priority" },
  { value: "client", label: "Client" },
  { value: "status", label: "Status" },
];

const PRIORITY_ORDER = { "Urgente": 0, "Haute": 1, "Normale": 2, "Basse": 3 };
const STATUS_ORDER = { "En cours": 0, "Bloqué": 1, "Non commencé": 2, "Terminé": 3 };

export default function TasksTab({ tasks, onUpdateTask }) {
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");
  const [showFilters, setShowFilters] = useState(false);

  const clients = [...new Set(tasks.map(t => t.client_name).filter(Boolean))];

  const filtered = tasks
    .filter(t => filterClient === "all" || t.client_name === filterClient)
    .filter(t => filterStatus === "all" || t.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === "deadline") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      }
      if (sortBy === "priority") return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      if (sortBy === "client") return (a.client_name || "").localeCompare(b.client_name || "");
      if (sortBy === "status") return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      return 0;
    });

  const pending = filtered.filter(t => t.status !== "Terminé");
  const done = filtered.filter(t => t.status === "Terminé");

  return (
    <div className="space-y-4">
      {/* Filters toggle */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showFilters ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters & Sort
        </button>
        <span className="text-xs text-slate-400">{pending.length} pending · {done.length} done</span>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm flex flex-wrap gap-3">
          <div className="flex-1 min-w-[120px]">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Sort by</p>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {clients.length > 0 && (
            <div className="flex-1 min-w-[120px]">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Client</p>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex-1 min-w-[120px]">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Status</p>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s] || s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Pending tasks */}
      {pending.length === 0 && done.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tasks assigned yet</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map(task => (
            <TaskRow key={task.id} task={task} onUpdateTask={onUpdateTask} />
          ))}
        </div>
      )}

      {/* Done tasks (collapsible) */}
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 list-none py-2 select-none">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            Completed ({done.length})
          </summary>
          <div className="space-y-2 mt-2 opacity-70">
            {done.map(task => (
              <TaskRow key={task.id} task={task} onUpdateTask={onUpdateTask} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}