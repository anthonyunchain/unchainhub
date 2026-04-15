import { useState } from "react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckSquare, Square, MessageCircle, Send } from "lucide-react";
import { TASK_STATUS_CONFIG as STATUS_CONFIG, TASK_STATUS_LABEL as STATUS_LABEL } from "@/lib/taskStatus";

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
  // legacy
  "Commercial": "Commercial", "Contenu": "Content", "Administratif": "Administrative",
  "Montage": "Video Editing", "Vie perso": "Personal", "Autre": "Other",
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
  const [noteDraft, setNoteDraft] = useState(task.freelancer_note || "");
  const [savingNote, setSavingNote] = useState(false);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Non commencé"];
  const doneCount = (task.checklist || []).filter(c => c.done).length;
  const totalCount = (task.checklist || []).length;
  const isDone = task.status === "Terminé";
  // Note UI is always available — accordion always openable
  const hasDetails = true;
  const hasNote = !!(task.freelancer_note && task.freelancer_note.trim());
  const noteDirty = (noteDraft || "").trim() !== (task.freelancer_note || "").trim();

  const saveNote = async () => {
    setSavingNote(true);
    try {
      await onUpdateTask(task, { freelancer_note: noteDraft });
    } finally {
      setSavingNote(false);
    }
  };

  const cycleStatus = () => {
    const order = ["Non commencé", "En cours", "Terminé"];
    const idx = order.indexOf(task.status);
    const next = order[(idx + 1) % order.length];
    onUpdateTask(task, { status: next });
  };

  return (
    <div className={`bg-white rounded-xl border transition-all ${isDone ? "border-slate-100 opacity-70" : "border-slate-100 hover:border-slate-200"} shadow-sm overflow-hidden`}>
      <div
        className={`p-4 ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => { if (hasDetails) setExpanded(v => !v); }}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={e => { e.stopPropagation(); cycleStatus(); }}
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
              {task.client_name && (
                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{task.client_name}</span>
              )}
              <DueBadge task={task} />
              {totalCount > 0 && (
                <span className="text-[10px] text-slate-400">{doneCount}/{totalCount} subtasks</span>
              )}
              {hasNote && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                  <MessageCircle className="w-3 h-3" /> Note sent
                </span>
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
            <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors">
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

          {/* Freelancer note → admin */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" /> Note for the admin
            </p>
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="Ask a question or leave a note…"
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                {task.freelancer_note_updated_at
                  ? `Last sent ${format(new Date(task.freelancer_note_updated_at), "d MMM yyyy HH:mm", { locale: enUS })}`
                  : "Admins get notified when you send a note"}
              </span>
              <button
                onClick={saveNote}
                disabled={!noteDirty || savingNote}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3 h-3" /> {savingNote ? "Sending…" : hasNote ? "Update note" : "Send note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TasksTab({ tasks, onUpdateTask }) {
  const [filterClient, setFilterClient] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const clients = [...new Set(tasks.map(t => t.client_name).filter(Boolean))];
  const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))];

  const filtered = tasks
    .filter(t => filterClient === "all" || t.client_name === filterClient)
    .filter(t => filterCategory === "all" || t.category === filterCategory || (filterCategory === "Personal" && t.category === "Vie perso"))
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });

  const pending = filtered.filter(t => t.status !== "Terminé");
  const done = filtered.filter(t => t.status === "Terminé");

  const FilterGroup = ({ label, children }) => (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
      <span className="shrink-0 text-xs text-slate-400 font-medium">{label}</span>
      {children}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Filter buttons */}
      {clients.length > 0 && (
        <FilterGroup label="Client:">
          <button
            onClick={() => setFilterClient("all")}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${filterClient === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            All
          </button>
          {clients.map(c =>
            <button
              key={c}
              onClick={() => setFilterClient(filterClient === c ? "all" : c)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${filterClient === c ? "bg-[#2A69FF] text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
              {c}
            </button>
          )}
        </FilterGroup>
      )}

      {categories.length > 0 && (
        <FilterGroup label="Type:">
          <button
            onClick={() => setFilterCategory("all")}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${filterCategory === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            All
          </button>
          {categories.map(c => {
            const active = filterCategory === c;
            const isPersonal = c === "Personal" || c === "Vie perso";
            const base = isPersonal
              ? (active ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100")
              : (active ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200");
            return (
              <button
                key={c}
                onClick={() => setFilterCategory(active ? "all" : c)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${base}`}>
                {CATEGORY_LABEL[c] || c}
                <span className="ml-1 text-[10px] opacity-70">{tasks.filter(t => t.category === c).length}</span>
              </button>
            );
          })}
        </FilterGroup>
      )}

      <div className="flex items-center justify-end">
        <span className="text-xs text-slate-400">{pending.length} pending · {done.length} done</span>
      </div>

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