import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { useConfirm } from "@/lib/confirm";
import StatusBadge from "../components/shared/StatusBadge";
import ClientMenusTab from "../components/shared/ClientMenusTab";
import ClientMusicTab from "../components/shared/ClientMusicTab";
import ClientCredentialsTab from "../components/shared/ClientCredentialsTab";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, FileText, Receipt,
  Pencil, Upload, X, ExternalLink, Briefcase, Trash2, UserPlus,
  ChevronLeft, ChevronRight, RefreshCw, Copy, KeyRound, Plus, Paperclip,
  ChefHat,
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
  isSameMonth, isSameDay, addMonths, subMonths, startOfWeek,
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
  { id: "calendars", label: "Calendars" },
  { id: "menus",     label: "Menus"     },
  { id: "music",     label: "Music"     },
  { id: "credentials", label: "Passwords" },
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
  const weeks      = [];
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));
  const visibleDays = weeks.filter(wk => wk.some(d => isSameMonth(d, calDate))).flat();

  const getDay_ = (day) =>
    content.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      <div className="rounded-2xl border border-slate-100 overflow-x-auto">
        <div className="min-w-[700px]">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 bg-white">
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
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function ClientDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id        = urlParams.get("id");
  const navigate  = useNavigate();
  const confirm   = useConfirm();

  const [activeTab,          setActiveTab]          = useState("dashboard");
  const [editOpen,           setEditOpen]           = useState(false);
  const [editData,           setEditData]           = useState(null);
  const [uploadingContract,  setUploadingContract]  = useState(false);
  const [uploadingInvoice,   setUploadingInvoice]   = useState(false);
  const [uploadingCalPdf,    setUploadingCalPdf]    = useState(false);
  const [calPdfMonth,        setCalPdfMonth]        = useState(format(new Date(), "yyyy-MM"));
  const [inviteOpen,         setInviteOpen]         = useState(false);
  const [inviteEmail,        setInviteEmail]        = useState("");
  const [inviting,           setInviting]           = useState(false);
  const [inviteMsg,          setInviteMsg]          = useState("");
  const [invitePassword,     setInvitePassword]     = useState("");
  const [inviteRole,         setInviteRole]         = useState("client"); // 'client' | 'staff'
  const [invoiceOpen,        setInvoiceOpen]        = useState(false);
  const [invoiceData,        setInvoiceData]        = useState(null);
  const [invoiceMutError,    setInvoiceMutError]    = useState(null);
  const [confirmDelete,      setConfirmDelete]      = useState(false);
  const qc = useQueryClient();

  const { data: client }     = useQuery({ queryKey: ["client", id], queryFn: () => base44.entities.Client.list().then(arr => arr.find(c => c.id === id)), enabled: !!id });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"],  queryFn: () => base44.entities.Contract.list() });
  const { data: invoices  = [] } = useQuery({ queryKey: ["invoices"],   queryFn: () => base44.entities.Invoice.list() });
  const { data: content   = [] } = useQuery({ queryKey: ["editorial"],  queryFn: () => base44.entities.EditorialContent.list() });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Client.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client", id] }); qc.invalidateQueries({ queryKey: ["clients"] }); setEditOpen(false); },
    onError: (e) => toast.error("Save error: " + (e?.message || JSON.stringify(e))),
  });

  const deleteMut = useMutation({
    mutationFn: async (cid) => {
      const { data } = await base44.functions.invoke('deleteClient', { clientId: cid });
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); navigate("/Clients"); },
    onError: (e) => toast.error("Deletion error: " + (e?.message || e)),
  });

  const calcInvoice = (d) => {
    const ht = parseFloat(d.total_amount) || 0;
    const tax_rate = parseFloat(d.tax_rate) || 0;
    const tax_amount = ht * (tax_rate / 100);
    return { ...d, tax_amount, total_with_tax: ht + tax_amount };
  };

  const createInvoiceMut = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase.from("invoices").insert(d);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); setInvoiceOpen(false); setInvoiceMutError(null); },
    onError: (e) => setInvoiceMutError(e.message),
  });

  const updateInvoiceMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { error } = await supabase.from("invoices").update(d).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); setInvoiceOpen(false); setInvoiceMutError(null); },
    onError: (e) => setInvoiceMutError(e.message),
  });

  const openNewInvoice = () => {
    const num = `INV-${String((invoices?.length || 0) + 1).padStart(4, "0")}`;
    setInvoiceData(calcInvoice({
      invoice_number: num,
      client_id: id,
      client_name: client.company_name,
      total_amount: 0,
      tax_rate: 25.5,
      tax_amount: 0,
      total_with_tax: 0,
      status: "Payée",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: "",
      notes: "",
      file_urls: [],
    }));
    setInvoiceMutError(null);
    setInvoiceOpen(true);
  };

  const openEditInvoice = (inv) => {
    setInvoiceData({ ...inv, file_urls: inv.file_urls || [] });
    setInvoiceMutError(null);
    setInvoiceOpen(true);
  };

  const handleSaveInvoice = () => {
    const final = calcInvoice(invoiceData);
    if (final.id) updateInvoiceMut.mutate({ id: final.id, d: final });
    else createInvoiceMut.mutate(final);
  };

  if (!client) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>;

  const clientContracts = contracts.filter(c => c.client_id === id || c.client_name === client.company_name);
  const clientInvoices  = invoices.filter(i => i.client_id === id || i.client_name === client.company_name);
  const clientContent   = content.filter(c => c.client_id === id || c.client_name === client.company_name);
  const totalRevenue    = clientInvoices.filter(i => i.status === "Payée").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const openInvite = (role = "client") => {
    setInviteRole(role);
    setInviteEmail(role === "staff" ? "" : (client.contact_email || ""));
    setInviteMsg("");
    setInvitePassword(generatePassword());
    setInviteOpen(true);
  };
  const sendInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true); setInviteMsg("");
    try {
      const fn = inviteRole === "staff" ? "setStaffPassword" : "setClientPassword";
      const { data } = await base44.functions.invoke(fn, {
        email: inviteEmail, company_name: client.company_name, client_id: id, password: invitePassword,
      });
      if (data?.error) {
        setInviteMsg("Error: " + data.error);
      } else {
        setInviteMsg(inviteRole === "staff"
          ? "✓ Account created. Share the password with the staff member."
          : "✓ Account created. Share the password with the client.");
      }
    } catch (e) { setInviteMsg("Error: " + (e?.message || "Unknown error")); }
    finally { setInviting(false); }
  };

  const openEdit = () => {
    setEditData({ ...client, active_services: client.active_services || [], contract_documents: client.contract_documents || [], invoice_documents: client.invoice_documents || [] });
    setEditOpen(true);
  };

  const handleDelete = () => deleteMut.mutate(id);

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
        <div className="flex flex-wrap items-start justify-between gap-3">
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
              <>
                <Button variant="outline" size="sm" onClick={() => openInvite("client")} className="h-8 gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-blue-500" /> Invite
                </Button>
                <Button variant="outline" size="sm" onClick={() => openInvite("staff")} className="h-8 gap-1">
                  <ChefHat className="w-3.5 h-3.5 text-amber-600" /> Staff
                </Button>
              </>
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
      <div className="flex items-center gap-1 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-1.5 overflow-x-auto">
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
              whiteSpace: "nowrap",
              flexShrink: 0,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="flex items-center gap-3">
              <label className={`cursor-pointer text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 ${uploadingInvoice ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-3 h-3" />{uploadingInvoice ? "Uploading…" : "Attach PDF"}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingInvoice(true);
                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                  await updateMut.mutateAsync({ id: client.id, d: { ...client, invoice_documents: [...(client.invoice_documents || []), file_url] } });
                  setUploadingInvoice(false); e.target.value = "";
                }} />
              </label>
              <button onClick={openNewInvoice} className="text-xs text-[#2A69FF] hover:underline flex items-center gap-1 font-medium">
                <Plus className="w-3 h-3" /> New invoice
              </button>
            </div>
          </div>

          {/* Summary row */}
          {clientInvoices.length > 0 && (
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/30">
              {[
                { label: "Paid", val: clientInvoices.filter(i => i.status === "Payée").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0), color: "text-emerald-600" },
                { label: "Pending", val: clientInvoices.filter(i => i.status === "Envoyée").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0), color: "text-blue-600" },
                { label: "Overdue", val: clientInvoices.filter(i => i.status === "En retard").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0), color: "text-red-500" },
              ].map(({ label, val, color }) => (
                <div key={label} className="px-5 py-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className={`text-sm font-bold ${color} mt-0.5`}>{val.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {clientInvoices.map(i => (
              <div key={i.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/40 cursor-pointer" onClick={() => openEditInvoice(i)}>
                <div>
                  <p className="text-sm font-medium text-slate-800">{i.invoice_number || "Invoice"}</p>
                  <p className="text-xs text-slate-400">{i.description || ""}{i.issue_date ? ` · ${format(new Date(i.issue_date), "d MMM yyyy", { locale: enUS })}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{(i.total_with_tax || i.total_amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
                    {i.total_amount > 0 && i.total_with_tax !== i.total_amount && (
                      <p className="text-[10px] text-slate-400">excl. tax: {(i.total_amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
                    )}
                  </div>
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
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-400 mb-3">No invoices yet</p>
                <button onClick={openNewInvoice} className="text-sm text-[#2A69FF] hover:underline font-medium">+ Create first invoice</button>
              </div>
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

      {/* CALENDARS */}
      {activeTab === "calendars" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Monthly Calendar PDFs</span>
            </div>
            {/* Upload row */}
            <div className="flex items-center gap-2 mb-3">
              <select
                value={calPdfMonth}
                onChange={e => setCalPdfMonth(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none flex-1"
              >
                {(() => {
                  const now = new Date(); now.setDate(1);
                  const start = client.start_date ? new Date(client.start_date) : new Date(now.getFullYear() - 1, now.getMonth(), 1);
                  start.setDate(1);
                  const months = [];
                  const cur = new Date(now);
                  while (cur >= start) {
                    const val = format(cur, "yyyy-MM");
                    months.push(<option key={val} value={val}>{format(cur, "MMMM yyyy", { locale: enUS })}</option>);
                    cur.setMonth(cur.getMonth() - 1);
                  }
                  return months;
                })()}
              </select>
              <label className={`cursor-pointer text-xs text-white bg-[#2A69FF] hover:opacity-90 px-3 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap ${uploadingCalPdf ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-3 h-3" />{uploadingCalPdf ? "Uploading…" : "Upload PDF"}
                <input type="file" className="hidden" accept=".pdf" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingCalPdf(true);
                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                  const existing = Array.isArray(client.editorial_calendar_pdfs) ? client.editorial_calendar_pdfs : [];
                  const filtered = existing.filter(p => p.month !== calPdfMonth);
                  const updated = [{ month: calPdfMonth, url: file_url }, ...filtered].sort((a, b) => b.month.localeCompare(a.month));
                  await updateMut.mutateAsync({ id: client.id, d: { ...client, editorial_calendar_pdfs: updated } });
                  setUploadingCalPdf(false); e.target.value = "";
                }} />
              </label>
            </div>
            {/* List */}
            {(client.editorial_calendar_pdfs || []).length > 0 ? (
              <div className="space-y-1.5">
                {(client.editorial_calendar_pdfs || []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-slate-500 shrink-0">{format(new Date(p.month + "-01"), "MMM yyyy", { locale: enUS })}</span>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[#2A69FF] hover:underline truncate">
                        <ExternalLink className="w-3 h-3 shrink-0" />Download
                      </a>
                    </div>
                    <button onClick={async () => {
                      const updated = (client.editorial_calendar_pdfs || []).filter((_, idx) => idx !== i);
                      await updateMut.mutateAsync({ id: client.id, d: { ...client, editorial_calendar_pdfs: updated } });
                    }} className="text-slate-300 hover:text-red-400 ml-2 shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No PDFs yet — upload one per month.</p>
            )}
          </div>
        </div>
      )}

      {/* MENUS — staff submissions */}
      {activeTab === "menus" && (
        <ClientMenusTab clientId={client.id} staffLinked={!!client.staff_user_id} />
      )}

      {/* MUSIC — curated library per client (for video editors) */}
      {activeTab === "music" && (
        <ClientMusicTab clientId={client.id} clientName={client.company_name} canEdit />
      )}

      {/* CREDENTIALS — per-client third-party login vault */}
      {activeTab === "credentials" && (
        <ClientCredentialsTab clientId={client.id} clientName={client.company_name} canEdit />
      )}

      {/* ── Invite Dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteMsg(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {inviteRole === "staff"
                ? <ChefHat className="w-5 h-5 text-amber-600" />
                : <UserPlus className="w-5 h-5 text-blue-500" />}
              {inviteRole === "staff" ? "Staff access" : "Portal access"} — {client?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-500">
              {inviteRole === "staff"
                ? "Create a staff account so the restaurant team can send you menus directly. Staff only see their own submissions — never the calendar, stats or invoices."
                : "Create an account with a password directly. Share it with the client via SMS or in person. Works even if the email is already registered."}
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
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setConfirmDelete(false); }}>
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
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Portal language</Label>
                  <Select value={editData.default_language || "en"} onValueChange={v => setEditData({ ...editData, default_language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fi">Finnish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="editorial_visible_detail"
                  checked={editData.editorial_visible || false}
                  onChange={e => setEditData({ ...editData, editorial_visible: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <div>
                  <label htmlFor="editorial_visible_detail" className="text-sm font-medium text-slate-700 cursor-pointer">Editorial calendar visible to freelancers</label>
                  <p className="text-xs text-slate-400 mt-0.5">Freelancers will see this client's calendar (read-only) and can write descriptions.</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600 font-medium">Delete this client?</span>
                    <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleteMut.isPending}>
                      {deleteMut.isPending ? "Deleting…" : "Confirm"}
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button onClick={() => updateMut.mutate({ id: editData.id, d: editData })} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!editData.company_name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Invoice dialog ──────────────────────────────── */}
      <Dialog open={invoiceOpen} onOpenChange={(o) => { setInvoiceOpen(o); if (!o) setInvoiceMutError(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{invoiceData?.id ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          {invoiceData && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Invoice No.</Label><Input value={invoiceData.invoice_number || ""} onChange={e => setInvoiceData({ ...invoiceData, invoice_number: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={invoiceData.status} onValueChange={v => setInvoiceData({ ...invoiceData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Payée">Paid</SelectItem>
                      <SelectItem value="Envoyée">Sent</SelectItem>
                      <SelectItem value="En retard">Overdue</SelectItem>
                      <SelectItem value="Brouillon">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Issue date</Label><Input type="date" value={invoiceData.issue_date || ""} onChange={e => setInvoiceData({ ...invoiceData, issue_date: e.target.value })} /></div>
                <div><Label>Due date</Label><Input type="date" value={invoiceData.due_date || ""} onChange={e => setInvoiceData({ ...invoiceData, due_date: e.target.value })} /></div>
              </div>

              {/* Amounts */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label className="shrink-0">Amount excl. tax (€)</Label>
                  <Input type="number" className="w-36 text-right" value={invoiceData.total_amount || ""} placeholder="0.00"
                    onChange={e => setInvoiceData(calcInvoice({ ...invoiceData, total_amount: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label className="shrink-0">VAT (%)</Label>
                  <Input type="number" className="w-36 text-right" value={invoiceData.tax_rate ?? 25.5} placeholder="25.5"
                    onChange={e => setInvoiceData(calcInvoice({ ...invoiceData, tax_rate: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>VAT amount</span>
                  <span>{(invoiceData.tax_amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-800 border-t border-slate-200 pt-2">
                  <span>Total incl. tax</span>
                  <span className="text-lg">{(invoiceData.total_with_tax || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                </div>
              </div>

              {/* PDF attachments */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5"><Paperclip className="w-3.5 h-3.5" />PDF</Label>
                <div className="space-y-1.5">
                  {(invoiceData.file_urls || []).map((url, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                      <FileText className="w-4 h-4 text-brand shrink-0" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex-1 truncate">
                        {decodeURIComponent(url.split("/").pop().split("?")[0])}
                      </a>
                      <button onClick={() => setInvoiceData(d => ({ ...d, file_urls: (d.file_urls || []).filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(invoiceData.file_urls || []).length < 3 && (
                    <label className="cursor-pointer flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand border border-dashed border-slate-200 rounded-lg px-4 py-2.5 w-full justify-center hover:border-brand/40 transition-colors">
                      <Upload className="w-4 h-4" /> Attach PDF
                      <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setInvoiceData(d => ({ ...d, file_urls: [...(d.file_urls || []), file_url] }));
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>
              </div>

              <div><Label>Notes</Label>
                <Textarea value={invoiceData.notes || ""} onChange={e => setInvoiceData({ ...invoiceData, notes: e.target.value })} rows={2} placeholder="Payment terms, bank details…" />
              </div>

              {invoiceMutError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{invoiceMutError}</p>}

              <div className="flex justify-between items-center pt-2">
                {invoiceData.id
                  ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={async () => {
                      const ok = await confirm({ title: "Delete this invoice?", description: "This action cannot be undone.", confirmLabel: "Delete", destructive: true });
                      if (!ok) return;
                      await supabase.from("invoices").delete().eq("id", invoiceData.id);
                      qc.invalidateQueries({ queryKey: ["invoices"] });
                      setInvoiceOpen(false);
                      toast.success("Invoice deleted");
                    }}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                  : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveInvoice} className="bg-brand hover:bg-brand/90 text-brand-foreground"
                    disabled={createInvoiceMut.isPending || updateInvoiceMut.isPending}>
                    {createInvoiceMut.isPending || updateInvoiceMut.isPending ? "Saving…" : "Save invoice"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
