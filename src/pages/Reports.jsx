import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Eye, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { enUS } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const PLATFORMS = ["All", "Instagram", "TikTok", "Facebook", "LinkedIn", "Other"];
const EMPTY_STAT = { client_name: "", period: format(new Date(), "yyyy-MM"), platform: "All", views: 0, reach: 0, likes: 0, comments: 0, shares: 0, followers_gained: 0, notes: "" };

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState("client");
  const [statDialog, setStatDialog] = useState(false);
  const [editStat, setEditStat] = useState(null);
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: content = [] } = useQuery({ queryKey: ["editorial"], queryFn: () => base44.entities.EditorialContent.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });
  const { data: payments = [] } = useQuery({ queryKey: ["freelancer-payments"], queryFn: () => base44.entities.FreelancerPayment.list() });
  const { data: allStats = [] } = useQuery({ queryKey: ["client-stats"], queryFn: () => base44.entities.ClientStats.list("-period") });

  const createStat = useMutation({ mutationFn: d => base44.entities.ClientStats.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-stats"] }); setStatDialog(false); }, onError: (e) => alert("Error saving: " + (e?.message || e)) });
  const updateStat = useMutation({ mutationFn: ({ id, d }) => base44.entities.ClientStats.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-stats"] }); setStatDialog(false); }, onError: (e) => alert("Error saving: " + (e?.message || e)) });
  const deleteStat = useMutation({ mutationFn: id => base44.entities.ClientStats.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-stats"] }); setStatDialog(false); }, onError: (e) => alert("Error deleting: " + (e?.message || e)) });

  const openNew = () => { setEditStat({ ...EMPTY_STAT, period: selectedMonth }); setStatDialog(true); };
  const openEdit = s => { setEditStat({ ...s }); setStatDialog(true); };
  const handleSave = () => editStat.id ? updateStat.mutate({ id: editStat.id, d: editStat }) : createStat.mutate(editStat);

  const monthStats = allStats.filter(s => s.period === selectedMonth);
  const totalViews = monthStats.reduce((s, r) => s + (r.views || 0), 0);
  const totalReach = monthStats.reduce((s, r) => s + (r.reach || 0), 0);

  const monthDate = new Date(selectedMonth + "-01");
  const interval = { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };

  const monthContent = content.filter(c => c.scheduled_date && isWithinInterval(new Date(c.scheduled_date), interval));
  const monthInvoicesPaid = invoices.filter(i => i.status === "Payée" && (i.paid_date || i.issue_date) && isWithinInterval(new Date(i.paid_date || i.issue_date), interval));
  const monthPayments = payments.filter(p => p.status === "Payé" && p.date && isWithinInterval(new Date(p.date), interval));

  const monthRevenue = monthInvoicesPaid.reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);
  const monthRevenueHT = monthInvoicesPaid.reduce((s, i) => s + (i.total_amount || 0), 0);
  const monthExpenses = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);

  // Trackers financiers
  const mrr = monthRevenue; // Monthly Recurring Revenue (TTC encaissé)
  const caOpex = monthExpenses > 0 ? (monthRevenueHT / monthExpenses) : null; // Ratio CA HT / Dépenses
  const ebitda = monthRevenueHT - monthExpenses; // EBITDA simplifié (CA HT - charges opex)

  // Content by type
  const contentByType = {};
  monthContent.forEach(c => { contentByType[c.post_type] = (contentByType[c.post_type] || 0) + 1; });
  const typeData = Object.entries(contentByType).map(([name, value]) => ({ name, value }));

  // Content by platform
  const contentByPlatform = {};
  monthContent.forEach(c => { contentByPlatform[c.platform] = (contentByPlatform[c.platform] || 0) + 1; });
  const platformData = Object.entries(contentByPlatform).map(([name, value]) => ({ name, value }));

  // Content by client
  const contentByClient = {};
  monthContent.forEach(c => { contentByClient[c.client_name] = (contentByClient[c.client_name] || 0) + 1; });
  const clientContentData = Object.entries(contentByClient).map(([name, value]) => ({ name, value }));

  // Months for selector
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(format(d, "yyyy-MM"));
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Reports" subtitle="Monthly reports">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{format(new Date(m + "-01"), "MMMM yyyy", { locale: enUS })}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="client">Client report</TabsTrigger>
            <TabsTrigger value="social">Social stats</TabsTrigger>
            <TabsTrigger value="financial">Financial report</TabsTrigger>
          </TabsList>
          {activeTab === "social" && (
            <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" />Add stats</Button>
          )}
        </div>

        <TabsContent value="client">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Scheduled content</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{monthContent.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Published</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{monthContent.filter(c => c.status === "Publié").length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Clients covered</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{Object.keys(contentByClient).length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">By content type</h3>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                      {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400">No data</p>}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">By platform</h3>
              {platformData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400">No data</p>}
            </div>
          </div>

          {/* Per-client breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Client breakdown</h3>
            <div className="space-y-3">
              {clientContentData.map(({ name, value }) => {
                const clientPosts = monthContent.filter(c => c.client_name === name);
                return (
                  <div key={name} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-800">{name}</h4>
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{value} posts</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {clientPosts.map(p => (
                        <span key={p.id} className="text-[10px] px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-600">
                          {p.post_type} · {p.platform} {p.status === "Publié" ? "✓" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {clientContentData.length === 0 && <p className="text-sm text-slate-400">No content this month</p>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="social">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Total views</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalViews.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Total reach</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalReach.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Entries</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{monthStats.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Clients tracked</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{new Set(monthStats.map(s => s.client_name)).size}</p>
            </div>
          </div>

          {/* Stats table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Platform</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Views</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Reach</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Likes</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Comments</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Followers +</th>
              </tr></thead>
              <tbody>
                {monthStats.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">No stats for this month — click "Add stats" to start</td></tr>}
                {monthStats.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(s)}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{s.client_name}</td>
                    <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{s.platform}</span></td>
                    <td className="px-5 py-3 text-sm text-right font-semibold text-blue-600">{(s.views || 0).toLocaleString("fr-FR")}</td>
                    <td className="px-5 py-3 text-sm text-right text-slate-600">{(s.reach || 0).toLocaleString("fr-FR")}</td>
                    <td className="px-5 py-3 text-sm text-right text-slate-500">{(s.likes || 0).toLocaleString("fr-FR")}</td>
                    <td className="px-5 py-3 text-sm text-right text-slate-500">{(s.comments || 0).toLocaleString("fr-FR")}</td>
                    <td className="px-5 py-3 text-sm text-right text-emerald-600 font-medium">{s.followers_gained > 0 ? `+${s.followers_gained}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="financial">
          {/* KPIs principaux */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Monthly revenue (incl. VAT)</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{monthRevenue.toLocaleString("fr-FR")} €</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Monthly expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{monthExpenses.toLocaleString("fr-FR")} €</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase">Net profit</p>
              <p className={`text-2xl font-bold mt-1 ${(monthRevenue - monthExpenses) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{(monthRevenue - monthExpenses).toLocaleString("fr-FR")} €</p>
            </div>
          </div>

          {/* Trackers avancés */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-400 uppercase font-semibold">MRR</p>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">Monthly</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-1">{mrr.toLocaleString("fr-FR")} €</p>
              <p className="text-[11px] text-slate-400 mt-1">Revenue collected incl. VAT this month</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-400 uppercase font-semibold">CA / OPEX</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${caOpex !== null && caOpex >= 2 ? "bg-emerald-50 text-emerald-600" : caOpex !== null && caOpex >= 1 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>
                  {caOpex !== null && caOpex >= 2 ? "Healthy" : caOpex !== null && caOpex >= 1 ? "Caution" : "Deficit"}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {caOpex !== null ? `x${caOpex.toFixed(2)}` : "—"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Revenue excl. VAT ({monthRevenueHT.toLocaleString("en-US")} €) ÷ Expenses ({monthExpenses.toLocaleString("en-US")} €)</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-400 uppercase font-semibold">EBITDA</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${ebitda >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {ebitda >= 0 ? "Positive" : "Negative"}
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${ebitda >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {ebitda.toLocaleString("fr-FR")} €
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Revenue excl. VAT - operating costs</p>
            </div>
          </div>

          {/* Invoices detail */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Invoices this month</h3>
            <div className="space-y-2">
              {monthInvoicesPaid.map(i => (
                <div key={i.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{i.client_name}</p>
                    <p className="text-xs text-slate-400">{i.invoice_number}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">{(i.total_with_tax || i.total_amount || 0).toLocaleString("fr-FR")} €</span>
                </div>
              ))}
              {monthInvoicesPaid.length === 0 && <p className="text-sm text-slate-400">No paid invoices</p>}
            </div>
          </div>

          {/* Payments detail */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Freelancer payments this month</h3>
            <div className="space-y-2">
              {monthPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.freelancer_name}</p>
                    <p className="text-xs text-slate-400">{p.mission}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{(p.amount || 0).toLocaleString("fr-FR")} €</span>
                </div>
              ))}
              {monthPayments.length === 0 && <p className="text-sm text-slate-400">No payments</p>}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Stat dialog */}
      <Dialog open={statDialog} onOpenChange={setStatDialog}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editStat?.id ? "Edit stats" : "Add social stats"}</DialogTitle></DialogHeader>
        {editStat && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Client *</Label>
                <Select value={editStat.client_name} onValueChange={v => setEditStat({ ...editStat, client_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Period</Label>
                <Input type="month" value={editStat.period || ""} onChange={e => setEditStat({ ...editStat, period: e.target.value })} />
              </div>
            </div>
            <div><Label>Platform</Label>
              <Select value={editStat.platform} onValueChange={v => setEditStat({ ...editStat, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Views / Impressions</Label><Input type="number" value={editStat.views || ""} onChange={e => setEditStat({ ...editStat, views: Number(e.target.value) })} /></div>
              <div><Label>Reach</Label><Input type="number" value={editStat.reach || ""} onChange={e => setEditStat({ ...editStat, reach: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Likes</Label><Input type="number" value={editStat.likes || ""} onChange={e => setEditStat({ ...editStat, likes: Number(e.target.value) })} /></div>
              <div><Label>Comments</Label><Input type="number" value={editStat.comments || ""} onChange={e => setEditStat({ ...editStat, comments: Number(e.target.value) })} /></div>
              <div><Label>Shares</Label><Input type="number" value={editStat.shares || ""} onChange={e => setEditStat({ ...editStat, shares: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Followers gained</Label><Input type="number" value={editStat.followers_gained || ""} onChange={e => setEditStat({ ...editStat, followers_gained: Number(e.target.value) })} /></div>
            <div><Label>Notes</Label><Textarea value={editStat.notes || ""} onChange={e => setEditStat({ ...editStat, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-between items-center pt-2">
              {editStat.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => { deleteStat.mutate(editStat.id); setStatDialog(false); }}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStatDialog(false)}>Cancel</Button>
                <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!editStat.client_name}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      </Dialog>
    </div>
  );
}