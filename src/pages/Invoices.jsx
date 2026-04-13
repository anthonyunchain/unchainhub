import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Check, Upload, FileText, X, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const qc = useQueryClient();

  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.Invoice.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); setDialogOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Invoice.update(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }) });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.Invoice.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }) });

  const togglePaid = (inv) => {
    const newStatus = inv.status === "Payée" ? "Envoyée" : "Payée";
    updateMut.mutate({ id: inv.id, d: { ...inv, status: newStatus, paid_date: newStatus === "Payée" ? format(new Date(), "yyyy-MM-dd") : "" } });
  };

  const uniqueClients = [...new Set(invoices.map(i => i.client_name).filter(Boolean))];
  const uniqueYears = [...new Set(invoices.map(i => {
    return i.issue_date ? new Date(i.issue_date).getFullYear().toString() : null;
  }).filter(Boolean))].sort((a, b) => b - a);

  const filtered = invoices
    .filter(i => filterStatus === "all" || i.status === filterStatus)
    .filter(i => filterClient === "all" || i.client_name === filterClient)
    .filter(i => {
      if (filterYear === "all") return true;
      return i.issue_date && new Date(i.issue_date).getFullYear().toString() === filterYear;
    })
    .sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const calc = (data) => {
    const ht = parseFloat(data.total_amount) || 0;
    const tax_rate = parseFloat(data.tax_rate) || 0;
    const tax_amount = ht * (tax_rate / 100);
    return { ...data, tax_amount, total_with_tax: ht + tax_amount };
  };

  const openNew = () => {
    const num = `INV-${String(invoices.length + 1).padStart(4, "0")}`;
    setEditData(calc({ invoice_number: num, client_id: "", client_name: "", total_amount: 0, tax_rate: 25.5, tax_amount: 0, total_with_tax: 0, status: "Payée", issue_date: format(new Date(), "yyyy-MM-dd"), due_date: "", notes: "", file_urls: [] }));
    setDialogOpen(true);
  };

  const openEdit = (inv) => {
    setEditData({ ...inv, file_urls: inv.file_urls || [] });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const final = calc(editData);
    if (final.id) {
      updateMut.mutate({ id: final.id, d: final }, { onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); setDialogOpen(false); } });
    } else {
      createMut.mutate(final);
    }
  };

  const handleDelete = () => {
    if (editData?.id && confirm("Delete this invoice?")) {
      deleteMut.mutate(editData.id);
      setDialogOpen(false);
    }
  };

  const kpiBase = filterYear === "all" ? invoices : invoices.filter(i => {
    return i.issue_date && new Date(i.issue_date).getFullYear().toString() === filterYear;
  });
  const totalPaid = kpiBase.filter(i => i.status === "Payée").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);
  const totalPending = kpiBase.filter(i => i.status === "Envoyée").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);
  const totalLate = kpiBase.filter(i => i.status === "En retard").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);

  const statusStyle = (status) => {
    if (status === "Payée") return "text-emerald-600 font-medium";
    if (status === "En retard") return "text-red-500 font-medium";
    return "text-blue-500 font-medium";
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Invoices" subtitle="Invoice management">
        <Select value={filterYear} onValueChange={v => { setFilterYear(v); setPage(1); }}>
          <SelectTrigger className="w-28 h-9 text-sm"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {uniqueYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={v => { setFilterClient(v); setPage(1); }}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Envoyée">Sent</SelectItem>
            <SelectItem value="Payée">Paid</SelectItem>
            <SelectItem value="En retard">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New invoice
        </Button>
      </PageHeader>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-5"><p className="text-xs text-slate-400 uppercase">Paid</p><p className="text-xl font-bold text-emerald-600 mt-1">{totalPaid.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p></div>
        <div className="bg-white rounded-xl border border-slate-100 p-5"><p className="text-xs text-slate-400 uppercase">Pending</p><p className="text-xl font-bold text-blue-600 mt-1">{totalPending.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p></div>
        <div className="bg-white rounded-xl border border-slate-100 p-5"><p className="text-xs text-slate-400 uppercase">Overdue</p><p className="text-xl font-bold text-red-600 mt-1">{totalLate.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p></div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[750px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 w-24">Status</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">No.</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Issue date</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Due date</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Excl. tax</th>
              <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Incl. tax</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Files</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(inv => (
              <tr
                key={inv.id}
                className="border-b border-slate-50 hover:bg-slate-50/30 group"
              >
                <td className="px-5 py-3">
                  <span className={`text-sm ${statusStyle(inv.status)}`}>{inv.status}</span>
                </td>
                <td
                  className="px-5 py-3 text-sm text-slate-600 cursor-pointer hover:text-brand"
                  onClick={() => openEdit(inv)}
                >
                  {inv.invoice_number || "—"}
                </td>
                <td
                  className="px-5 py-3 text-sm font-medium text-slate-800 cursor-pointer"
                  onClick={() => openEdit(inv)}
                >
                  {inv.client_name || "—"}
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">
                  {inv.issue_date ? format(new Date(inv.issue_date), "dd/MM/yyyy") : "—"}
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">
                  {inv.due_date ? format(new Date(inv.due_date), "dd/MM/yyyy") : "—"}
                </td>
                <td className="px-5 py-3 text-sm text-right text-slate-600">
                  {(inv.total_amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </td>
                <td className="px-5 py-3 text-sm font-medium text-right text-slate-800">
                  {(inv.total_with_tax || inv.total_amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    {(inv.file_urls || []).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={decodeURIComponent(url.split("/").pop().split("?")[0])} className="text-brand hover:text-brand/80">
                        <FileText className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => togglePaid(inv)}
                    title={inv.status === "Payée" ? "Mark unpaid" : "Mark paid"}
                    className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                      inv.status === "Payée"
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-200 bg-white text-transparent hover:border-blue-400"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-400">No invoices</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-400">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''} · Page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 p-0">←</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)} className={`w-8 h-8 p-0 ${p === page ? "bg-brand text-white" : ""}`}>{p}</Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 p-0">→</Button>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editData?.id ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4 mt-2">
              {/* Client + Invoice No */}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Client</Label>
                  <Select value={editData.client_id || ""} onValueChange={v => { const cl = clients.find(c => c.id === v); setEditData({ ...editData, client_id: v, client_name: cl?.company_name || "" }); }}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Invoice No.</Label><Input value={editData.invoice_number || ""} onChange={e => setEditData({ ...editData, invoice_number: e.target.value })} /></div>
              </div>

              {/* Dates + Status */}
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Issue date</Label><Input type="date" value={editData.issue_date || ""} onChange={e => setEditData({ ...editData, issue_date: e.target.value })} /></div>
                <div><Label>Due date</Label><Input type="date" value={editData.due_date || ""} onChange={e => setEditData({ ...editData, due_date: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={editData.status} onValueChange={v => setEditData({ ...editData, status: v })}>
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

              {/* Amounts */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label className="shrink-0">Amount excl. tax (€)</Label>
                  <Input type="number" className="w-40 text-right" placeholder="0.00"
                    value={editData.total_amount || ""}
                    onChange={e => setEditData(calc({ ...editData, total_amount: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label className="shrink-0">VAT (%)</Label>
                  <Input type="number" className="w-40 text-right" placeholder="25.5"
                    value={editData.tax_rate ?? 25.5}
                    onChange={e => setEditData(calc({ ...editData, tax_rate: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>VAT amount</span>
                  <span>{(editData.tax_amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-800 border-t border-slate-200 pt-2">
                  <span>Total incl. tax</span>
                  <span className="text-lg">{(editData.total_with_tax || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                </div>
              </div>

              {/* PDF */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5"><Paperclip className="w-3.5 h-3.5" />PDF</Label>
                <div className="space-y-1.5">
                  {(editData.file_urls || []).map((url, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                      <FileText className="w-4 h-4 text-brand shrink-0" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex-1 truncate">
                        {decodeURIComponent(url.split("/").pop().split("?")[0])}
                      </a>
                      <button onClick={() => setEditData(d => ({ ...d, file_urls: (d.file_urls || []).filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(editData.file_urls || []).length < 3 && (
                    <label className="cursor-pointer flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand border border-dashed border-slate-200 rounded-lg px-4 py-2.5 w-full justify-center hover:border-brand/40 transition-colors">
                      <Upload className="w-4 h-4" /> Attach PDF
                      <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setEditData(d => ({ ...d, file_urls: [...(d.file_urls || []), file_url] }));
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>
              </div>

              <div><Label>Notes</Label><Textarea value={editData.notes || ""} onChange={e => setEditData({ ...editData, notes: e.target.value })} rows={2} /></div>

              <div className="flex justify-between items-center pt-2">
                {editData.id ? (
                  <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!editData.client_id && !editData.client_name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}