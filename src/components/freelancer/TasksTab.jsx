import { useState } from "react";
import { format, isPast, isToday, isTomorrow, isThisWeek, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckSquare, Square, MessageCircle, Send, X } from "lucide-react";
import { TASK_STATUS_CONFIG as STATUS_CONFIG, TASK_STATUS_LABEL as STATUS_LABEL } from "@/lib/taskStatus";
import TaskComments from "@/components/tasks/TaskComments";

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
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Non commencé"];
  const doneCount = (task.checklist || []).filter(c => c.done).length;
  const totalCount = (task.checklist || []).length;
  const isDone = task.status === "Terminé";

  const thread = Array.isArray(task.note_thread) ? task.note_thread : [];
  const hasMessages = thread.length > 0;
  const lastMessage = hasMessages ? thread[thread.length - 1] : null;
  const lastFromAdmin = lastMessage?.author_role === "admin";
  const hasDetails = task.description || task.blocking_reason || task.notes || totalCount > 0;

  const sendMessage = async () => {
    const text = messageDraft.trim();
    if (!text) return;
    setSendingMessage(true);
    try {
      await onUpdateTask(task, { append_note: text });
      setMessageDraft("");
    } finally {
      setSendingMessage(false);
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

          {/* Note chat icon */}
          <button
            onClick={e => { e.stopPropagation(); setChatOpen(true); }}
            title={hasMessages ? "Conversation with Anthony" : "Leave a note for Anthony"}
            className={`relative shrink-0 rounded-full p-1.5 transition-colors ${
              lastFromAdmin
                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                : hasMessages
                  ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                  : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {lastFromAdmin && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

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
          {/* Comments */}
          <div className="pt-1">
            <TaskComments taskId={task.id} />
          </div>
        </div>
      )}

      {/* Conversation modal */}
      {chatOpen && (
        <div
          onClick={() => setChatOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Conversation with Anthony</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-2 max-h-[50vh] overflow-y-auto">
              {thread.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No messages yet. Send a note to Anthony below.
                </p>
              ) : (
                thread.map(m => {
                  const fromAdmin = m.author_role === "admin";
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 border ${
                        fromAdmin
                          ? "bg-blue-50 border-blue-200"
                          : "bg-amber-50 border-amber-200 ml-6"
                      }`}
                    >
                      <p className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${fromAdmin ? "text-blue-700" : "text-amber-700"}`}>
                        {fromAdmin ? (m.author_name || "Anthony") : "You"}
                        {m.created_at && (
                          <span className="ml-1.5 text-slate-400 normal-case tracking-normal font-normal">
                            · {format(new Date(m.created_at), "d MMM yyyy HH:mm", { locale: enUS })}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{m.text}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/50">
              <textarea
                value={messageDraft}
                onChange={e => setMessageDraft(e.target.value.slice(0, 5000))}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={3}
                maxLength={5000}
                placeholder="Write a message…"
                className="w-full text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-400 resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">Anthony gets notified when you send.</span>
                <button
                  onClick={sendMessage}
                  disabled={!messageDraft.trim() || sendingMessage}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" /> {sendingMessage ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function groupTasksByDate(tasks) {
  const groups = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], noDate: [] };
  for (const t of tasks) {
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

const DATE_GROUP_CONFIG = [
  { key: "overdue", label: "Overdue", headerClass: "text-red-600", dotClass: "bg-red-500" },
  { key: "today", label: "Today", headerClass: "text-amber-600", dotClass: "bg-amber-500" },
  { key: "tomorrow", label: "Tomorrow", headerClass: "text-blue-600", dotClass: "bg-blue-500" },
  { key: "thisWeek", label: "This week", headerClass: "text-indigo-600", dotClass: "bg-indigo-400" },
  { key: "later", label: "Later", headerClass: "text-slate-500", dotClass: "bg-slate-400" },
  { key: "noDate", label: "No date", headerClass: "text-slate-400", dotClass: "bg-slate-300" },
];
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

      {/* Pending tasks — grouped by date */}
      {pending.length === 0 && done.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tasks assigned yet</p>
        </div>
      )}

      {pending.length > 0 && (() => {
        const groups = groupTasksByDate(pending);
        return (
          <div className="space-y-5">
            {DATE_GROUP_CONFIG.map(({ key, label, headerClass, dotClass }) => {
              const items = groups[key];
              if (!items || items.length === 0) return null;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                    <h3 className={`text-xs font-semibold uppercase tracking-wider ${headerClass}`}>{label}</h3>
                    <span className="text-[10px] text-slate-400">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(task => (
                      <TaskRow key={task.id} task={task} onUpdateTask={onUpdateTask} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

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