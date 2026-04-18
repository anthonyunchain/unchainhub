import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import SmartAlertsWidget from "../components/dashboard/SmartAlertsWidget";
import { Users, Kanban, Calendar, ArrowUpRight, FileBarChart, Eye, Camera } from "lucide-react";
import KpiCard from "../components/shared/KpiCard";
import StatusBadge from "../components/shared/StatusBadge";
import TodayTasksWidget from "../components/tasks/TodayTasksWidget";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useState, useEffect, useMemo } from "react";
import { getGreeting } from "@/lib/greeting";

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

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: prospects = [] } = useQuery({ queryKey: ["prospects"], queryFn: () => base44.entities.Prospect.list() });
  const { data: content = [] } = useQuery({ queryKey: ["content-dash"], queryFn: () => base44.entities.EditorialContent.list() });

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
  const { data: clientStats = [] } = useQuery({ queryKey: ["client-stats-dash"], queryFn: () => base44.entities.ClientStats.list("-period") });
  const thisMonthStats = clientStats.filter(s => s.period === currentMonth);
  const totalViews30d = thisMonthStats.reduce((s, r) => s + (r.views || 0), 0);
  const { data: shootingContentLinks = [] } = useQuery({ queryKey: ["shooting-content-dash"], queryFn: () => base44.entities.ShootingContent.list() });
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
            background: 'linear-gradient(145deg, #1a3a8f 0%, #2A69FF 60%, #5b8fff 100%)',
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
          <Link to="/Clients" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Active clients"   value={activeClients}                      icon={Users}  tint="blue"   />
          </Link>
          <Link to="/Admin?s=sales" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Open deals"       value={openDeals}                          icon={Kanban} tint="purple" />
          </Link>
          <Link to="/Admin?s=analytics" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Views this month" value={totalViews30d.toLocaleString("fr-FR")} icon={Eye}    tint="green"  />
          </Link>
          <Link to="/Shootings" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Shootings to organize" value={shootingsToOrganize} icon={Camera} tint="amber" />
          </Link>
        </div>
      </div>

      {/* ── Row 2: Editorial + Upcoming + Today's Tasks ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

        {/* Editorial Calendars */}
        <div
          style={{ ...CARD, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          className="h-auto lg:h-[420px]"
          onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexShrink: 0 }}>
            <span style={LABEL}>Editorial calendars</span>
            <Link to="/Editorial" style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--brand)', textDecoration: 'none' }}>
              View all <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {activeClientsList.length === 0 && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>No active clients</p>}
            {activeClientsList.map((c, i) => (
              <Link
                key={c.id}
                to={`/Editorial?client=${encodeURIComponent(c.company_name)}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 8px', borderBottom: i < activeClientsList.length - 1 ? '1px solid var(--divider)' : 'none', textDecoration: 'none', borderRadius: 12, transition: 'background 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(42,105,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {c.company_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{c.company_name}</p>
                    {c.city && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{c.city}</p>}
                  </div>
                </div>
                <Calendar style={{ width: 14, height: 14, color: 'var(--subtle)' }} />
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Content */}
        <Link to="/Editorial" style={{ textDecoration: 'none', display: 'block' }} className="h-auto lg:h-[420px]">
        <div
          style={{ ...CARD, display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', height: '100%' }}
          className=""
          onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <span style={{ ...LABEL, flexShrink: 0 }}>Upcoming content</span>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {upcomingContent.length === 0 && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>No scheduled content</p>}
            {upcomingContent.map((c, i) => (
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
        <div className="h-auto lg:h-[420px] md:col-span-2 lg:col-span-1">
          <TodayTasksWidget />
        </div>

      </div>
    </div>
  );
}
