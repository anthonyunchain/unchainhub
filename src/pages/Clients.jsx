import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import StatusBadge from "../components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Search, MapPin, Building2, ChevronRight, Trash2, Pencil, GripVertical, ArrowUpDown, UserPlus, RefreshCw, Copy, KeyRound } from "lucide-react";
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

const emptyClient = { company_name: "", contact_name: "", contact_email: "", contact_phone: "", city: "Tampere", sector: "F&B", address: "", start_date: "", notes: "", status: "Actif", active_services: [] };

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
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });

  const orderedClients = localClients || [...clients].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const displayClients = orderedClients.filter(c => c.company_name?.toLowerCase().includes(search.toLowerCase()));

  const createMut = useMutation({ mutationFn: (d) => base44.entities.Client.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setDialogOpen(false); }, onError: (e) => alert("Creation error: " + (e?.message || e)) });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Client.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setDialogOpen(false); }, onError: (e) => alert("Update error: " + (e?.message || e)) });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.Client.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setDialogOpen(false); }, onError: (e) => alert("Deletion error: " + (e?.message || e)) });

  const handleDelete = () => {
    if (editData?.id && confirm("Delete this client? This action is irreversible.")) {
      deleteMut.mutate(editData.id);
    }
  };

  const openEdit = (c) => { setEditData(c ? { ...c } : { ...emptyClient }); setDialogOpen(true); };

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

  const openInvite = (c) => {
    setInviteClient(c);
    setInviteEmail(c.contact_email || "");
    setInviteMsg("");
    setInvitePassword(generatePassword());
    setInviteOpen(true);
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg("");
    try {
      const { data, error } = await supabase.functions.invoke('setClientPassword', {
        body: { email: inviteEmail, company_name: inviteClient?.company_name, client_id: inviteClient?.id, password: invitePassword },
      });
      if (error || data?.error) {
        setInviteMsg("Erreur : " + (data?.error || error?.message));
      } else {
        setInviteMsg("✓ Compte créé. Partagez le mot de passe avec le client.");
      }
    } catch (e) {
      setInviteMsg("Erreur : " + (e?.message || "Unknown error"));
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
        <Button onClick={() => openEdit(null)} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New client
        </Button>
      </PageHeader>

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
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {c.status === 'Actif' && (
                                    <button
                                      onClick={(e) => { e.preventDefault(); openInvite(c); }}
                                      className="p-1 rounded-md hover:bg-blue-50 transition-colors"
                                      title="Invite to Client Portal"
                                    >
                                      <UserPlus className="w-3.5 h-3.5 text-blue-500" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.preventDefault(); openEdit(c); }}
                                    className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
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

      {/* Invite to Client Portal dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteMsg(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" /> Accès au portail — {inviteClient?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-500">
              Créez directement un compte avec mot de passe. Partagez-le avec le client par SMS ou en personne. Fonctionne même si l'email est déjà utilisé.
            </p>
            <div>
              <Label>Adresse email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="client@company.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Mot de passe</Label>
              <div className="flex gap-2 mt-1">
                <Input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setInvitePassword(generatePassword())} title="Regénérer">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(invitePassword)} title="Copier">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {inviteMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${inviteMsg.startsWith('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                {inviteMsg}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Annuler</Button>
              <Button onClick={sendInvite} disabled={inviting || !inviteEmail || !invitePassword} className="bg-brand hover:bg-brand/90 text-white">
                <KeyRound className="w-4 h-4 mr-1.5" />{inviting ? "Création..." : "Créer le compte"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editData?.id ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4 mt-2">
              <div><Label>Company *</Label><Input value={editData.company_name || ""} onChange={e => setEditData({ ...editData, company_name: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={editData.contact_email || ""} onChange={e => setEditData({ ...editData, contact_email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editData.contact_phone || ""} onChange={e => setEditData({ ...editData, contact_phone: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} /></div>
              <div><Label>Start date</Label><Input type="date" value={editData.start_date || ""} onChange={e => setEditData({ ...editData, start_date: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={editData.notes || ""} onChange={e => setEditData({ ...editData, notes: e.target.value })} rows={3} /></div>
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
                  <p className="text-xs text-slate-400 mt-0.5">Freelancers will see this client's calendar (read-only) and can write descriptions.</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                {editData.id ? (
                  <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
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