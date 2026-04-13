import { useState, useEffect, useMemo } from "react";
import { base44, supabase } from "@/api/base44Client";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { getGreeting } from "@/lib/greeting";
import { useTheme } from "@/lib/useTheme";
import {
  LayoutDashboard, Calendar, BarChart2, FileText, LogOut,
  Settings, ChevronLeft, ChevronRight, Eye, Users, TrendingUp,
  Bell, Moon, Sun, ExternalLink, Instagram, Youtube, Facebook,
  Linkedin, Globe, Download, Receipt
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── helpers ────────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
  Post:     "bg-blue-100 text-blue-700",
};

const STATUS_DOT = {
  "Publié":   "bg-emerald-500",
  "Planifié": "bg-blue-400",
  "En cours": "bg-amber-400",
  default:    "bg-slate-300",
};

const PLATFORM_ICON = {
  Instagram: <Instagram className="w-3 h-3" />,
  TikTok:    <Youtube className="w-3 h-3" />,
  Facebook:  <Facebook className="w-3 h-3" />,
  LinkedIn:  <Linkedin className="w-3 h-3" />,
};

function KpiCard({ label, value, icon: Icon, color = "#2A69FF" }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + "18" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{value ?? "—"}</p>
    </div>
  );
}

// ── Dashboard tab ──────────────────────────────────────────────────────────
function DashboardTab({ client, stats, content, contracts, invoices, calendarPdfs }) {
  const [calCurrentDate, setCalCurrentDate] = useState(new Date());
  const currentMonth = format(new Date(), "yyyy-MM");
  const monthStats = stats.filter(s => s.period === currentMonth);
  const totalViews = monthStats.reduce((s, r) => s + (r.views || 0), 0);
  const totalFollowers = monthStats.reduce((s, r) => s + (r.followers_gained || 0), 0);
  const monthContent = content.filter(c => c.scheduled_date?.startsWith(currentMonth));
  const published = monthContent.filter(c => c.status === "Publié").length;

  // Chart: last 6 months
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const period = format(d, "yyyy-MM");
    const s = stats.filter(x => x.period === period);
    chartData.push({
      month: format(d, "MMM", { locale: enUS }),
      views: s.reduce((a, x) => a + (x.views || 0), 0),
      followers: s.reduce((a, x) => a + (x.followers_gained || 0), 0),
    });
  }

  // Recent unpaid invoices
  const unpaidInvoices = invoices.filter(i => i.status !== "Payée").slice(0, 3);
  // Active contract
  const activeContract = contracts.find(c => c.status === "Actif" || c.status === "Signé");

  return (
    <div className="space-y-4">
      {/* KPIs + Calendar shortcut — same grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Views this month" value={totalViews.toLocaleString()} icon={Eye} color="#2A69FF" />
        <KpiCard label="Posts published" value={published} icon={TrendingUp} color="#10B981" />
        {(() => {
          const calMonthKey = format(calCurrentDate, "yyyy-MM");
          const monthPdf = Array.isArray(calendarPdfs) ? calendarPdfs.find(p => p.month === calMonthKey) : null;
          const monthLabel = format(calCurrentDate, "MMMM yyyy", { locale: enUS });
          return monthPdf ? (
            <a
              href={monthPdf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 lg:col-span-1 rounded-2xl p-5 flex flex-col gap-2 transition-all hover:opacity-90"
              style={{ background: '#2A69FF', textDecoration: 'none', boxShadow: '0 4px 24px rgba(42,105,255,0.25)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-white/70 uppercase tracking-wider">Editorial Calendar PDF</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <Download className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight">{monthLabel}</p>
            </a>
          ) : (
            <div
              className="col-span-2 lg:col-span-1 rounded-2xl p-5 flex flex-col gap-2"
              style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Editorial Calendar PDF</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-300 tracking-tight">—</p>
            </div>
          );
        })()}
      </div>

      {/* Chart */}
      {chartData.some(d => d.views > 0) && (
        <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4">Views — last 6 months</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A9BAD' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8A9BAD' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Bar dataKey="views" fill="#2A69FF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pending invoices */}
      {unpaidInvoices.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">Pending invoices</p>
          <div className="space-y-2">
            {unpaidInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{inv.invoice_number || "Invoice"}</p>
                  {inv.due_date && <p className="text-[10px] text-slate-400">Due {format(new Date(inv.due_date), "d MMM yyyy", { locale: enUS })}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{(inv.total_with_tax || inv.total_amount || 0).toLocaleString("fr-FR")} €</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editorial calendar */}
      <CalendarTab content={content} calendarPdfs={calendarPdfs} currentDate={calCurrentDate} setCurrentDate={setCalCurrentDate} />

    </div>
  );
}

// ── Calendar tab ───────────────────────────────────────────────────────────
function CalendarTab({ content, calendarPdfs = [], currentDate: externalDate, setCurrentDate: externalSetDate }) {
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = externalDate ?? internalDate;
  const setCurrentDate = externalSetDate ?? setInternalDate;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;

  const contentByDay = {};
  content.forEach(c => {
    if (!c.scheduled_date) return;
    const key = c.scheduled_date.split("T")[0];
    if (!contentByDay[key]) contentByDay[key] = [];
    contentByDay[key].push(c);
  });

  const monthContent = content.filter(c =>
    c.scheduled_date && c.scheduled_date.startsWith(format(currentDate, "yyyy-MM"))
  );

  const currentMonthKey = format(currentDate, "yyyy-MM");
  const monthPdf = Array.isArray(calendarPdfs) ? calendarPdfs.find(p => p.month === currentMonthKey) : null;

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 capitalize">
          {format(currentDate, "MMMM yyyy", { locale: enUS })}
        </h2>
        <div className="flex items-center gap-2">
          {monthPdf && (
            <a href={monthPdf.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#2A69FF' }}>
              <Download className="w-3 h-3" /> PDF
            </a>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(d => subMonths(d, 1))} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={() => setCurrentDate(d => addMonths(d, 1))} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 flex-wrap">
        {["Reel", "Story", "Carousel", "Post"].map(t => {
          const count = monthContent.filter(c => c.post_type === t).length;
          if (!count) return null;
          return (
            <div key={t} className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${TYPE_COLOR[t] || "bg-slate-100 text-slate-500"}`}>
              {count} {t}{count > 1 ? "s" : ""}
            </div>
          );
        })}
        <div className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500">
          {monthContent.length} total
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} className="text-center text-[10px] font-mono text-slate-400 py-2 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {Array(startPad).fill(null).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[110px] border-b border-r border-slate-50 p-1 bg-slate-50/50" />
          ))}
          {days.map(day => {
            const key = format(day, "yyyy-MM-dd");
            const items = contentByDay[key] || [];
            const isToday = isSameDay(day, new Date());
            return (
              <div key={key} className={`min-h-[110px] border-b border-r border-slate-50 p-1.5 ${isToday ? "bg-blue-50/40" : ""}`}>
                <span className={`text-[11px] font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full mb-1 ${
                  isToday ? "bg-[#2A69FF] text-white" : "text-slate-400"
                }`}>{format(day, "d")}</span>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map(c => (
                    <div key={c.id} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate ${TYPE_COLOR[c.post_type] || "bg-slate-100 text-slate-500"}`}>
                      {c.title || c.post_type}
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[9px] text-slate-400 px-1">+{items.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ── Reports tab ────────────────────────────────────────────────────────────
function ReportsTab({ stats, content }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(format(d, "yyyy-MM"));
  }

  const monthStats = stats.filter(s => s.period === selectedMonth);
  const totalViews = monthStats.reduce((s, r) => s + (r.views || 0), 0);
  const totalReach = monthStats.reduce((s, r) => s + (r.reach || 0), 0);
  const totalFollowers = monthStats.reduce((s, r) => s + (r.followers_gained || 0), 0);
  const totalLikes = monthStats.reduce((s, r) => s + (r.likes || 0), 0);

  const chartData = months.map(period => {
    const d = new Date(period + "-01");
    const s = stats.filter(x => x.period === period);
    return {
      month: format(d, "MMM", { locale: enUS }),
      views: s.reduce((a, x) => a + (x.views || 0), 0),
      followers: s.reduce((a, x) => a + (x.followers_gained || 0), 0),
      reach: s.reduce((a, x) => a + (x.reach || 0), 0),
    };
  });

  const monthContent = content.filter(c => c.scheduled_date?.startsWith(selectedMonth));

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Month:</span>
        <div className="flex gap-1 flex-wrap">
          {months.slice(-6).map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`text-[11px] font-mono px-3 py-1.5 rounded-lg transition-colors ${selectedMonth === m ? "bg-[#2A69FF] text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {format(new Date(m + "-01"), "MMM yy", { locale: enUS })}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Views" value={totalViews.toLocaleString()} icon={Eye} color="#2A69FF" />
        <KpiCard label="Reach" value={totalReach.toLocaleString()} icon={Globe} color="#8B5CF6" />
        <KpiCard label="Followers" value={`+${totalFollowers}`} icon={Users} color="#10B981" />
        <KpiCard label="Likes" value={totalLikes.toLocaleString()} icon={TrendingUp} color="#F59E0B" />
      </div>

      {/* Content published */}
      <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Posts this month</p>
        <p className="text-3xl font-extrabold text-slate-800">{monthContent.filter(c => c.status === "Publié").length}</p>
        <p className="text-xs text-slate-400 mt-1">{monthContent.length} planned total</p>
      </div>

      {/* Chart */}
      <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4">Views over 12 months</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8A9BAD' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#8A9BAD' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
            <Bar dataKey="views" fill="#2A69FF" radius={[4, 4, 0, 0]} name="Views" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-platform breakdown */}
      {monthStats.length > 1 && (
        <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">By platform</p>
          <div className="space-y-2">
            {monthStats.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{s.platform || "All"}</span>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{(s.views || 0).toLocaleString()} views</span>
                  <span>+{s.followers_gained || 0} followers</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Contracts tab ──────────────────────────────────────────────────────────
function ContractsTab({ contracts, contractDocuments }) {
  const STATUS_COLOR = {
    "Actif": "bg-emerald-100 text-emerald-700",
    "Signé": "bg-blue-100 text-blue-700",
    "Brouillon": "bg-slate-100 text-slate-500",
    "Terminé": "bg-amber-100 text-amber-700",
    "Résilié": "bg-red-100 text-red-600",
  };

  const STATUS_LABEL = {
    "Actif": "Active", "Signé": "Signed", "Brouillon": "Draft",
    "Terminé": "Completed", "Résilié": "Terminated",
  };

  if (!contracts.length && !contractDocuments.length) return (
    <div className="text-center py-20 text-slate-400">
      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-sm">No contracts found</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {contracts.map(c => (
        <div key={c.id} className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] || "bg-slate-100 text-slate-500"}`}>
                  {STATUS_LABEL[c.status] || c.status}
                </span>
              </div>
              <p className="text-base font-bold text-slate-800">{c.title || "Contract"}</p>
              {c.start_date && (
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(c.start_date), "d MMM yyyy", { locale: enUS })}
                  {c.end_date && ` → ${format(new Date(c.end_date), "d MMM yyyy", { locale: enUS })}`}
                </p>
              )}
              {c.monthly_amount > 0 && (
                <p className="text-sm font-semibold text-slate-700 mt-2">{c.monthly_amount.toLocaleString("fr-FR")} € / month</p>
              )}
              {c.notes && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{c.notes}</p>}
            </div>
          </div>
        </div>
      ))}
      {contractDocuments.map((url, i) => {
        const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
        return (
          <a key={`doc-${i}`} href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl p-5 hover:bg-slate-50 transition-colors"
            style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
            <FileText className="w-5 h-5 text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
          </a>
        );
      })}
    </div>
  );
}

// ── Invoices tab ───────────────────────────────────────────────────────────
function InvoicesTab({ invoices }) {
  const STATUS_COLOR = {
    "Payée": "bg-emerald-100 text-emerald-700",
    "En attente": "bg-amber-100 text-amber-700",
    "En retard": "bg-red-100 text-red-600",
    "Brouillon": "bg-slate-100 text-slate-500",
    "Annulée": "bg-slate-100 text-slate-400",
  };

  const STATUS_LABEL = {
    "Payée": "Paid", "En attente": "Pending",
    "En retard": "Overdue", "Brouillon": "Draft", "Annulée": "Cancelled",
  };

  if (!invoices.length) return (
    <div className="text-center py-20 text-slate-400">
      <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-sm">No invoices found</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {invoices.map(inv => (
        <div key={inv.id} className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #d8dde5', boxShadow: '0 4px 24px rgba(13,27,42,0.12)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[inv.status] || "bg-slate-100 text-slate-500"}`}>
                  {STATUS_LABEL[inv.status] || inv.status}
                </span>
                {inv.invoice_number && (
                  <span className="text-[10px] font-mono text-slate-400">{inv.invoice_number}</span>
                )}
              </div>
              <p className="text-base font-bold text-slate-800">
                {(inv.total_with_tax || inv.total_amount || 0).toLocaleString("fr-FR")} €
              </p>
              {inv.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{inv.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                {inv.issue_date && <span>Issued {format(new Date(inv.issue_date), "d MMM yyyy", { locale: enUS })}</span>}
                {inv.due_date && <span>· Due {format(new Date(inv.due_date), "d MMM yyyy", { locale: enUS })}</span>}
                {inv.paid_date && <span>· Paid {format(new Date(inv.paid_date), "d MMM yyyy", { locale: enUS })}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Admin tab (contracts + invoices) ──────────────────────────────────────
function AdminTab({ contracts, contractDocuments, invoices }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">Contracts</p>
        <ContractsTab contracts={contracts} contractDocuments={contractDocuments} />
      </div>
      <div>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">Invoices</p>
        <InvoicesTab invoices={invoices} />
      </div>
    </div>
  );
}

// ── Settings dialog ────────────────────────────────────────────────────────
function SettingsDialog({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const updateEmail = async () => {
    if (!email) return;
    const { error } = await supabase.auth.updateUser({ email });
    setEmailMsg(error ? error.message : "Confirmation email sent.");
    if (!error) setEmail("");
  };

  const updatePw = async () => {
    if (newPw !== confirmPw) { setPwMsg("Passwords don't match."); return; }
    if (newPw.length < 6) { setPwMsg("Min 6 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwMsg(error ? error.message : "Password updated.");
    if (!error) { setNewPw(""); setConfirmPw(""); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-800">Account settings</h2>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Change email</p>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="new@email.com"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          {emailMsg && <p className={`text-xs px-3 py-2 rounded-lg ${emailMsg.includes("sent") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{emailMsg}</p>}
          <button onClick={updateEmail} disabled={!email} className="w-full bg-[#2A69FF] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">Update email</button>
        </div>
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Change password</p>
          <input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="New password"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          <input value={confirmPw} onChange={e => setConfirmPw(e.target.value)} type="password" placeholder="Confirm password"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          {pwMsg && <p className={`text-xs px-3 py-2 rounded-lg ${pwMsg.includes("updated") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{pwMsg}</p>}
          <button onClick={updatePw} disabled={!newPw || !confirmPw} className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">Update password</button>
        </div>
        <button onClick={onClose} className="w-full text-sm text-slate-400 hover:text-slate-600 py-1">Close</button>
      </div>
    </div>
  );
}

// ── Main portal ────────────────────────────────────────────────────────────
const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "reports",   label: "Reports",   icon: BarChart2 },
  { key: "admin",     label: "Admin",     icon: Settings },
];

export default function ClientPortal() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [clientRecord, setClientRecord] = useState(null);
  const [content, setContent] = useState([]);
  const [stats, setStats] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { dark, toggle } = useTheme();

  const clientName = clientRecord?.company_name || user?.user_metadata?.company_name || user?.email?.split("@")[0] || "";
  const greeting = useMemo(() => getGreeting(clientName.split(" ")[0] || ""), [clientName]);

  useEffect(() => {
    (async () => {
      try {
        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("Not authenticated");
        setUser(authUser);

        // Find client record linked to this user (try portal_user_id first, fall back to email)
        let { data: clientRows } = await supabase
          .from("clients")
          .select("id, company_name, portal_user_id, contact_email, editorial_calendar_pdfs, contract_documents")
          .eq("portal_user_id", authUser.id)
          .limit(1);

        if (!clientRows?.length) {
          const { data: emailRows } = await supabase
            .from("clients")
            .select("id, company_name, portal_user_id, contact_email, editorial_calendar_pdfs, contract_documents")
            .eq("contact_email", authUser.email)
            .limit(1);
          clientRows = emailRows;
        }

        const client = clientRows?.[0] || null;
        setClientRecord(client);

        if (!client?.company_name) {
          // No client record linked — show empty portal
          setLoading(false);
          return;
        }

        const cName = client.company_name;
        const cId = client.id;

        // Fetch all data in parallel, filtered by client_name OR client_id
        const [contentRes, contractsRes, invoicesRes, statsRes] = await Promise.all([
          supabase
            .from("editorial_content")
            .select("id, title, post_type, scheduled_date, status, client_name, client_id")
            .or(`client_name.eq.${cName},client_id.eq.${cId}`)
            .order("scheduled_date", { ascending: false }),
          supabase
            .from("contracts")
            .select("id, title, status, monthly_amount, start_date, end_date, notes, client_name")
            .eq("client_name", cName)
            .order("start_date", { ascending: false }),
          supabase
            .from("invoices")
            .select("id, invoice_number, description, total_amount, total_with_tax, status, issue_date, due_date, paid_date, client_name")
            .eq("client_name", cName)
            .order("issue_date", { ascending: false }),
          supabase
            .from("client_stats")
            .select("id, period, platform, views, reach, likes, comments, shares, followers_gained, notes")
            .eq("client_name", cName)
            .order("period", { ascending: false }),
        ]);

        setContent(contentRes.data || []);
        setContracts(contractsRes.data || []);
        setInvoices(invoicesRes.data || []);
        setStats(statsRes.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <p className="text-slate-700 font-medium mb-2">Unable to load your portal</p>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    </div>
  );

  const initials = clientName?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "CL";

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      {/* Topbar */}
      <div style={{ paddingTop: 'max(28px, env(safe-area-inset-top))', paddingBottom: 20, paddingLeft: 20, paddingRight: 20 }}>
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>U</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.2px' }}>Unchain Studio</span>
          </div>

          {/* Desktop tabs */}
          <div className="hidden md:flex items-center gap-1 p-1" style={{ background: '#ffffff', borderRadius: 'var(--pill-radius)', boxShadow: '0 4px 24px rgba(13,27,42,0.12)', border: '1px solid #d8dde5' }}>
            {TABS.map((t, i) => {
              const isAdmin = t.key === "admin";
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500,
                    padding: isAdmin ? '6px 10px' : '6px 14px',
                    borderRadius: 'var(--pill-radius)',
                    background: activeTab === t.key ? 'var(--brand)' : 'transparent',
                    color: activeTab === t.key ? '#fff' : 'var(--muted)',
                    border: 'none', cursor: 'pointer', transition: 'all 200ms',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <t.icon style={{ width: 12, height: 12 }} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Avatar */}
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{initials}</span>
            </button>
            {menuOpen && (
              <div style={{ position: 'fixed', top: 72, right: 20, background: 'var(--card)', borderRadius: 20, boxShadow: 'var(--card-shadow-hover)', border: '1px solid var(--divider)', zIndex: 9999, minWidth: 200 }}
                onClick={() => setMenuOpen(false)}>
                <div style={{ padding: '12px 0' }}>
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--divider)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{clientName}</p>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '4px 0 0 0', fontFamily: "'DM Mono', monospace" }}>{user?.email}</p>
                  </div>
                  <button onClick={toggle}
                    style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {dark ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}
                      {dark ? "Light mode" : "Dark mode"}
                    </span>
                    <span style={{ width: 32, height: 18, borderRadius: 9, background: dark ? 'var(--brand)' : 'var(--subtle)', position: 'relative', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: dark ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 200ms' }} />
                    </span>
                  </button>
                  <button onClick={() => setSettingsOpen(true)}
                    style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                    <Settings style={{ width: 14, height: 14 }} /> Settings
                  </button>
                  <button onClick={() => base44.auth.logout()}
                    style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#E8421A', borderTop: '1px solid var(--divider)' }}>
                    <LogOut style={{ width: 14, height: 14 }} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-24 md:pb-8 mx-auto" style={{ maxWidth: 1400 }}>
        {/* Greeting — dashboard only */}
        {activeTab === "dashboard" && (
          <div className="mb-5">
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0 }}>
              {greeting}
            </h2>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--muted)', marginTop: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: enUS })}
            </p>
          </div>
        )}

        {/* Page title for other tabs */}
        {activeTab !== "dashboard" && (
          <div className="mb-5">
            {(() => { const t = TABS.find(x => x.key === activeTab); return t ? (
              <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0 }}>
                {t.label}
              </h2>
            ) : null; })()}
          </div>
        )}

        {activeTab === "dashboard" && <DashboardTab client={clientRecord} stats={stats} content={content} contracts={contracts} invoices={invoices} calendarPdfs={clientRecord?.editorial_calendar_pdfs || []} />}
        {activeTab === "reports"   && <ReportsTab stats={stats} content={content} />}
        {activeTab === "admin"     && (
          <div style={{ maxWidth: 640 }}>
            <AdminTab contracts={contracts} contractDocuments={clientRecord?.contract_documents || []} invoices={invoices} />
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe" style={{ background: 'var(--card)', borderTop: '1px solid var(--divider)', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-around px-2 py-2">
          {TABS.map(t => {
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors"
                style={{ background: active ? 'var(--brand-muted)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                <t.icon style={{ width: 20, height: 20, color: active ? 'var(--brand)' : 'var(--subtle)' }} />
                <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 500, color: active ? 'var(--brand)' : 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
