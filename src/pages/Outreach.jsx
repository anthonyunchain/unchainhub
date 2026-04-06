import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import StatusBadge from "../components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Bell, MessageSquare, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";

export default function Outreach() {
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [logData, setLogData] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const qc = useQueryClient();

  const { data: logs = [] } = useQuery({ queryKey: ["contact-logs"], queryFn: () => base44.entities.ContactLog.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => base44.entities.Template.list() });
  const { data: prospects = [] } = useQuery({ queryKey: ["prospects"], queryFn: () => base44.entities.Prospect.list() });

  const createLogMut = useMutation({ mutationFn: (d) => base44.entities.ContactLog.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact-logs"] }); setLogDialogOpen(false); } });
  const createTemplateMut = useMutation({ mutationFn: (d) => base44.entities.Template.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); setTemplateDialogOpen(false); } });
  const deleteTemplateMut = useMutation({ mutationFn: (id) => base44.entities.Template.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }) });

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setCsvResult(null);
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { setCsvImporting(false); return; }

    // Detect separator (comma or semicolon)
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

    const getField = (row, ...keys) => {
      for (const k of keys) {
        const idx = headers.findIndex(h => h.includes(k));
        if (idx !== -1 && row[idx]) return row[idx].trim().replace(/^["']|["']$/g, "");
      }
      return "";
    };

    const STAGE_MAP = { "identifié": "Identifié", "contacté": "Contacté", "réunion": "Réunion", "proposition": "Proposition", "négociation": "Négociation", "signé": "Signé", "perdu": "Perdu" };
    const SECTOR_MAP = { "f&b": "F&B", "food": "F&B", "wellness": "Wellness", "tourism": "Tourism", "tourisme": "Tourism" };
    const CITY_MAP = { "tampere": "Tampere", "helsinki": "Helsinki", "lapland": "Lapland" };

    let created = 0, errors = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(sep);
      const company = getField(row, "company", "entreprise", "société", "organization");
      if (!company) { errors++; continue; }

      const rawStage = getField(row, "stage", "étape", "statut", "status").toLowerCase();
      const rawSector = getField(row, "sector", "secteur", "industrie").toLowerCase();
      const rawCity = getField(row, "city", "ville", "location", "localisation").toLowerCase();

      const prospect = {
        company_name: company,
        contact_name: getField(row, "contact", "nom", "name", "prénom"),
        contact_email: getField(row, "email", "mail", "courriel"),
        contact_phone: getField(row, "phone", "tel", "téléphone", "mobile"),
        city: CITY_MAP[rawCity] || (rawCity ? "Other" : ""),
        sector: SECTOR_MAP[rawSector] || (rawSector ? "Other" : ""),
        stage: STAGE_MAP[rawStage] || "Identifié",
        notes: getField(row, "notes", "note", "remarque"),
      };
      try {
        await base44.entities.Prospect.create(prospect);
        created++;
      } catch { errors++; }
    }
    qc.invalidateQueries({ queryKey: ["prospects"] });
    setCsvResult({ created, errors });
    setCsvImporting(false);
    e.target.value = "";
  };

  const reminders = logs.filter(l => l.follow_up_date && (isPast(new Date(l.follow_up_date)) || isToday(new Date(l.follow_up_date))));

  const openNewLog = () => {
    setLogData({ prospect_id: "", prospect_name: "", date: format(new Date(), "yyyy-MM-dd"), channel: "Email", outcome: "Répondu", notes: "", follow_up_date: "" });
    setLogDialogOpen(true);
  };

  const openNewTemplate = () => {
    setTemplateData({ name: "", type: "Email", sector: "Tous", subject: "", body: "" });
    setTemplateDialogOpen(true);
  };

  const messageTemplates = templates.filter(t => t.type === "Email" || t.type === "Message");

  return (
    <div>
      <PageHeader title="Prospection" subtitle="Suivi des contacts et modèles">
        <label className={`cursor-pointer inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors font-medium text-slate-700 ${csvImporting ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="w-4 h-4" />
          {csvImporting ? "Import en cours..." : "Importer CSV"}
          <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
        </label>
        <Button onClick={openNewLog} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> Nouveau contact
        </Button>
      </PageHeader>

      {csvResult && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm font-medium ${csvResult.errors === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
          {csvResult.errors === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {csvResult.created} prospect{csvResult.created > 1 ? "s" : ""} importé{csvResult.created > 1 ? "s" : ""}
          {csvResult.errors > 0 && ` · ${csvResult.errors} ligne${csvResult.errors > 1 ? "s" : ""} ignorée${csvResult.errors > 1 ? "s" : ""} (nom manquant)`}
          <button onClick={() => setCsvResult(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Relances à faire ({reminders.length})</span>
          </div>
          <div className="space-y-1.5">
            {reminders.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{r.prospect_name}</span>
                <span className="text-xs text-amber-600">{r.follow_up_date ? format(new Date(r.follow_up_date), "d MMM", { locale: fr }) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="logs">
        <TabsList className="mb-6"><TabsTrigger value="logs">Journal de contacts</TabsTrigger><TabsTrigger value="templates">Modèles</TabsTrigger></TabsList>

        <TabsContent value="logs">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Prospect</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Canal</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Résultat</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Relance</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Notes</th>
                </tr></thead>
                <tbody>
                  {logs.sort((a, b) => new Date(b.date) - new Date(a.date)).map(l => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-3 text-sm font-medium text-slate-800">{l.prospect_name}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{l.date ? format(new Date(l.date), "d MMM yyyy", { locale: fr }) : ""}</td>
                      <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{l.channel}</span></td>
                      <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{l.outcome}</span></td>
                      <td className="px-5 py-3 text-sm text-slate-500">{l.follow_up_date ? format(new Date(l.follow_up_date), "d MMM", { locale: fr }) : "—"}</td>
                      <td className="px-5 py-3 text-sm text-slate-400 max-w-[200px] truncate">{l.notes || "—"}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Aucun contact enregistré</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="flex justify-end mb-4">
            <Button onClick={openNewTemplate} variant="outline" className="h-9"><Plus className="w-4 h-4 mr-1" /> Nouveau modèle</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messageTemplates.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-800">{t.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{t.sector}</span>
                    <button onClick={() => deleteTemplateMut.mutate(t.id)} className="text-red-400 hover:text-red-600 text-xs">×</button>
                  </div>
                </div>
                {t.subject && <p className="text-xs text-slate-500 mt-2">Objet: {t.subject}</p>}
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{t.body}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Contact Log Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
          {logData && (
            <div className="space-y-4 mt-2">
              <div><Label>Prospect</Label>
                <Select value={logData.prospect_id} onValueChange={v => { const p = prospects.find(pp => pp.id === v); setLogData({ ...logData, prospect_id: v, prospect_name: p?.company_name || "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>{prospects.map(p => <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={logData.date} onChange={e => setLogData({ ...logData, date: e.target.value })} /></div>
                <div><Label>Canal</Label>
                  <Select value={logData.channel} onValueChange={v => setLogData({ ...logData, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Email">Email</SelectItem><SelectItem value="Téléphone">Téléphone</SelectItem><SelectItem value="En personne">En personne</SelectItem><SelectItem value="LinkedIn">LinkedIn</SelectItem><SelectItem value="Instagram">Instagram</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Résultat</Label>
                  <Select value={logData.outcome} onValueChange={v => setLogData({ ...logData, outcome: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Répondu">Répondu</SelectItem><SelectItem value="Pas de réponse">Pas de réponse</SelectItem><SelectItem value="Intéressé">Intéressé</SelectItem><SelectItem value="Refusé">Refusé</SelectItem><SelectItem value="Rendez-vous fixé">Rendez-vous fixé</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Date de relance</Label><Input type="date" value={logData.follow_up_date || ""} onChange={e => setLogData({ ...logData, follow_up_date: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={logData.notes || ""} onChange={e => setLogData({ ...logData, notes: e.target.value })} rows={3} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setLogDialogOpen(false)}>Annuler</Button>
                <Button onClick={() => createLogMut.mutate(logData)} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!logData.prospect_id}>Enregistrer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau modèle</DialogTitle></DialogHeader>
          {templateData && (
            <div className="space-y-4 mt-2">
              <div><Label>Nom</Label><Input value={templateData.name} onChange={e => setTemplateData({ ...templateData, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={templateData.type} onValueChange={v => setTemplateData({ ...templateData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Email">Email</SelectItem><SelectItem value="Message">Message</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Secteur</Label>
                  <Select value={templateData.sector} onValueChange={v => setTemplateData({ ...templateData, sector: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Tous">Tous</SelectItem><SelectItem value="F&B">F&B</SelectItem><SelectItem value="Wellness">Wellness</SelectItem><SelectItem value="Tourism">Tourism</SelectItem><SelectItem value="Other">Autre</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div><Label>Objet</Label><Input value={templateData.subject || ""} onChange={e => setTemplateData({ ...templateData, subject: e.target.value })} /></div>
              <div><Label>Corps du message</Label><Textarea value={templateData.body || ""} onChange={e => setTemplateData({ ...templateData, body: e.target.value })} rows={6} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Annuler</Button>
                <Button onClick={() => createTemplateMut.mutate(templateData)} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!templateData.name}>Enregistrer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}