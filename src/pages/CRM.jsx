import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  format, startOfWeek, endOfWeek, isPast, startOfDay,
  addMonths, subMonths,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Mail, MessageCircle, Bell, ChevronLeft, ChevronRight,
  Zap, CheckCircle2, Clock, SkipForward, AlertTriangle,
  Pencil, X, RefreshCw, Eye, Plus,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(d) { return format(d, "yyyy-MM"); }
function fmtMonth(m) {
  const [y, mo] = m.split("-");
  return format(new Date(parseInt(y), parseInt(mo) - 1, 1), "MMMM yyyy", { locale: enUS });
}
function nextMonth(m) {
  const [y, mo] = m.split("-");
  const d = addMonths(new Date(parseInt(y), parseInt(mo) - 1, 1), 1);
  return monthKey(d);
}

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

const CHANNEL_ICON = {
  email: Mail,
  whatsapp: MessageCircle,
  push: Bell,
};

const CHANNEL_LABEL = { email: "Email", whatsapp: "WhatsApp", push: "Push" };

const CHANNEL_COLOR = {
  email: "text-blue-600 bg-blue-50",
  whatsapp: "text-emerald-600 bg-emerald-50",
  push: "text-violet-600 bg-violet-50",
};

function StatusBadge({ task }) {
  if (task.status === "sent") return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
      <CheckCircle2 className="w-3 h-3" /> Sent
    </span>
  );
  if (task.status === "skipped") return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-medium line-through">
      <SkipForward className="w-3 h-3 no-underline" /> Skipped
    </span>
  );
  if (task.scheduled_date && isPast(startOfDay(new Date(task.scheduled_date))) && task.status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
      <AlertTriangle className="w-3 h-3" /> Overdue
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

// ── Task detail modal ─────────────────────────────────────────────────────────

function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (task) setForm({
      status: task.status,
      channel: task.channel,
      scheduled_date: task.scheduled_date,
      notes: task.notes || "",
    });
  }, [task]);

  if (!task || !form) return null;

  const clientName = task.clients?.company_name || "";
  const month = task.month || monthKey(new Date());
  const tpl = task.workflow_message_templates;
  const body = substituteVars(tpl?.message_en || "", clientName, month);
  const subject = substituteVars(tpl?.subject_en || "", clientName, month);

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{tpl?.msg_id} — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          {subject && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Subject: </span>
              <span className="text-slate-700">{subject}</span>
            </div>
          )}
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {body}
          </div>
          {tpl?.notes && (
            <p className="text-xs text-slate-400 italic">{tpl.notes}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Channel</Label>
              <Select value={form.channel || ""} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Scheduled date</Label>
            <Input type="date" value={form.scheduled_date || ""} className="h-8 text-xs"
              onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} rows={2} className="text-sm resize-none"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={() => onSave(task.id, form)}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Generate modal ────────────────────────────────────────────────────────────

function GenerateModal({ open, onClose }) {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generateWorkflowTasks", {
        body: { month, dry_run: dryRun },
      });
      if (error) throw error;
      setResult(data);
      if (!dryRun && data?.created > 0) toast.success(`${data.created} tasks generated for ${fmtMonth(month)}`);
      if (data?.skipped) toast.info(`Tasks for ${fmtMonth(month)} already exist`);
    } catch (e) {
      toast.error(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Generate workflow tasks</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Month</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-8 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            Dry run (preview only, no DB writes)
          </label>
          {result && (
            <div className={`text-sm rounded-lg p-3 ${result.skipped ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
              {result.skipped
                ? result.reason
                : dryRun
                  ? `Would create ${result.would_create} tasks`
                  : `Created ${result.created} tasks for ${fmtMonth(month)}`
              }
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            <Button size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={run} disabled={loading}>
              {loading ? "Generating…" : dryRun ? "Preview" : "Generate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── This Week tab ─────────────────────────────────────────────────────────────

function ThisWeekTab({ onEditTask }) {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd   = format(endOfWeek(now,   { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["workflow-tasks-week", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tasks")
        .select("*, clients(company_name), workflow_message_templates(msg_id, title, subject_en, message_en, notes, trigger_event)")
        .gte("scheduled_date", weekStart)
        .lte("scheduled_date", weekEnd)
        .order("scheduled_date");
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>;

  const grouped = {};
  for (const t of tasks) {
    const d = t.scheduled_date;
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  }

  if (tasks.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
      <p className="text-slate-400 text-sm">No tasks scheduled this week</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([date, dayTasks]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {format(new Date(date + "T12:00:00"), "EEEE, d MMMM", { locale: enUS })}
            </span>
            <span className="text-xs text-slate-300">{dayTasks.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {dayTasks.map(task => (
              <TaskRow key={task.id} task={task} onClick={() => onEditTask(task)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskRow({ task, onClick }) {
  const tpl = task.workflow_message_templates;
  const clientName = task.clients?.company_name || "—";
  const Ch = CHANNEL_ICON[task.channel] || Mail;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-100 rounded-xl p-4 hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 p-1.5 rounded-lg ${CHANNEL_COLOR[task.channel] || "text-slate-500 bg-slate-50"}`}>
          <Ch className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-700">{tpl?.msg_id}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium truncate max-w-[120px]">{clientName}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{tpl?.trigger_event || "—"}</p>
          {task.assigned_to && task.assigned_to !== "anthony" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium">{task.assigned_to}</span>
          )}
        </div>
        <StatusBadge task={task} />
      </div>
    </div>
  );
}

// ── By Client tab ─────────────────────────────────────────────────────────────

function ByClientTab({ onEditTask }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = monthKey(currentDate);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["workflow-tasks-month", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_tasks")
        .select("*, clients(id, company_name), workflow_message_templates(msg_id, trigger_event, subject_en, message_en, notes)")
        .eq("month", month)
        .order("scheduled_date");
      if (error) throw error;
      return data || [];
    },
  });

  // Group by client
  const byClient = {};
  for (const t of tasks) {
    const cid = t.client_id || "unknown";
    if (!byClient[cid]) byClient[cid] = { name: t.clients?.company_name || "Unknown", tasks: [] };
    byClient[cid].tasks.push(t);
  }

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => setCurrentDate(d => subMonths(d, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 min-w-[140px] text-center">
          {format(currentDate, "MMMM yyyy", { locale: enUS })}
        </span>
        <button onClick={() => setCurrentDate(d => addMonths(d, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400 ml-2">{tasks.length} tasks</span>
      </div>

      {isLoading && <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>}

      {!isLoading && Object.keys(byClient).length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <RefreshCw className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No tasks for this month</p>
          <p className="text-slate-300 text-xs mt-1">Use "Generate" to create tasks for {format(currentDate, "MMMM yyyy", { locale: enUS })}</p>
        </div>
      )}

      {Object.values(byClient).map(({ name, tasks: clientTasks }) => (
        <div key={name} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">{name}</span>
            <span className="text-xs text-slate-400">{clientTasks.length} tasks</span>
            <span className="ml-auto text-[10px] text-emerald-600 font-medium">
              {clientTasks.filter(t => t.status === "sent").length} / {clientTasks.length} sent
            </span>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {clientTasks.map(task => {
              const Ch = CHANNEL_ICON[task.channel] || Mail;
              const isOverdue = task.status === "pending" && task.scheduled_date && isPast(startOfDay(new Date(task.scheduled_date)));
              const dotColor = task.status === "sent" ? "bg-emerald-500" : task.status === "skipped" ? "bg-slate-300" : isOverdue ? "bg-red-500" : "bg-slate-300";
              return (
                <button
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  title={`${task.workflow_message_templates?.msg_id} — ${task.scheduled_date}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm ${
                    task.status === "sent" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : task.status === "skipped" ? "bg-slate-50 border-slate-200 text-slate-400"
                    : isOverdue ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <Ch className="w-3 h-3" />
                  <span>{task.workflow_message_templates?.msg_id}</span>
                  {task.scheduled_date && (
                    <span className="text-[10px] opacity-60">{format(new Date(task.scheduled_date + "T12:00:00"), "d MMM")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_message_templates")
        .select("*")
        .order("msg_id");
      if (error) throw error;
      return data || [];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { error } = await supabase.from("workflow_message_templates").update(d).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-templates"] });
      setEditing(null);
      toast.success("Template saved");
    },
    onError: e => toast.error(e.message),
  });

  const openEdit = (tpl) => {
    setEditing(tpl);
    setForm({ trigger_event: tpl.trigger_event || "", message_en: tpl.message_en, message_fi: tpl.message_fi, subject_en: tpl.subject_en || "", subject_fi: tpl.subject_fi || "" });
  };

  const WEEK_COLOR = {
    "Week 1": "bg-blue-50 text-blue-700",
    "Week 2": "bg-violet-50 text-violet-700",
    "Week 3": "bg-amber-50 text-amber-700",
    "Week 4": "bg-emerald-50 text-emerald-700",
    "Anytime": "bg-slate-100 text-slate-500",
  };

  if (isLoading) return <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-2">
      {templates.map(tpl => {
        const Ch = CHANNEL_ICON[tpl.default_channel] || Mail;
        return (
          <div key={tpl.id} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${WEEK_COLOR[tpl.week_label] || "bg-slate-100 text-slate-500"}`}>
                  {tpl.week_label}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">{tpl.msg_id}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLOR[tpl.default_channel] || "bg-slate-50 text-slate-500"}`}>
                    <Ch className="w-3 h-3" /> {CHANNEL_LABEL[tpl.default_channel] || tpl.default_channel}
                  </span>
                  {tpl.is_reminder && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">Reminder +{tpl.reminder_delay_days}d</span>
                  )}
                  {tpl.default_day_of_month && (
                    <span className="text-[10px] text-slate-400">Day {tpl.default_day_of_month}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{tpl.trigger_event}</p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tpl.message_en}</p>
                {!tpl.message_fi && (
                  <p className="text-[10px] text-amber-500 mt-1">⚠️ Finnish translation missing</p>
                )}
              </div>
              <button onClick={() => openEdit(tpl)} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.msg_id} — {editing?.trigger_event}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs">Message name</Label>
                <Input value={form.trigger_event} className="text-sm" placeholder="e.g. Month start, Brief not received…"
                  onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))} />
              </div>
              {editing?.default_channel === "email" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Subject EN</Label>
                    <Input value={form.subject_en} className="text-sm" onChange={e => setForm(f => ({ ...f, subject_en: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Subject FI</Label>
                    <Input value={form.subject_fi} className="text-sm" onChange={e => setForm(f => ({ ...f, subject_fi: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">Message EN</Label>
                <Textarea value={form.message_en} rows={5} className="text-sm"
                  onChange={e => setForm(f => ({ ...f, message_en: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Message FI</Label>
                <Textarea value={form.message_fi} rows={5} className="text-sm"
                  placeholder="Finnish translation…"
                  onChange={e => setForm(f => ({ ...f, message_fi: e.target.value }))} />
              </div>
              {editing?.variables && (
                <p className="text-[10px] text-slate-400">
                  Variables: <span className="font-mono">{editing.variables}</span>
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground"
                  disabled={updateMut.isPending}
                  onClick={() => updateMut.mutate({ id: editing.id, d: { trigger_event: form.trigger_event, message_en: form.message_en, message_fi: form.message_fi, subject_en: form.subject_en, subject_fi: form.subject_fi } })}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main CRM page ─────────────────────────────────────────────────────────────

function NewTaskModal({ open, onClose }) {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const empty = { client_id: "", msg_id: "", scheduled_date: today, channel: "whatsapp", status: "pending", notes: "", assigned_to: "anthony" };
  const [form, setForm] = useState(empty);

  const { data: clients = [] } = useQuery({
    queryKey: ["crm-clients-new"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name").eq("status", "Actif").order("company_name");
      return data || [];
    },
    enabled: open,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["workflow-templates-new"],
    queryFn: async () => {
      const { data } = await supabase.from("workflow_message_templates").select("msg_id, trigger_event").order("msg_id");
      return data || [];
    },
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const month = d.scheduled_date ? d.scheduled_date.slice(0, 7) : format(new Date(), "yyyy-MM");
      const { error } = await supabase.from("workflow_tasks").insert({ ...d, month });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-tasks-week"] });
      qc.invalidateQueries({ queryKey: ["workflow-tasks-month"] });
      toast.success("Task created");
      setForm(empty);
      onClose();
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => { if (open) setForm(empty); }, [open]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Client</Label>
            <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Message template</Label>
            <Select value={form.msg_id} onValueChange={v => setForm(f => ({ ...f, msg_id: v }))}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select template" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.msg_id} value={t.msg_id}>{t.msg_id} — {t.trigger_event}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Scheduled date</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Assigned to</Label>
            <Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="text-sm" placeholder="anthony" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground"
              disabled={!form.client_id || !form.msg_id || !form.scheduled_date || createMut.isPending}
              onClick={() => createMut.mutate(form)}>
              Create task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CRM() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("week");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const updateTaskMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const update = { ...d };
      if (d.status === "sent" && !d.sent_at) update.sent_at = new Date().toISOString();
      const { error } = await supabase.from("workflow_tasks").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-tasks-week"] });
      qc.invalidateQueries({ queryKey: ["workflow-tasks-month"] });
      setEditingTask(null);
      toast.success("Task updated");
    },
    onError: e => toast.error(e.message),
  });

  const TABS = [
    { id: "week",      label: "This Week"  },
    { id: "client",    label: "By Client"  },
    { id: "templates", label: "Templates"  },
  ];

  return (
    <div className="mx-auto px-4 md:px-6" style={{ maxWidth: 1400 }}>
      <PageHeader title="CRM" subtitle="Monthly client touchpoint scheduler">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9" onClick={() => setNewTaskOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New task
          </Button>
          <Button onClick={() => setGenerateOpen(true)}
            className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
            <Zap className="w-4 h-4 mr-1" /> Generate tasks
          </Button>
        </div>
      </PageHeader>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-xl border border-slate-100 p-1 w-fit shadow-sm">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-brand text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "week"      && <ThisWeekTab onEditTask={setEditingTask} />}
      {tab === "client"    && <ByClientTab onEditTask={setEditingTask} />}
      {tab === "templates" && <TemplatesTab />}

      <TaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={(id, d) => updateTaskMut.mutate({ id, d })}
      />

      <GenerateModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <NewTaskModal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </div>
  );
}
