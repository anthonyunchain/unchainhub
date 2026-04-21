import { useState } from "react";
import { format, isPast, isToday, isTomorrow, isThisWeek, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckSquare, Square, MessageCircle, Send, X, Paperclip, FileText, Loader2, ThumbsUp } from "lucide-react";

const isPdfUrl = (url) => typeof url === "string" && /\.pdf(\?|#|$)/i.test(url);
const fileNameFromUrl = (url) => {
  try {
    const clean = url.split("?")[0].split("#")[0];
    return decodeURIComponent(clean.split("/").pop() || "document.pdf");
  } catch { return "document.pdf"; }
};
import { TASK_STATUS_CONFIG as STATUS_CONFIG, TASK_STATUS_LABEL as STATUS_LABEL } from "@/lib/taskStatus";
import { base44 } from "@/api/base44Client";

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
  const [chatImageFile, setChatImageFile] = useState(null);
  const [chatImagePreview, setChatImagePreview] = useState(null);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Non commencé"];
  const doneCount = (task.checklist || []).filter(c => c.done).length;
  const totalCount = (task.checklist || []).length;
  const isDone = task.status === "Terminé";

  const thread = Array.isArray(task.note_thread) ? task.note_thread : [];
  const hasMessages = thread.length > 0;
  const lastMessage = hasMessages ? thread[thread.length - 1] : null;
  const lastFromAdmin = lastMessage?.author_role === "admin";
  const taskImages = Array.isArray(task.images) ? task.images : [];
  const hasDetails = task.description || task.blocking_reason || task.notes || totalCount > 0 || taskImages.length > 0;

  const sendMessage = async () => {
    const text = messageDraft.trim();
    if (!text && !chatImageFile) return;
    setSendingMessage(true);
    try {
      let image_url = null;
      if (chatImageFile) {
        const res = await base44.integrations.Core.UploadFile({ file: chatImageFile });
        image_url = res.file_url;
      }
      await onUpdateTask(task, { append_note: text || "", append_note_image: image_url });
      setMessageDraft("");
      setChatImageFile(null);
      setChatImagePreview(null);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleChatImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChatImageFile(file);
    if (file.type === "application/pdf") {
      setChatImagePreview({ type: "pdf", name: file.name });
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setChatImagePreview({ type: "image", dataUrl: ev.target.result });
      reader.readAsDataURL(file);
    }
  };

  const cycleStatus = () => {
    const order = ["Non commencé", "En cours", "Terminé"];
    const idx = order.indexOf(task.status);
    const next = order[(idx + 1) % order.length];
    onUpdateTask(task, { status: next });
  };

  return (
    <div className={`bg-white rounded-xl border transition-all shadow-sm overflow-hidden ${isDone ? "border-slate-100 opacity-70" : task.urgent ? "border-red-200 hover:border-red-300" : "border-slate-100 hover:border-slate-200"}`}>
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
              {task.urgent && !isDone && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded mr-1.5 align-middle">
                  <AlertTriangle className="w-2.5 h-2.5" /> Urgent
                </span>
              )}
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
          {taskImages.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {taskImages.map((url, i) => (
                  isPdfUrl(url) ? (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={fileNameFromUrl(url)}
                      className="w-24 h-24 rounded-lg border border-slate-200 bg-red-50 flex flex-col items-center justify-center gap-1 p-2 hover:bg-red-100 transition-colors"
                    >
                      <FileText className="w-7 h-7 text-red-500" />
                      <span className="text-[10px] font-semibold text-red-600 truncate max-w-full">PDF</span>
                    </a>
                  ) : (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-24 h-24 rounded-lg border border-slate-200 object-cover hover:opacity-90 transition-opacity" />
                    </a>
                  )
                ))}
              </div>
            </div>
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
                      {m.text && <p className="text-xs text-slate-700 whitespace-pre-wrap">{m.text}</p>}
                      {m.image_url && (
                        isPdfUrl(m.image_url) ? (
                          <a
                            href={m.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors max-w-full"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-xs font-medium truncate">{fileNameFromUrl(m.image_url)}</span>
                          </a>
                        ) : (
                          <a href={m.image_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                            <img src={m.image_url} alt="" className="max-w-[180px] max-h-[120px] rounded-md border border-slate-200 object-cover hover:opacity-90" />
                          </a>
                        )
                      )}
                      {/* Reaction toggle */}
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => onUpdateTask(task, { toggle_reaction_msg_id: m.id })}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                            (m.reactions || []).length > 0
                              ? "bg-amber-50 border-amber-200 text-amber-600"
                              : "border-transparent text-slate-300 hover:text-slate-500"
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          {(m.reactions || []).length > 0 && <span>{m.reactions.length}</span>}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/50">
              {chatImagePreview && (
                <div className="relative inline-block">
                  {chatImagePreview.type === "pdf" ? (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 bg-red-50 max-w-[180px]">
                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="text-xs text-slate-700 truncate">{chatImagePreview.name}</span>
                    </div>
                  ) : (
                    <img src={chatImagePreview.dataUrl} alt="Preview" className="max-w-[80px] max-h-[50px] rounded-md border border-slate-200 object-cover" />
                  )}
                  <button
                    onClick={() => { setChatImageFile(null); setChatImagePreview(null); }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-1.5 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus-within:border-blue-400 transition-colors">
                <label className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" title="Attach image or PDF">
                  <Paperclip className="w-4 h-4" />
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleChatImageSelect} />
                </label>
                <textarea
                  value={messageDraft}
                  onChange={e => setMessageDraft(e.target.value.slice(0, 5000))}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (messageDraft.trim() || chatImageFile) sendMessage();
                    }
                  }}
                  rows={1}
                  maxLength={5000}
                  placeholder="Write a message…"
                  className="flex-1 text-sm bg-transparent border-0 outline-none resize-none py-1 placeholder:text-slate-400"
                  style={{ minHeight: 28, maxHeight: 100 }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
                />
                <button
                  onClick={sendMessage}
                  disabled={(!messageDraft.trim() && !chatImageFile) || sendingMessage}
                  className="shrink-0 p-1.5 rounded-lg text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400">Anthony gets notified.</span>
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
        const urgentPending = pending.filter(t => t.urgent);
        const normalPending = pending.filter(t => !t.urgent);
        const groups = groupTasksByDate(normalPending);
        return (
          <div className="space-y-5">
            {urgentPending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600">Urgent</h3>
                  <span className="text-[10px] text-slate-400">{urgentPending.length}</span>
                </div>
                <div className="space-y-2">
                  {urgentPending.map(task => (
                    <TaskRow key={task.id} task={task} onUpdateTask={onUpdateTask} />
                  ))}
                </div>
              </div>
            )}
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