import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { format, isPast, isToday, isTomorrow, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCircle2, Clock, Mail, MessageCircle, Bell, AlertTriangle, Send, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { addMonths } from "date-fns";

const CHANNEL_ICON = { email: Mail, whatsapp: MessageCircle, push: Bell };
const CHANNEL_COLOR = {
  email: "text-blue-600 bg-blue-50",
  whatsapp: "text-emerald-600 bg-emerald-50",
  push: "text-violet-600 bg-violet-50",
};

function substituteVars(text, clientName, month) {
  if (!text) return "";
  const [y, mo] = month.split("-");
  const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
  const next = addMonths(d, 1);
  return text
    .replace(/\{client_name\}/g, clientName || "{client_name}")
    .replace(/\{month\}/g, format(d, "MMMM yyyy", { locale: enUS }))
    .replace(/\{next_month\}/g, format(next, "MMMM yyyy", { locale: enUS }))
    .replace(/\{brief_link\}/g, "[brief_link]")
    .replace(/\{deadline_brief\}/g, `${y}-${mo}-12`)
    .replace(/\{deadline_calendar\}/g, `${y}-${mo}-22`)
    .replace(/\{shooting_dates\}/g, "[shooting_dates]")
    .replace(/\{report_link\}/g, "[report_link]")
    .replace(/\{availabilities\}/g, "[availabilities]");
}

function DueBadge({ date, status }) {
  if (!date || status === "sent") return null;
  const d = new Date(date + "T12:00:00");
  if (isToday(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Today</span>;
  if (isPast(startOfDay(d))) return <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Overdue</span>;
  if (isTomorrow(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">Tomorrow</span>;
  return <span className="text-[10px] text-slate-400">{format(d, "d MMM", { locale: enUS })}</span>;
}

function WorkflowTaskCard({ task, onMarkSent }) {
  const [expanded, setExpanded] = useState(false);
  const tpl = task.workflow_message_templates;
  const clientName = task.clients?.company_name || "";
  const month = task.month || "";
  const body = substituteVars(tpl?.message_en || "", clientName, month);
  const subject = substituteVars(tpl?.subject_en || "", clientName, month);
  const Ch = CHANNEL_ICON[task.channel] || Mail;
  const isDone = task.status === "sent";

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isDone ? "border-slate-100 opacity-70" : "border-slate-200 hover:border-slate-300"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status icon */}
          {isDone
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            : <Clock className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
          }

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">{tpl?.msg_id}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLOR[task.channel] || "bg-slate-50 text-slate-500"}`}>
                <Ch className="w-3 h-3" />
                {task.channel === "whatsapp" ? "WhatsApp" : task.channel === "push" ? "Push" : "Email"}
              </span>
              {clientName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{clientName}</span>
              )}
            </div>

            {/* Trigger */}
            <p className="text-xs text-slate-500 mt-0.5">{tpl?.trigger_event || ""}</p>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <DueBadge date={task.scheduled_date} status={task.status} />
              {isDone && task.sent_at && (
                <span className="text-[10px] text-emerald-600">
                  Sent {format(new Date(task.sent_at), "d MMM HH:mm", { locale: enUS })}
                </span>
              )}
            </div>
          </div>

          {/* Expand button */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expanded: message preview + send button */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-3">
          {subject && (
            <div className="text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Subject: </span>
              <span className="text-slate-700">{subject}</span>
            </div>
          )}
          <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white rounded-lg border border-slate-100 p-3">
            {body}
          </div>
          {task.notes && (
            <p className="text-[10px] text-slate-400 italic">{task.notes}</p>
          )}
          {!isDone && (
            <div className="flex justify-end">
              <button
                onClick={() => onMarkSent(task.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Mark as sent
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkflowTasksTab({ userId }) {
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["workflow-tasks-freelancer", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tasks")
        .select("*, clients(company_name), workflow_message_templates(msg_id, trigger_event, subject_en, message_en, notes)")
        .order("scheduled_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const markSentMut = useMutation({
    mutationFn: async (taskId) => {
      const { error } = await supabase
        .from("workflow_tasks")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-tasks-freelancer", userId] });
      toast.success("Task marked as sent");
    },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>;

  const pending = tasks.filter(t => t.status !== "sent");
  const done = tasks.filter(t => t.status === "sent");

  if (tasks.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No workflow tasks assigned to you</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <span className="text-xs text-slate-400">{pending.length} pending · {done.length} sent</span>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map(task => (
            <WorkflowTaskCard key={task.id} task={task} onMarkSent={id => markSentMut.mutate(id)} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 list-none py-2 select-none">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            Sent ({done.length})
          </summary>
          <div className="space-y-2 mt-2 opacity-70">
            {done.map(task => (
              <WorkflowTaskCard key={task.id} task={task} onMarkSent={id => markSentMut.mutate(id)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
