import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, Kanban, Calendar, ArrowUpRight, FileBarChart, Eye } from "lucide-react";
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
  const greeting = useMemo(() => getGreeting(userName.split(" ")[0] || ""), [userName]);

  useEffect(() => {
    base44.auth.me().then(u => setUserName(u?.full_name || u?.email || "")).catch(() => {});
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
  const totalFollowers = thisMonthStats.reduce((s, r) => s + (r.followers_gained || 0), 0);

  return (
    <div className="mx-auto space-y-4" style={{ maxWidth: '1100px' }}>
      {/* Greeting */}
      <div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
          {greeting}
        </h2>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginTop: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: enUS })}
        </p>
      </div>

      <div className="space-y-3">

      {/* ── Row 1: Hero + 4 KPIs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-1">

        {/* Hero Content Overview */}
        <Link to="/Reports" style={{ textDecoration: 'none' }}>
          <div style={{
            ...CARD,
            background: 'linear-gradient(145deg, #1a3a8f 0%, #2A69FF 60%, #5b8fff 100%)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            height: '100%', minHeight: 220,
          }}>
            <div>
              <span style={{ ...LABEL, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>This Month</span>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '52px', fontWeight: 800, color: '#fff', letterSpacing: '-3px', lineHeight: 1.05 }}>
                {totalContent}
              </p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.60)', marginTop: 6 }}>
                total posts planned
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {[
                { label: 'Shot', value: shot },
                { label: 'In Editing', value: inProgress },
                { label: 'Scheduled', value: scheduled },
                { label: 'Published', value: published },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px' }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: 700, color: '#fff' }}>{s.value}</p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileBarChart style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.55)' }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.55)' }}>View full reports →</span>
            </div>
          </div>
        </Link>

        {/* 2×2 KPI grid — equal row heights */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3" style={{ gridTemplateRows: '1fr 1fr' }}>
          <KpiCard title="Active clients" value={activeClients} icon={Users} tint="blue" />
          <KpiCard title="Open deals" value={openDeals} icon={Kanban} tint="purple" />
          <Link to="/Reports" style={{ textDecoration: 'none', display: 'block' }}>
            <KpiCard title="Views this month" value={totalViews30d.toLocaleString("fr-FR")} icon={Eye} tint="green" />
          </Link>
          <KpiCard title="Followers gained" value={`+${totalFollowers}`} icon={Users} tint="amber" />
        </div>
      </div>

      {/* ── Row 2: Editorial + Upcoming + Today's Tasks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-1" style={{ alignItems: 'stretch' }}>

        {/* Editorial Calendars */}
        <div
          style={{ ...CARD, display: 'flex', flexDirection: 'column', height: 'clamp(320px, 50vw, 420px)', overflow: 'hidden' }}
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
        <div
          style={{ ...CARD, display: 'flex', flexDirection: 'column', height: 'clamp(320px, 50vw, 420px)', overflow: 'hidden' }}
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

        {/* Today's Tasks */}
        <div style={{ height: 'clamp(320px, 50vw, 420px)' }}>
          <TodayTasksWidget />
        </div>

      </div>
      </div>
    </div>
  );
}