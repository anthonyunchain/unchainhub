import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { base44 } from "@/api/base44Client";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, isSameDay, isSameMonth, isToday } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Sparkles, CalendarDays, ClipboardList, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";

// ── Workflow step definitions ───────────────────────────────────────────────
const STEPS = [
  { key: "meeting_prev",   label: "Review meeting",                  week: 0, color: "#8B5CF6", emoji: "🗓️" },
  { key: "stats_share",    label: "Stats shared + brief request",    week: 1, color: "#2A69FF", emoji: "📊" },
  { key: "calendar_pdf",   label: "Editorial calendar & PDF",        week: 2, color: "#0EA5E9", emoji: "📅" },
  { key: "shooting_org",   label: "Shootings + calendar validation", week: 3, color: "#F59E0B", emoji: "📸" },
  { key: "meeting_review", label: "Monthly review meeting",          week: 4, color: "#10B981", emoji: "✅" },
];

const STEP_MAP = Object.fromEntries(STEPS.map(s => [s.key, s]));

// ── Helpers ─────────────────────────────────────────────────────────────────
function monthKey(date) { return format(date, "yyyy-MM"); }

function currentWeekOfMonth(date) {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PlanningCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const qc = useQueryClient();
  const month = monthKey(currentDate);
  const prevMonth = monthKey(subMonths(currentDate, 1));

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: () => base44.entities.Client.filter({ status: "Actif" }),
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["workflow-steps", month],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_workflow_steps")
        .select("*")
        .in("month", [month, prevMonth]);
      return data || [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-planning", month],
    queryFn: async () => {
      const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
      const end   = format(endOfMonth(currentDate),   "yyyy-MM-dd");
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, client_name, category")
        .gte("due_date", start)
        .lte("due_date", end)
        .neq("status", "Terminé");
      return data || [];
    },
  });

  const { data: shootings = [] } = useQuery({
    queryKey: ["shootings-planning", month],
    queryFn: async () => {
      const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
      const end   = format(endOfMonth(currentDate),   "yyyy-MM-dd");
      const { data } = await supabase
        .from("shootings")
        .select("id, title, date, client_name, status")
        .gte("date", start)
        .lte("date", end);
      return data || [];
    },
  });

  // ── Toggle step ──────────────────────────────────────────────────────────
  const toggleStep = useMutation({
    mutationFn: async ({ client_name, step_key, completed, targetMonth }) => {
      await supabase
        .from("client_workflow_steps")
        .upsert({
          client_name,
          month: targetMonth || month,
          step_key,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        }, { onConflict: "client_name,month,step_key" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-steps", month] }),
  });

  // ── Generate workflow for all clients ────────────────────────────────────
  const generateWorkflow = useMutation({
    mutationFn: async () => {
      const rows = clients.flatMap(c =>
        STEPS.map(s => ({
          client_name: c.company_name,
          month,
          step_key: s.key,
          completed: false,
        }))
      );
      await supabase
        .from("client_workflow_steps")
        .upsert(rows, { onConflict: "client_name,month,step_key", ignoreDuplicates: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-steps", month] }),
  });

  // ── Derived state ────────────────────────────────────────────────────────
  const stepsByClient = {};
  for (const s of steps) {
    if (!stepsByClient[s.client_name]) stepsByClient[s.client_name] = {};
    stepsByClient[s.client_name][`${s.month}__${s.step_key}`] = s;
  }

  const getStep = (clientName, stepKey, targetMonth = month) =>
    stepsByClient[clientName]?.[`${targetMonth}__${stepKey}`];

  // Clients with at least one step row this month, or all active clients
  const activeClients = clients.filter(c => c.status === "Actif");
  const clientsWithSteps = activeClients.filter(c =>
    STEPS.some(s => getStep(c.company_name, s.key))
  );
  const displayClients = clientsWithSteps.length > 0 ? activeClients : activeClients;

  // Tasks by day
  const tasksByDay = {};
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date;
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(t);
  }
  const shootingsByDay = {};
  for (const s of shootings) {
    if (!s.date) continue;
    if (!shootingsByDay[s.date]) shootingsByDay[s.date] = [];
    shootingsByDay[s.date].push(s);
  }

  // Calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Monday-first: getDay returns 0=Sun, remap
  const startDow = (getDay(monthStart) + 6) % 7; // 0=Mon
  const totalCells = Math.ceil((startDow + days.length) / 7) * 7;
  const cells = Array(totalCells).fill(null).map((_, i) => {
    const dayIndex = i - startDow;
    return dayIndex >= 0 && dayIndex < days.length ? days[dayIndex] : null;
  });

  const today = new Date();
  const currentWeek = isSameMonth(today, currentDate) ? currentWeekOfMonth(today) : null;

  const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const CARD = { background: "var(--card)", borderRadius: "var(--card-radius, 16px)", border: "1px solid var(--divider)", boxShadow: "var(--card-shadow)" };

  return (
    <div className="w-full mx-auto space-y-4" style={{ maxWidth: 1400 }}>
      <PageHeader title="Planning" subtitle="Monthly client workflow & calendar">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDate(d => subMonths(d, 1))}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--divider)", background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <ChevronLeft style={{ width: 16, height: 16, color: "var(--ink)" }} />
          </button>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)", minWidth: 130, textAlign: "center" }}>
            {format(currentDate, "MMMM yyyy", { locale: enUS })}
          </span>
          <button
            onClick={() => setCurrentDate(d => addMonths(d, 1))}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--divider)", background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <ChevronRight style={{ width: 16, height: 16, color: "var(--ink)" }} />
          </button>
          <button
            onClick={() => generateWorkflow.mutate()}
            disabled={generateWorkflow.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: generateWorkflow.isPending ? 0.6 : 1 }}
          >
            <Sparkles style={{ width: 13, height: 13 }} />
            Generate workflow
          </button>
        </div>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── LEFT: Workflow checklist ───────────────────────────────────── */}
        <div style={{ ...CARD, padding: 0, overflow: "hidden", width: "100%", flexShrink: 0 }} className="lg:w-[420px]">
          {/* Step legend */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--divider)", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STEPS.map(s => (
              <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                W{s.week === 0 ? "−1" : s.week} {s.label}
              </span>
            ))}
          </div>

          {/* Client rows */}
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
            {displayClients.length === 0 ? (
              <p style={{ padding: 24, fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                No active clients. Generate workflow to start.
              </p>
            ) : displayClients.map((client, ci) => {
              const name = client.company_name;
              const completedCount = STEPS.filter(s => getStep(name, s.key)?.completed).length;
              const hasAny = STEPS.some(s => getStep(name, s.key));

              return (
                <div key={client.id} style={{ borderBottom: ci < displayClients.length - 1 ? "1px solid var(--divider)" : "none" }}>
                  {/* Client header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--brand)", flexShrink: 0 }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{name}</span>
                    </div>
                    {hasAny && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: completedCount === STEPS.length ? "#10B981" : "var(--muted)" }}>
                        {completedCount}/{STEPS.length}
                      </span>
                    )}
                  </div>

                  {/* Step checkboxes */}
                  <div style={{ padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {STEPS.map(step => {
                      const row = getStep(name, step.key);
                      const done = row?.completed || false;
                      const exists = !!row;
                      return (
                        <button
                          key={step.key}
                          onClick={() => toggleStep.mutate({ client_name: name, step_key: step.key, completed: !done })}
                          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: "4px 0", textAlign: "left" }}
                        >
                          {done
                            ? <CheckCircle2 style={{ width: 16, height: 16, color: step.color, flexShrink: 0 }} />
                            : <Circle style={{ width: 16, height: 16, color: exists ? "var(--divider)" : "var(--subtle)", flexShrink: 0 }} />
                          }
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: done ? "var(--ink)" : exists ? "var(--muted)" : "var(--subtle)", textDecoration: done ? "line-through" : "none", letterSpacing: "0.01em" }}>
                            {step.emoji} {step.label}
                          </span>
                          {!exists && (
                            <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "var(--subtle)", marginLeft: "auto" }}>generate</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Calendar ────────────────────────────────────────────── */}
        <div style={{ ...CARD, padding: 0, overflow: "hidden", flex: 1, minWidth: 0 }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--divider)" }}>
            {DOW.map(d => (
              <div key={d} style={{ padding: "10px 0", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {cells.map((day, i) => {
              if (!day) return (
                <div key={`empty-${i}`} style={{ minHeight: 90, borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--divider)" : "none", borderBottom: i < cells.length - 7 ? "1px solid var(--divider)" : "none", background: "var(--bg)" }} />
              );

              const dayKey = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay[dayKey] || [];
              const dayShootings = shootingsByDay[dayKey] || [];
              const isCurrentDay = isToday(day);
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;

              return (
                <div
                  key={dayKey}
                  style={{
                    minHeight: 90,
                    padding: "6px 6px 4px",
                    borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--divider)" : "none",
                    borderBottom: i < cells.length - 7 ? "1px solid var(--divider)" : "none",
                    background: isWeekend ? "rgba(0,0,0,0.018)" : "var(--card)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  {/* Day number */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isCurrentDay ? "var(--brand)" : "transparent",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      fontWeight: isCurrentDay ? 700 : 400,
                      color: isCurrentDay ? "#fff" : isWeekend ? "var(--muted)" : "var(--ink)",
                    }}>
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Shootings */}
                  {dayShootings.map(s => (
                    <Link
                      key={s.id}
                      to="/Shootings"
                      style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 5px", borderRadius: 4, background: "rgba(245,158,11,0.1)", border: "none", textDecoration: "none", overflow: "hidden" }}
                    >
                      <Camera style={{ width: 8, height: 8, color: "#F59E0B", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#92400E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </span>
                    </Link>
                  ))}

                  {/* Tasks */}
                  {dayTasks.slice(0, 3).map(t => {
                    const statusColor = t.status === "En cours" ? "#2A69FF" : t.status === "Bloqué" ? "#EF4444" : "#6B7280";
                    return (
                      <Link
                        key={t.id}
                        to="/Tasks"
                        style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 5px", borderRadius: 4, background: "rgba(42,105,255,0.07)", textDecoration: "none", overflow: "hidden" }}
                      >
                        <ClipboardList style={{ width: 8, height: 8, color: statusColor, flexShrink: 0 }} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}
                        </span>
                      </Link>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", paddingLeft: 4 }}>
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { color: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", label: "Shooting" },
          { color: "rgba(42,105,255,0.07)", border: "rgba(42,105,255,0.2)", label: "Task" },
        ].map(l => (
          <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)" }}>
            <span style={{ width: 14, height: 10, borderRadius: 3, background: l.color, border: `1px solid ${l.border}`, display: "inline-block" }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
