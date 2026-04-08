import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Trash2, Settings, X, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STAGES = ["Identifié", "Contacté", "Réunion", "Proposition", "Négociation", "Signé", "Perdu"];

const STAGE_COLORS = {
  "Identifié": "bg-slate-100 text-slate-600",
  "Contacté": "bg-blue-50 text-blue-700",
  "Réunion": "bg-violet-50 text-violet-700",
  "Proposition": "bg-amber-50 text-amber-700",
  "Négociation": "bg-orange-50 text-orange-700",
  "Signé": "bg-emerald-50 text-emerald-700",
  "Perdu": "bg-red-50 text-red-600",
};

const DEFAULT_CITIES = ["Tampere", "Helsinki", "Lapland", "Other"];
const DEFAULT_SECTORS = ["F&B", "Wellness", "Tourism", "Other"];
const CITIES_KEY = "pipeline_cities";
const SECTORS_KEY = "pipeline_sectors";

function loadList(key, defaults) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaults;
}

export default function Pipeline() {
  const [filterCity, setFilterCity] = useState("all");
  const [filterSector, setFilterSector] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [cities, setCities] = useState(() => loadList(CITIES_KEY, DEFAULT_CITIES));
  const [sectors, setSectors] = useState(() => loadList(SECTORS_KEY, DEFAULT_SECTORS));
  const [newCity, setNewCity] = useState("");
  const [newSector, setNewSector] = useState("");
  const [editingCity, setEditingCity] = useState(null); // { index, value }
  const [editingSector, setEditingSector] = useState(null);

  const qc = useQueryClient();

  const saveList = (key, setter, value) => { setter(value); localStorage.setItem(key, JSON.stringify(value)); };
  const addCity = () => { const t = newCity.trim(); if (t && !cities.includes(t)) saveList(CITIES_KEY, setCities, [...cities, t]); setNewCity(""); };
  const removeCity = (c) => { saveList(CITIES_KEY, setCities, cities.filter(x => x !== c)); if (filterCity === c) setFilterCity("all"); };
  const renameCity = (i, val) => { const updated = [...cities]; updated[i] = val; saveList(CITIES_KEY, setCities, updated); setEditingCity(null); };

  const addSector = () => { const t = newSector.trim(); if (t && !sectors.includes(t)) saveList(SECTORS_KEY, setSectors, [...sectors, t]); setNewSector(""); };
  const removeSector = (s) => { saveList(SECTORS_KEY, setSectors, sectors.filter(x => x !== s)); if (filterSector === s) setFilterSector("all"); };
  const renameSector = (i, val) => { const updated = [...sectors]; updated[i] = val; saveList(SECTORS_KEY, setSectors, updated); setEditingSector(null); };

  const { data: prospects = [] } = useQuery({ queryKey: ["prospects"], queryFn: () => base44.entities.Prospect.list() });
  const createMut = useMutation({ mutationFn: (d) => base44.entities.Prospect.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["prospects"] }); setDialogOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.Prospect.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["prospects"] }); setDialogOpen(false); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.Prospect.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }) });

  const filtered = prospects.filter(p => {
    if (filterCity !== "all" && p.city !== filterCity) return false;
    if (filterSector !== "all" && p.sector !== filterSector) return false;
    if (filterStage !== "all" && p.stage !== filterStage) return false;
    return true;
  });

  const emptyProspect = { company_name: "", sector: sectors[0] || "", city: cities[0] || "", contact_name: "", contact_email: "", contact_phone: "", contact_method: "Email", stage: "Identifié", notes: "", closing_probability: 0, estimated_value: 0 };
  const openEdit = (p) => { setEditData(p ? { ...p } : { ...emptyProspect }); setDialogOpen(true); };
  const handleSave = () => { if (editData.id) updateMut.mutate({ id: editData.id, d: editData }); else createMut.mutate(editData); };
  const handleDelete = () => { if (editData?.id && confirm("Delete this prospect?")) { deleteMut.mutate(editData.id); setDialogOpen(false); } };
  const quickDelete = (e, id) => { e.stopPropagation(); if (confirm("Delete this prospect?")) deleteMut.mutate(id); };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Prospects" subtitle={`${filtered.length} prospect${filtered.length > 1 ? "s" : ""}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="All stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSector} onValueChange={setFilterSector}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
          <Button onClick={() => openEdit(null)} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
      </PageHeader>

      {/* List view */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Company</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Stage</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Sector</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">City</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Contact</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Last contact</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Prob.</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">No prospects</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 group cursor-pointer" onClick={() => openEdit(p)}>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{p.company_name}</p>
                  {p.estimated_value > 0 && <p className="text-xs text-slate-400">{p.estimated_value.toLocaleString("fr-FR")} €</p>}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STAGE_COLORS[p.stage] || "bg-slate-100 text-slate-600"}`}>{p.stage}</span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">{p.sector || "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-500 flex items-center gap-1">
                  {p.city && <><MapPin className="w-3 h-3 shrink-0" />{p.city}</>}
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm text-slate-600">{p.contact_name || "—"}</p>
                  {p.contact_email && <p className="text-xs text-slate-400">{p.contact_email}</p>}
                </td>
                <td className="px-5 py-3 text-sm text-slate-400">
                  {p.last_contact_date ? format(new Date(p.last_contact_date), "d MMM yyyy", { locale: fr }) : "—"}
                </td>
                <td className="px-5 py-3">
                  {p.closing_probability > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: `${p.closing_probability}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{p.closing_probability}%</span>
                    </div>
                  ) : <span className="text-xs text-slate-300">—</span>}
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={(e) => quickDelete(e, p.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Prospect Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editData?.id ? "Edit prospect" : "New prospect"}</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-4 mt-2">
              <div><Label>Company *</Label><Input value={editData.company_name} onChange={e => setEditData({ ...editData, company_name: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Sector</Label>
                  <Select value={editData.sector} onValueChange={v => setEditData({ ...editData, sector: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>City</Label>
                  <Select value={editData.city} onValueChange={v => setEditData({ ...editData, city: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Contact name</Label><Input value={editData.contact_name || ""} onChange={e => setEditData({ ...editData, contact_name: e.target.value })} /></div>
                <div><Label>Method</Label>
                  <Select value={editData.contact_method} onValueChange={v => setEditData({ ...editData, contact_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="In-person">In-person</SelectItem><SelectItem value="Email">Email</SelectItem><SelectItem value="Phone">Phone</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={editData.contact_email || ""} onChange={e => setEditData({ ...editData, contact_email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editData.contact_phone || ""} onChange={e => setEditData({ ...editData, contact_phone: e.target.value })} /></div>
              </div>
              <div><Label>Stage</Label>
                <Select value={editData.stage} onValueChange={v => setEditData({ ...editData, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Probability (%)</Label><Input type="number" min={0} max={100} value={editData.closing_probability || 0} onChange={e => setEditData({ ...editData, closing_probability: Number(e.target.value) })} /></div>
                <div><Label>Estimated value (€)</Label><Input type="number" value={editData.estimated_value || 0} onChange={e => setEditData({ ...editData, estimated_value: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Last contact</Label><Input type="date" value={editData.last_contact_date || ""} onChange={e => setEditData({ ...editData, last_contact_date: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={editData.notes || ""} onChange={e => setEditData({ ...editData, notes: e.target.value })} rows={3} /></div>
              <div className="flex justify-between items-center pt-2">
                {editData.id ? (
                  <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!editData.company_name}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Settings — Cities & Sectors</DialogTitle></DialogHeader>
          <div className="mt-4 space-y-6">

            {/* Cities */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cities</p>
              <div className="space-y-1.5">
                {cities.map((city, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {editingCity?.index === i ? (
                      <>
                        <Input
                          value={editingCity.value}
                          onChange={e => setEditingCity({ index: i, value: e.target.value })}
                          className="h-8 text-sm flex-1"
                          onKeyDown={e => { if (e.key === "Enter") renameCity(i, editingCity.value); if (e.key === "Escape") setEditingCity(null); }}
                          autoFocus
                        />
                        <Button size="sm" className="h-8 px-3" onClick={() => renameCity(i, editingCity.value)}>OK</Button>
                        <button onClick={() => setEditingCity(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700 px-3 py-1.5 bg-slate-50 rounded-lg">{city}</span>
                        <button onClick={() => setEditingCity({ index: i, value: city })} className="text-slate-300 hover:text-brand"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removeCity(city)} className="text-slate-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="New city..." className="h-8 text-sm" onKeyDown={e => e.key === "Enter" && addCity()} />
                <Button size="sm" onClick={addCity} disabled={!newCity.trim()} className="h-8 shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            </div>

            {/* Sectors */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sectors</p>
              <div className="space-y-1.5">
                {sectors.map((sector, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {editingSector?.index === i ? (
                      <>
                        <Input
                          value={editingSector.value}
                          onChange={e => setEditingSector({ index: i, value: e.target.value })}
                          className="h-8 text-sm flex-1"
                          onKeyDown={e => { if (e.key === "Enter") renameSector(i, editingSector.value); if (e.key === "Escape") setEditingSector(null); }}
                          autoFocus
                        />
                        <Button size="sm" className="h-8 px-3" onClick={() => renameSector(i, editingSector.value)}>OK</Button>
                        <button onClick={() => setEditingSector(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700 px-3 py-1.5 bg-slate-50 rounded-lg">{sector}</span>
                        <button onClick={() => setEditingSector({ index: i, value: sector })} className="text-slate-300 hover:text-brand"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removeSector(sector)} className="text-slate-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input value={newSector} onChange={e => setNewSector(e.target.value)} placeholder="New sector..." className="h-8 text-sm" onKeyDown={e => e.key === "Enter" && addSector()} />
                <Button size="sm" onClick={addSector} disabled={!newSector.trim()} className="h-8 shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}