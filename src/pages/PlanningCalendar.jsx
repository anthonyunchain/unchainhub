import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { base44 } from "@/api/base44Client";
import {
  format, addMonths, subMonths, addWeeks, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, CalendarDays, Loader2, AlertCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";

// ── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "meeting_prev",   label: "Review meeting",         shortLabel: "Review mtg",  week: "W−1", color: "#8B5CF6", bg: "rgba(139,92,246,0.1)"  },
  { key: "stats_share",    label: "Stats + brief request",  shortLabel: "Stats/brief", week: "W1",  color: "#2A69FF", bg: "rgba(42,105,255,0.1)"  },
  { key: "calendar_pdf",   label: "Editorial calendar PDF", shortLabel: "Edito PDF",   week: "W2",  color: "#0EA5E9", bg: "rgba(14,165,233,0.1)"  },
  { key: "shooting_org",   label: "Shootings + validation", shortLabel: "Shootings",   week: "W3",  color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
  { key: "meeting_review", label: "Monthly review meeting", shortLabel: "Review mtg",  week: "W4",  color: "#10B981", bg: "rgba(16,185,129,0.1)"  },
];

function monthKey(d) { return format(d, "yyyy-MM"); }

// ── Google Cal helpers ────────────────────────────────────────────────────────
async function callEdgeFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );
  return res.json();
}

