import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import StatusBadge from "../components/shared/StatusBadge";
import FreelancerProfileCard from "@/components/freelancer/FreelancerProfileCard";
import { Button } from "@/components/ui/button";
import { Plus, UserCheck, Pencil, Upload, FileText, X, GripVertical, ArrowUpDown, Trash2, Eye, EyeOff } from "lucide-react";
import { FREELANCER_NAV_ITEMS } from "@/lib/navConfig";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { toast } from "sonner";

function friendlyFreelancerError(err) {
  const msg = err?.message || String(err);
  if (/freelancers_email_unique/i.test(msg) || /duplicate key value.*email/i.test(msg)) {
    return "A freelancer with this email already exists.";
  }
  return msg;
}

export default function Freelancers() {
  const [section, setSection] = useState(null);
  const [selectedFreelancer, setSelectedFreelancer] = useState(null);
  const [detailTab, setDetailTab] = useState("profile");
  const [fDialogOpen, setFDialogOpen] = useState(false);
  const [pDialogOpen, setPDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterFreelancer, setFilterFreelancer] = useState("all");
  const [editFreelancer, setEditFreelancer] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentMutError, setPaymentMutError] = useState(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [localFreelancers, setLocalFreelancers] = useState(null);
  const [newTag, setNewTag] = useState("");
  const qc = useQueryClient();

  const { data: freelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });
  const orderedFreelancers = (localFreelancers || [...freelancers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  const { data: payments = [] } = useQuery({
    queryKey: ["freelancer-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancer_payments").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createFMut = useMutation({
    mutationFn: (d) => base44.entities.Freelancer.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancers"] }); setFDialogOpen(false); },
    onError: (e) => toast.error(friendlyFreelancerError(e)),
  });
  const updateFMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Freelancer.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancers"] }); setFDialogOpen(false); },
    onError: (e) => toast.error(friendlyFreelancerError(e)),
  });
  const deleteFMut = useMutation({ mutationFn: (id) => base44.entities.Freelancer.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancers"] }); setFDialogOpen(false); setConfirmDelete(null); } });
  const createPMut = useMutation({
    mutationFn: async (d) => {
      const { id, ...rest } = d;
      const { error } = await supabase.from("freelancer_payments").insert({ ...rest, amount: parseFloat(rest.amount) || 0 });
      if (error) throw error;
    },
    onSuccess: (_, d) => {
      const fl = freelancers.find(f => f.id === d.freelancer_id);
      if (fl?.email) base44.functions.invoke('sendPushNotification', {
        title: '💸 Payment recorded',
        body: `${d.mission || 'Invoice'} — €${parseFloat(d.amount || 0).toFixed(2)}`,
        url: '/',
        freelancer_email: fl.email,
      }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["freelancer-payments"] }); setPDialogOpen(false); setPaymentMutError(null);
    },
    onError: (e) => setPaymentMutError(e.message),
  });
  const updatePMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { id: _id, created_at, ...rest } = d;
      const { error } = await supabase.from("freelancer_payments").update({ ...rest, amount: parseFloat(rest.amount) || 0 }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-payments"] }); setPDialogOpen(false); setPaymentMutError(null); },
    onError: (e) => setPaymentMutError(e.message),
  });
  const deletePMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("freelancer_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-payments"] }); setPDialogOpen(false); setConfirmDelete(null); },
    onError: (e) => setPaymentMutError(e.message),
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(orderedFreelancers);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setLocalFreelancers(items);
  };

  const saveOrder = async () => {
    const updates = (localFreelancers || orderedFreelancers).map((f, i) => base44.entities.Freelancer.update(f.id, { order: i }));
    await Promise.all(updates);
    qc.invalidateQueries({ queryKey: ["freelancers"] });
    setLocalFreelancers(null);
    setReordering(false);
  };

  const openEditFreelancer = (f) => {
    setEditFreelancer(f ? { ...f } : { name: "", role: "", email: "", phone: "", type: "Freelance", status: "Actif", notes: "", tags: [] });
    setNewTag("");
    setFDialogOpen(true);
  };

  const openNewPayment = (freelancer = null) => {
    setPaymentData({
      freelancer_id: freelancer?.id || "",
      freelancer_name: freelancer?.name || "",
      mission: "", client_name: "", amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      status: "Pending", invoice_url: "", notes: "",
    });
    setPaymentMutError(null);
    setPDialogOpen(true);
  };

  const openFreelancerDetail = (f) => {
    setSelectedFreelancer(f);
    setDetailTab("profile");
    setSection("detail");
  };

  const openEditPayment = (p) => {
    setPaymentData({ ...p });
    setPaymentMutError(null);
    setPDialogOpen(true);
  };

  const renderFreelancerDialog = () => (
    <Dialog open={fDialogOpen} onOpenChange={setFDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editFreelancer?.id ? "Edit freelancer" : "New freelancer"}</DialogTitle></DialogHeader>
        {editFreelancer && (
          <div className="space-y-4 mt-2">
            <div><Label>Name *</Label><Input value={editFreelancer.name} onChange={e => setEditFreelancer({ ...editFreelancer, name: e.target.value })} /></div>
            <div><Label>Role (free text)</Label><Input value={editFreelancer.role || ""} onChange={e => setEditFreelancer({ ...editFreelancer, role: e.target.value })} placeholder="e.g. Video editor, Photographer..." /></div>
            <div>
              <Label>Skill tags</Label>
              <p className="text-[10px] text-slate-400 mb-1.5">The <strong>Video editor</strong> tag enables Reel assignment in the editorial calendar.</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(editFreelancer.tags || []).map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                    {tag}
                    <button type="button" onClick={() => setEditFreelancer({ ...editFreelancer, tags: editFreelancer.tags.filter((_, idx) => idx !== i) })} className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newTag} onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newTag.trim()) { setEditFreelancer({ ...editFreelancer, tags: [...(editFreelancer.tags || []), newTag.trim()] }); setNewTag(""); e.preventDefault(); } }}
                  placeholder="Ex: Video editor, Photographer…" className="h-8 text-sm" />
                <Button type="button" variant="outline" className="h-8 shrink-0" onClick={() => { if (newTag.trim()) { setEditFreelancer({ ...editFreelancer, tags: [...(editFreelancer.tags || []), newTag.trim()] }); setNewTag(""); } }}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {["Video editor", "Photographer", "Designer", "Copywriter"].filter(t => !(editFreelancer.tags || []).includes(t)).map(t => (
                  <button key={t} type="button" onClick={() => setEditFreelancer({ ...editFreelancer, tags: [...(editFreelancer.tags || []), t] })} className="text-[10px] px-2 py-0.5 border border-dashed border-slate-200 rounded-full text-slate-400 hover:border-blue-300 hover:text-blue-600 transition-colors">+ {t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={editFreelancer.type} onValueChange={v => setEditFreelancer({ ...editFreelancer, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Partenaire">Partner</SelectItem><SelectItem value="Freelance">Freelance</SelectItem></SelectContent>
                </Select></div>
              <div><Label>Status</Label>
                <Select value={editFreelancer.status} onValueChange={v => setEditFreelancer({ ...editFreelancer, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Actif">Active</SelectItem><SelectItem value="Indisponible">Unavailable</SelectItem></SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={editFreelancer.email || ""} onChange={e => setEditFreelancer({ ...editFreelancer, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={editFreelancer.phone || ""} onChange={e => setEditFreelancer({ ...editFreelancer, phone: e.target.value })} /></div>
            </div>
            <div>
              <Label>Timezone</Label>
              <Input
                value={editFreelancer.timezone || ""}
                onChange={e => setEditFreelancer({ ...editFreelancer, timezone: e.target.value })}
                placeholder="e.g. Asia/Karachi, Asia/Ho_Chi_Minh, Europe/Helsinki"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                IANA timezone ID. When set, the freelancer's portal shows their local time plus Helsinki. Leave empty to default to Helsinki.
              </p>
            </div>
            <div><Label>Notes</Label><Textarea value={editFreelancer.notes || ""} onChange={e => setEditFreelancer({ ...editFreelancer, notes: e.target.value })} rows={3} /></div>

            {editFreelancer.id && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-slate-700">Page access</Label>
                  <span className="text-[10px] text-slate-400">
                    {FREELANCER_NAV_ITEMS.length - (editFreelancer.hidden_nav_items?.length || 0)} / {FREELANCER_NAV_ITEMS.length} visible
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">Toggle which pages this freelancer can see in their sidebar.</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                  {FREELANCER_NAV_ITEMS.map(item => {
                    const hidden = (editFreelancer.hidden_nav_items || []).includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          const current = editFreelancer.hidden_nav_items || [];
                          const next = hidden ? current.filter(x => x !== item.id) : [...current, item.id];
                          setEditFreelancer({ ...editFreelancer, hidden_nav_items: next });
                        }}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                          hidden
                            ? "bg-slate-50 border-slate-200 text-slate-400"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        }`}
                      >
                        <span className={hidden ? "line-through" : "font-medium"}>{item.label}</span>
                        {hidden ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              {editFreelancer.id && (
                confirmDelete === "freelancer" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Confirm?</span>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => deleteFMut.mutate(editFreelancer.id)}>Yes, delete</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" className="text-red-500 hover:bg-red-50 h-8 text-xs" onClick={() => setConfirmDelete("freelancer")}>🗑 Delete</Button>
                )
              )}
              {!editFreelancer.id && <div />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setFDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => { if (editFreelancer.id) updateFMut.mutate({ id: editFreelancer.id, d: editFreelancer }); else createFMut.mutate(editFreelancer); }} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!editFreelancer.name}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const renderPaymentDialog = () => (
    <Dialog open={pDialogOpen} onOpenChange={(o) => { setPDialogOpen(o); if (!o) setPaymentMutError(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{paymentData?.id ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
        {paymentData && (
          <div className="space-y-4 mt-2">
            <div><Label>Freelancer</Label>
              <Select value={paymentData.freelancer_id || ""} onValueChange={v => { const f = freelancers.find(ff => ff.id === v); setPaymentData({ ...paymentData, freelancer_id: v, freelancer_name: f?.name || "" }); }}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{freelancers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Mission / Description</Label><Input value={paymentData.mission || ""} onChange={e => setPaymentData({ ...paymentData, mission: e.target.value })} placeholder="e.g. Video editing — April 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Client</Label><Input value={paymentData.client_name || ""} onChange={e => setPaymentData({ ...paymentData, client_name: e.target.value })} /></div>
              <div><Label>Amount (€)</Label><Input type="number" value={paymentData.amount || ""} placeholder="0.00" onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={paymentData.date || ""} onChange={e => setPaymentData({ ...paymentData, date: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={paymentData.status || "Pending"} onValueChange={v => setPaymentData({ ...paymentData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Invoice PDF</Label>
              <div className="mt-1.5">
                {paymentData.invoice_url ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <FileText className="w-4 h-4 text-brand shrink-0" />
                    <a href={paymentData.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex-1 truncate">
                      {decodeURIComponent(paymentData.invoice_url.split("/").pop().split("?")[0])}
                    </a>
                    <button onClick={() => setPaymentData({ ...paymentData, invoice_url: "" })} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className={`cursor-pointer flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand border border-dashed border-slate-200 rounded-lg px-4 py-2.5 w-full justify-center hover:border-brand/40 transition-colors ${uploadingInvoice ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-4 h-4" />
                    {uploadingInvoice ? "Uploading..." : "Attach invoice PDF"}
                    <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploadingInvoice(true);
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      setPaymentData(d => ({ ...d, invoice_url: file_url }));
                      setUploadingInvoice(false);
                      e.target.value = "";
                    }} />
                  </label>
                )}
              </div>
            </div>
            {paymentMutError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{paymentMutError}</p>}
            <div className="flex justify-between items-center pt-2">
              {paymentData.id ? (
                confirmDelete === "payment" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Confirm?</span>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => deletePMut.mutate(paymentData.id)}>Yes, delete</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" className="text-red-500 hover:bg-red-50 h-8 text-xs" onClick={() => setConfirmDelete("payment")}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                )
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => { if (paymentData.id) updatePMut.mutate({ id: paymentData.id, d: paymentData }); else createPMut.mutate(paymentData); }}
                  className="bg-brand hover:bg-brand/90 text-brand-foreground"
                  disabled={!paymentData.freelancer_id || createPMut.isPending || updatePMut.isPending}>
                  {createPMut.isPending || updatePMut.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const filteredPayments = filterFreelancer === "all" ? payments : payments.filter(p => p.freelancer_name === filterFreelancer || p.freelancer_id === filterFreelancer);
  const totalPaid = filteredPayments.filter(p => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);

  const activeFreelancers = freelancers.filter(f => f.status === "Actif");
  const unavailable = freelancers.filter(f => f.status === "Indisponible");
  const totalAllPaid = payments.filter(p => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
  const pendingPayments = payments.filter(p => p.status === "Pending");
  const totalPending = pendingPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const CARD = { background: 'var(--card)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)', padding: '24px', cursor: 'pointer', transition: 'box-shadow 200ms ease, transform 200ms ease' };
  const hoverOn = e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; };
  const hoverOff = e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; };
  const LABEL = { fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' };
  const VAL = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '36px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-2px', lineHeight: 1.05 };

  /* ── Freelancer detail view ── */
  if (section === 'detail' && selectedFreelancer) {
    const fl = selectedFreelancer;
    const flPayments = payments.filter(p => p.freelancer_id === fl.id);
    const totalPaidFl = flPayments.filter(p => p.status === "Paid").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const pendingFl = flPayments.filter(p => p.status === "Pending").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    return (
      <div className="mx-auto" style={{ maxWidth: '1400px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSection(null)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">
            ← Back
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-base shrink-0">
              {fl.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">{fl.name}</h2>
              <p className="text-xs text-slate-400">{fl.role || "Freelancer"}</p>
            </div>
          </div>
          {detailTab === "payments" && (
            <Button onClick={() => openNewPayment(fl)} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
              <Plus className="w-4 h-4 mr-1" /> Add invoice
            </Button>
          )}
          {detailTab === "profile" && (
            <Button variant="outline" className="h-9" onClick={() => { setEditFreelancer({ ...fl }); setNewTag(""); setFDialogOpen(true); }}>
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
          {["profile", "payments"].map(tab => (
            <button key={tab} onClick={() => setDetailTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${detailTab === tab ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
              {tab === "payments" ? `Invoices & Payments` : "Profile"}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {detailTab === "profile" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Information</h3>
              <div className="space-y-3">
                {fl.email && <div className="flex items-center gap-2 text-sm text-slate-600"><span className="text-slate-400 w-16 shrink-0 text-xs">Email</span>{fl.email}</div>}
                {fl.phone && <div className="flex items-center gap-2 text-sm text-slate-600"><span className="text-slate-400 w-16 shrink-0 text-xs">Phone</span>{fl.phone}</div>}
                <div className="flex items-center gap-2 text-sm text-slate-600"><span className="text-slate-400 w-16 shrink-0 text-xs">Type</span>{fl.type || "—"}</div>
                <div className="flex items-center gap-2 text-sm"><span className="text-slate-400 w-16 shrink-0 text-xs">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fl.status === "Actif" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{fl.status}</span>
                </div>
              </div>
              {fl.tags?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {fl.tags.map((t, i) => <span key={i} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">{t}</span>)}
                  </div>
                </div>
              )}
              {fl.notes && <div><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm text-slate-600 whitespace-pre-line">{fl.notes}</p></div>}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Payment summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Total paid</span>
                  <span className="text-lg font-bold text-emerald-600">{totalPaidFl.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Pending</span>
                  <span className="text-lg font-bold text-amber-500">{pendingFl.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-slate-500">Invoices</span>
                  <span className="text-sm font-semibold text-slate-700">{flPayments.length}</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={() => setDetailTab("payments")}>
                View all invoices →
              </Button>
            </div>
          </div>
        )}

        {/* Payments tab */}
        {detailTab === "payments" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {flPayments.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-400 mb-3">No invoices yet for {fl.name}</p>
                <button onClick={() => openNewPayment(fl)} className="text-sm text-brand hover:underline font-medium">+ Add first invoice</button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Mission</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Client</th>
                    <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Amount</th>
                    <th className="text-center text-xs font-medium text-slate-400 px-5 py-3">Invoice</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {flPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => { setPaymentData({ ...p }); setPaymentMutError(null); setPDialogOpen(true); }}>
                      <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                        {p.date ? format(new Date(p.date), "d MMM yyyy", { locale: enUS }) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{p.mission || "—"}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{p.client_name || "—"}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-right text-slate-800 whitespace-nowrap">
                        {(parseFloat(p.amount) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {p.invoice_url
                          ? <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><FileText className="w-3.5 h-3.5" /> PDF</a>
                          : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={e => { e.stopPropagation(); updatePMut.mutate({ id: p.id, d: { ...p, status: p.status === "Paid" ? "Pending" : "Paid" } }); }}>
                          <StatusBadge status={p.status} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Dialogs below (reuse existing) */}
        {renderFreelancerDialog()}
        {renderPaymentDialog()}
      </div>
    );
  }

  if (section) {
    return (
      <div>
        {/* Mobile: back link above title */}
        <button onClick={() => setSection(null)} className="sm:hidden text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 mb-3">
          ← Back
        </button>
        <PageHeader title="Freelancers & Partners" subtitle="External team management">
          {/* Desktop: back + all controls */}
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={() => setSection(null)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">
              ← Back
            </button>
            {section === 'team' && (
              <>
                <Button variant="outline" className="h-9" onClick={openNewPayment}><Plus className="w-4 h-4 mr-1" /> Payment</Button>
                {reordering ? (
                  <>
                    <Button variant="outline" className="h-9" onClick={() => { setLocalFreelancers(null); setReordering(false); }}>Cancel</Button>
                    <Button className="bg-brand hover:bg-brand/90 text-brand-foreground h-9" onClick={saveOrder}>Save order</Button>
                  </>
                ) : (
                  <Button variant="outline" className="h-9" onClick={() => setReordering(true)}><ArrowUpDown className="w-4 h-4 mr-1" /> Reorder</Button>
                )}
              </>
            )}
            {section === 'payments' && (
              <Button variant="outline" className="h-9" onClick={openNewPayment}><Plus className="w-4 h-4 mr-1" /> New payment</Button>
            )}
          </div>
          {/* Mobile: only primary action */}
          {section === 'team' && (
            <Button onClick={() => openEditFreelancer(null)} className="sm:hidden bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" /> New profile</Button>
          )}
          {section === 'payments' && (
            <Button className="sm:hidden bg-brand hover:bg-brand/90 text-brand-foreground h-9" onClick={openNewPayment}><Plus className="w-4 h-4 mr-1" /> New payment</Button>
          )}
          {/* Desktop: New profile */}
          {section === 'team' && (
            <Button onClick={() => openEditFreelancer(null)} className="hidden sm:inline-flex bg-brand hover:bg-brand/90 text-brand-foreground h-9"><Plus className="w-4 h-4 mr-1" /> New profile</Button>
          )}
        </PageHeader>

        {section === 'team' && (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="freelancers" direction="horizontal" isDropDisabled={!reordering}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
                  {orderedFreelancers.map((f, index) => {
                    const fPayments = payments.filter(p => p.freelancer_id === f.id || p.freelancer_name === f.name);
                    const totalPaidF = fPayments.filter(p => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
                    return (
                      <Draggable key={f.id} draggableId={f.id} index={index} isDragDisabled={!reordering}>{(dragProvided, snapshot) => (
                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`flex flex-col gap-2 ${snapshot.isDragging ? 'opacity-80' : ''}`}>
                          {reordering && (<div {...dragProvided.dragHandleProps} className="flex items-center gap-2 px-3 py-2 bg-white border border-dashed border-slate-200 rounded-lg cursor-grab text-slate-400 text-xs"><GripVertical className="w-4 h-4" /> Drag to reorder</div>)}
                          <FreelancerProfileCard freelancer={f} onClick={reordering ? undefined : openFreelancerDetail} />
                          <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between">
                            <span className="text-xs text-slate-400">{fPayments.length} missions</span>
                            <span className="text-sm font-semibold text-slate-700">{totalPaidF.toLocaleString('fr-FR')} € paid</span>
                          </div>
                          {fPayments.slice(0, 2).map(p => (
                            <div key={p.id} className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                              <span className="text-slate-600 truncate">{p.mission}</span>
                              <div className="flex items-center gap-2 shrink-0"><span className="font-medium">{p.amount?.toLocaleString('fr-FR')} €</span><StatusBadge status={p.status} /></div>
                            </div>
                          ))}
                        </div>
                      )}</Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {section === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 shrink-0">Payment history</h3>
              <div className="flex items-center gap-3 ml-auto">
                <Select value={filterFreelancer} onValueChange={setFilterFreelancer}>
                  <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All freelancers</SelectItem>
                    {freelancers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-sm text-slate-500 shrink-0">Total paid: <span className="font-bold text-slate-800">{totalPaid.toLocaleString('fr-FR')} €</span></span>
              </div>
            </div>
            <table className="w-full">
              <thead><tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Freelancer</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Mission</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Invoice</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
              </tr></thead>
              <tbody>
                {filteredPayments.sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date)).map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => openEditPayment(p)}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{p.freelancer_name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.mission}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{p.client_name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{p.date ? format(new Date(p.date), 'd MMM yyyy', { locale: fr }) : '—'}</td>
                    <td className="px-5 py-3 text-sm font-medium text-right">{(p.amount || 0).toLocaleString('fr-FR')} €</td>
                    <td className="px-5 py-3">{p.invoice_url ? (<a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#2A69FF] hover:underline"><FileText className="w-3.5 h-3.5" /> PDF</a>) : <span className="text-xs text-slate-300">—</span>}</td>
                    <td className="px-5 py-3"><button onClick={(e) => { e.stopPropagation(); updatePMut.mutate({ id: p.id, d: { ...p, status: p.status === 'Paid' ? 'Pending' : 'Paid' } }); }}><StatusBadge status={p.status} /></button></td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">No payments</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Freelancers & Partners" subtitle="External team management" />

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">

        {/* Team hero card */}
        <div
          style={{ ...CARD, background: 'linear-gradient(145deg, #0F1C2E 0%, #1a3a8f 100%)', gridColumn: '1 / 2' }}
          onClick={() => setSection('team')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={{ ...LABEL, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>Team</p>
          <p style={{ ...VAL, fontSize: '52px', color: '#fff', letterSpacing: '-3px' }}>{freelancers.length}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
            {activeFreelancers.length} active{unavailable.length > 0 ? ` · ${unavailable.length} unavailable` : ''}
          </p>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {orderedFreelancers.slice(0, 4).map((f, i) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {f.name?.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                {f.status === 'Indisponible' && <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.12)', color: '#fca5a5', padding: '2px 6px', borderRadius: 100 }}>away</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Payments card */}
        <div
          style={{ ...CARD, background: 'var(--card-green)' }}
          onClick={() => setSection('payments')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={LABEL}>Payments</p>
          <p style={{ ...VAL, color: 'var(--success)', marginTop: 8 }}>{totalAllPaid.toLocaleString('fr-FR')} €</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginTop: 6 }}>{payments.length} total payment{payments.length !== 1 ? 's' : ''}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', background: 'var(--success-bg)', color: 'var(--success-text)', padding: '4px 10px', borderRadius: 100 }}>{payments.filter(p => p.status === 'Paid').length} paid</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', background: 'var(--warning-bg)', color: 'var(--warning-text)', padding: '4px 10px', borderRadius: 100 }}>{pendingPayments.length} pending</span>
          </div>
          <div style={{ marginTop: 16 }}>
            {payments.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 2 ? '1px solid var(--divider)' : 'none' }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '12px', color: 'var(--ink)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.freelancer_name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--success)', fontWeight: 600, marginLeft: 8 }}>{(p.amount || 0).toLocaleString('fr-FR')} €</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending card */}
        <div
          style={{ ...CARD, background: 'var(--card-amber)' }}
          onClick={() => setSection('payments')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={LABEL}>Pending</p>
          <p style={{ ...VAL, color: 'var(--warning)', marginTop: 8 }}>{totalPending.toLocaleString('fr-FR')} €</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginTop: 6 }}>{pendingPayments.length} payment{pendingPayments.length !== 1 ? 's' : ''} to process</p>
          <div style={{ marginTop: 16 }}>
            {pendingPayments.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 2 ? '1px solid var(--divider)' : 'none' }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '12px', color: 'var(--ink)', fontWeight: 500 }}>{p.freelancer_name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--warning)', fontWeight: 600 }}>{(p.amount || 0).toLocaleString('fr-FR')} €</span>
              </div>
            ))}
          </div>
        </div>

      </div>


      {renderFreelancerDialog()}
      {renderPaymentDialog()}
    </div>
  );
}

