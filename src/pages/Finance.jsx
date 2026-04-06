import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import KpiCard from "../components/shared/KpiCard";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

export default function Finance() {
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });
  const { data: payments = [] } = useQuery({ queryKey: ["freelancer-payments"], queryFn: () => base44.entities.FreelancerPayment.list() });

  const paidInvoices = invoices.filter(i => i.status === "Payée");
  const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);
  const paidPayments = payments.filter(p => p.status === "Payé");
  const totalExpenses = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const margin = totalRevenue - totalExpenses;
  const marginPct = totalRevenue > 0 ? ((margin / totalRevenue) * 100).toFixed(1) : 0;

  // Monthly data
  const monthlyData = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mRevenue = paidInvoices.filter(inv => {
      const pd = new Date(inv.paid_date || inv.issue_date);
      return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
    }).reduce((s, inv) => s + (inv.total_with_tax || inv.total_amount || 0), 0);

    const mExpenses = paidPayments.filter(p => {
      const pd = new Date(p.date);
      return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
    }).reduce((s, p) => s + (p.amount || 0), 0);

    monthlyData.push({
      month: format(d, "MMM yy", { locale: enUS }),
      revenue: mRevenue,
      expenses: mExpenses,
      margin: mRevenue - mExpenses,
    });
  }

  // Cash position (cumulative margin)
  let cumul = 0;
  const cashData = monthlyData.map(m => {
    cumul += m.marge;
    return { ...m, cashflow: cumul };
  });

  return (
    <div>
      <PageHeader title="Finance" subtitle="Financial overview — Unchain Studio Oy" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5 mb-6">
        <KpiCard title="Total revenue" value={`${totalRevenue.toLocaleString("en-US")} €`} icon={TrendingUp} color="emerald" />
        <KpiCard title="Total expenses" value={`${totalExpenses.toLocaleString("en-US")} €`} icon={TrendingDown} color="rose" />
        <KpiCard title="Net margin" value={`${margin.toLocaleString("en-US")} €`} subtitle={`${marginPct}% margin`} icon={PiggyBank} color="violet" />
        <KpiCard title="Cash position" value={`${cumul.toLocaleString("en-US")} €`} icon={Wallet} color="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip formatter={(v) => [`${v.toLocaleString("en-US")} €`]} />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Cash flow evolution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cashData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip formatter={(v) => [`${v.toLocaleString("en-US")} €`]} />
              <Line type="monotone" dataKey="cashflow" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", r: 4 }} />
              <Line type="monotone" dataKey="margin" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ratios */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Key ratios</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-slate-400 uppercase">Margin rate</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{marginPct}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Avg revenue / invoice</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{paidInvoices.length > 0 ? Math.round(totalRevenue / paidInvoices.length).toLocaleString("en-US") : 0} €</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Avg expense / project</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{paidPayments.length > 0 ? Math.round(totalExpenses / paidPayments.length).toLocaleString("en-US") : 0} €</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Overdue invoices</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{invoices.filter(i => i.status === "En retard").length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}