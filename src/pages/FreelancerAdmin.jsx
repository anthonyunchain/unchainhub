import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { useConfirm } from "@/lib/confirm";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Upload, X, ExternalLink, Users, CalendarDays, Wrench, Briefcase, Bell, FileText, Check, Eye, EyeOff, LayoutDashboard, KeyRound, RefreshCw, Copy, Contact } from "lucide-react";
import { FREELANCER_NAV_ITEMS } from "@/lib/navConfig";
import AdminProjects from "@/components/admin/AdminProjects";
import AdminNotifications from "@/components/admin/AdminNotifications";
import FreelancerProfileCard from "@/components/freelancer/FreelancerProfileCard";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── FREELANCER PROFILES ──────────────────────────────────────────────────
function generateFreelancerPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function FreelancerProfiles() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteForce, setInviteForce] = useState(false);
  const qc = useQueryClient();

  const { data: freelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.filter({ status: "Actif" }) });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.Freelancer.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancers"] }); setSaveError(null); setOpen(false); }, onError: (e) => setSaveError("Create error: " + (e?.message || String(e))) });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Freelancer.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancers"] }); setSaveError(null); setOpen(false); }, onError: (e) => setSaveError("Update error: " + (e?.message || String(e))) });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.Freelancer.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["freelancers"] }), onError: (e) => setSaveError("Delete error: " + (e?.message || String(e))) });

  const empty = { first_name: "", last_name: "", name: "", email: "", phone: "", role: "", status: "Actif", notes: "", contract_url: "", editorial_client_names: [] };

  const toggleEditorialClient = (clientName) => {
    const current = data.editorial_client_names || [];
    const updated = current.includes(clientName)
      ? current.filter(n => n !== clientName)
      : [...current, clientName];
    setData(d => ({ ...d, editorial_client_names: updated }));
  };
  const openNew = () => { setData({ ...empty }); setSaveError(null); setOpen(true); };
  const openEdit = (f) => { setData({ ...f, first_name: f.first_name || "", last_name: f.last_name || "" }); setSaveError(null); setOpen(true); };
  const buildPayload = (d) => {
    const first = (d.first_name || "").trim();
    const last = (d.last_name || "").trim();
    const fullName = [first, last].filter(Boolean).join(" ");
    return { ...d, first_name: first, last_name: last, name: fullName || d.name };
  };
  const handleSave = () => {
    const payload = buildPayload(data);
    return data.id ? updateMut.mutate({ id: data.id, d: payload }) : createMut.mutate(payload);
  };
  const handleDelete = () => { if (data?.id) { deleteMut.mutate(data.id); setOpen(false); setConfirmDelete(false); } };

  const handleContractUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setData(d => ({ ...d, contract_url: file_url }));
    setUploading(false); e.target.value = "";
  };

  const openInvite = (freelancer) => {
    setInviteTarget(freelancer);
    setInviteEmail(freelancer?.email || "");
    setInvitePassword(generateFreelancerPassword());
    setInviteMsg("");
    setInviteForce(false);
    setInviteOpen(true);
  };

  const sendInvite = async () => {
    if (!inviteEmail || !invitePassword) return;
    setInviting(true);
    setInviteMsg("");
    try {
      const { data: resp, error } = await supabase.functions.invoke('setFreelancerPassword', {
        body: {
          email: inviteEmail,
          freelancer_name: inviteTarget?.name,
          freelancer_id: inviteTarget?.id,
          password: invitePassword,
          force: inviteForce,
        },
      });
      if (error) {
        setInviteMsg("Error: " + error.message);
      } else if (resp?.error) {
        if (resp.canForce) {
          setInviteMsg(resp.error + " Tick \"override\" and retry to overwrite the password.");
          setInviteForce(false);
        } else {
          setInviteMsg("Error: " + resp.error);
        }
      } else {
        setInviteMsg("Account ready. Share the password with the freelancer.");
        qc.invalidateQueries({ queryKey: ["freelancers"] });
      }
    } catch (e) {
      setInviteMsg("Error: " + (e?.message || "Unknown error"));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> Add freelancer
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {freelancers.map(f => (
          <FreelancerProfileCard key={f.id} freelancer={f} onClick={openEdit} />
        ))}
        {freelancers.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No freelancers registered</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:!max-w-6xl">
          <DialogHeader><DialogTitle>{data?.id ? "Edit freelancer" : "New freelancer"}</DialogTitle></DialogHeader>
          {data && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* ── Left column: identity ─────────────────────────────── */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First name *</Label><Input value={data.first_name || ""} onChange={e => setData({ ...data, first_name: e.target.value })} /></div>
                  <div><Label>Last name</Label><Input value={data.last_name || ""} onChange={e => setData({ ...data, last_name: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input value={data.email || ""} onChange={e => setData({ ...data, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={data.phone || ""} onChange={e => setData({ ...data, phone: e.target.value })} placeholder="e.g. +33 6 12 34 56 78" /></div>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input
                    value={data.timezone || ""}
                    onChange={e => setData({ ...data, timezone: e.target.value })}
                    placeholder="e.g. Asia/Karachi, Asia/Ho_Chi_Minh, Europe/Helsinki"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    IANA timezone ID. When set, the freelancer's portal shows their local time plus Helsinki.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Role</Label><Input value={data.role || ""} onChange={e => setData({ ...data, role: e.target.value })} placeholder="e.g. Video editor" /></div>
                  <div><Label>Status</Label>
                    <Select value={data.status} onValueChange={v => setData({ ...data, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Actif">Active</SelectItem>
                        <SelectItem value="Indisponible">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Contract PDF</Label>
                  <div className="mt-1">
                    {data.contract_url ? (
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <a href={data.contract_url} target="_blank" rel="noopener noreferrer" className="text-[#2A69FF] hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> View contract
                        </a>
                        <button onClick={() => setData(d => ({ ...d, contract_url: "" }))} className="text-slate-300 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs text-[#2A69FF] hover:underline ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                        <Upload className="w-3 h-3" />{uploading ? "Uploading..." : "Upload contract"}
                        <input type="file" accept=".pdf" className="hidden" onChange={handleContractUpload} />
                      </label>
                    )}
                  </div>
                </div>
                <div><Label>Notes</Label><Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} /></div>
              </div>

              {/* ── Right column: visibility toggles ──────────────────── */}
              <div className="space-y-4">
                {/* Editorial calendar visibility */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    Visible editorial calendars
                  </Label>
                  {clients.length === 0 ? (
                    <p className="text-xs text-slate-400">No active clients</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {clients.map(c => {
                        const isVisible = (data.editorial_client_names || []).includes(c.company_name);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleEditorialClient(c.company_name)}
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                              isVisible
                                ? 'border-blue-300 bg-blue-50 text-blue-800'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isVisible ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                              {isVisible && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="truncate">{c.company_name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1.5">The freelancer will only see the selected calendars.</p>
                </div>

                {/* Page access — per-freelancer sidebar visibility */}
                {data.id && (
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                      Page access
                      <span className="ml-auto text-[10px] text-slate-400 font-normal">
                        {FREELANCER_NAV_ITEMS.length - (data.hidden_nav_items?.length || 0)} / {FREELANCER_NAV_ITEMS.length} visible
                      </span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {FREELANCER_NAV_ITEMS.map(item => {
                        const hidden = (data.hidden_nav_items || []).includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const current = data.hidden_nav_items || [];
                              const next = hidden ? current.filter(x => x !== item.id) : [...current, item.id];
                              setData({ ...data, hidden_nav_items: next });
                            }}
                            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                              hidden
                                ? "bg-slate-50 border-slate-200 text-slate-400"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            }`}
                          >
                            <span className={hidden ? "line-through truncate" : "font-medium truncate"}>{item.label}</span>
                            {hidden ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">Green = visible. Grey = hidden.</p>
                  </div>
                )}

                {/* CRM access */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Contact className="w-3.5 h-3.5 text-slate-400" />
                    CRM access
                  </Label>
                  <button
                    type="button"
                    onClick={() => setData({ ...data, can_see_crm: !data.can_see_crm })}
                    className={`flex items-center justify-between gap-2 w-full px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                      data.can_see_crm
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <span className={data.can_see_crm ? "font-medium" : ""}>CRM</span>
                    {data.can_see_crm ? <Eye className="w-4 h-4 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1.5">Off by default. When enabled, the freelancer sees a CRM tab in their portal.</p>
                </div>
              </div>

              {data.email && !data.id && (
                <div className="md:col-span-2 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  💡 After saving, send an invitation to <strong>{data.email}</strong> so they can access the portal.
                </div>
              )}

              {saveError && (
                <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                  {saveError}
                </div>
              )}

              <div className="md:col-span-2 flex justify-between items-center pt-2 border-t border-slate-100">
                {data.id ? (
                  <div className="flex gap-2">
                    {confirmDelete ? (
                      <>
                        <span className="text-xs text-red-600 self-center">Confirm?</span>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 h-7 text-xs" onClick={handleDelete}>Yes</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>No</Button>
                      </>
                    ) : (
                      <Button variant="ghost" className="text-red-500 hover:bg-red-50 h-8 text-xs" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    )}
                    {data.email && !confirmDelete && (
                      <Button variant="outline" className="h-8 text-xs" onClick={() => { setOpen(false); openInvite(data); }}>
                        <KeyRound className="w-3.5 h-3.5 mr-1" /> Portal access
                      </Button>
                    )}
                  </div>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.first_name && !data.name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Portal access dialog — per-freelancer password */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteMsg(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-500" />
              Portal access — {inviteTarget?.name || inviteTarget?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-500">
              Create an account with a password for this freelancer. Share it with them via SMS or in person.
              Works even if the email is already registered.
            </p>
            <div>
              <Label>Email address</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="freelancer@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Password</Label>
              <div className="flex gap-2 mt-1">
                <Input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setInvitePassword(generateFreelancerPassword())} title="Regenerate">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(invitePassword)} title="Copy">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {inviteMsg?.includes("existing") && (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={inviteForce} onChange={e => setInviteForce(e.target.checked)} />
                Override existing account role and reset its password
              </label>
            )}
            {inviteMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${inviteMsg.startsWith('Error') || inviteMsg.includes('existing') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                {inviteMsg}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={sendInvite} disabled={inviting || !inviteEmail || !invitePassword} className="bg-brand hover:bg-brand/90 text-white">
                <KeyRound className="w-4 h-4 mr-1.5" />{inviting ? "Creating..." : "Create account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MEETINGS MANAGEMENT ──────────────────────────────────────────────────
export function MeetingsManagement() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const qc = useQueryClient();

  const { data: meetings = [] } = useQuery({ queryKey: ["freelancer-meetings"], queryFn: () => base44.entities.FreelancerMeeting.list("-date") });
  const { data: freelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.FreelancerMeeting.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-meetings"] }); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.FreelancerMeeting.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-meetings"] }); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.FreelancerMeeting.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["freelancer-meetings"] }) });

  const confirm = useConfirm();
  const empty = { title: "", date: "", time: "", format: "Remote", link: "", freelancer_id: "", freelancer_name: "", notes: "", status: "À venir" };
  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (m) => { setData({ ...m }); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = async () => {
    if (!data?.id) return;
    const ok = await confirm({ title: "Delete this meeting?", confirmLabel: "Delete", destructive: true });
    if (ok) { deleteMut.mutate(data.id); setOpen(false); }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New meeting
        </Button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Title</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Freelancer</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Date</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Format</th>
              <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {meetings.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No meetings yet</td></tr>}
            {meetings.map(m => (
              <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(m)}>
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{m.title}</td>
                <td className="px-5 py-3 text-sm text-slate-600">{m.freelancer_name || "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{m.date ? format(new Date(m.date), "d MMM yyyy", { locale: fr }) : "—"} {m.time && `· ${m.time}`}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${m.format === "Remote" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{m.format}</span></td>
                <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${m.status === "À venir" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{data?.id ? "Edit meeting" : "New meeting"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div><Label>Title *</Label><Input value={data.title || ""} onChange={e => setData({ ...data, title: e.target.value })} /></div>
              <div><Label>Freelancer</Label>
                <Select value={data.freelancer_id || ""} onValueChange={v => { const f = freelancers.find(x => x.id === v); setData({ ...data, freelancer_id: v, freelancer_name: f?.name || "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{freelancers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={data.date || ""} onChange={e => setData({ ...data, date: e.target.value })} /></div>
                <div><Label>Time</Label><Input value={data.time || ""} onChange={e => setData({ ...data, time: e.target.value })} placeholder="14:00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Format</Label>
                  <Select value={data.format} onValueChange={v => setData({ ...data, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Remote">Remote</SelectItem><SelectItem value="On-site">On-site</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={data.status} onValueChange={v => setData({ ...data, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="À venir">Upcoming</SelectItem>
                      <SelectItem value="Terminée">Done</SelectItem>
                      <SelectItem value="Annulée">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Link (Meet / Zoom)</Label><Input value={data.link || ""} onChange={e => setData({ ...data, link: e.target.value })} placeholder="https://meet.google.com/..." /></div>
              <div><Label>Notes</Label><Textarea value={data.notes || ""} onChange={e => setData({ ...data, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-between pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TOOLS MANAGEMENT ─────────────────────────────────────────────────────
function ToolsManagement() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const qc = useQueryClient();

  const { data: tools = [] } = useQuery({ queryKey: ["freelancer-tools"], queryFn: () => base44.entities.FreelancerTool.list() });
  const { data: freelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });

  const createMut = useMutation({ mutationFn: (d) => base44.entities.FreelancerTool.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-tools"] }); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.FreelancerTool.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-tools"] }); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.FreelancerTool.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["freelancer-tools"] }) });

  const confirm = useConfirm();
  const empty = { name: "", description: "", url: "", logo_url: "", category: "Autre", order: 0, visible_to_freelancer_ids: [] };
  const openNew = () => { setData({ ...empty }); setOpen(true); };
  const openEdit = (t) => { setData({ ...t, visible_to_freelancer_ids: t.visible_to_freelancer_ids || [] }); setOpen(true); };
  const toggleVisible = (fid) => {
    const current = data.visible_to_freelancer_ids || [];
    const next = current.includes(fid) ? current.filter(x => x !== fid) : [...current, fid];
    setData({ ...data, visible_to_freelancer_ids: next });
  };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = async () => {
    if (!data?.id) return;
    const ok = await confirm({ title: "Delete this tool?", confirmLabel: "Delete", destructive: true });
    if (ok) { deleteMut.mutate(data.id); setOpen(false); }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="Tools" subtitle="Shared resources for freelancers">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> Add tool
        </Button>
      </PageHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map(t => (
          <div key={t.id} onClick={() => openEdit(t)} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:shadow-sm transition-all">
            <div className="flex items-center gap-3">
              {t.logo_url ? (
                <img src={t.logo_url} alt={t.name} className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-1 border border-slate-100" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Wrench className="w-3.5 h-3.5 text-slate-400" /></div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                <p className="text-xs text-slate-400">{t.category}</p>
              </div>
            </div>
            {t.description && <p className="text-xs text-slate-500 mt-2">{t.description}</p>}
          </div>
        ))}
        {tools.length === 0 && (
          <p className="col-span-3 text-center text-slate-400 text-sm py-10">No tools added yet</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{data?.id ? "Edit tool" : "New tool"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={data.name || ""} onChange={e => setData({ ...data, name: e.target.value })} /></div>
                <div><Label>Category</Label>
                  <Select value={data.category} onValueChange={v => setData({ ...data, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Design", "Video", "Communication", "Documents", "Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>URL *</Label><Input value={data.url || ""} onChange={e => setData({ ...data, url: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Logo URL</Label><Input value={data.logo_url || ""} onChange={e => setData({ ...data, logo_url: e.target.value })} placeholder="https://...favicon.ico" /></div>
              <div><Label>Description</Label><Textarea value={data.description || ""} onChange={e => setData({ ...data, description: e.target.value })} rows={2} /></div>
              <div><Label>Display order</Label><Input type="number" value={data.order || 0} onChange={e => setData({ ...data, order: Number(e.target.value) })} /></div>

              {/* Visibility — empty = visible to all freelancers */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Visible for
                  <span className="ml-auto text-[10px] text-slate-400 font-normal">
                    {(data.visible_to_freelancer_ids || []).length === 0
                      ? "All freelancers"
                      : `${data.visible_to_freelancer_ids.length} selected`}
                  </span>
                </Label>
                {freelancers.length === 0 ? (
                  <p className="text-xs text-slate-400">No freelancers</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {freelancers.map(f => {
                      const isVisible = (data.visible_to_freelancer_ids || []).includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleVisible(f.id)}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                            isVisible
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isVisible ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                            {isVisible && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="truncate">{f.name || f.email}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1.5">Leave empty to show this tool to every freelancer.</p>
              </div>

              <div className="flex justify-between pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.name || !data.url}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── INVOICES MANAGEMENT ───────────────────────────────────────────────────
function InvoicesManagement() {
  const qc = useQueryClient();
  const [selectedFreelancer, setSelectedFreelancer] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [mutError, setMutError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["freelancer-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancer_payments").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: () => base44.entities.Freelancer.list(),
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const { id, ...rest } = d;
      const { error } = await supabase.from("freelancer_payments").insert({ ...rest, amount: parseFloat(rest.amount) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-payments"] }); setDialogOpen(false); setMutError(null); },
    onError: (e) => setMutError(e.message),
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, d, originalStatus }) => {
      const { id: _id, created_at, ...rest } = d;
      const { error } = await supabase.from("freelancer_payments").update({ ...rest, amount: parseFloat(rest.amount) || 0 }).eq("id", id);
      if (error) throw error;
      // Fire notification when status changes to Paid
      if (originalStatus !== "Paid" && d.status === "Paid") {
        const freelancer = freelancers.find(f => f.id === d.freelancer_id);
        const recipientId = freelancer?.user_id;
        if (recipientId) {
          await supabase.from("notifications").insert({
            recipient_id: recipientId,
            title: "Invoice marked as paid",
            message: `Your invoice for "${d.mission || "mission"}" has been marked as paid (€${parseFloat(d.amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}).`,
            type: "invoice_paid",
            is_read: false,
            action_required: false,
          });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-payments"] }); setDialogOpen(false); setMutError(null); },
    onError: (e) => setMutError(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("freelancer_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancer-payments"] }); setDialogOpen(false); setConfirmDelete(false); },
    onError: (e) => setMutError(e.message),
  });

  const openNew = () => {
    const preselected = selectedFreelancer !== "all" ? freelancers.find(f => f.id === selectedFreelancer) : null;
    setEditData({
      freelancer_id: preselected?.id || "",
      freelancer_name: preselected?.name || "",
      mission: "", client_name: "", amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      status: "Pending", invoice_url: "", notes: "",
    });
    setMutError(null);
    setDialogOpen(true);
  };
  const openEdit = (p) => { setEditData({ ...p }); setMutError(null); setConfirmDelete(false); setDialogOpen(true); };
  const handleSave = () => {
    if (editData.id) {
      const originalPayment = payments.find(p => p.id === editData.id);
      updateMut.mutate({ id: editData.id, d: editData, originalStatus: originalPayment?.status });
    } else {
      createMut.mutate(editData);
    }
  };

  const STATUS_COLORS = {
    "Pending": "bg-amber-50 text-amber-700",
    "Paid": "bg-emerald-50 text-emerald-700",
    "Overdue": "bg-red-50 text-red-700",
  };

  const filtered = selectedFreelancer === "all"
    ? payments
    : payments.filter(p => p.freelancer_id === selectedFreelancer);

  const pending = filtered.filter(p => p.status === "Pending");
  const paid = filtered.filter(p => p.status === "Paid");

  if (isLoading) return <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSelectedFreelancer("all")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedFreelancer === "all" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            All freelancers
          </button>
          {freelancers.map(f => (
            <button key={f.id} onClick={() => setSelectedFreelancer(f.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedFreelancer === f.id ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {f.name}
            </button>
          ))}
        </div>
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9 shrink-0 ml-3">
          <Plus className="w-4 h-4 mr-1" /> Add invoice
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase">Total invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase">Pending</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pending.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 uppercase">Paid</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{paid.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Freelancer</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mission</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                No invoices yet — <button onClick={openNew} className="text-brand hover:underline">add one</button>
              </td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => openEdit(p)}>
                <td className="px-5 py-3.5 font-medium text-slate-800">{p.freelancer_name || "—"}</td>
                <td className="px-5 py-3.5 text-slate-500">{p.mission || "—"}</td>
                <td className="px-5 py-3.5 text-slate-500">{p.date ? format(new Date(p.date), "d MMM yyyy") : "—"}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-semibold text-slate-800 text-right">{p.amount ? `${parseFloat(p.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—"}</td>
                <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                  {p.invoice_url && (
                    <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline text-xs flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> PDF
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setMutError(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editData?.id ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4 mt-2">
              <div><Label>Freelancer</Label>
                <Select value={editData.freelancer_id || ""} onValueChange={v => { const f = freelancers.find(ff => ff.id === v); setEditData({ ...editData, freelancer_id: v, freelancer_name: f?.name || "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Select freelancer…" /></SelectTrigger>
                  <SelectContent>{freelancers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Mission / Description</Label>
                <Input value={editData.mission || ""} onChange={e => setEditData({ ...editData, mission: e.target.value })} placeholder="e.g. Video editing — April 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount (€)</Label>
                  <Input type="number" value={editData.amount || ""} placeholder="0.00" onChange={e => setEditData({ ...editData, amount: e.target.value })} />
                </div>
                <div><Label>Date</Label>
                  <Input type="date" value={editData.date || ""} onChange={e => setEditData({ ...editData, date: e.target.value })} />
                </div>
              </div>
              <div><Label>Status</Label>
                <Select value={editData.status || "Pending"} onValueChange={v => setEditData({ ...editData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Invoice PDF</Label>
                {editData.invoice_url ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 mt-1">
                    <FileText className="w-4 h-4 text-brand shrink-0" />
                    <a href={editData.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex-1 truncate">
                      {decodeURIComponent(editData.invoice_url.split("/").pop().split("?")[0])}
                    </a>
                    <button onClick={() => setEditData({ ...editData, invoice_url: "" })} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className={`cursor-pointer flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand border border-dashed border-slate-200 rounded-lg px-4 py-2.5 w-full justify-center hover:border-brand/40 transition-colors mt-1 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Attach invoice PDF"}
                    <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploading(true);
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      setEditData(d => ({ ...d, invoice_url: file_url }));
                      setUploading(false); e.target.value = "";
                    }} />
                  </label>
                )}
              </div>
              {mutError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{mutError}</p>}
              <div className="flex justify-between items-center pt-2">
                {editData.id ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Confirm?</span>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs" onClick={() => deleteMut.mutate(editData.id)} disabled={deleteMut.isPending}>Yes, delete</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                  )
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground"
                    disabled={!editData.freelancer_id || createMut.isPending || updateMut.isPending}>
                    {createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
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

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function FreelancerAdmin() {
  const [adminId, setAdminId] = useState(null);
  const [section, setSection] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setAdminId(u?.id)).catch(() => {});
  }, []);

  const { data: freelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });
  const { data: meetings = [] } = useQuery({ queryKey: ["freelancer-meetings"], queryFn: () => base44.entities.FreelancerMeeting.list("-date") });
  const { data: tools = [] } = useQuery({ queryKey: ["freelancer-tools"], queryFn: () => base44.entities.FreelancerTool.list() });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => base44.entities.Project.list() });

  const activeFreelancers = freelancers.filter(f => f.status === "Actif");
  const upcomingMeetings = meetings.filter(m => m.status === "À venir");
  const activeProjects = projects.filter(p => p.status !== "Completed" && p.status !== "Cancelled");

  const CARD = { background: 'var(--card)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)', padding: '24px', cursor: 'pointer', transition: 'box-shadow 200ms ease, transform 200ms ease', height: '200px', overflow: 'hidden' };
  const hoverOn = e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; };
  const hoverOff = e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; };
  const LABEL = { fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' };
  const VAL = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '36px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-2px', lineHeight: 1.05 };

  if (section) {
    return (
      <div className="mx-auto" style={{ maxWidth: '1400px' }}>
        <PageHeader title="Freelancer Hub" subtitle="Projects, profiles, meetings and tools">
          <button
            onClick={() => setSection(null)}
            className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
          >
            ← Back
          </button>
        </PageHeader>
        {section === 'projects' && <AdminProjects />}
        {section === 'notifications' && <div className="mx-auto" style={{ maxWidth: '1400px' }}><AdminNotifications adminId={adminId} /></div>}
        {section === 'profiles' && <FreelancerProfiles />}
        {section === 'meetings' && <MeetingsManagement />}
        {section === 'tools' && <ToolsManagement />}
        {section === 'invoices' && <InvoicesManagement />}
      </div>
    );
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Freelancer Hub" subtitle="Projects, profiles, notifications and tools" />

      {/* Bento Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

        {/* Projects — hero card */}
        <div
          style={{ ...CARD, background: 'linear-gradient(145deg, #0F1C2E 0%, #1a3a8f 100%)', gridColumn: '1 / 2' }}
          onClick={() => setSection('projects')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={{ ...LABEL, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>Active Projects</p>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '52px', fontWeight: 800, color: '#fff', letterSpacing: '-3px', lineHeight: 1.05 }}>{activeProjects.length}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
            {projects.filter(p => p.status === 'Pending acceptance').length} pending acceptance
          </p>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {activeProjects.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: 100 }}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Freelancers card */}
        <div
          style={{ ...CARD, background: '#F8F4FF' }}
          onClick={() => setSection('profiles')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={LABEL}>Freelancers</p>
          <p style={{ ...VAL, color: '#6B3FE7', marginTop: 8 }}>{freelancers.length}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', background: '#E8F5EE', color: '#1A5C33', padding: '4px 10px', borderRadius: 100 }}>{activeFreelancers.length} active</span>
            {freelancers.filter(f => f.status === 'Indisponible').length > 0 && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', background: '#FEF0ED', color: '#C0391A', padding: '4px 10px', borderRadius: 100 }}>{freelancers.filter(f => f.status === 'Indisponible').length} unavailable</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {freelancers.map(f => (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(107,63,231,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#6B3FE7', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {f.name?.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications card */}
        <div
          style={{ ...CARD }}
          onClick={() => setSection('notifications')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={LABEL}>Notifications</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--muted)', marginTop: 12 }}>View & send notifications →</p>
        </div>

        {/* New Project shortcut */}
        <div
          style={{ ...CARD, background: 'linear-gradient(145deg, #F0F7FF 0%, #E8F0FE 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          onClick={() => setSection('projects')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--brand)' }}>New Project</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>Create & assign →</p>
        </div>

        {/* Tools card */}
        <div
          style={{ ...CARD, background: '#F0FAF5' }}
          onClick={() => setSection('tools')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={LABEL}>Tools</p>
          <p style={{ ...VAL, color: 'var(--success)', marginTop: 8 }}>{tools.length}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginTop: 6 }}>shared resource{tools.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Invoices card */}
        <div
          style={{ ...CARD, background: '#FFFBF0' }}
          onClick={() => setSection('invoices')}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <p style={LABEL}>Freelancer Invoices</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--muted)', marginTop: 12 }}>View & manage invoices →</p>
        </div>

      </div>
    </div>
  );
}