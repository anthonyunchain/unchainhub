import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/base44Client";
import SmartAlertsWidget from "../components/dashboard/SmartAlertsWidget";
import { Users, Kanban, Calendar, ArrowUpRight, FileBarChart, Eye, Camera, CalendarClock, CalendarDays } from "lucide-react";
import KpiCard from "../components/shared/KpiCard";
import StatusBadge from "../components/shared/StatusBadge";
import TodayTasksWidget from "../components/tasks/TodayTasksWidget";
import { Link } from "react-router-dom";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { useState, useEffect, useMemo } from "react";
import { getGreeting } from "@/lib/greeting";

async function fetchUpcomingGcalEvents() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { connected: false, events: [] };
  const now = new Date();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/googleCalendarEvents`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ timeMin: now.toISOString(), timeMax: addDays(now, 14).toISOString() }),
    }
  );
  if (!res.ok) return { connected: false, events: [] };
  const data = await res.json();
  const today = format(new Date(), "yyyy-MM-dd");
  // Apply hidden calendars from Planning
  const hidden = new Set(JSON.parse(localStorage.getItem("gcal_hidden") || "[]"));
  const events = (data.events || []).filter(ev => {
    if (hidden.has(ev._calendarName)) return false;
    // Only future/today events (compare by start date string)
    const dayStr = ev.start?.date || ev.start?.dateTime?.slice(0, 10) || "";
    return dayStr >= today;
  });
  return { ...data, events };
}

const CARD = {
  background: 'var(--card)',
  borderRadius: 'var(--card-radius)',
  boxShadow: 'var(--card-shadow)',
  padding: '24px',
  transition: 'box-shadow 200ms ease, transform 200ms ease',
};

const LABEL = {
  fontFamily: "'DM Mono', monospace",
  fontSize: '10px',
  fontWeight: 500,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: 14,
  display: 'block',
};

export default function Dashboard() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState(null);
  const greeting = useMemo(() => getGreeting(userName.split(" ")[0] || ""), [userName]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUserName(u?.full_name || u?.email || "");
      setUserRole(u?.role || null);
    }).catch(() => {});
  }, []);

  const { data: gcalData = { connected: false, events: [] } } = useQuery({
    queryKey: ["gcal-upcoming-dash"],
    queryFn: fetchUpcomingGcalEvents,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: prospects = [], isLoading: loadingProspects } = useQuery({ queryKey: ["prospects"], queryFn: () => base44.entities.Prospect.list() });
  const { data: content = [], isLoading: loadingContent } = useQuery({ queryKey: ["content-dash"], queryFn: () => base44.entities.EditorialContent.list() });

  const currentMonth = format(new Date(), "yyyy-MM");

  const activeClients = clients.filter(c => c.status === "Actif").length;
  const openDeals = prospects.filter(p => !["Signé", "Perdu"].includes(p.stage)).length;

  const thisMonthContent = content.filter(c => c.scheduled_date?.startsWith(currentMonth));
  const totalContent = thisMonthContent.length;
  const published = thisMonthContent.filter(c => c.status === "Publié").length;
  const inProgress = thisMonthContent.filter(c => c.status === "En cours").length;
  const scheduled = thisMonthContent.filter(c => c.status === "Planifié").length;
  const shot = thisMonthContent.filter(c => c.post_type === "Reel" || c.post_type === "Story").length;

  const upcomingContent = content
    .filter(c => c.status === "Planifié" || c.status === "En cours")
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .slice(0, 6);
  const activeClientsList = clients.filter(c => c.status === "Actif");
  const { data: clientStats = [], isLoading: loadingStats } = useQuery({ queryKey: ["client-stats-dash"], queryFn: () => base44.entities.ClientStats.list("-period") });
  const thisMonthStats = clientStats.filter(s => s.period === currentMonth);
  const totalViews30d = thisMonthStats.reduce((s, r) => s + (r.views || 0), 0);
  const { data: shootingContentLinks = [], isLoading: loadingShootings } = useQuery({ queryKey: ["shooting-content-dash"], queryFn: () => base44.entities.ShootingContent.list() });
  const linkedContentIds = new Set(shootingContentLinks.map(c => c.content_id));
  const shootingsToOrganize = content.filter(c => c.status !== "Publié" && c.needs_shooting !== false && !linkedContentIds.has(c.id)).length;

  return (
    <div className="w-full mx-auto space-y-4" style={{ maxWidth: '1400px' }}>

      {/* ── Greeting ── */}
      <div>
        <h2
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 'clamp(20px, 5.5vw, 28px)',
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: '-0.5px',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {greeting}
        </h2>
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '11px',
          color: 'var(--muted)',
          marginTop: 6,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: enUS })}
        </p>
      </div>

      {/* ── Smart Alerts (admin only) ── */}
      {userRole === 'admin' && <SmartAlertsWidget />}

      {/* ── Row 1: Hero + 4 KPIs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Hero Content Overview */}
        <Link to="/Admin?s=analytics" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{
            ...CARD,
            background: 'linear-gradient(145deg, var(--brand-card-from) 0%, var(--brand) 60%, var(--brand-card-to) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ ...LABEL, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>This Month</span>
              <p
                className="text-[42px] sm:text-[52px]"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-3px',
                  lineHeight: 1.05,
                  margin: 0,
                }}
              >
                {totalContent}
              </p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.60)', marginTop: 6 }}>
                total posts planned
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-2 mt-5">
              {[
                { label: 'Shot',       value: shot },
                { label: 'In Editing', value: inProgress },
                { label: 'Scheduled',  value: scheduled },
                { label: 'Published',  value: published },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>{s.value}</p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileBarChart style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.55)' }}>View full reports →</span>
            </div>
          </div>
        </Link>

        {/* 2×2 KPI grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <Link to="/Planning" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              ...CARD,
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', minHeight: 110,
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Planning</p>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>Pro Calendar</p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Workflow · Tasks · Meetings</p>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarClock style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.7)' }} />
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowUpRight style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.35)' }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Open planning</span>
              </div>
            </div>
          </Link>
          <Link to="/Admin?s=sales" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Open deals"       value={openDeals}                          icon={Kanban} tint="purple" loading={loadingProspects} />
          </Link>
          <Link to="/Admin?s=analytics" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Views this month" value={totalViews30d.toLocaleString("fr-FR")} icon={Eye}    tint="green"  loading={loadingStats} />
          </Link>
          <Link to="/Shootings" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Shootings to organize" value={shootingsToOrganize} icon={Camera} tint="amber" loading={loadingContent || loadingShootings} />
          </Link>
        </div>
      </div>

      {/* ── Row 2: Upcoming Content + Today's Tasks + Upcoming Events ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

        {/* Upcoming Content */}
        <Link to="/Editorial" style={{ textDecoration: 'none', display: 'block' }} className="h-auto lg:h-[420px]">
          <div
            style={{ ...CARD, display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', height: '100%' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ ...LABEL, flexShrink: 0 }}>Upcoming content</span>
            <div className="scrollbar-none" style={{ overflowY: 'auto', flex: 1 }}>
              {loadingContent ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56 }} aria-hidden="true" />)}
                </div>
              ) : upcomingContent.length === 0 ? (
                <p className="text-mono-caps">No scheduled content</p>
              ) : null}
              {!loadingContent && upcomingContent.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: i < upcomingContent.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar style={{ width: 14, height: 14, color: 'var(--brand)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || c.post_type}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{c.client_name} · {c.scheduled_date ? format(new Date(c.scheduled_date), "d MMM", { locale: enUS }) : "—"}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          </div>
        </Link>

        {/* Today's Tasks */}
        <div className="h-auto lg:h-[420px]">
          <TodayTasksWidget />
        </div>

        {/* Upcoming Events (Google Calendar) */}
        <div
          style={{ ...CARD, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          className="h-auto lg:h-[420px]"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
            <span style={LABEL}>Upcoming events</span>
            <Link to="/Planning" style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', textDecoration: 'none' }}>
              Planning <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          {!gcalData.connected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(66,133,244,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarDays style={{ width: 22, height: 22, color: '#4285F4' }} />
              </div>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0, textAlign: 'center' }}>Google Calendar not connected</p>
              <Link to="/Planning" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--brand)', textDecoration: 'none', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--brand)', background: 'rgba(42,105,255,0.06)' }}>
                Connect in Planning →
              </Link>
            </div>
          ) : gcalData.events.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No upcoming events in the next 14 days</p>
            </div>
          ) : (
            <div className="scrollbar-none" style={{ overflowY: 'auto', flex: 1 }}>
              {gcalData.events.slice(0, 8).map((ev, i) => {
                const isAllDay = !!ev.start?.date;
                const startDate = isAllDay ? new Date(ev.start.date + 'T00:00:00') : new Date(ev.start.dateTime);
                const isToday = format(startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < Math.min(gcalData.events.length, 8) - 1 ? '1px solid var(--divider)' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: isToday ? 'rgba(66,133,244,0.15)' : 'rgba(66,133,244,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: '#4285F4', lineHeight: 1 }}>{format(startDate, 'd')}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4285F4', opacity: 0.7, textTransform: 'uppercase' }}>{format(startDate, 'MMM', { locale: enUS })}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{ev.summary || '(No title)'}</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {isAllDay ? 'All day' : `${format(startDate, 'HH:mm')}${ev.end?.dateTime ? ` – ${format(new Date(ev.end.dateTime), 'HH:mm')}` : ''}`}
                        {isToday && <span style={{ marginLeft: 6, color: '#4285F4', fontWeight: 700 }}>· Today</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