export default function PlanningCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDate, setWeekDate] = useState(new Date());
  const [calView, setCalView] = useState("week");
  const [gcalConnected, setGcalConnected] = useState(null); // null=checking, true/false
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalEvents, setGcalEvents] = useState([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const month = monthKey(currentDate);

  // ── Handle OAuth redirect params ─────────────────────────────────────────
  useEffect(() => {
    const connected = searchParams.get("connected");
    const gcalError = searchParams.get("gcal_error");
    if (connected === "1") {
      setGcalConnected(true);
      toast.success("Google Calendar connected!");
      setSearchParams({}, { replace: true });
    } else if (gcalError === "1") {
      toast.error("Could not connect Google Calendar. Try again.");
      setSearchParams({}, { replace: true });
    }
  }, []);

  // ── Check connection status on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const result = await callEdgeFunction("googleCalendarEvents", {
          timeMin: now.toISOString(),
          timeMax: now.toISOString(),
        });
        setGcalConnected(result.connected === true);
      } catch {
        setGcalConnected(false);
      }
    })();
  }, []);

  // ── Fetch Google Calendar events for current view range ───────────────────
  const fetchGcalEvents = useCallback(async (start, end) => {
    if (!gcalConnected) return;
    setGcalLoading(true);
    try {
      const result = await callEdgeFunction("googleCalendarEvents", {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      });
      if (result.connected) setGcalEvents(result.events || []);
    } catch {
      // silently ignore
    } finally {
      setGcalLoading(false);
    }
  }, [gcalConnected]);

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekDate,   { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(currentDate);

  useEffect(() => {
    if (!gcalConnected) return;
    if (calView === "week") {
      fetchGcalEvents(weekStart, weekEnd);
    } else {
      fetchGcalEvents(monthStart, monthEnd);
    }
  }, [gcalConnected, calView, format(weekStart, "yyyy-MM-dd"), month]);

  // ── Connect Google Calendar ───────────────────────────────────────────────
  const connectGcal = async () => {
    setGcalConnecting(true);
    try {
      const result = await callEdgeFunction("googleCalendarAuth", {});
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to get OAuth URL");
        setGcalConnecting(false);
      }
    } catch {
      toast.error("Connection error");
      setGcalConnecting(false);
    }
  };

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
    enabled: calView === "week",
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
    enabled: calView === "week",
  });

  const { data: monthTasks = [] } = useQuery({
    queryKey: ["tasks-planning-month", month],
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("id, title, due_date, status, client_name, category")
        .gte("due_date", format(monthStart, "yyyy-MM-dd"))
        .lte("due_date", format(monthEnd,   "yyyy-MM-dd"))
        .neq("status", "Terminé");
      return data || [];
    },
    enabled: calView === "month",
  });

  const { data: monthShootings = [] } = useQuery({
    queryKey: ["shootings-planning-month", month],
    queryFn: async () => {
      const { data } = await supabase.from("shootings")
        .select("id, title, date, client_name, status, time")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd,   "yyyy-MM-dd"));
      return data || [];
    },
    enabled: calView === "month",
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

  const mTasksByDay = {};
  const mShootingsByDay = {};
  for (const t of monthTasks) { if (t.due_date) { (mTasksByDay[t.due_date] ||= []).push(t); } }
  for (const s of monthShootings) { if (s.date) { (mShootingsByDay[s.date] ||= []).push(s); } }

  // Google Calendar events by day
  const gcalByDay = {};
  for (const ev of gcalEvents) {
    const dayStr = ev.start?.date || ev.start?.dateTime?.slice(0, 10);
    if (dayStr) (gcalByDay[dayStr] ||= []).push(ev);
  }

  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd   = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  const monthCells = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const CARD = {
    background: "var(--card)",
    borderRadius: 16,
    border: "1px solid var(--divider)",
    boxShadow: "var(--card-shadow)",
  };

  // ── Google Calendar chip ─────────────────────────────────────────────────
  const GcalChip = () => {
    if (gcalConnected === null) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--card)", color: "var(--muted)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
          <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
          Google Cal
        </div>
      );
    }
    if (gcalConnected) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #10B981", background: "rgba(16,185,129,0.08)", color: "#10B981", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600 }}>
          <CalendarDays style={{ width: 13, height: 13 }} />
          Google Cal {gcalLoading && <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />}
        </div>
      );
    }
    return (
      <button
        onClick={connectGcal}
        disabled={gcalConnecting}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--brand)", background: "rgba(42,105,255,0.08)", color: "var(--brand)", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
      >
        {gcalConnecting ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <CalendarDays style={{ width: 13, height: 13 }} />}
        {gcalConnecting ? "Connecting…" : "Connect Google Cal"}
      </button>
    );
  };

  return (
    <div className="w-full mx-auto space-y-5" style={{ maxWidth: 1400 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader title="Planning" subtitle="Monthly workflow & calendar">
        <div className="flex items-center gap-3 flex-wrap">
          <GcalChip />
          <button onClick={() => setCurrentDate(d => subMonths(d, 1))} style={navBtn}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)", minWidth: 140, textAlign: "center" }}>
            {format(currentDate, "MMMM yyyy", { locale: enUS })}
          </span>
          <button onClick={() => setCurrentDate(d => addMonths(d, 1))} style={navBtn}>
            <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
          <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--divider)", borderRadius: 10, padding: 3, gap: 2 }}>
            {["week", "month"].map(v => (
              <button key={v} onClick={() => setCalView(v)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, textTransform: "capitalize", background: calView === v ? "var(--card)" : "transparent", color: calView === v ? "var(--ink)" : "var(--muted)", boxShadow: calView === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {/* ── Section 1: Workflow table ────────────────────────────────────── */}
      <div style={{ ...CARD, overflow: "hidden" }}>
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
                <div style={{ height: 4, borderRadius: 2, background: "var(--divider)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, borderRadius: 2, background: completedCount === STEPS.length ? "#10B981" : "var(--brand)", transition: "width 0.3s ease" }} />
                </div>
              </div>

              {STEPS.map(step => {
                const row = getStep(name, step.key);
                const done = row?.completed || false;
                return (
                  <div
                    key={step.key}
                    style={{ borderLeft: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px", background: done ? step.bg : "transparent", transition: "background 0.15s ease" }}
                  >
                    <button
                      onClick={() => toggleStep.mutate({ client_name: name, step_key: step.key, completed: !done })}
                      title={step.label}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 10 }}
                    >
                      {done
                        ? <CheckCircle2 style={{ width: 28, height: 28, color: step.color }} />
                        : <Circle style={{ width: 28, height: 28, color: "rgba(0,0,0,0.15)" }} />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Section 2: Calendar ──────────────────────────────────────────── */}
      <div style={{ ...CARD, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
            {calView === "week"
              ? `${format(weekStart, "d MMM", { locale: enUS })} — ${format(weekEnd, "d MMM yyyy", { locale: enUS })}`
              : format(currentDate, "MMMM yyyy", { locale: enUS })
            }
          </span>
          {calView === "week" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setWeekDate(d => subWeeks(d, 1))} style={navBtn}><ChevronLeft style={{ width: 16, height: 16 }} /></button>
              <button onClick={() => setWeekDate(new Date())} style={{ ...navBtn, fontSize: 11, fontFamily: "'DM Mono', monospace", width: "auto", padding: "0 10px", color: "var(--brand)" }}>Today</button>
              <button onClick={() => setWeekDate(d => addWeeks(d, 1))} style={navBtn}><ChevronRight style={{ width: 16, height: 16 }} /></button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--divider)" }}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
            <div key={d} style={{ padding: "8px 0", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{d}</div>
          ))}
        </div>

        {/* ── WEEK view ── */}
        {calView === "week" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {weekDays.map((day, i) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay[dayKey] || [];
              const dayShootings = shootingsByDay[dayKey] || [];
              const dayGcal = gcalByDay[dayKey] || [];
              const isCurrentDay = isToday(day);
              const isWeekend = i >= 5;
              return (
                <div key={dayKey} style={{ borderRight: i < 6 ? "1px solid var(--divider)" : "none", background: isCurrentDay ? "rgba(42,105,255,0.03)" : isWeekend ? "rgba(0,0,0,0.015)" : "transparent", minHeight: 220, display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--divider)", textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", background: isCurrentDay ? "var(--brand)" : "transparent", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: isCurrentDay ? 700 : 500, color: isCurrentDay ? "#fff" : isWeekend ? "var(--muted)" : "var(--ink)" }}>
                      {format(day, "d")}
                    </span>
                  </div>
                  <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    {/* Google Calendar events */}
                    {dayGcal.map(ev => (
                      <div key={ev.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(66,133,244,0.1)", borderLeft: "3px solid #4285F4" }}>
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#1a56db", margin: 0, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {ev.summary || "(No title)"}
                        </p>
                        {ev.start?.dateTime && (
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#1a56db", margin: "3px 0 0", opacity: 0.7 }}>
                            {format(new Date(ev.start.dateTime), "HH:mm")}
                            {ev.end?.dateTime ? ` – ${format(new Date(ev.end.dateTime), "HH:mm")}` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                    {/* Shootings */}
                    {dayShootings.map(s => (
                      <Link key={s.id} to="/Shootings" style={{ textDecoration: "none" }}>
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.12)", borderLeft: "3px solid #F59E0B" }}>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#92400E", margin: 0, lineHeight: 1.3 }}>📸 {s.title}</p>
                          {s.client_name && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#B45309", margin: "3px 0 0" }}>{s.client_name}{s.time ? ` · ${s.time}` : ""}</p>}
                        </div>
                      </Link>
                    ))}
                    {/* Tasks */}
                    {dayTasks.map(t => {
                      const accent = t.status === "Bloqué" ? "#EF4444" : t.status === "En cours" ? "#2A69FF" : "#6B7280";
                      const bg = t.status === "Bloqué" ? "rgba(239,68,68,0.08)" : t.status === "En cours" ? "rgba(42,105,255,0.08)" : "rgba(0,0,0,0.04)";
                      return (
                        <Link key={t.id} to="/Tasks" style={{ textDecoration: "none" }}>
                          <div style={{ padding: "8px 10px", borderRadius: 8, background: bg, borderLeft: `3px solid ${accent}` }}>
                            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.title}</p>
                            {t.client_name && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", margin: "3px 0 0" }}>{t.client_name}</p>}
                          </div>
                        </Link>
                      );
                    })}
                    {!dayTasks.length && !dayShootings.length && !dayGcal.length && (
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--subtle)", textAlign: "center", marginTop: 16 }}>—</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MONTH view ── */}
        {calView === "month" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {monthCells.map((day, i) => {
              const inMonth = day.getMonth() === currentDate.getMonth();
              const dayKey = format(day, "yyyy-MM-dd");
              const dayTasks = mTasksByDay[dayKey] || [];
              const dayShootings = mShootingsByDay[dayKey] || [];
              const dayGcal = gcalByDay[dayKey] || [];
              const isCurrentDay = isToday(day);
              const isWeekend = (i % 7) >= 5;
              return (
                <div key={dayKey} style={{ borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--divider)" : "none", borderBottom: i < monthCells.length - 7 ? "1px solid var(--divider)" : "none", minHeight: 110, padding: "8px 8px 6px", background: !inMonth ? "var(--bg)" : isCurrentDay ? "rgba(42,105,255,0.03)" : isWeekend ? "rgba(0,0,0,0.015)" : "var(--card)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isCurrentDay ? "var(--brand)" : "transparent", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: isCurrentDay ? 700 : inMonth ? 500 : 400, color: isCurrentDay ? "#fff" : !inMonth ? "var(--subtle)" : isWeekend ? "var(--muted)" : "var(--ink)" }}>
                      {format(day, "d")}
                    </span>
                  </div>
                  {/* Google Cal events */}
                  {dayGcal.slice(0, 1).map(ev => (
                    <div key={ev.id} style={{ padding: "3px 7px", borderRadius: 5, background: "rgba(66,133,244,0.1)", borderLeft: "2px solid #4285F4", overflow: "hidden" }}>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "#1a56db", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.summary || "(No title)"}</p>
                    </div>
                  ))}
                  {dayGcal.length > 1 && (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#4285F4", margin: 0, paddingLeft: 2 }}>+{dayGcal.length - 1} gcal</p>
                  )}
                  {/* Shootings */}
                  {dayShootings.map(s => (
                    <Link key={s.id} to="/Shootings" style={{ textDecoration: "none" }}>
                      <div style={{ padding: "3px 7px", borderRadius: 5, background: "rgba(245,158,11,0.13)", borderLeft: "2px solid #F59E0B", overflow: "hidden" }}>
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "#92400E", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📸 {s.title}</p>
                      </div>
                    </Link>
                  ))}
                  {dayTasks.slice(0, 2).map(t => {
                    const accent = t.status === "Bloqué" ? "#EF4444" : t.status === "En cours" ? "#2A69FF" : "#6B7280";
                    const bg = t.status === "Bloqué" ? "rgba(239,68,68,0.08)" : t.status === "En cours" ? "rgba(42,105,255,0.08)" : "rgba(0,0,0,0.04)";
                    return (
                      <Link key={t.id} to="/Tasks" style={{ textDecoration: "none" }}>
                        <div style={{ padding: "3px 7px", borderRadius: 5, background: bg, borderLeft: `2px solid ${accent}`, overflow: "hidden" }}>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "var(--ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</p>
                        </div>
                      </Link>
                    );
                  })}
                  {dayTasks.length > 2 && (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", margin: 0, paddingLeft: 2 }}>+{dayTasks.length - 2} more</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", paddingBottom: 8 }}>
        {[
          { color: "#4285F4", bg: "rgba(66,133,244,0.1)", label: "Google Calendar" },
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
