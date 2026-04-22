import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import {
  format, addMonths, subMonths, addWeeks, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, CalendarDays, Loader2, Layers } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";

function monthKey(d) { return format(d, "yyyy-MM"); }

// ── Color helpers ─────────────────────────────────────────────────────────────
// Convert a hex string (e.g. "#4285F4") to an rgba() string with the given alpha.
// Falls back to Google Calendar blue if the input is missing or malformed.
function hexToRgba(hex, alpha) {
  const clean = (hex || "").replace("#", "").trim();
  const norm = clean.length === 6 ? clean : "4285F4";
  const r = parseInt(norm.substring(0, 2), 16);
  const g = parseInt(norm.substring(2, 4), 16);
  const b = parseInt(norm.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const [calView, setCalView] = useState("month");
  const [gcalConnected, setGcalConnected] = useState(null);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalEvents, setGcalEvents] = useState([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [allCalendars, setAllCalendars] = useState([]); // [{ name, color }]
  const [hiddenCalendars, setHiddenCalendars] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("gcal_hidden") || "[]")); }
    catch { return new Set(); }
  });
  const [calPickerOpen, setCalPickerOpen] = useState(false);
  const [expandedGcalDay, setExpandedGcalDay] = useState(null); // dayKey when +N gcal expanded
  const [bulkSyncing, setBulkSyncing] = useState(false);
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
      if (result.connected) {
        const evs = result.events || [];
        setGcalEvents(evs);
        // Extract unique calendars from events
        const calMap = {};
        for (const ev of evs) {
          if (ev._calendarName && !calMap[ev._calendarName]) {
            calMap[ev._calendarName] = ev._calendarColor || "#4285F4";
          }
        }
        setAllCalendars(prev => {
          const next = { ...Object.fromEntries(prev.map(c => [c.name, c.color])), ...calMap };
          return Object.entries(next).map(([name, color]) => ({ name, color }));
        });
      }
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

  // ── Bulk sync existing tasks & shootings ─────────────────────────────────
  const bulkSync = async () => {
    setBulkSyncing(true);
    try {
      const result = await callEdgeFunction("googleCalendarBulkSync", {});
      if (result.connected === false) {
        toast.error("Google Calendar not connected");
      } else {
        toast.success(`Synced ${result.synced} event${result.synced !== 1 ? "s" : ""} to Google Calendar`);
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setBulkSyncing(false);
    }
  };

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

  // ── Derived ──────────────────────────────────────────────────────────────
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const tasksByDay = {};
  const shootingsByDay = {};
  for (const t of tasks) { if (t.due_date) { (tasksByDay[t.due_date] ||= []).push(t); } }
  for (const s of shootings) { if (s.date) { (shootingsByDay[s.date] ||= []).push(s); } }

  const mTasksByDay = {};
  const mShootingsByDay = {};
  for (const t of monthTasks) { if (t.due_date) { (mTasksByDay[t.due_date] ||= []).push(t); } }
  for (const s of monthShootings) { if (s.date) { (mShootingsByDay[s.date] ||= []).push(s); } }

  const toggleCalendar = (name) => {
    setHiddenCalendars(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      localStorage.setItem("gcal_hidden", JSON.stringify([...next]));
      return next;
    });
  };

  const visibleGcalEvents = gcalEvents.filter(ev =>
    !hiddenCalendars.has(ev._calendarName)
  );

  // Google Calendar events by day (visible only)
  const gcalByDay = {};
  for (const ev of visibleGcalEvents) {
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

  const disconnectGcal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("google_calendar_tokens").delete().eq("user_id", user.id);
    setGcalConnected(false);
    setGcalEvents([]);
    toast.success("Google Calendar disconnected");
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #10B981", background: "rgba(16,185,129,0.08)", color: "#10B981", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600 }}>
            <CalendarDays style={{ width: 13, height: 13 }} />
            Google Cal {gcalLoading && <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />}
          </div>
          <button
            onClick={bulkSync}
            disabled={bulkSyncing}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--card)", color: "var(--brand)", fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: "pointer", fontWeight: 600 }}
          >
            {bulkSyncing ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : null}
            {bulkSyncing ? "Syncing…" : "Sync existing"}
          </button>
          <button
            onClick={disconnectGcal}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--card)", color: "var(--muted)", fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: "pointer" }}
          >
            Disconnect
          </button>
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
        <div className="flex items-center gap-3 flex-wrap" style={{ position: "relative" }}>
          <GcalChip />
          {gcalConnected && allCalendars.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setCalPickerOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--card)", color: "var(--ink)", fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer" }}
              >
                <Layers style={{ width: 13, height: 13 }} />
                Calendars {hiddenCalendars.size > 0 && <span style={{ background: "var(--brand)", color: "#fff", borderRadius: 10, padding: "0 5px", fontSize: 9 }}>{allCalendars.length - hiddenCalendars.size}/{allCalendars.length}</span>}
              </button>
              {calPickerOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setCalPickerOpen(false)} />
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, background: "var(--card)", border: "1px solid var(--divider)", borderRadius: 12, boxShadow: "var(--card-shadow)", padding: "8px", minWidth: 220, display: "flex", flexDirection: "column", gap: 2 }}>
                    {allCalendars.map(cal => {
                      const hidden = hiddenCalendars.has(cal.name);
                      return (
                        <button
                          key={cal.name}
                          onClick={() => toggleCalendar(cal.name)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "none", background: hidden ? "transparent" : "rgba(0,0,0,0.03)", cursor: "pointer", textAlign: "left", width: "100%", opacity: hidden ? 0.45 : 1, transition: "all 0.15s" }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: cal.color || "#4285F4", flexShrink: 0, outline: hidden ? "2px dashed var(--divider)" : "none" }} />
                          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--ink)", flex: 1 }}>{cal.name}</span>
                          {!hidden && <CheckCircle2 style={{ width: 14, height: 14, color: "var(--brand)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
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

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
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
                <div key={dayKey} style={{ borderRight: i < 6 ? "1px solid var(--divider)" : "none", background: isCurrentDay ? "rgba(42,105,255,0.03)" : isWeekend ? "rgba(0,0,0,0.015)" : "transparent", minHeight: 220, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--divider)", textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", background: isCurrentDay ? "var(--brand)" : "transparent", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: isCurrentDay ? 700 : 500, color: isCurrentDay ? "#fff" : isWeekend ? "var(--muted)" : "var(--ink)" }}>
                      {format(day, "d")}
                    </span>
                  </div>
                  <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    {/* Google Calendar events */}
                    {dayGcal.map(ev => {
                      const calColor = ev._calendarColor || "#4285F4";
                      const calBg = hexToRgba(calColor, 0.1);
                      return (
                        <div key={ev.id} style={{ padding: "8px 10px", borderRadius: 8, background: calBg, borderLeft: `3px solid ${calColor}` }}>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: calColor, margin: 0, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {ev.summary || "(No title)"}
                          </p>
                          {ev.start?.dateTime && (
                            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: calColor, margin: "3px 0 0", opacity: 0.7 }}>
                              {format(new Date(ev.start.dateTime), "HH:mm")}
                              {ev.end?.dateTime ? ` – ${format(new Date(ev.end.dateTime), "HH:mm")}` : ""}
                            </p>
                          )}
                        </div>
                      );
                    })}
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
                <div key={dayKey} style={{ borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--divider)" : "none", borderBottom: i < monthCells.length - 7 ? "1px solid var(--divider)" : "none", minHeight: 110, minWidth: 0, overflow: expandedGcalDay === dayKey ? "visible" : "hidden", padding: "8px 8px 6px", background: !inMonth ? "var(--bg)" : isCurrentDay ? "rgba(42,105,255,0.03)" : isWeekend ? "rgba(0,0,0,0.015)" : "var(--card)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isCurrentDay ? "var(--brand)" : "transparent", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: isCurrentDay ? 700 : inMonth ? 500 : 400, color: isCurrentDay ? "#fff" : !inMonth ? "var(--subtle)" : isWeekend ? "var(--muted)" : "var(--ink)" }}>
                      {format(day, "d")}
                    </span>
                  </div>
                  {/* Google Cal events — collapse to 1 by default, click "+N gcal" to expand */}
                  {(() => {
                    const isExpanded = expandedGcalDay === dayKey;
                    const visibleGcal = isExpanded ? dayGcal : dayGcal.slice(0, 1);
                    return (
                      <>
                        {visibleGcal.map(ev => {
                          const calColor = ev._calendarColor || "#4285F4";
                          const calBg = hexToRgba(calColor, 0.1);
                          return (
                            <div key={ev.id} style={{ padding: "3px 7px", borderRadius: 5, background: calBg, borderLeft: `2px solid ${calColor}`, overflow: "hidden" }}>
                              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: calColor, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.summary || "(No title)"}</p>
                            </div>
                          );
                        })}
                        {dayGcal.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpandedGcalDay(isExpanded ? null : dayKey); }}
                            style={{
                              fontFamily: "'DM Mono', monospace", fontSize: 9,
                              color: dayGcal[0]?._calendarColor || "#4285F4",
                              margin: 0, paddingLeft: 2,
                              background: "transparent", border: "none",
                              cursor: "pointer", textAlign: "left",
                              textDecoration: "underline",
                            }}
                          >
                            {isExpanded ? "− show less" : `+${dayGcal.length - 1} gcal`}
                          </button>
                        )}
                      </>
                    );
                  })()}
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
