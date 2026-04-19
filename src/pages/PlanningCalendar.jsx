import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { base44 } from "@/api/base44Client";
import {
  format, addMonths, subMonths, addWeeks, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, getDay, isToday, isSameDay,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Sparkles, ClipboardList, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";

// ── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "meeting_prev",   label: "Review meeting",         shortLabel: "Review mtg",  week: "W−1", color: "#8B5CF6", bg: "rgba(139,92,246,0.1)"  },
  { key: "stats_share",    label: "Stats + brief request",  shortLabel: "Stats/brief", week: "W1",  color: "#2A69FF", bg: "rgba(42,105,255,0.1)"  },
  { key: "calendar_pdf",   label: "Editorial calendar PDF", shortLabel: "Edito PDF",   week: "W2",  color: "#0EA5E9", bg: "rgba(14,165,233,0.1)"  },
  { key: "shooting_org",   label: "Shootings + validation", shortLabel: "Shootings",   week: "W3",  color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
  { key: "meeting_review", label: "Monthly review meeting", shortLabel: "Review mtg",  week: "W4",  color: "#10B981", bg: "rgba(16,185,129,0.1)"  },
];

function monthKey(d) { return format(d, "yyyy-MM"); }

export default function PlanningCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDate, setWeekDate] = useState(new Date());
  const qc = useQueryClient();
  const month = monthKey(currentDate);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: () => base44.entities.Client.filter({ status: "Actif" }),
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["workflow-steps", month],
    queryFn: async () => {
      const { data } = await supabase.from("client_workflow_steps").select("*").eq("month", month);
      return data || [];
    },
  });

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekDate,   { weekStartsOn: 1 });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-planning", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("id, title, due_date, status, client_name, category")
        .gte("due_date", format(weekStart, "yyyy-MM-dd"))
        .lte("due_date", format(weekEnd,   "yyyy-MM-dd"))
        .neq("status", "Terminé");
      return data || [];
    },
  });

  const { data: shootings = [] } = useQuery({
    queryKey: ["shootings-planning", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase.from("shootings")
        .select("id, title, date, client_name, status, time, location")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd,   "yyyy-MM-dd"));
      return data || [];
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const toggleStep = useMutation({
    mutationFn: async ({ client_name, step_key, completed }) => {
      await supabase.from("client_workflow_steps").upsert(
        { client_name, month, step_key, completed, completed_at: completed ? new Date().toISOString() : null },
        { onConflict: "client_name,month,step_key" }
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-steps", month] }),
  });

  const generateWorkflow = useMutation({
    mutationFn: async () => {
      const rows = clients.flatMap(c =>
        STEPS.map(s => ({ client_name: c.company_name, month, step_key: s.key, completed: false }))
      );
      await supabase.from("client_workflow_steps")
        .upsert(rows, { onConflict: "client_name,month,step_key", ignoreDuplicates: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-steps", month] }),
  });

  // ── Derived ──────────────────────────────────────────────────────────────
  const stepMap = {};
  for (const s of steps) {
    if (!stepMap[s.client_name]) stepMap[s.client_name] = {};
    stepMap[s.client_name][s.step_key] = s;
  }
  const getStep = (clientName, stepKey) => stepMap[clientName]?.[stepKey];
  const activeClients = clients.filter(c => c.status === "Actif");

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const tasksByDay = {};
  const shootingsByDay = {};
  for (const t of tasks) { if (t.due_date) { (tasksByDay[t.due_date] ||= []).push(t); } }
  for (const s of shootings) { if (s.date) { (shootingsByDay[s.date] ||= []).push(s); } }

  const CARD = {
    background: "var(--card)",
    borderRadius: 16,
    border: "1px solid var(--divider)",
    boxShadow: "var(--card-shadow)",
  };

  return (
    <div className="w-full mx-auto space-y-5" style={{ maxWidth: 1400 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader title="Planning" subtitle="Monthly workflow & weekly calendar">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(d => subMonths(d, 1))} style={navBtn}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)", minWidth: 140, textAlign: "center" }}>
            {format(currentDate, "MMMM yyyy", { locale: enUS })}
          </span>
          <button onClick={() => setCurrentDate(d => addMonths(d, 1))} style={navBtn}>
            <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
          <button
            onClick={() => generateWorkflow.mutate()}
            disabled={generateWorkflow.isPending}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: generateWorkflow.isPending ? 0.6 : 1 }}
          >
            <Sparkles style={{ width: 14, height: 14 }} />
            Generate workflow
          </button>
        </div>
      </PageHeader>

      {/* ── Section 1: Workflow table ────────────────────────────────────── */}
      <div style={{ ...CARD, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "220px repeat(5, 1fr)", borderBottom: "1px solid var(--divider)" }}>
          <div style={{ padding: "14px 20px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Client
          </div>
          {STEPS.map(s => (
            <div key={s.key} style={{ padding: "14px 12px", borderLeft: "1px solid var(--divider)", textAlign: "center" }}>
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: s.bg, fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                {s.week}
              </span>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.3 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Client rows */}
        {activeClients.length === 0 ? (
          <p style={{ padding: "32px 20px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--muted)" }}>
            No active clients — add clients first.
          </p>
        ) : activeClients.map((client, ci) => {
          const name = client.company_name;
          const completedCount = STEPS.filter(s => getStep(name, s.key)?.completed).length;
          const progress = Math.round((completedCount / STEPS.length) * 100);
          return (
            <div
              key={client.id}
              style={{ display: "grid", gridTemplateColumns: "220px repeat(5, 1fr)", borderBottom: ci < activeClients.length - 1 ? "1px solid var(--divider)" : "none" }}
            >
              {/* Client info */}
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--brand)", flexShrink: 0 }}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{name}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: completedCount === STEPS.length ? "#10B981" : "var(--muted)", margin: 0 }}>
                      {completedCount}/{STEPS.length} done
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, borderRadius: 2, background: "var(--divider)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, borderRadius: 2, background: completedCount === STEPS.length ? "#10B981" : "var(--brand)", transition: "width 0.3s ease" }} />
                </div>
              </div>

              {/* Step cells */}
              {STEPS.map(step => {
                const row = getStep(name, step.key);
                const done = row?.completed || false;
                const exists = !!row;
                return (
                  <div
                    key={step.key}
                    style={{ borderLeft: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px", background: done ? step.bg : "transparent", transition: "background 0.15s ease" }}
                  >
                    <button
                      onClick={() => toggleStep.mutate({ client_name: name, step_key: step.key, completed: !done })}
                      title={step.label}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 10 }}
                    >
                      {done
                        ? <CheckCircle2 style={{ width: 28, height: 28, color: step.color }} />
                        : <Circle style={{ width: 28, height: 28, color: exists ? "var(--divider)" : "rgba(0,0,0,0.12)" }} />
                      }
                      {!exists && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--subtle)", letterSpacing: "0.05em" }}>generate</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Section 2: Week calendar ─────────────────────────────────────── */}
      <div style={{ ...CARD, overflow: "hidden" }}>
        {/* Week nav header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
            {format(weekStart, "d MMM", { locale: enUS })} — {format(weekEnd, "d MMM yyyy", { locale: enUS })}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setWeekDate(d => subWeeks(d, 1))} style={navBtn}><ChevronLeft style={{ width: 16, height: 16 }} /></button>
            <button onClick={() => setWeekDate(new Date())} style={{ ...navBtn, fontSize: 11, fontFamily: "'DM Mono', monospace", width: "auto", padding: "0 10px", color: "var(--brand)" }}>Today</button>
            <button onClick={() => setWeekDate(d => addWeeks(d, 1))} style={navBtn}><ChevronRight style={{ width: 16, height: 16 }} /></button>
          </div>
        </div>

        {/* Day columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {weekDays.map((day, i) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDay[dayKey] || [];
            const dayShootings = shootingsByDay[dayKey] || [];
            const isCurrentDay = isToday(day);
            const isWeekend = i >= 5;

            return (
              <div
                key={dayKey}
                style={{
                  borderRight: i < 6 ? "1px solid var(--divider)" : "none",
                  background: isCurrentDay ? "rgba(42,105,255,0.03)" : isWeekend ? "rgba(0,0,0,0.015)" : "transparent",
                  minHeight: 220,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Day header */}
                <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--divider)", textAlign: "center" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: isCurrentDay ? "var(--brand)" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
                    {format(day, "EEE", { locale: enUS })}
                  </p>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: "50%",
                    background: isCurrentDay ? "var(--brand)" : "transparent",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 16, fontWeight: isCurrentDay ? 700 : 500,
                    color: isCurrentDay ? "#fff" : isWeekend ? "var(--muted)" : "var(--ink)",
                  }}>
                    {format(day, "d")}
                  </span>
                </div>

                {/* Events */}
                <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  {dayShootings.map(s => (
                    <Link key={s.id} to="/Shootings" style={{ textDecoration: "none" }}>
                      <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.12)", borderLeft: "3px solid #F59E0B" }}>
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#92400E", margin: 0, lineHeight: 1.3 }}>
                          📸 {s.title}
                        </p>
                        {s.client_name && (
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#B45309", margin: "3px 0 0" }}>{s.client_name}{s.time ? ` · ${s.time}` : ""}</p>
                        )}
                      </div>
                    </Link>
                  ))}

                  {dayTasks.map(t => {
                    const isBlocked = t.status === "Bloqué";
                    const isInProgress = t.status === "En cours";
                    const accentColor = isBlocked ? "#EF4444" : isInProgress ? "#2A69FF" : "#6B7280";
                    const bgColor = isBlocked ? "rgba(239,68,68,0.08)" : isInProgress ? "rgba(42,105,255,0.08)" : "rgba(0,0,0,0.04)";
                    return (
                      <Link key={t.id} to="/Tasks" style={{ textDecoration: "none" }}>
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: bgColor, borderLeft: `3px solid ${accentColor}` }}>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {t.title}
                          </p>
                          {t.client_name && (
                            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", margin: "3px 0 0" }}>{t.client_name}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}

                  {dayTasks.length === 0 && dayShootings.length === 0 && (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--subtle)", textAlign: "center", marginTop: 16 }}>—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", paddingBottom: 8 }}>
        {[
          { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Shooting" },
          { color: "#2A69FF", bg: "rgba(42,105,255,0.08)", label: "Task in progress" },
          { color: "#EF4444", bg: "rgba(239,68,68,0.08)", label: "Task blocked" },
          { color: "#6B7280", bg: "rgba(0,0,0,0.04)", label: "Task not started" },
        ].map(l => (
          <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, borderLeft: `3px solid ${l.color}`, display: "inline-block" }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const navBtn = {
  width: 32, height: 32, borderRadius: 8,
  border: "1px solid var(--divider)",
  background: "var(--card)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "var(--ink)",
};
