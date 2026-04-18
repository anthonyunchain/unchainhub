import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import AdminNavPanel from "@/components/admin/AdminNavPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, ShoppingCart, ChevronLeft, ChevronRight,
  Pencil, Trash2, ToggleLeft, ToggleRight, Check, X
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, subMonths, addMonths } from "date-fns";
import { enUS } from "date-fns/locale";

const CATEGORIES = ["Video Editing", "Design", "Writing", "Social Media", "Photography", "Development", "Other"];

function fmt(n) {
  return (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function monthKey(date) { return format(date, "yyyy-MM"); }
function monthLabel(key) {
  const [y, m] = key.split("-");
  return format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMMM yyyy", { locale: enUS });
}

// ─── INLINE PRICE EDIT ───────────────────────────────────────────────────────
function InlinePrice({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  if (editing) return (
    <div className="flex items-center gap-1">
      <Input value={val} onChange={e => setVal(e.target.value)} className="w-20 h-7 text-sm" type="number" />
      <button onClick={() => { onSave(parseFloat(val) || value); setEditing(false); }} className="p-1 rounded bg-green-100 text-green-700"><Check className="w-3 h-3" /></button>
      <button onClick={() => setEditing(false)} className="p-1 rounded bg-slate-100 text-slate-500"><X className="w-3 h-3" /></button>
    </div>
  );
  return (
    <button onClick={() => { setVal(String(value)); setEditing(true); }} className="font-semibold text-slate-800 hover:text-blue-600 transition-colors" title="Click to override price">
      {fmt(value)} €
    </button>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function FreelancerShop() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("monthly");
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
  const svcById = useMemo(() => Object.fromEntries(services.map(s => [s.id, s])), [services]);
  const flById = useMemo(() => Object.fromEntries(freelancers.map(f => [f.id, f])), [freelancers]);

  const monthTotal = useMemo(() =>
    monthOrders.reduce((s, o) => s + (o.custom_price ?? svcById[o.service_id]?.price ?? 0), 0),
    [monthOrders, svcById]);

  const activeServices = services.filter(s => s.is_active).length;

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

  const availableToAdd = services.filter(s => s.is_active && !monthOrders.some(o => o.service_id === s.id));

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createSvcMut = useMutation({ mutationFn: d => base44.entities.FreelancerService.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-services"] }); setServiceDialog(false); } });
  const updateSvcMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.FreelancerService.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-services"] }); setServiceDialog(false); setEditService(null); } });
  const deleteSvcMut = useMutation({ mutationFn: id => base44.entities.FreelancerService.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-services"] }); setConfirmDelete(null); } });
  const addOrderMut = useMutation({
    mutationFn: async id => { const { error } = await supabase.from("monthly_service_orders").insert({ service_id: id, month, status: "active" }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monthly-service-orders"] }); setAddOrderDialog(false); setAddOrderServiceId(""); },
  });
  const removeOrderMut = useMutation({
    mutationFn: async id => { const { error } = await supabase.from("monthly_service_orders").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-service-orders"] }),
  });
  const updateOrderPriceMut = useMutation({
    mutationFn: async ({ id, price }) => { const { error } = await supabase.from("monthly_service_orders").update({ custom_price: price }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-service-orders"] }),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => { setEditService(null); setServiceForm({ name: "", description: "", category: "", price: "", freelancer_id: "", billing_cycle: "monthly" }); setServiceDialog(true); };
  const openEdit = svc => { setEditService(svc); setServiceForm({ name: svc.name, description: svc.description || "", category: svc.category || "", price: String(svc.price), freelancer_id: svc.freelancer_id || "", billing_cycle: svc.billing_cycle || "monthly" }); setServiceDialog(true); };
  const saveService = () => {
    const payload = { ...serviceForm, price: parseFloat(serviceForm.price) || 0 };
    if (!payload.freelancer_id) delete payload.freelancer_id;
    editService ? updateSvcMut.mutate({ id: editService.id, d: payload }) : createSvcMut.mutate(payload);
  };
  const toggleActive = svc => updateSvcMut.mutate({ id: svc.id, d: { is_active: !svc.is_active } });

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

      {/* Admin nav */}
      <div className="mb-5">
        <AdminNavPanel section={null} onSelect={id => navigate(`/Admin?s=${id}`)} />
      </div>

      {/* KPIs — same style as Subscriptions */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wide">This month</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(monthTotal)} €</p>
          <p className="text-xs text-slate-400 mt-1">{monthLabel(month)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Services ordered</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{monthOrders.length}</p>
          <p className="text-xs text-slate-400 mt-1">of {activeServices} active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Services in catalog</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeServices}</p>
          <p className="text-xs text-slate-400 mt-1">{services.length - activeServices} inactive</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Freelancers</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{freelancers.filter(f => services.some(s => s.freelancer_id === f.id)).length}</p>
          <p className="text-xs text-slate-400 mt-1">with services</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "var(--surface)", width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13,
              padding: "6px 18px", borderRadius: 10, transition: "all 150ms",
              background: tab === t.key ? "#fff" : "transparent",
              color: tab === t.key ? "var(--ink)" : "var(--muted)",
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MONTHLY TAB ── */}
      {tab === "monthly" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Left: orders table */}
          <div className="xl:col-span-2">
            {/* Month nav */}
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all" style={{ color: "var(--muted)" }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
              <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all" style={{ color: "var(--muted)" }}>
                <ChevronRight className="w-4 h-4" />
              </button>
              <Button variant="outline" size="sm" onClick={() => setAddOrderDialog(true)} disabled={availableToAdd.length === 0} className="ml-2 gap-1 h-8">
                <Plus className="w-3.5 h-3.5" /> Add service
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Service</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Freelancer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">Price</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {monthOrders.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No services ordered this month
                    </td></tr>
                  )}
                  {monthOrders.map(order => {
                    const svc = svcById[order.service_id];
                    const fl = flById[svc?.freelancer_id];
                    const price = order.custom_price ?? svc?.price ?? 0;
                    return (
                      <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{svc?.name || "—"}</td>
                        <td className="px-5 py-3 text-slate-500">{fl?.name || "—"}</td>
                        <td className="px-5 py-3 text-slate-500">{svc?.category || "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <InlinePrice value={price} onSave={p => updateOrderPriceMut.mutate({ id: order.id, price: p })} />
                          {order.custom_price != null && <span className="ml-1 text-[10px] text-slate-400">custom</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => removeOrderMut.mutate(order.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {monthOrders.length > 0 && (
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Total</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{fmt(monthTotal)} €</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: breakdown + chart */}
          <div className="space-y-4">
            {/* Per-freelancer */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">By freelancer</p>
              {monthOrders.length === 0 ? (
                <p className="text-sm text-slate-400">None yet</p>
              ) : (
                <div className="space-y-3">
                  {Object.values(
                    monthOrders.reduce((acc, o) => {
                      const svc = svcById[o.service_id];
                      const fl = flById[svc?.freelancer_id];
                      if (!fl) return acc;
                      const price = o.custom_price ?? svc?.price ?? 0;
                      acc[fl.id] = acc[fl.id] || { name: fl.name, total: 0 };
                      acc[fl.id].total += price;
                      return acc;
                    }, {})
                  ).sort((a, b) => b.total - a.total).map((fl, i) => (
                    <div key={fl.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{fl.name}</span>
                        <span className="text-sm font-bold text-slate-900">{fmt(fl.total)} €</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div style={{ width: `${Math.round((fl.total / monthTotal) * 100)}%`, height: "100%", background: "#2A69FF", borderRadius: 99, opacity: 1 - i * 0.2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6-month chart */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Last 6 months</p>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip formatter={v => [`${fmt(v)} €`, "Spend"]} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.month === format(currentMonth, "MMM yy", { locale: enUS }) ? "#2A69FF" : "#e2e8f0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CATALOG TAB ── */}
      {tab === "catalog" && (
        <div className="space-y-6">
          {freelancers.filter(fl => services.some(s => s.freelancer_id === fl.id)).map(fl => {
            const flServices = services.filter(s => s.freelancer_id === fl.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            return (
              <div key={fl.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{fl.name}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{flServices.length}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Service</th>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Billing</th>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="px-5 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">Price</th>
                        <th className="px-5 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {flServices.map(svc => (
                        <tr key={svc.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-slate-800">{svc.name}</td>
                          <td className="px-5 py-3 text-slate-500">{svc.category || "—"}</td>
                          <td className="px-5 py-3 text-slate-500">{svc.billing_cycle === "per_project" ? "Per project" : "Per month"}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${svc.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                              {svc.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(svc.price)} €</td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => toggleActive(svc)} className="p-1 rounded hover:bg-slate-100 transition-colors" style={{ color: svc.is_active ? "#10b981" : "#94a3b8" }}>
                                {svc.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                              </button>
                              <button onClick={() => openEdit(svc)} className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setConfirmDelete(svc)} className="p-1 rounded hover:bg-red-50 transition-colors text-slate-300 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {services.filter(s => !s.freelancer_id).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>Unassigned</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{services.filter(s => !s.freelancer_id).length}</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {services.filter(s => !s.freelancer_id).map(svc => (
                      <tr key={svc.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{svc.name}</td>
                        <td className="px-5 py-3 text-slate-500">{svc.category || "—"}</td>
                        <td className="px-5 py-3 text-slate-500">{svc.billing_cycle === "per_project" ? "Per project" : "Per month"}</td>
                        <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${svc.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{svc.is_active ? "Active" : "Inactive"}</span></td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(svc.price)} €</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => toggleActive(svc)} className="p-1 rounded hover:bg-slate-100 transition-colors" style={{ color: svc.is_active ? "#10b981" : "#94a3b8" }}>{svc.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>
                            <button onClick={() => openEdit(svc)} className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setConfirmDelete(svc)} className="p-1 rounded hover:bg-red-50 transition-colors text-slate-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {services.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-100 shadow-sm">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No services yet</p>
              <p className="text-xs text-slate-400 mt-1">Create your first service to start tracking monthly spend</p>
              <Button className="mt-4 gap-1.5" onClick={openCreate}><Plus className="w-4 h-4" /> New service</Button>
            </div>
          )}
        </div>
      )}

      {/* ── SERVICE DIALOG ── */}
      <Dialog open={serviceDialog} onOpenChange={v => { setServiceDialog(v); if (!v) setEditService(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editService ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Service name *</Label><Input className="mt-1" placeholder="e.g. Video editing" value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea className="mt-1" placeholder="Short description..." rows={2} value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (€) *</Label><Input className="mt-1" type="number" placeholder="0.00" value={serviceForm.price} onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))} /></div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={serviceForm.category} onValueChange={v => setServiceForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Freelancer</Label>
                <Select value={serviceForm.freelancer_id || "__none__"} onValueChange={v => setServiceForm(f => ({ ...f, freelancer_id: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {freelancers.map(fl => <SelectItem key={fl.id} value={fl.id}>{fl.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              {editService ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => { setConfirmDelete(editService); setServiceDialog(false); }}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setServiceDialog(false)}>Cancel</Button>
                <Button onClick={saveService} disabled={!serviceForm.name || !serviceForm.price}>
                  {editService ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ADD ORDER DIALOG ── */}
      <Dialog open={addOrderDialog} onOpenChange={setAddOrderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add service — {monthLabel(month)}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
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
              <Button onClick={() => addOrderMut.mutate(addOrderServiceId)} disabled={!addOrderServiceId} className="flex-1">Add to {format(currentMonth, "MMMM", { locale: enUS })}</Button>
              <Button variant="outline" onClick={() => setAddOrderDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE ── */}
      <Dialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete service?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">"{confirmDelete?.name}" will be permanently deleted along with all its monthly order history.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" onClick={() => deleteSvcMut.mutate(confirmDelete.id)} className="flex-1">Delete</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
