import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import StatusBadge from "../components/shared/StatusBadge";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, FileText, Receipt, Pencil, Upload, X, ExternalLink, Briefcase, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ALL_SERVICES = [
  "Community Management", "Content Creation", "Photography", "Video",
  "Digital Strategy", "Meta Ads", "Influencers", "Email Marketing",
  "SEO", "Website", "Branding", "Consulting"
];

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
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${value.includes(s) ? "bg-[#2A69FF] text-white border-[#2A69FF]" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {/* Services personnalisés non dans la liste */}
      {value.filter(s => !ALL_SERVICES.includes(s)).map(s => (
        <span key={s} className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#2A69FF] text-white border border-[#2A69FF] mr-1 mb-1">
          {s}
          <button onClick={() => toggle(s)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <div className="flex gap-2 mt-2">
        <Input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          placeholder="Custom service..."
          className="h-8 text-xs"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom} className="h-8 text-xs">Add</Button>
      </div>
    </div>
  );
}

function DocumentSection({ label, icon: Icon, docs = [], onUpload, onRemove, uploading }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400 flex items-center gap-1"><Icon className="w-3.5 h-3.5" />{label}</p>
        <label className={`cursor-pointer text-xs text-[#2A69FF] hover:underline flex items-center gap-1 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="w-3 h-3" />
          {uploading ? "Uploading..." : "Attach"}
          <input type="file" className="hidden" onChange={onUpload} accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg" />
        </label>
      </div>
      {docs.length === 0 && <p className="text-xs text-slate-300 italic">No documents</p>}
      <div className="space-y-1">
        {docs.map((url, i) => {
          const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
          return (
            <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:text-[#2A69FF] flex items-center gap-1.5 truncate max-w-[200px]">
                <ExternalLink className="w-3 h-3 shrink-0" />{name}
              </a>
              <button onClick={() => onRemove(i)} className="text-slate-300 hover:text-red-400 ml-2"><X className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const qc = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: () => base44.entities.Client.list().then(arr => arr.find(c => c.id === id)),
    enabled: !!id
  });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => base44.entities.Contract.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });
  const { data: content = [] } = useQuery({ queryKey: ["editorial"], queryFn: () => base44.entities.EditorialContent.list() });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Client.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditOpen(false);
    }
  });

  const deleteMut = useMutation({
    mutationFn: (clientId) => base44.entities.Client.delete(clientId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); navigate("/Clients"); },
    onError: (e) => alert("Deletion error: " + (e?.message || e)),
  });

  const handleDelete = () => {
    if (confirm("Delete this client? This action is irreversible.")) {
      deleteMut.mutate(id);
    }
  };

  if (!client) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  const clientContracts = contracts.filter(c => c.client_id === id || c.client_name === client.company_name);
  const clientInvoices = invoices.filter(i => i.client_id === id || i.client_name === client.company_name);
  const clientContent = content.filter(c => c.client_id === id || c.client_name === client.company_name);
  const totalRevenue = clientInvoices.filter(i => i.status === "Payée").reduce((s, i) => s + (i.total_with_tax || i.total_amount || 0), 0);

  const openEdit = () => {
    setEditData({
      ...client,
      active_services: client.active_services || [],
      contract_documents: client.contract_documents || [],
      invoice_documents: client.invoice_documents || [],
    });
    setEditOpen(true);
  };

  const handleUpload = async (type, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setter = type === "contract" ? setUploadingContract : setUploadingInvoice;
    const field = type === "contract" ? "contract_documents" : "invoice_documents";
    setter(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const current = editData[field] || [];
    setEditData(d => ({ ...d, [field]: [...current, file_url] }));
    setter(false);
    e.target.value = "";
  };

  const handleRemoveDoc = (type, idx) => {
    const field = type === "contract" ? "contract_documents" : "invoice_documents";
    setEditData(d => ({ ...d, [field]: d[field].filter((_, i) => i !== idx) }));
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <Link to="/Clients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to clients
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{client.company_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              {client.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{client.city}</span>}
              {client.sector && <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{client.sector}</span>}
              {client.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Since {format(new Date(client.start_date), "MMM yyyy", { locale: fr })}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={client.status} />
            <Button variant="outline" size="sm" onClick={openEdit} className="h-8 gap-1">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          {client.contact_name && <div><p className="text-xs text-slate-400">Contact</p><p className="text-sm font-medium">{client.contact_name}</p></div>}
          {client.contact_email && <div><p className="text-xs text-slate-400">Email</p><p className="text-sm font-medium flex items-center gap-1"><Mail className="w-3 h-3" />{client.contact_email}</p></div>}
          {client.contact_phone && <div><p className="text-xs text-slate-400">Phone</p><p className="text-sm font-medium flex items-center gap-1"><Phone className="w-3 h-3" />{client.contact_phone}</p></div>}
        </div>

        {client.active_services?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />Active services</p>
            <div className="flex flex-wrap gap-2">
              {client.active_services.map((s, i) => <span key={i} className="text-xs px-3 py-1 bg-[#2A69FF]/10 text-[#2A69FF] rounded-full">{s}</span>)}
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

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total revenue</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalRevenue.toLocaleString("fr-FR")} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Contracts</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{clientContracts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Published content</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{clientContent.filter(c => c.status === "Publié").length}</p>
        </div>
      </div>

      {/* Documents joints inline dans les sections */}

      {/* Contrats liés */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4" />Contracts</h3>
          <label className={`cursor-pointer text-xs text-[#2A69FF] hover:underline flex items-center gap-1 ${uploadingContract ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-3 h-3" />{uploadingContract ? "Uploading..." : "Attach file"}
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setUploadingContract(true);
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              await updateMut.mutateAsync({ id: client.id, d: { ...client, contract_documents: [...(client.contract_documents || []), file_url] } });
              setUploadingContract(false); e.target.value = "";
            }} />
          </label>
        </div>
        <div className="space-y-2">
          {clientContracts.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-xs text-slate-400">{c.monthly_amount ? `${c.monthly_amount} €/mois` : ""}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {(client.contract_documents || []).map((url, i) => {
            const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
            return (
              <div key={`doc-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-[#2A69FF] truncate max-w-[300px]">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />{name}
                </a>
                <button onClick={async () => {
                  const docs = (client.contract_documents || []).filter((_, idx) => idx !== i);
                  await updateMut.mutateAsync({ id: client.id, d: { ...client, contract_documents: docs } });
                }} className="text-slate-300 hover:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            );
          })}
          {clientContracts.length === 0 && (client.contract_documents || []).length === 0 && <p className="text-sm text-slate-400">No contracts</p>}
        </div>
      </div>

      {/* Factures liées */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Receipt className="w-4 h-4" />Invoices</h3>
          <label className={`cursor-pointer text-xs text-[#2A69FF] hover:underline flex items-center gap-1 ${uploadingInvoice ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-3 h-3" />{uploadingInvoice ? "Uploading..." : "Attach file"}
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setUploadingInvoice(true);
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              await updateMut.mutateAsync({ id: client.id, d: { ...client, invoice_documents: [...(client.invoice_documents || []), file_url] } });
              setUploadingInvoice(false); e.target.value = "";
            }} />
          </label>
        </div>
        <div className="space-y-2">
          {clientInvoices.map(i => (
            <div key={i.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <p className="text-sm font-medium">{i.invoice_number || "Facture"}</p>
                <p className="text-xs text-slate-400">{i.issue_date ? format(new Date(i.issue_date), "d MMM yyyy", { locale: fr }) : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{(i.total_with_tax || i.total_amount || 0).toLocaleString("fr-FR")} €</span>
                <StatusBadge status={i.status} />
              </div>
            </div>
          ))}
          {(client.invoice_documents || []).map((url, i) => {
            const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
            return (
              <div key={`doc-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-[#2A69FF] truncate max-w-[300px]">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />{name}
                </a>
                <button onClick={async () => {
                  const docs = (client.invoice_documents || []).filter((_, idx) => idx !== i);
                  await updateMut.mutateAsync({ id: client.id, d: { ...client, invoice_documents: docs } });
                }} className="text-slate-300 hover:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            );
          })}
          {clientInvoices.length === 0 && (client.invoice_documents || []).length === 0 && <p className="text-sm text-slate-400">No invoices</p>}
        </div>
      </div>

      {/* Edit Dialog */}
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
                    <SelectContent><SelectItem value="F&B">F&B</SelectItem><SelectItem value="Wellness">Wellness</SelectItem><SelectItem value="Tourism">Tourism</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>City</Label>
                  <Select value={editData.city} onValueChange={v => setEditData({ ...editData, city: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Tampere">Tampere</SelectItem><SelectItem value="Helsinki">Helsinki</SelectItem><SelectItem value="Lapland">Lapland</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact name</Label><Input value={editData.contact_name || ""} onChange={e => setEditData({ ...editData, contact_name: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={editData.status} onValueChange={v => setEditData({ ...editData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Actif">Active</SelectItem><SelectItem value="Inactif">Inactive</SelectItem><SelectItem value="En pause">On hold</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={editData.contact_email || ""} onChange={e => setEditData({ ...editData, contact_email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editData.contact_phone || ""} onChange={e => setEditData({ ...editData, contact_phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Address</Label><Input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} /></div>
                <div><Label>Start date</Label><Input type="date" value={editData.start_date || ""} onChange={e => setEditData({ ...editData, start_date: e.target.value })} /></div>
              </div>

              {/* Services */}
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
                  <Button onClick={() => updateMut.mutate({ id: editData.id, d: editData })} className="bg-emerald-600 hover:bg-emerald-700" disabled={!editData.company_name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}