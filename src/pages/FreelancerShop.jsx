import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import KpiCard from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, ShoppingCart, Package, ChevronLeft, ChevronRight,
  Pencil, Trash2, Euro, User, ToggleLeft, ToggleRight, Check, X,
  TrendingUp, Receipt, Users
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, subMonths, addMonths } from "date-fns";
import { enUS } from "date-fns/locale";

const CATEGORIES = ["Video Editing", "Design", "Writing", "Social Media", "Photography", "Development", "Other"];

const PALETTE = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

function fmt(n) {
  return (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function monthKey(date) {
  return format(date, "yyyy-MM");
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  return format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMMM yyyy", { locale: enUS });
}

// ─── SERVICE CARD ────────────────────────────────────────────────────────────
function ServiceCard({ service, freelancer, onEdit, onDelete, onToggle }) {
  return (
    <div
      style={{
        background: service.is_active ? "var(--card)" : "#f8fafc",
        borderRadius: "var(--card-radius)",
        boxShadow: service.is_active ? "var(--card-shadow)" : "none",
        border: service.is_active ? "none" : "1px solid #e2e8f0",
        padding: "16px",
        opacity: service.is_active ? 1 : 0.6,
        transition: "all 200ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--ink)" }} className="truncate">
            {service.name}
          </p>
          {service.category && (
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--muted)", background: "var(--surface)",
              padding: "2px 7px", borderRadius: 100, display: "inline-block", marginTop: 3,
            }}>
              {service.category}
            </span>
          )}
        </div>
        <div className="text-right flexShrink-0">
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 18, color: "var(--brand)" }}>
            {fmt(service.price)} €
          </p>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.05em" }}>
            {service.billing_cycle === "per_project" ? "/ project" : "/ month"}
          </span>
        </div>
      </div>

      {service.description && (
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{service.description}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User style={{ width: 11, height: 11, color: "var(--brand)" }} />
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
            {freelancer?.name || "No freelancer"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onToggle(service)} title={service.is_active ? "Deactivate" : "Activate"}
            style={{ color: service.is_active ? "var(--success)" : "var(--muted)" }}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors">
            {service.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button onClick={() => onEdit(service)} className="p-1.5 rounded hover:bg-slate-100 transition-colors" style={{ color: "var(--muted)" }}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(service)} className="p-1.5 rounded hover:bg-red-50 transition-colors" style={{ color: "#ef4444" }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MONTH ORDER ROW ─────────────────────────────────────────────────────────
function OrderRow({ order, service, freelancer, onRemove, onUpdatePrice }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const price = order.custom_price ?? service?.price ?? 0;

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors group"
      style={{ borderBottom: "1px solid var(--border-light, #f1f5f9)" }}>
      <div className="flex-1 min-w-0">
        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{service?.name || "Unknown"}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {freelancer && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{freelancer.name}</span>
          )}
          {service?.category && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", background: "var(--surface)", padding: "1px 6px", borderRadius: 100 }}>
              {service.category}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input value={val} onChange={e => setVal(e.target.value)} className="w-20 h-7 text-sm" type="number" />
            <button onClick={() => { onUpdatePrice(order.id, parseFloat(val) || price); setEditing(false); }}
              className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={() => { setVal(String(price)); setEditing(true); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            title="Click to override price">
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--brand)" }}>{fmt(price)} €</span>
            {order.custom_price != null && (
              <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>custom</span>
            )}
          </button>
        )}

        <button onClick={() => onRemove(order.id)}
          className="p-1.5 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: "#ef4444" }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function FreelancerShop() {
  const [tab, setTab] = useState("monthly"); // "monthly" | "catalog"
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [serviceDialog, setServiceDialog] = useState(false);
  const [editService, setEditService] = useState(null);
  const [addOrderDialog, setAddOrderDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: "", description: "", category: "", price: "", freelancer_id: "", billing_cycle: "monthly" });
  const [addOrderServiceId, setAddOrderServiceId] = useState("");
  const qc = useQueryClient();

  const month = monthKey(currentMonth);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: freelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });
  const { data: services = [] } = useQuery({ queryKey: ["freelancer-services"], queryFn: () => base44.entities.FreelancerService.list() });
  const { data: allOrders = [] } = useQuery({
    queryKey: ["monthly-service-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_service_orders").select("*").order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const monthOrders = useMemo(() => allOrders.filter(o => o.month === month), [allOrders, month]);

  // ─── Service helpers ───────────────────────────────────────────────────────
  const svcById = useMemo(() => Object.fromEntries(services.map(s => [s.id, s])), [services]);
  const flById = useMemo(() => Object.fromEntries(freelancers.map(f => [f.id, f])), [freelancers]);

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const monthTotal = useMemo(() =>
    monthOrders.reduce((s, o) => s + (o.custom_price ?? svcById[o.service_id]?.price ?? 0), 0),
    [monthOrders, svcById]);

  const activeServices = services.filter(s => s.is_active).length;

  // Per-freelancer spend this month
  const flSpend = useMemo(() => {
    const map = {};
    for (const o of monthOrders) {
      const svc = svcById[o.service_id];
      if (!svc) continue;
      const flId = svc.freelancer_id;
      const fl = flById[flId];
      if (!fl) continue;
      map[flId] = { name: fl.name, total: (map[flId]?.total || 0) + (o.custom_price ?? svc.price ?? 0) };
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthOrders, svcById, flById]);

  // Last 6 months chart data
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = monthKey(d);
      const orders = allOrders.filter(o => o.month === key);
      const total = orders.reduce((s, o) => s + (o.custom_price ?? svcById[o.service_id]?.price ?? 0), 0);
      months.push({ month: format(d, "MMM yy", { locale: enUS }), total });
    }
    return months;
  }, [allOrders, svcById]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createSvcMut = useMutation({
    mutationFn: (d) => base44.entities.FreelancerService.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-services"] }); setServiceDialog(false); },
  });
  const updateSvcMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.FreelancerService.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-services"] }); setServiceDialog(false); setEditService(null); },
  });
  const deleteSvcMut = useMutation({
    mutationFn: (id) => base44.entities.FreelancerService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-services"] }); setConfirmDelete(null); },
  });
  const addOrderMut = useMutation({
    mutationFn: async (serviceId) => {
      const { error } = await supabase.from("monthly_service_orders").insert({ service_id: serviceId, month, status: "active" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monthly-service-orders"] }); setAddOrderDialog(false); setAddOrderServiceId(""); },
  });
  const removeOrderMut = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from("monthly_service_orders").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-service-orders"] }),
  });
  const updateOrderPriceMut = useMutation({
    mutationFn: async ({ id, price }) => {
      const { error } = await supabase.from("monthly_service_orders").update({ custom_price: price }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-service-orders"] }),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditService(null);
    setServiceForm({ name: "", description: "", category: "", price: "", freelancer_id: "" });
    setServiceDialog(true);
  };
  const openEdit = (svc) => {
    setEditService(svc);
    setServiceForm({ name: svc.name, description: svc.description || "", category: svc.category || "", price: String(svc.price), freelancer_id: svc.freelancer_id || "", billing_cycle: svc.billing_cycle || "monthly" });
    setServiceDialog(true);
  };
  const saveService = () => {
    const payload = { ...serviceForm, price: parseFloat(serviceForm.price) || 0 };
    if (!payload.freelancer_id) delete payload.freelancer_id;
    if (editService) {
      updateSvcMut.mutate({ id: editService.id, d: payload });
    } else {
      createSvcMut.mutate(payload);
    }
  };
  const toggleActive = (svc) => updateSvcMut.mutate({ id: svc.id, d: { is_active: !svc.is_active } });

  // Services not yet in this month's orders
  const availableToAdd = services.filter(s => s.is_active && !monthOrders.some(o => o.service_id === s.id));

  // ─── Render ────────────────────────────────────────────────────────────────
  const TABS = [
    { key: "monthly", label: "Monthly Overview" },
    { key: "catalog", label: "Service Catalog" },
  ];

  return (
    <div className="mx-auto" style={{ maxWidth: 1400 }}>
      <PageHeader title="Freelancer Shop" subtitle="Monthly service purchases">
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New service
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <KpiCard title="This month" value={`${fmt(monthTotal)} €`} icon={ShoppingCart} tint="blue" subtitle={monthLabel(month)} />
        <KpiCard title="Services ordered" value={monthOrders.length} icon={Receipt} tint="purple" subtitle={`of ${activeServices} active`} />
        <KpiCard title="Freelancers billed" value={flSpend.length} icon={Users} tint="green" />
        <KpiCard title="Top freelancer" value={flSpend[0]?.name || "—"} icon={TrendingUp} tint="amber" subtitle={flSpend[0] ? `${fmt(flSpend[0].total)} €` : ""} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "var(--surface)", width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13,
              padding: "6px 18px", borderRadius: 10, transition: "all 150ms",
              background: tab === t.key ? "var(--card)" : "transparent",
              color: tab === t.key ? "var(--ink)" : "var(--muted)",
              boxShadow: tab === t.key ? "var(--card-shadow)" : "none",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MONTHLY TAB ── */}
      {tab === "monthly" && (
        <div className="space-y-5">
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors" style={{ color: "var(--muted)" }}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, color: "var(--ink)", minWidth: 180, textAlign: "center" }}>
              {monthLabel(month)}
            </h2>
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors" style={{ color: "var(--muted)" }}>
              <ChevronRight className="w-5 h-5" />
            </button>
            <Button variant="outline" size="sm" onClick={() => setAddOrderDialog(true)} className="ml-2 gap-1.5"
              disabled={availableToAdd.length === 0}>
              <Plus className="w-4 h-4" /> Add service
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Orders list */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>Services this month</h3>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--muted)" }}>
                    Total: <strong style={{ color: "var(--brand)" }}>{fmt(monthTotal)} €</strong>
                  </span>
                </div>

                {monthOrders.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--muted)" }} />
                    <p style={{ color: "var(--muted)", fontSize: 14 }}>No services ordered this month</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setAddOrderDialog(true)}
                      disabled={availableToAdd.length === 0}>
                      <Plus className="w-4 h-4" /> Add a service
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {monthOrders.map(order => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        service={svcById[order.service_id]}
                        freelancer={flById[svcById[order.service_id]?.freelancer_id]}
                        onRemove={(id) => removeOrderMut.mutate(id)}
                        onUpdatePrice={(id, price) => updateOrderPriceMut.mutate({ id, price })}
                      />
                    ))}
                    {/* Total row */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Total</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--brand)" }}>{fmt(monthTotal)} €</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: per-freelancer + chart */}
            <div className="space-y-4">
              {/* Per-freelancer breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>By freelancer</h3>
                {flSpend.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>None yet</p>
                ) : (
                  <div className="space-y-3">
                    {flSpend.map((fl, i) => (
                      <div key={fl.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{fl.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: PALETTE[i % PALETTE.length] }}>{fmt(fl.total)} €</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
                          <div style={{ width: `${Math.round((fl.total / monthTotal) * 100)}%`, height: "100%", background: PALETTE[i % PALETTE.length], borderRadius: 99 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6-month chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>Last 6 months</h3>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip formatter={(v) => [`${fmt(v)} €`, "Spend"]} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.month === format(currentMonth, "MMM yy", { locale: enUS }) ? "var(--brand)" : "#cbd5e1"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CATALOG TAB ── */}
      {tab === "catalog" && (
        <div className="space-y-5">
          {/* Group by freelancer */}
          {freelancers
            .filter(fl => services.some(s => s.freelancer_id === fl.id))
            .map(fl => {
              const flServices = services.filter(s => s.freelancer_id === fl.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              return (
                <div key={fl.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User style={{ width: 13, height: 13, color: "var(--brand)" }} />
                    </div>
                    <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{fl.name}</h3>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: 100, letterSpacing: "0.05em" }}>
                      {flServices.length} service{flServices.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-2">
                    {flServices.map(svc => (
                      <ServiceCard
                        key={svc.id}
                        service={svc}
                        freelancer={fl}
                        onEdit={openEdit}
                        onDelete={(s) => setConfirmDelete(s)}
                        onToggle={toggleActive}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          }

          {/* Services without freelancer */}
          {services.filter(s => !s.freelancer_id).length > 0 && (
            <div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 12 }}>Unassigned</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {services.filter(s => !s.freelancer_id).map(svc => (
                  <ServiceCard key={svc.id} service={svc} freelancer={null} onEdit={openEdit} onDelete={(s) => setConfirmDelete(s)} onToggle={toggleActive} />
                ))}
              </div>
            </div>
          )}

          {services.length === 0 && (
            <div className="text-center py-20">
              <Package className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--muted)" }} />
              <p style={{ fontSize: 15, color: "var(--muted)", fontWeight: 500 }}>No services yet</p>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Create your first service to start tracking monthly spend</p>
              <Button className="mt-5 gap-1.5" onClick={openCreate}><Plus className="w-4 h-4" /> New service</Button>
            </div>
          )}
        </div>
      )}

      {/* ── SERVICE DIALOG ── */}
      <Dialog open={serviceDialog} onOpenChange={v => { setServiceDialog(v); if (!v) setEditService(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editService ? "Edit service" : "New service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Service name *</Label>
              <Input className="mt-1" placeholder="e.g. Video editing" value={serviceForm.name}
                onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" placeholder="Short description..." rows={2} value={serviceForm.description}
                onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (€) *</Label>
                <Input className="mt-1" type="number" placeholder="0.00" value={serviceForm.price}
                  onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <Label>Billing type</Label>
                <Select value={serviceForm.billing_cycle} onValueChange={v => setServiceForm(f => ({ ...f, billing_cycle: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Per month</SelectItem>
                    <SelectItem value="per_project">Per project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={serviceForm.category} onValueChange={v => setServiceForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Freelancer</Label>
              <Select value={serviceForm.freelancer_id || "__none__"} onValueChange={v => setServiceForm(f => ({ ...f, freelancer_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select freelancer…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {freelancers.map(fl => <SelectItem key={fl.id} value={fl.id}>{fl.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveService} disabled={!serviceForm.name || !serviceForm.price} className="flex-1">
                {editService ? "Save changes" : "Create service"}
              </Button>
              <Button variant="outline" onClick={() => setServiceDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ADD ORDER DIALOG ── */}
      <Dialog open={addOrderDialog} onOpenChange={setAddOrderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add service — {monthLabel(month)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Service</Label>
              <Select value={addOrderServiceId} onValueChange={setAddOrderServiceId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a service…" /></SelectTrigger>
                <SelectContent>
                  {availableToAdd.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {fmt(s.price)} € {flById[s.freelancer_id] ? `(${flById[s.freelancer_id].name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addOrderMut.mutate(addOrderServiceId)} disabled={!addOrderServiceId} className="flex-1">
                Add to {format(currentMonth, "MMMM", { locale: enUS })}
              </Button>
              <Button variant="outline" onClick={() => setAddOrderDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE ── */}
      <Dialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete service?</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            "<strong>{confirmDelete?.name}</strong>" will be permanently deleted along with all its monthly order history.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" onClick={() => deleteSvcMut.mutate(confirmDelete.id)} className="flex-1">Delete</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
