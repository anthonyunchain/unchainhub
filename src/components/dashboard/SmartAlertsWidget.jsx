import { useQuery } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { AlertTriangle, Clock, TrendingUp, CalendarX, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";

export default function SmartAlertsWidget() {
  const [expanded, setExpanded] = useState({});

  const { data: content = [] } = useQuery({ queryKey: ["content-dash"],        queryFn: () => base44.entities.EditorialContent.list() });
  const { data: prospects = [] } = useQuery({ queryKey: ["prospects"],          queryFn: () => base44.entities.Prospect.list() });
  const { data: clients = [] }   = useQuery({ queryKey: ["clients"],            queryFn: () => base44.entities.Client.list() });
  const { data: shootingLinks = [] } = useQuery({ queryKey: ["shooting-content-dash"], queryFn: () => base44.entities.ShootingContent.list() });
  const { data: payments = [] } = useQuery({
    queryKey: ["freelancer-payments-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancer_payments").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const now        = new Date();
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd    = endOfWeek(now, { weekStartsOn: 1 });
  const month      = format(now, "yyyy-MM");
  const ago30      = subDays(now, 30);
  const ago60      = subDays(now, 60);

  const linkedIds  = new Set(shootingLinks.map(s => s.content_id));

  // ── Alert 1: content this week without shooting ──────────────────────────
  const noShooting = content.filter(c => {
    if (!c.scheduled_date) return false;
    const d = new Date(c.scheduled_date);
    if (d < weekStart || d > weekEnd) return false;
    if (c.status === "Publié") return false;
    if (c.needs_shooting === false) return false;
    return !linkedIds.has(c.id);
  });

  // ── Alert 2: freelancer invoices pending > 30 days ───────────────────────
  const overdueInvoices = payments.filter(p =>
    p.status === "Pending" && p.date && new Date(p.date) < ago30
  );

  // ── Alert 3: deals without activity > 60 days ────────────────────────────
  const staleDeals = prospects.filter(p => {
    if (["Signé", "Perdu"].includes(p.stage)) return false;
    const ref = p.updated_at || p.created_at;
    return ref && new Date(ref) < ago60;
  });

  // ── Alert 4: active clients with no content this month ───────────────────
  const activeClients    = clients.filter(c => c.status === "Actif");
  const clientsWithContent = new Set(
    content.filter(c => c.scheduled_date?.startsWith(month)).map(c => c.client_name)
  );
  const noContent = activeClients.filter(c => !clientsWithContent.has(c.company_name));

  const alerts = [
    noShooting.length > 0 && {
      id: "shooting",
      level: "warning",
      Icon: CalendarX,
      label: "Content this week without shooting",
      count: noShooting.length,
      items: noShooting.map(c => `${c.title || c.post_type || "Untitled"} — ${c.client_name || ""}`),
    },
    overdueInvoices.length > 0 && {
      id: "invoices",
      level: "error",
      Icon: Clock,
      label: "Freelancer invoices pending +30 days",
      count: overdueInvoices.length,
      items: overdueInvoices.map(i => `${i.freelancer_name || "?"} — ${i.mission || "invoice"} (€${parseFloat(i.amount || 0).toLocaleString("fr-FR")})`),
    },
    staleDeals.length > 0 && {
      id: "deals",
      level: "warning",
      Icon: TrendingUp,
      label: "Deals with no activity for 60+ days",
      count: staleDeals.length,
      items: staleDeals.map(p => p.company_name || p.contact_name || "Unknown"),
    },
    noContent.length > 0 && {
      id: "content",
      level: "info",
      Icon: AlertTriangle,
      label: "Active clients with no content this month",
      count: noContent.length,
      items: noContent.map(c => c.company_name),
    },
  ].filter(Boolean);

  if (alerts.length === 0) return null;

  const COLORS = {
    error:   { bg: "rgba(239,68,68,0.07)",  border: "#ef444428", dot: "#ef4444", text: "#b91c1c" },
    warning: { bg: "rgba(245,158,11,0.07)", border: "#f59e0b28", dot: "#f59e0b", text: "#92400e" },
    info:    { bg: "rgba(42,105,255,0.07)", border: "#2A69FF28", dot: "var(--brand)", text: "var(--brand)" },
  };

  const totalCount = alerts.reduce((s, a) => s + a.count, 0);

  return (
    <div style={{
      background: "var(--card)",
      borderRadius: "var(--card-radius)",
      boxShadow: "var(--card-shadow)",
      padding: "14px 16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: "10px", fontWeight: 500,
          color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em",
        }}>
          Alerts
        </span>
        <span style={{
          background: "#ef4444", color: "#fff",
          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {totalCount}
        </span>
      </div>

      {/* Alert rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {alerts.map(({ id, level, Icon, label, count, items }) => {
          const c = COLORS[level];
          const isOpen = expanded[id];
          return (
            <div key={id} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${c.border}` }}>
              <button
                onClick={() => setExpanded(p => ({ ...p, [id]: !p[id] }))}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px", background: c.bg, border: "none", cursor: "pointer",
                }}
              >
                <Icon style={{ width: 13, height: 13, color: c.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "var(--ink)", textAlign: "left" }}>
                  {label}
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: c.text, minWidth: 18 }}>
                  {count}
                </span>
                {isOpen
                  ? <ChevronDown style={{ width: 11, height: 11, color: "var(--muted)", flexShrink: 0 }} />
                  : <ChevronRight style={{ width: 11, height: 11, color: "var(--muted)", flexShrink: 0 }} />
                }
              </button>
              {isOpen && (
                <div style={{ padding: "4px 10px 8px 31px", background: c.bg }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "2px 0" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: c.dot, flexShrink: 0, marginTop: 4 }} />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
