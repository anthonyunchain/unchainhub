import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import StatusBadge from "../components/shared/StatusBadge";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, FileText, Receipt,
  Pencil, Upload, X, ExternalLink, Briefcase, Trash2, UserPlus,
  ChevronLeft, ChevronRight, RefreshCw, Copy, KeyRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addDays,
  getDay, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";

/* ─── Constants ───────────────────────────────────────────────────────────── */
const ALL_SERVICES = [
  "Community Management", "Content Creation", "Photography", "Video",
  "Digital Strategy", "Meta Ads", "Influencers", "Email Marketing",
  "SEO", "Website", "Branding", "Consulting",
];

const TYPE_COLORS = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "reports",   label: "Reports"   },
  { id: "invoices",  label: "Invoices"  },
  { id: "contract",  label: "Contract"  },
];

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function ServicesEditor({ value = [], onChange }) {
  const [custom, setCustom] = useState("");
  const toggle = (s) => {
    if (value.includes(s)) onChange(value.filter(x => x !== s));
    else onChange([...value, s]);
  };
  const addCustom = () => {
    if (custom.trim() && !value.includes(custom.trim())) {
      onChange([...value, custom.trim()]);
      setCustom("");
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {ALL_SERVICES.map(s => (
          <button
            key={s} type="button" onClick={() => toggle(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              value.includes(s)
                ? "bg-[#2A69FF] text-white border-[#2A69FF]"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >{s}</button>
        ))}
      </div>
      {value.filter(s => !ALL_SERVICES.includes(s)).map(s => (
        <span key={s} className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#2A69FF] text-white border border-[#2A69FF] mr-1 mb-1">
          {s}
          <button onClick={() => toggle(s)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <div className="flex gap-2 mt-2">
        <Input
          value={custom} onChange={e => setCustom(e.target.value)}
          placeholder="Custom service…" className="h-8 text-xs"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom} className="h-8 text-xs">Add</Button>
      </div>
    </div>
  );
}

/* ─── Editorial Calendar (client-scoped) ──────────────────────────────────── */
function EditorialCalendar({ content }) {
  const [calDate, setCalDate] = useState(new Date());

  const monthStart = startOfMonth(calDate);
  const monthEnd   = endOfMonth(calDate);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const allDays    = eachDayOfInterval({ start: calStart, end: addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), 6) }).slice(0, 49);
  const noWeekend  = allDays.filter(d => getDay(d) !== 0 && getDay(d) !== 6);
  const weeks      = [];
  for (let i = 0; i < noWeekend.length; i += 5) weeks.push(noWeekend.slice(i, i + 5));
  const visibleDays = weeks.filter(wk => wk.some(d => isSameMonth(d, calDate))).flat();

  const getDay_ = (day) =>
    content.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          {format(calDate, "MMMM yyyy", { locale: enUS })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCalDate(d => subMonths(d, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          ><ChevronLeft className="w-4 h-4" /></button>
          <button
            onClick={() => setCalDate(new Date())}
            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >Today</button>
          <button
            onClick={() => setCalDate(d => addMonths(d, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-5 border-b border-slate-100 bg-slate-50/60">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-5 bg-white">
          {visibleDays.map((day, i) => {
            const dayContent = getDay_(day);
            const inMonth    = isSameMonth(day, calDate);
            const isToday    = isSameDay(day, new Date());
            return (
              <div
                key={i}
                className={`min-h-[96px] border-b border-r border-slate-100 p-1.5 last:border-r-0 ${!inMonth ? "bg-slate-50/50" : ""}`}
              >
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  isToday ? "bg-[#2A69FF] text-white" : inMonth ? "text-slate-700" : "text-slate-300"
                }`}>
                  {format(day, "d")}
                </span>
                <div className="space-y-0.5">
                  {dayContent.slice(0, 3).map((c, idx) => (
                    <div
                      key={idx}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md truncate font-medium ${
                        TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"
                      }`}
                      title={c.title || c.post_type}
                    >
                      {c.title || c.post_type || "—"}
                    </div>
                  ))}
                  {dayContent.length > 3 && (
                    <p className="text-[9px] text-slate-400 pl-1">+{dayContent.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function ClientDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id        = urlParams.get("id");
  const navigate  = useNavigate();

  const [activeTab,          setActiveTab]          = useState("dashboard");
  const [editOpen,           setEditOpen]           = useState(false);
  const [editData,           setEditData]           = useState(null);
  const [uploadingContract,  setUploadingContract]  = useState(false);
  const [uploadingInvoice,   setUploadingInvoice]   = useState(false);
  const [inviteOpen,         setInviteOpen]         = useState(false);
  const [inviteEmail,        setInviteEmail]        = useState("");
  const [inviting,           setInviting]           = useState(false);
  const [inviteMsg,          setInviteMsg]          = useState("");
  const [invitePassword,     setInvitePassword]     = useState("");
  const qc = useQueryClient();

  const { data: client }     = useQuery({ queryKey: ["client", id], queryFn: () => base44.entities.Client.list().then(arr => arr.find(c => c.id === id)), enabled: !!id });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"],  queryFn: () => base44.entities.Contract.list() });
  const { data: invoices  = [] } = useQuery({ queryKey: ["invoices"],   queryFn: () => base44.entities.Invoice.list() });
  const { data: content   = [] } = useQuery({ queryKey: ["editorial"],  queryFn: () => base44.entities.EditorialContent.list() });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Client.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client", id] }); qc.invalidateQueries({ queryKey: ["clients"] }); setEditOpen(false); },
    onError: (e) => alert("Save error: " + (e?.message || JSON.stringify(e))),
  });

  const deleteMut = useMutation({
    mutationFn: (cid) => base44.entities.Client.delete(cid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); navigate("/Clients"); },
    onError: (e) => alert("Deletion error: " + (e?.message || e)),
  });

  if (!client) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>;

  const clientContracts = contracts.filter(c => c.client_id === id || c.client_name === client.company_name);
  const clientInvoices  = invoices.filter(i => i.client_id === id || i.client_name === client.company_name);
  const clientContent   = content.filter(c => c.client_id === id || c.client_name === client.company_name);
  const totalRevenue    = clientInvoices.filter(i => i.status === "Payée").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const openInvite = () => {
    setInviteEmail(client.contact_email || "");
    setInviteMsg("");
    setInvitePassword(generatePassword());
    setInviteOpen(true);
  };
  const sendInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true); setInviteMsg("");
    try {
      const { data } = await base44.functions.invoke("setClientPassword", {
        email: inviteEmail, company_name: client.company_name, client_id: id, password: invitePassword,
      });
      setInviteMsg(data?.error ? "Error: " + data.error : "✓ Account created. Share the password with the client.");
    } catch (e) { setInviteMsg("Error: " + (e?.message || "Unknown error")); }
    finally { setInviting(false); }
  };

  const openEdit = () => {
    setEditData({ ...client, active_services: client.active_services || [], contract_documents: client.contract_documents || [], invoice_documents: client.invoice_documents || [] });
    setEditOpen(true);
  };

  const handleDelete = () => {
    if (confirm("Delete this client? This action is irreversible.")) deleteMut.mutate(id);
  };

  /* ── Published stats for Reports tab ── */
  const currentMonth      = format(new Date(), "yyyy-MM");
  const thisMonthContent  = clientContent.filter(c => c.scheduled_date?.startsWith(currentMonth));
  const publishedTotal    = clientContent.filter(c => c.status === "Publié").length;
  const publishedMonth    = thisMonthContent.filter(c => c.status === "Publié").length;
  const inProgressMonth   = thisMonthContent.filter(c => c.status === "En cours").length;
  const scheduledMonth    = thisMonthContent.filter(c => c.status === "Planifié").length;

  return (
    <div className="mx-auto" style={{ maxWidth: "1400px" }}>
      {/* Back link */}
      <Link to="/Clients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to clients
      </Link>

      {/* ── Header card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg, #2A69FF22 0%, #2A69FF44 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#2A69FF", fontWeight: 800, fontSize: 20,
              fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0,
            }}>
              {client.company_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
                {client.company_name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                {client.city    && <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="w-3 h-3" />{client.city}</span>}
                {client.sector  && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{client.sector}</span>}
                {client.start_date && <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="w-3 h-3" />Since {format(new Date(client.start_date), "MMM yyyy", { locale: enUS })}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={client.status} />
            {client.status === "Actif" && (
              <Button variant="outline" size="sm" onClick={openInvite} className="h-8 gap-1">
                <UserPlus className="w-3.5 h-3.5 text-blue-500" /> Invite
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openEdit} className="h-8 gap-1">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </div>
        </div>

        {/* Contact row */}
        {(client.contact_name || client.contact_email || client.contact_phone) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
            {client.contact_name  && <div><p className="text-xs text-slate-400 mb-0.5">Contact</p><p className="text-sm font-medium text-slate-700">{client.contact_name}</p></div>}
            {client.contact_email && <div><p className="text-xs text-slate-400 mb-0.5">Email</p><p className="text-sm font-medium text-slate-700 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />{client.contact_email}</p></div>}
            {client.contact_phone && <div><p className="text-xs text-slate-400 mb-0.5">Phone</p><p className="text-sm font-medium text-slate-700 flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{client.contact_phone}</p></div>}
          </div>
        )}

        {/* Services */}
        {client.active_services?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />Active services</p>
            <div className="flex flex-wrap gap-1.5">
              {client.active_services.map((s, i) => (
                <span key={i} className="text-xs px-2.5 py-0.5 bg-[#2A69FF]/10 text-[#2A69FF] rounded-full font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {client.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-1">Notes</p>
            <p className="text-sm text-slate-600">{client.notes}</p>
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-1.5 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "#fff" : "var(--muted)",
              background: activeTab === tab.id ? "#2A69FF" : "transparent",
              padding: "6px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              transition: "all 150ms ease",
              letterSpacing: "0.03em",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}

      {/* DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total revenue</p>
              <p className="text-2xl font-bold text-slate-900">{totalRevenue.toLocaleString("fr-FR")} €</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Contracts</p>
              <p className="text-2xl font-bold text-slate-900">{clientContracts.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Published content</p>
              <p className="text-2xl font-bold text-slate-900">{publishedTotal}</p>
            </div>
          </div>

          {/* Editorial calendar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Editorial Calendar
              </span>
            </div>
            {clientContent.length === 0
              ? <p className="text-sm text-slate-400">No content scheduled for this client.</p>
              : <EditorialCalendar content={clientContent} />
            }
          </div>
        </div>
      )}

      {/* REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "This month",    value: thisMonthContent.length, color: "text-slate-900" },
              { label: "Published",     value: publishedMonth,          color: "text-emerald-600" },
              { label: "In editing",    value: inProgressMonth,         color: "text-blue-600" },
              { label: "Scheduled",     value: scheduledMonth,          color: "text-amber-600" },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Content list */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">All content</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Date</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Title</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Type</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...clientContent].sort((a, b) => new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0)).map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/30">
                    <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {c.scheduled_date ? format(new Date(c.scheduled_date), "d MMM yyyy", { locale: enUS }) : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 max-w-[260px] truncate">{c.title || c.description || "Untitled"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type || "—"}</span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
                {clientContent.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">No content</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INVOICES */}
      {activeTab === "invoices" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Receipt className="w-4 h-4" />Invoices</h3>
            <label className={`cursor-pointer text-xs text-[#2A69FF] hover:underline flex items-center gap-1 ${uploadingInvoice ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload className="w-3 h-3" />{uploadingInvoice ? "Uploading…" : "Attach file"}
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                setUploadingInvoice(true);
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                await updateMut.mutateAsync({ id: client.id, d: { ...client, invoice_documents: [...(client.invoice_documents || []), file_url] } });
                setUploadingInvoice(false); e.target.value = "";
              }} />
            </label>
          </div>
          <div className="divide-y divide-slate-50">
            {clientInvoices.map(i => (
              <div key={i.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/40">
                <div>
                  <p className="text-sm font-medium text-slate-800">{i.invoice_number || "Invoice"}</p>
                  <p className="text-xs text-slate-400">{i.issue_date ? format(new Date(i.issue_date), "d MMM yyyy", { locale: enUS }) : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">{(i.total_with_tax || i.total_amount || 0).toLocaleString("fr-FR")} €</span>
                  <StatusBadge status={i.status} />
                </div>
              </div>
            ))}
            {(client.invoice_documents || []).map((url, i) => {
              const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
              return (
                <div key={`doc-${i}`} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/40">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#2A69FF] truncate max-w-[340px]">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />{name}
                  </a>
                  <button onClick={async () => {
                    const docs = (client.invoice_documents || []).filter((_, idx) => idx !== i);
                    await updateMut.mutateAsync({ id: client.id, d: { ...client, invoice_documents: docs } });
                  }} className="text-slate-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              );
            })}
            {clientInvoices.length === 0 && (client.invoice_documents || []).length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No invoices</p>
            )}
          </div>
        </div>
      )}

      {/* CONTRACT */}
      {activeTab === "contract" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4" />Contracts</h3>
            <label className={`cursor-pointer text-xs text-[#2A69FF] hover:underline flex items-center gap-1 ${uploadingContract ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload className="w-3 h-3" />{uploadingContract ? "Uploading…" : "Attach file"}
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                setUploadingContract(true);
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                await updateMut.mutateAsync({ id: client.id, d: { ...client, contract_documents: [...(client.contract_documents || []), file_url] } });
                setUploadingContract(false); e.target.value = "";
              }} />
            </label>
          </div>
          <div className="divide-y divide-slate-50">
            {clientContracts.map(c => (
              <div key={c.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/40">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.title}</p>
                  <p className="text-xs text-slate-400">{c.monthly_amount ? `${c.monthly_amount} €/month` : ""}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
            {(client.contract_documents || []).map((url, i) => {
              const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
              return (
                <div key={`doc-${i}`} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/40">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#2A69FF] truncate max-w-[340px]">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />{name}
                  </a>
                  <button onClick={async () => {
                    const docs = (client.contract_documents || []).filter((_, idx) => idx !== i);
                    await updateMut.mutateAsync({ id: client.id, d: { ...client, contract_documents: docs } });
                  }} className="text-slate-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              );
            })}
            {clientContracts.length === 0 && (client.contract_documents || []).length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No contracts</p>
            )}
          </div>
        </div>
      )}

      {/* ── Invite Dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteMsg(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" /> Portal access — {client?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-500">
              Create an account with a password directly. Share it with the client via SMS or in person. Works even if the email is already registered.
            </p>
            <div>
              <Label>Email address</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="client@company.com" className="mt-1" />
            </div>
            <div>
              <Label>Password</Label>
              <div className="flex gap-2 mt-1">
                <Input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setInvitePassword(generatePassword())} title="Regenerate">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(invitePassword)} title="Copy">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {inviteMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${inviteMsg.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{inviteMsg}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={sendInvite} disabled={inviting || !inviteEmail || !invitePassword} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                <KeyRound className="w-4 h-4 mr-1.5" />{inviting ? "Creating…" : "Create account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit client</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4 mt-2">
              <div><Label>Company *</Label><Input value={editData.company_name} onChange={e => setEditData({ ...editData, company_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sector</Label>
                  <Select value={editData.sector} onValueChange={v => setEditData({ ...editData, sector: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F&B">F&B</SelectItem>
                      <SelectItem value="Wellness">Wellness</SelectItem>
                      <SelectItem value="Tourism">Tourism</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>City</Label>
                  <Select value={editData.city} onValueChange={v => setEditData({ ...editData, city: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tampere">Tampere</SelectItem>
                      <SelectItem value="Helsinki">Helsinki</SelectItem>
                      <SelectItem value="Lapland">Lapland</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact name</Label><Input value={editData.contact_name || ""} onChange={e => setEditData({ ...editData, contact_name: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={editData.status} onValueChange={v => setEditData({ ...editData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Actif">Active</SelectItem>
                      <SelectItem value="Inactif">Inactive</SelectItem>
                      <SelectItem value="En pause">On hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={editData.contact_email || ""} onChange={e => setEditData({ ...editData, contact_email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editData.contact_phone || ""} onChange={e => setEditData({ ...editData, contact_phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Address</Label><Input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} /></div>
                <div><Label>Start date</Label><Input type="date" value={editData.start_date || ""} onChange={e => setEditData({ ...editData, start_date: e.target.value })} /></div>
              </div>
              <div>
                <Label className="mb-2 block">Active services</Label>
                <ServicesEditor value={editData.active_services || []} onChange={v => setEditData({ ...editData, active_services: v })} />
              </div>
              <div><Label>Notes</Label><Textarea value={editData.notes || ""} onChange={e => setEditData({ ...editData, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={deleteMut.isPending}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button onClick={() => updateMut.mutate({ id: editData.id, d: editData })} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!editData.company_name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
