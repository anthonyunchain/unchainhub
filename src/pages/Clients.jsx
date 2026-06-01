import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import StatusBadge from "../components/shared/StatusBadge";
import EmptyState from "../components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Plus, Search, MapPin, Building2, ChevronRight, Trash2, Pencil, GripVertical, ArrowUpDown, UserPlus, RefreshCw, Copy, KeyRound, ChefHat, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";

const STEPS = [
  { key: "meeting_prev",   label: "Review meeting",         week: "W−1", color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  { key: "stats_share",    label: "Stats + brief request",  week: "W1",  color: "#2A69FF", bg: "rgba(42,105,255,0.1)" },
  { key: "calendar_pdf",   label: "Editorial calendar PDF", week: "W2",  color: "#0EA5E9", bg: "rgba(14,165,233,0.1)" },
  { key: "shooting_org",   label: "Shootings + validation", week: "W3",  color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  { key: "meeting_review", label: "Monthly review meeting", week: "W4",  color: "#10B981", bg: "rgba(16,185,129,0.1)" },
];
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const SERVICE_TRANSLATIONS = {
  "Création de contenu": "Content Creation",
  "Community Management": "Community Management",
  "Graphic Design": "Graphic Design",
  "Social Media Management": "Social Media Management",
  "Email marketing": "Email Marketing",
  "Site web": "Website",
  "Vidéo": "Video",
  "Photographie": "Photography",
  "Branding": "Branding",
  "Publicité Meta": "Meta Ads",
  "Stratégie digitale": "Digital Strategy",
  "SEO": "SEO",
  "Montage vidéo": "Video Editing",
};

const STATUS_TRANSLATIONS = {
  "Actif": "Active",
  "Inactif": "Inactive",
  "En pause": "On hold",
};

const translateService = (s) => SERVICE_TRANSLATIONS[s] || s;
const translateStatus = (s) => STATUS_TRANSLATIONS[s] || s;

const emptyClient = { company_name: "", contact_name: "", contact_email: "", contact_phone: "", city: "Tampere", sector: "F&B", address: "", start_date: "", notes: "", status: "Actif", active_services: [], default_language: "en" };

export default function Clients() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [localClients, setLocalClients] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteClient, setInviteClient] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("client"); // 'client' | 'staff'
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();

  const month = format(new Date(), "yyyy-MM");

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });

  const { data: workflowSteps = [] } = useQuery({
    queryKey: ["workflow-steps", month],
    queryFn: async () => {
      const { data } = await supabase.from("client_workflow_steps").select("*").eq("month", month);
      return data || [];
    },
  });

  const toggleStep = useMutation({
    mutationFn: async ({ client_name, step_key, completed }) => {
      await supabase.from("client_workflow_steps").upsert(
        { client_name, month, step_key, completed, completed_at: completed ? new Date().toISOString() : null },
        { onConflict: "client_name,month,step_key" }
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-steps", month] }),
  });

  const stepMap = {};
  for (const s of workflowSteps) {
    if (!stepMap[s.client_name]) stepMap[s.client_name] = {};
    stepMap[s.client_name][s.step_key] = s;
  }
  const getStep = (clientName, stepKey) => stepMap[clientName]?.[stepKey];

  const orderedClients = localClients || [...clients].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const displayClients = orderedClients.filter(c => c.company_name?.toLowerCase().includes(search.toLowerCase()));

  const createMut = useMutation({ mutationFn: (d) => base44.entities.Client.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setDialogOpen(false); toast.success("Client created"); }, onError: (e) => toast.error("Creation error: " + (e?.message || e)) });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Client.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setDialogOpen(false); toast.success("Client updated"); }, onError: (e) => toast.error("Update error: " + (e?.message || e)) });
  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { data } = await base44.functions.invoke('deleteClient', { clientId: id });
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setDialogOpen(false); toast.success("Client deleted"); },
    onError: (e) => toast.error("Deletion error: " + (e?.message || e)),
  });

  const handleDelete = () => {
    if (editData?.id) deleteMut.mutate(editData.id);
  };

  const openEdit = (c) => { setEditData(c ? { ...c } : { ...emptyClient }); setConfirmDelete(false); setDialogOpen(true); };

  const handleSave = () => {
    if (editData.id) updateMut.mutate({ id: editData.id, d: editData });
    else createMut.mutate(editData);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(displayClients);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setLocalClients(items);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const openInvite = (c, role = "client") => {
    setInviteClient(c);
    setInviteRole(role);
    setInviteEmail(role === "staff" ? "" : (c.contact_email || ""));
    setInviteMsg("");
    setInvitePassword(generatePassword());
    setInviteOpen(true);
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg("");
    try {
      const fn = inviteRole === "staff" ? "setStaffPassword" : "setClientPassword";
      const { data } = await base44.functions.invoke(fn, {
        email: inviteEmail, company_name: inviteClient?.company_name, client_id: inviteClient?.id, password: invitePassword,
      });
      if (data?.error) {
        setInviteMsg("Error: " + data.error);
      } else {
        setInviteMsg(inviteRole === "staff"
          ? "Account created. Share the password with the staff member."
          : "Account created. Share the password with the client.");
      }
    } catch (e) {
      setInviteMsg("Error: " + (e?.message || "Unknown error"));
    } finally {
      setInviting(false);
    }
  };

  const saveOrder = async () => {
    const updates = displayClients.map((c, i) => base44.entities.Client.update(c.id, { order: i }));
    await Promise.all(updates);
    qc.invalidateQueries({ queryKey: ["clients"] });
    setLocalClients(null);
    setReordering(false);
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Clients" subtitle="Active client management">
        <div className="hidden sm:flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search..." className="pl-9 w-60 h-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {reordering ? (
            <>
              <Button variant="outline" className="h-9" onClick={() => { setLocalClients(null); setReordering(false); }}>Cancel</Button>
              <Button className="bg-brand hover:bg-brand/90 text-brand-foreground h-9" onClick={saveOrder}>Save order</Button>
            </>
          ) : (
            <Button variant="outline" className="h-9" onClick={() => setReordering(true)}>
              <ArrowUpDown className="w-4 h-4 mr-1" /> Reorder
            </Button>
          )}
        </div>
        <Button onClick={() => openEdit(null)} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New client
        </Button>
      </PageHeader>

      {displayClients.length === 0 && (
        <EmptyState
          icon={Building2}
          title={clients.length === 0 ? "No clients yet" : "No clients match your search"}
          description={clients.length === 0 ? "Create your first client to start tracking projects and invoices." : "Try a different search term."}
        />
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="clients" isDropDisabled={!reordering}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
            >
              {displayClients.map((c, index) => (
                <Draggable key={c.id} draggableId={c.id} index={index} isDragDisabled={!reordering}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`relative group ${snapshot.isDragging ? "opacity-80 shadow-xl" : ""}`}
                    >
                      {reordering && (
                        <div
                          {...dragProvided.dragHandleProps}
                          className="absolute top-3 left-3 z-20 cursor-grab text-slate-400 hover:text-slate-600"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}
                      {!reordering ? (
                        <Link to={`/ClientDetail?id=${c.id}`} className="block">
                          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                  <Building2 className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-800">{c.company_name}</h3>
                                  <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city} · {c.sector}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <StatusBadge status={translateStatus(c.status)} />
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  {c.status === 'Actif' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); openInvite(c, "client"); }}
                                        className="p-1 rounded-md hover:bg-blue-50 transition-colors"
                                        aria-label={`Invite ${c.company_name} to Client Portal`}
                                        title="Invite to Client Portal"
                                      >
                                        <UserPlus className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); openInvite(c, "staff"); }}
                                        className="p-1 rounded-md hover:bg-amber-50 transition-colors"
                                        aria-label={`Invite staff for ${c.company_name}`}
                                        title="Invite staff (menu submissions)"
                                      >
                                        <ChefHat className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); openEdit(c); }}
                                    className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                                    aria-label={`Edit ${c.company_name}`}
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                  </button>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                              </div>
                            </div>
                            {c.contact_name && <p className="text-xs text-slate-500 mt-3">Contact: {c.contact_name}</p>}
                            {c.active_services?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {c.active_services.map((s, i) => (
                                  <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{translateService(s)}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div
                          {...dragProvided.dragHandleProps}
                          className="bg-white rounded-2xl border border-dashed border-slate-200 p-5 shadow-sm pl-9"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-slate-800">{c.company_name}</h3>
                                <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city} · {c.sector}</p>
                              </div>
                            </div>
                            <StatusBadge status={translateStatus(c.status)} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* ── Monthly Workflow ──────────────────────────────────────────────── */}
      {clients.filter(c => c.status === "Actif").length > 0 && (
        <div style={{ marginTop: 32, background: "var(--card)", borderRadius: 16, border: "1px solid var(--divider)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--ink)", margin: 0 }}>Monthly workflow</p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{format(new Date(), "MMMM yyyy")}</p>
            </div>
          </div>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "200px repeat(5, 1fr)", borderBottom: "1px solid var(--divider)", overflowX: "auto" }}>
            <div style={{ padding: "12px 16px", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Client</div>
            {STEPS.map(s => (
              <div key={s.key} style={{ padding: "12px 10px", borderLeft: "1px solid var(--divider)", textAlign: "center" }}>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: s.bg, fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{s.week}</span>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.3 }}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* Client rows */}
          {clients.filter(c => c.status === "Actif").map((client, ci, arr) => {
            const name = client.company_name;
            const completedCount = STEPS.filter(s => getStep(name, s.key)?.completed).length;
            const progress = Math.round((completedCount / STEPS.length) * 100);
            return (
              <div key={client.id} style={{ display: "grid", gridTemplateColumns: "200px repeat(5, 1fr)", borderBottom: ci < arr.length - 1 ? "1px solid var(--divider)" : "none" }}>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--brand)", flexShrink: 0 }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{name}</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: completedCount === STEPS.length ? "#10B981" : "var(--muted)", margin: 0 }}>{completedCount}/{STEPS.length} done</p>
                    </div>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "var(--divider)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, borderRadius: 2, background: completedCount === STEPS.length ? "#10B981" : "var(--brand)", transition: "width 0.3s ease" }} />
                  </div>
                </div>
                {STEPS.map(step => {
                  const done = getStep(name, step.key)?.completed || false;
                  return (
                    <div key={step.key} style={{ borderLeft: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 10px", background: done ? step.bg : "transparent", transition: "background 0.15s" }}>
                      <button
                        onClick={() => toggleStep.mutate({ client_name: name, step_key: step.key, completed: !done })}
                        title={step.label}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8 }}
                      >
                        {done
                          ? <CheckCircle2 style={{ width: 26, height: 26, color: step.color }} />
                          : <Circle style={{ width: 26, height: 26, color: "rgba(0,0,0,0.15)" }} />
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite dialog — client portal OR staff portal */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteMsg(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {inviteRole === "staff"
                ? <ChefHat className="w-5 h-5 text-amber-600" />
                : <UserPlus className="w-5 h-5 text-blue-500" />}
              {inviteRole === "staff" ? "Staff access" : "Portal access"} — {inviteClient?.company_name}
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
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="client@company.com"
                className="mt-1"
              />
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
              <p className={`text-sm px-3 py-2 rounded-lg ${inviteMsg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setConfirmDelete(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editData?.id ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
          {editData && (
            <div className="mt-2">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {/* Left column */}
                <div className="space-y-3">
                  <div><Label>Company *</Label><Input value={editData.company_name || ""} onChange={e => setEditData({ ...editData, company_name: e.target.value })} /></div>
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
                </div>
                {/* Right column */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Address</Label><Input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} /></div>
                    <div><Label>Start date</Label><Input type="date" value={editData.start_date || ""} onChange={e => setEditData({ ...editData, start_date: e.target.value })} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={editData.notes || ""} onChange={e => setEditData({ ...editData, notes: e.target.value })} rows={2} /></div>
                  <div><Label>Portal language</Label>
                    <Select value={editData.default_language || "en"} onValueChange={v => setEditData({ ...editData, default_language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fi">Finnish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <input
                      type="checkbox"
                      id="editorial_visible"
                      checked={editData.editorial_visible || false}
                      onChange={e => setEditData({ ...editData, editorial_visible: e.target.checked })}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <div>
                      <label htmlFor="editorial_visible" className="text-sm font-medium text-slate-700 cursor-pointer">Editorial calendar visible to freelancers</label>
                      <p className="text-xs text-slate-400 mt-0.5">Freelancers will see this client's calendar (read-only).</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                    <input
                      type="checkbox"
                      id="portal_v2_enabled"
                      checked={editData.portal_v2_enabled || false}
                      onChange={e => setEditData({ ...editData, portal_v2_enabled: e.target.checked })}
                      className="w-4 h-4 accent-violet-600 cursor-pointer"
                    />
                    <div>
                      <label htmlFor="portal_v2_enabled" className="text-sm font-medium text-slate-700 cursor-pointer">Activer Portal V2</label>
                      <p className="text-xs text-slate-400 mt-0.5">Donne accès au nouveau portail client via un lien secret (sans connexion requise).</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-100">
                {editData.id ? (
                  confirmDelete ? (
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
                  )
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!editData.id && !editData.company_name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}