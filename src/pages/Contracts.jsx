import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import StatusBadge from "../components/shared/StatusBadge";
import Sensitive from "../components/shared/Sensitive";
import { Button } from "@/components/ui/button";
import { Plus, Upload, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Contracts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const qc = useQueryClient();

  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.Contract.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); setDialogOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Contract.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); setDialogOpen(false); } });

  const openEdit = (c) => {
    setEditData(c ? { ...c } : { client_id: "", client_name: "", title: "", status: "Brouillon", monthly_amount: 0, start_date: "", end_date: "", notes: "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editData.id) updateMut.mutate({ id: editData.id, d: editData });
    else createMut.mutate(editData);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditData({ ...editData, file_url });
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Contracts" subtitle="Client contract management">
        <Button onClick={() => openEdit(null)} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New contract
        </Button>
      </PageHeader>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {contracts.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-sm text-slate-400">No contracts</div>
        )}
        {contracts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer active:bg-slate-50" onClick={() => openEdit(c)}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-800 truncate">{c.title}</span>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-xs text-slate-500 mb-2 ml-6">{c.client_name}</p>
            <div className="flex items-center justify-between ml-6">
              <span className="text-xs font-medium text-slate-700">{c.monthly_amount ? <><Sensitive>{c.monthly_amount.toLocaleString("fr-FR")} €</Sensitive>/mois</> : "—"}</span>
              <span className="text-xs text-slate-400">
                {c.start_date ? format(new Date(c.start_date), "d MMM yy", { locale: fr }) : ""}
                {c.end_date ? ` – ${format(new Date(c.end_date), "d MMM yy", { locale: fr })}` : ""}
              </span>
            </div>
            {c.file_url && (
              <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-brand text-xs hover:underline ml-6 mt-1 block" onClick={e => e.stopPropagation()}>View file</a>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead><tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Contract</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Client</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Amount</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Period</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
            <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">File</th>
          </tr></thead>
          <tbody>
            {contracts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(c => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => openEdit(c)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-800">{c.title}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-slate-600">{c.client_name}</td>
                <td className="px-5 py-3 text-sm font-medium" onClick={(e) => e.stopPropagation()}>{c.monthly_amount ? <><Sensitive>{c.monthly_amount.toLocaleString("fr-FR")} €</Sensitive>/mois</> : "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-500">
                  {c.start_date ? format(new Date(c.start_date), "d MMM yyyy", { locale: fr }) : "—"}
                  {c.end_date ? ` — ${format(new Date(c.end_date), "d MMM yyyy", { locale: fr })}` : ""}
                </td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3">
                  {c.file_url ? <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-brand text-xs hover:underline" onClick={e => e.stopPropagation()}>View</a> : <span className="text-xs text-slate-400">—</span>}
                </td>
              </tr>
            ))}
            {contracts.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">No contracts</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editData?.id ? "Edit contract" : "New contract"}</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4 mt-2">
              <div><Label>Title *</Label><Input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} /></div>
              <div><Label>Client</Label>
                <Select value={editData.client_id || ""} onValueChange={v => { const cl = clients.find(c => c.id === v); setEditData({ ...editData, client_id: v, client_name: cl?.company_name || "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Status</Label>
                <Select value={editData.status} onValueChange={v => setEditData({ ...editData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Brouillon">Draft</SelectItem><SelectItem value="Envoyé">Sent</SelectItem><SelectItem value="Signé">Signed</SelectItem><SelectItem value="Terminé">Done</SelectItem></SelectContent>
                </Select></div>
              <div><Label>Monthly amount (€)</Label><Input type="number" value={editData.monthly_amount || 0} onChange={e => setEditData({ ...editData, monthly_amount: Number(e.target.value) })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start date</Label><Input type="date" value={editData.start_date || ""} onChange={e => setEditData({ ...editData, start_date: e.target.value })} /></div>
                <div><Label>End date</Label><Input type="date" value={editData.end_date || ""} onChange={e => setEditData({ ...editData, end_date: e.target.value })} /></div>
              </div>
              <div>
                <Label>Contract file</Label>
                <div className="flex items-center gap-2 mt-1">
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border rounded-md text-sm text-slate-600 hover:bg-slate-50">
                    <Upload className="w-4 h-4" /> Upload
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                  {editData.file_url && <a href={editData.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">Current file</a>}
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={editData.notes || ""} onChange={e => setEditData({ ...editData, notes: e.target.value })} rows={3} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!editData.title}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}