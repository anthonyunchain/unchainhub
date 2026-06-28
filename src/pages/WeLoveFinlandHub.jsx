import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { useConfirm } from "@/lib/confirm";
import {
  Plus, Search, X, ExternalLink, Trash2, Edit2, ChevronDown, ChevronUp,
  CheckSquare, Square, FileText, Link2, Calendar, Users, TrendingUp,
  Film, Star, Package, Zap, MapPin, Phone, Mail, Globe, Upload,
  AlertCircle, Clock, CheckCircle2, Circle, ArrowUpRight, Filter,
  MoreHorizontal, Eye,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isAfter, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const WLF = {
  olive:       "#44503C",
  olive700:    "#353D2D",
  olive500:    "#5A664E",
  olive300:    "#97A082",
  olive100:    "#E7E9DD",
  sage:        "#DADBBE",
  sageDeep:    "#C7CBA6",
  sage100:     "#EDEEE1",
  paper:       "#F4F4EC",
  paper2:      "#FBFBF4",
  paperSunken: "#ECECE0",
  ink:         "#1A1A17",
  ink2:        "#3C3D34",
  ink3:        "#6E6F5E",
  stone:       "#8A8B76",
  border:      "#DEDCCE",
  borderStrong:"#CDCBBA",
  success:     "#3E7A4E",
  warning:     "#B58838",
  danger:      "#A8493C",
};

// ─── PLANS ──────────────────────────────────────────────────────────────────
const PLANS = {
  listing: {
    label: "Listing",
    color: WLF.stone,
    bg: WLF.paperSunken,
    icon: MapPin,
    desc: "Référencé sur le site",
    videosMax: 0,
    contentsMax: 0,
  },
  feature: {
    label: "Feature",
    color: WLF.olive500,
    bg: WLF.olive100,
    icon: Star,
    desc: "Publié sur le site + 1 vidéo sur nos channels",
    videosMax: 1,
    contentsMax: 1,
  },
  visibility: {
    label: "Visibility Pack",
    color: "#5E9EBE",
    bg: "#EAF1F5",
    icon: Film,
    desc: "3 vidéos sur l'année",
    videosMax: 3,
    contentsMax: 3,
  },
  steady: {
    label: "Steady Pack",
    color: WLF.warning,
    bg: "#FBF3E0",
    icon: Package,
    desc: "12 contenus dédiés sur l'année",
    videosMax: 0,
    contentsMax: 12,
  },
  performance: {
    label: "Performance",
    color: WLF.danger,
    bg: "#F9EAE8",
    icon: Zap,
    desc: "18 contenus dédiés sur l'année",
    videosMax: 0,
    contentsMax: 18,
  },
};

const CATEGORIES = ["Restaurant", "Hôtel", "Activité", "Culture", "Shopping", "Transport", "Wellness", "Autre"];
const PRIORITIES = { low: "Basse", medium: "Moyenne", high: "Haute", urgent: "Urgent" };
const DOC_TYPES = { contract: "Contrat", brief: "Brief", report: "Rapport", media: "Média", invoice: "Facture", other: "Autre" };
const STATUS_LABELS = { active: "Actif", inactive: "Inactif", prospect: "Prospect" };

// ─── HELPERS ────────────────────────────────────────────────────────────────
const PlanBadge = ({ plan, size = "sm" }) => {
  const p = PLANS[plan] || PLANS.listing;
  const Icon = p.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: size === "sm" ? "2px 8px" : "4px 12px",
      borderRadius: 99, fontSize: size === "sm" ? 11 : 13,
      fontWeight: 600, fontFamily: "Inter, sans-serif",
      background: p.bg, color: p.color,
    }}>
      <Icon size={size === "sm" ? 10 : 13} />
      {p.label}
    </span>
  );
};

const StatusDot = ({ status }) => {
  const colors = { active: WLF.success, inactive: WLF.stone, prospect: WLF.warning };
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors[status] || WLF.stone }} />
  );
};

const ContentBar = ({ delivered, max, label }) => {
  if (!max) return null;
  const pct = Math.min((delivered / max) * 100, 100);
  const color = pct >= 100 ? WLF.success : pct >= 60 ? WLF.warning : WLF.olive;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: WLF.ink3, fontFamily: "Inter, sans-serif" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: WLF.ink2 }}>{delivered}/{max}</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: WLF.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .3s" }} />
      </div>
    </div>
  );
};

// ─── SUPABASE HELPERS ────────────────────────────────────────────────────────
const db = {
  partners: {
    list: () => supabase.from("wlf_partners").select("*").order("name"),
    create: (d) => supabase.from("wlf_partners").insert(d).select().single(),
    update: (id, d) => supabase.from("wlf_partners").update({ ...d, updated_at: new Date().toISOString() }).eq("id", id).select().single(),
    delete: (id) => supabase.from("wlf_partners").delete().eq("id", id),
  },
  todos: {
    list: () => supabase.from("wlf_todos").select("*").order("created_at", { ascending: false }),
    create: (d) => supabase.from("wlf_todos").insert(d).select().single(),
    update: (id, d) => supabase.from("wlf_todos").update({ ...d, updated_at: new Date().toISOString() }).eq("id", id).select().single(),
    delete: (id) => supabase.from("wlf_todos").delete().eq("id", id),
  },
  docs: {
    list: () => supabase.from("wlf_documents").select("*").order("created_at", { ascending: false }),
    create: (d) => supabase.from("wlf_documents").insert(d).select().single(),
    delete: (id) => supabase.from("wlf_documents").delete().eq("id", id),
  },
};

const useWLF = (key, fn) => useQuery({ queryKey: ["wlf", key], queryFn: async () => { const { data, error } = await fn(); if (error) throw error; return data; } });

// ─── PARTNER FORM ────────────────────────────────────────────────────────────
function PartnerForm({ partner, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!partner?.id;
  const empty = { name: "", category: "", contact_name: "", contact_email: "", contact_phone: "", website: "", plan: "listing", status: "active", notes: "", plan_start_date: "", plan_end_date: "", videos_delivered: 0, contents_delivered: 0 };
  const [form, setForm] = useState(isEdit ? { ...empty, ...partner } : empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    const payload = { ...form };
    if (!payload.plan_start_date) delete payload.plan_start_date;
    if (!payload.plan_end_date) delete payload.plan_end_date;
    const { error } = isEdit ? await db.partners.update(partner.id, payload) : await db.partners.create(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Partenaire mis à jour" : "Partenaire créé");
    qc.invalidateQueries({ queryKey: ["wlf", "partners"] });
    onClose();
  };

  const plan = PLANS[form.plan] || PLANS.listing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "Inter, sans-serif" }}>
      <div style={{ padding: "12px 16px", borderRadius: 8, background: plan.bg, border: `1px solid ${plan.color}22`, display: "flex", alignItems: "center", gap: 10 }}>
        <plan.icon size={16} color={plan.color} />
        <span style={{ fontSize: 13, color: plan.color, fontWeight: 600 }}>{plan.label}</span>
        <span style={{ fontSize: 12, color: WLF.ink3 }}>— {plan.desc}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>Nom du partenaire *</label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Visit Helsinki" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Catégorie</label>
          <Select value={form.category} onValueChange={v => set("category", v)}>
            <SelectTrigger style={inputStyle}><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label style={labelStyle}>Statut</label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>Plan</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
            {Object.entries(PLANS).map(([key, p]) => (
              <button key={key} onClick={() => set("plan", key)} style={{
                padding: "8px 4px", borderRadius: 8, border: `2px solid ${form.plan === key ? p.color : WLF.border}`,
                background: form.plan === key ? p.bg : WLF.paper2, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all .15s",
              }}>
                <p.icon size={14} color={form.plan === key ? p.color : WLF.stone} />
                <span style={{ fontSize: 10, fontWeight: 600, color: form.plan === key ? p.color : WLF.stone, textAlign: "center" }}>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Début du plan</label>
          <Input type="date" value={form.plan_start_date || ""} onChange={e => set("plan_start_date", e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Fin du plan</label>
          <Input type="date" value={form.plan_end_date || ""} onChange={e => set("plan_end_date", e.target.value)} style={inputStyle} />
        </div>

        <div style={{ gridColumn: "1/-1", borderTop: `1px solid ${WLF.border}`, paddingTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: WLF.stone, marginBottom: 12 }}>Contact</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Nom du contact</label>
              <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Prénom Nom" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} placeholder="email@partner.fi" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <Input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} placeholder="+358..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Site web</label>
              <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
          </div>
        </div>

        {(PLANS[form.plan]?.videosMax > 0 || PLANS[form.plan]?.contentsMax > 0) && (
          <div style={{ gridColumn: "1/-1", borderTop: `1px solid ${WLF.border}`, paddingTop: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: WLF.stone, marginBottom: 12 }}>Contenus livrés</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {PLANS[form.plan]?.videosMax > 0 && (
                <div>
                  <label style={labelStyle}>Vidéos livrées (/{PLANS[form.plan].videosMax})</label>
                  <Input type="number" min={0} max={PLANS[form.plan].videosMax} value={form.videos_delivered} onChange={e => set("videos_delivered", parseInt(e.target.value) || 0)} style={inputStyle} />
                </div>
              )}
              {PLANS[form.plan]?.contentsMax > 0 && (
                <div>
                  <label style={labelStyle}>Contenus livrés (/{PLANS[form.plan].contentsMax})</label>
                  <Input type="number" min={0} max={PLANS[form.plan].contentsMax} value={form.contents_delivered} onChange={e => set("contents_delivered", parseInt(e.target.value) || 0)} style={inputStyle} />
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>Notes internes</label>
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Informations utiles, historique..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ ...btnBase, background: WLF.paperSunken, color: WLF.ink2 }}>Annuler</button>
        <button onClick={save} style={{ ...btnBase, background: WLF.olive, color: WLF.paper }}>
          {isEdit ? "Enregistrer" : "Créer le partenaire"}
        </button>
      </div>
    </div>
  );
}

// ─── TODO FORM ────────────────────────────────────────────────────────────────
function TodoForm({ todo, partners, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!todo?.id;
  const empty = { title: "", description: "", priority: "medium", partner_id: todo?.partner_id || "", due_date: "", assigned_to: "" };
  const [form, setForm] = useState(isEdit ? { ...empty, ...todo } : empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    const payload = { ...form };
    if (!payload.partner_id) delete payload.partner_id;
    if (!payload.due_date) delete payload.due_date;
    const { error } = isEdit ? await db.todos.update(todo.id, payload) : await db.todos.create(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Tâche mise à jour" : "Tâche créée");
    qc.invalidateQueries({ queryKey: ["wlf", "todos"] });
    onClose();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "Inter, sans-serif" }}>
      <div>
        <label style={labelStyle}>Titre *</label>
        <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Que faut-il faire ?" style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Partenaire (optionnel)</label>
          <Select value={form.partner_id || "none"} onValueChange={v => set("partner_id", v === "none" ? "" : v)}>
            <SelectTrigger style={inputStyle}><SelectValue placeholder="Général" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Général (aucun)</SelectItem>
              {(partners || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label style={labelStyle}>Priorité</label>
          <Select value={form.priority} onValueChange={v => set("priority", v)}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label style={labelStyle}>Échéance</label>
          <Input type="date" value={form.due_date || ""} onChange={e => set("due_date", e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Assigné à</label>
          <Input value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} placeholder="Nom..." style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Détails..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ ...btnBase, background: WLF.paperSunken, color: WLF.ink2 }}>Annuler</button>
        <button onClick={save} style={{ ...btnBase, background: WLF.olive, color: WLF.paper }}>{isEdit ? "Enregistrer" : "Créer la tâche"}</button>
      </div>
    </div>
  );
}

// ─── DOC FORM ────────────────────────────────────────────────────────────────
function DocForm({ partnerId, partners, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", type: "other", file_url: "", notes: "", partner_id: partnerId || "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    const payload = { ...form };
    if (!payload.partner_id) delete payload.partner_id;
    const { error } = await db.docs.create(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Document ajouté");
    qc.invalidateQueries({ queryKey: ["wlf", "docs"] });
    onClose();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "Inter, sans-serif" }}>
      <div>
        <label style={labelStyle}>Titre *</label>
        <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Nom du document" style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <Select value={form.type} onValueChange={v => set("type", v)}>
            <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label style={labelStyle}>Partenaire</label>
          <Select value={form.partner_id || "none"} onValueChange={v => set("partner_id", v === "none" ? "" : v)}>
            <SelectTrigger style={inputStyle}><SelectValue placeholder="Général" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Général</SelectItem>
              {(partners || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>URL du fichier / lien</label>
        <Input value={form.file_url} onChange={e => set("file_url", e.target.value)} placeholder="https://drive.google.com/..." style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Notes</label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ ...btnBase, background: WLF.paperSunken, color: WLF.ink2 }}>Annuler</button>
        <button onClick={save} style={{ ...btnBase, background: WLF.olive, color: WLF.paper }}>Ajouter</button>
      </div>
    </div>
  );
}

// ─── PARTNER DETAIL ──────────────────────────────────────────────────────────
function PartnerDetail({ partner, todos, docs, onEdit, onClose }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [todoOpen, setTodoOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const partnerTodos = todos.filter(t => t.partner_id === partner.id);
  const partnerDocs = docs.filter(d => d.partner_id === partner.id);
  const plan = PLANS[partner.plan] || PLANS.listing;

  const toggleTodo = async (t) => {
    const next = t.status === "done" ? "todo" : "done";
    await db.todos.update(t.id, { status: next });
    qc.invalidateQueries({ queryKey: ["wlf", "todos"] });
  };

  const deleteTodo = async (id) => {
    const ok = await confirm({ title: "Supprimer cette tâche ?", confirmLabel: "Supprimer", destructive: true });
    if (ok) { await db.todos.delete(id); qc.invalidateQueries({ queryKey: ["wlf", "todos"] }); }
  };

  const deleteDoc = async (id) => {
    const ok = await confirm({ title: "Supprimer ce document ?", confirmLabel: "Supprimer", destructive: true });
    if (ok) { await db.docs.delete(id); qc.invalidateQueries({ queryKey: ["wlf", "docs"] }); }
  };

  const todosDone = partnerTodos.filter(t => t.status === "done").length;
  const prioColors = { urgent: WLF.danger, high: "#D4793A", medium: WLF.warning, low: WLF.stone };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <StatusDot status={partner.status} />
            <span style={{ fontSize: 12, color: WLF.stone }}>{STATUS_LABELS[partner.status]}</span>
            {partner.category && <span style={{ fontSize: 12, color: WLF.stone }}>· {partner.category}</span>}
          </div>
          <h2 style={{ fontFamily: "'Chelsea Market', cursive", fontSize: 24, color: WLF.olive, margin: 0 }}>{partner.name}</h2>
          <div style={{ marginTop: 8 }}><PlanBadge plan={partner.plan} size="md" /></div>
        </div>
        <button onClick={onEdit} style={{ ...btnBase, background: WLF.olive100, color: WLF.olive, fontSize: 13 }}>
          <Edit2 size={14} /> Modifier
        </button>
      </div>

      {/* Content progress */}
      {(plan.videosMax > 0 || plan.contentsMax > 0) && (
        <div style={{ padding: 16, borderRadius: 10, background: WLF.sage100, border: `1px solid ${WLF.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: WLF.stone, marginBottom: 10 }}>Avancement contenus</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plan.videosMax > 0 && <ContentBar delivered={partner.videos_delivered || 0} max={plan.videosMax} label="Vidéos" />}
            {plan.contentsMax > 0 && <ContentBar delivered={partner.contents_delivered || 0} max={plan.contentsMax} label="Contenus" />}
          </div>
        </div>
      )}

      {/* Contact info */}
      {(partner.contact_name || partner.contact_email || partner.contact_phone || partner.website) && (
        <div style={{ padding: 16, borderRadius: 10, background: WLF.paper2, border: `1px solid ${WLF.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: WLF.stone, marginBottom: 10 }}>Contact</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {partner.contact_name && <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: WLF.ink2 }}><Users size={14} color={WLF.stone} />{partner.contact_name}</div>}
            {partner.contact_email && <a href={`mailto:${partner.contact_email}`} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: WLF.olive, textDecoration: "none" }}><Mail size={14} />{partner.contact_email}</a>}
            {partner.contact_phone && <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: WLF.ink2 }}><Phone size={14} color={WLF.stone} />{partner.contact_phone}</div>}
            {partner.website && <a href={partner.website} target="_blank" rel="noreferrer" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: WLF.olive, textDecoration: "none" }}><Globe size={14} />{partner.website} <ExternalLink size={11} /></a>}
          </div>
        </div>
      )}

      {/* Dates */}
      {(partner.plan_start_date || partner.plan_end_date) && (
        <div style={{ display: "flex", gap: 12 }}>
          {partner.plan_start_date && <div style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: WLF.paper2, border: `1px solid ${WLF.border}` }}>
            <p style={{ fontSize: 11, color: WLF.stone, marginBottom: 2 }}>Début</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: WLF.ink }}>{format(parseISO(partner.plan_start_date), "d MMM yyyy", { locale: fr })}</p>
          </div>}
          {partner.plan_end_date && <div style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: WLF.paper2, border: `1px solid ${WLF.border}` }}>
            <p style={{ fontSize: 11, color: WLF.stone, marginBottom: 2 }}>Fin</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: isAfter(new Date(), parseISO(partner.plan_end_date)) ? WLF.danger : WLF.ink }}>
              {format(parseISO(partner.plan_end_date), "d MMM yyyy", { locale: fr })}
            </p>
          </div>}
        </div>
      )}

      {/* Notes */}
      {partner.notes && (
        <div style={{ padding: 14, borderRadius: 8, background: WLF.olive100, border: `1px solid ${WLF.olive300}33`, fontSize: 14, color: WLF.ink2, lineHeight: 1.6 }}>
          {partner.notes}
        </div>
      )}

      {/* Todos */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: WLF.ink }}>Tâches <span style={{ color: WLF.stone, fontWeight: 400 }}>({todosDone}/{partnerTodos.length})</span></p>
          <button onClick={() => setTodoOpen(true)} style={{ ...btnBase, padding: "4px 10px", fontSize: 12, background: WLF.olive100, color: WLF.olive }}>
            <Plus size={12} /> Ajouter
          </button>
        </div>
        {partnerTodos.length === 0 ? (
          <p style={{ fontSize: 13, color: WLF.stone, padding: "12px 0" }}>Aucune tâche pour ce partenaire</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {partnerTodos.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, background: t.status === "done" ? WLF.paperSunken : WLF.paper2, border: `1px solid ${WLF.border}`, opacity: t.status === "done" ? 0.65 : 1 }}>
                <button onClick={() => toggleTodo(t)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1 }}>
                  {t.status === "done" ? <CheckCircle2 size={16} color={WLF.success} /> : <Circle size={16} color={WLF.border} />}
                </button>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: WLF.ink, fontWeight: 500, textDecoration: t.status === "done" ? "line-through" : "none", margin: 0 }}>{t.title}</p>
                  {t.description && <p style={{ fontSize: 12, color: WLF.ink3, margin: "2px 0 0" }}>{t.description}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                    {t.priority !== "medium" && <span style={{ fontSize: 10, fontWeight: 700, color: prioColors[t.priority], textTransform: "uppercase" }}>{PRIORITIES[t.priority]}</span>}
                    {t.due_date && <span style={{ fontSize: 11, color: isAfter(new Date(), parseISO(t.due_date)) ? WLF.danger : WLF.stone }}>
                      <Calendar size={10} style={{ display: "inline", marginRight: 3 }} />
                      {format(parseISO(t.due_date), "d MMM", { locale: fr })}
                    </span>}
                    {t.assigned_to && <span style={{ fontSize: 11, color: WLF.stone }}>→ {t.assigned_to}</span>}
                  </div>
                </div>
                <button onClick={() => deleteTodo(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: WLF.stone, padding: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: WLF.ink }}>Documents <span style={{ color: WLF.stone, fontWeight: 400 }}>({partnerDocs.length})</span></p>
          <button onClick={() => setDocOpen(true)} style={{ ...btnBase, padding: "4px 10px", fontSize: 12, background: WLF.olive100, color: WLF.olive }}>
            <Plus size={12} /> Ajouter
          </button>
        </div>
        {partnerDocs.length === 0 ? (
          <p style={{ fontSize: 13, color: WLF.stone, padding: "12px 0" }}>Aucun document</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {partnerDocs.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: WLF.paper2, border: `1px solid ${WLF.border}` }}>
                <FileText size={15} color={WLF.stone} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: WLF.ink, margin: 0 }}>{d.title}</p>
                  <span style={{ fontSize: 11, color: WLF.stone }}>{DOC_TYPES[d.type] || d.type}</span>
                </div>
                {d.file_url && (
                  <a href={d.file_url} target="_blank" rel="noreferrer" style={{ color: WLF.olive, display: "flex" }}>
                    <ExternalLink size={14} />
                  </a>
                )}
                <button onClick={() => deleteDoc(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: WLF.stone, padding: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-dialogs */}
      <Dialog open={todoOpen} onOpenChange={setTodoOpen}>
        <DialogContent style={{ background: WLF.paper, border: `1px solid ${WLF.border}`, maxWidth: 520 }}>
          <DialogHeader><DialogTitle style={{ fontFamily: "'Chelsea Market', cursive", color: WLF.olive }}>Nouvelle tâche</DialogTitle></DialogHeader>
          <TodoForm partners={[]} todo={{ partner_id: partner.id }} onClose={() => setTodoOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent style={{ background: WLF.paper, border: `1px solid ${WLF.border}`, maxWidth: 520 }}>
          <DialogHeader><DialogTitle style={{ fontFamily: "'Chelsea Market', cursive", color: WLF.olive }}>Ajouter un document</DialogTitle></DialogHeader>
          <DocForm partnerId={partner.id} partners={[]} onClose={() => setDocOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function WeLoveFinlandHub() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: partners = [], isLoading: loadingP } = useWLF("partners", db.partners.list);
  const { data: todos = [], isLoading: loadingT } = useWLF("todos", db.todos.list);
  const { data: docs = [], isLoading: loadingD } = useWLF("docs", db.docs.list);

  const [tab, setTab] = useState("partners"); // partners | todos | docs
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [partnerForm, setPartnerForm] = useState(null); // null | {} | partner
  const [todoForm, setTodoForm] = useState(null);
  const [docForm, setDocForm] = useState(false);
  const [detailPartner, setDetailPartner] = useState(null);

  // Stats
  const stats = useMemo(() => {
    const active = partners.filter(p => p.status === "active");
    const byPlan = Object.fromEntries(Object.keys(PLANS).map(k => [k, partners.filter(p => p.plan === k).length]));
    const todosOpen = todos.filter(t => t.status !== "done").length;
    const todosUrgent = todos.filter(t => t.priority === "urgent" && t.status !== "done").length;
    return { total: partners.length, active: active.length, byPlan, todosOpen, todosUrgent };
  }, [partners, todos]);

  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      if (filterPlan !== "all" && p.plan !== filterPlan) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [partners, filterPlan, filterStatus, search]);

  const filteredTodos = useMemo(() => {
    return todos.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      const prioOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
    });
  }, [todos, search]);

  const deletePartner = async (id) => {
    const ok = await confirm({ title: "Supprimer ce partenaire ?", description: "Ses tâches et documents seront aussi supprimés.", confirmLabel: "Supprimer", destructive: true });
    if (!ok) return;
    await db.partners.delete(id);
    qc.invalidateQueries({ queryKey: ["wlf", "partners"] });
    toast.success("Partenaire supprimé");
  };

  const toggleTodo = async (t) => {
    const next = t.status === "done" ? "todo" : "done";
    await db.todos.update(t.id, { status: next });
    qc.invalidateQueries({ queryKey: ["wlf", "todos"] });
  };

  const prioColors = { urgent: WLF.danger, high: "#D4793A", medium: WLF.warning, low: WLF.stone };

  const partnerName = (id) => partners.find(p => p.id === id)?.name || null;

  return (
    <div data-portal-brand="welovefinland" style={{ minHeight: "100vh", background: WLF.paper, fontFamily: "Inter, sans-serif" }}>

      {/* ── HEADER BAND ── */}
      <div style={{ background: WLF.olive, padding: "28px 32px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", maxWidth: 1200, margin: "0 auto" }}>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: WLF.olive300, marginBottom: 4 }}>Admin Hub</p>
            <h1 style={{ fontFamily: "'Chelsea Market', cursive", fontSize: 36, color: WLF.paper, margin: 0, lineHeight: 1 }}>We Love Finland</h1>
            <p style={{ color: WLF.olive300, fontSize: 14, marginTop: 6, fontFamily: "Inter, sans-serif" }}>Gestion des partenaires & contenus</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setTodoForm({}); }}
              style={{ ...btnBase, background: "rgba(255,255,255,0.12)", color: WLF.paper, borderColor: "rgba(255,255,255,0.2)", border: "1px solid" }}
            >
              <CheckSquare size={14} /> Tâche
            </button>
            <button
              onClick={() => setPartnerForm({})}
              style={{ ...btnBase, background: WLF.paper, color: WLF.olive, fontWeight: 700 }}
            >
              <Plus size={14} /> Partenaire
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ maxWidth: 1200, margin: "20px auto 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Partenaires", value: stats.total, sub: `${stats.active} actifs` },
            ...Object.entries(PLANS).map(([k, p]) => ({ label: p.label, value: stats.byPlan[k] || 0, icon: p.icon, color: p.color })),
            { label: "Tâches ouvertes", value: stats.todosOpen, sub: stats.todosUrgent > 0 ? `${stats.todosUrgent} urgentes` : null, urgent: stats.todosUrgent > 0 },
          ].map((s, i) => (
            <div key={i} style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", minWidth: 100 }}>
              <p style={{ fontSize: 22, fontFamily: "'Chelsea Market', cursive", color: WLF.paper, margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: WLF.olive300, marginTop: 2 }}>{s.label}</p>
              {s.sub && <p style={{ fontSize: 10, color: s.urgent ? "#F4A0A0" : WLF.olive300, marginTop: 1 }}>{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── SAGE TAB BAR ── */}
      <div style={{ background: WLF.sage, borderBottom: `1px solid ${WLF.sageDeep}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", gap: 0 }}>
          {[
            { key: "partners", label: "Partenaires", icon: Users },
            { key: "todos", label: "To-do", icon: CheckSquare },
            { key: "docs", label: "Documents", icon: FileText },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "12px 20px",
              border: "none", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif",
              fontSize: 14, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? WLF.olive : WLF.ink3,
              borderBottom: `2px solid ${tab === t.key ? WLF.olive : "transparent"}`,
              transition: "all .15s",
            }}>
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>

        {/* Search + filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: WLF.stone }} />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={tab === "partners" ? "Chercher un partenaire..." : "Chercher..."}
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>
          {tab === "partners" && (
            <>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger style={{ ...inputStyle, width: 160 }}><SelectValue placeholder="Tous les plans" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les plans</SelectItem>
                  {Object.entries(PLANS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger style={{ ...inputStyle, width: 130 }}><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {tab === "todos" && (
            <button onClick={() => setTodoForm({})} style={{ ...btnBase, background: WLF.olive, color: WLF.paper }}>
              <Plus size={14} /> Nouvelle tâche
            </button>
          )}
          {tab === "docs" && (
            <button onClick={() => setDocForm(true)} style={{ ...btnBase, background: WLF.olive, color: WLF.paper }}>
              <Plus size={14} /> Ajouter document
            </button>
          )}
        </div>

        {/* ── PARTNERS TAB ── */}
        {tab === "partners" && (
          <div>
            {loadingP ? (
              <div style={{ textAlign: "center", padding: 48, color: WLF.stone }}>Chargement...</div>
            ) : filteredPartners.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <Users size={36} color={WLF.border} style={{ margin: "0 auto 12px" }} />
                <p style={{ color: WLF.stone, fontSize: 15 }}>Aucun partenaire trouvé</p>
                <button onClick={() => setPartnerForm({})} style={{ ...btnBase, background: WLF.olive, color: WLF.paper, marginTop: 16 }}>
                  <Plus size={14} /> Ajouter un partenaire
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {filteredPartners.map(p => {
                  const plan = PLANS[p.plan] || PLANS.listing;
                  const PIcon = plan.icon;
                  const partnerTodos = todos.filter(t => t.partner_id === p.id && t.status !== "done");
                  const partnerDocs = docs.filter(d => d.partner_id === p.id);
                  const isExpired = p.plan_end_date && isAfter(new Date(), parseISO(p.plan_end_date));
                  return (
                    <div key={p.id} style={{
                      borderRadius: 12, background: WLF.paper2, border: `1px solid ${WLF.border}`,
                      overflow: "hidden", transition: "box-shadow .15s", cursor: "default",
                    }}>
                      {/* Plan color strip */}
                      <div style={{ height: 4, background: plan.color }} />
                      <div style={{ padding: 18 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <StatusDot status={p.status} />
                              <span style={{ fontSize: 11, color: WLF.stone }}>{STATUS_LABELS[p.status]}</span>
                              {p.category && <span style={{ fontSize: 11, color: WLF.stone }}>· {p.category}</span>}
                            </div>
                            <h3 style={{ fontFamily: "'Chelsea Market', cursive", fontSize: 18, color: WLF.olive, margin: 0 }}>{p.name}</h3>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setDetailPartner(p)} style={{ ...iconBtn }}><Eye size={14} /></button>
                            <button onClick={() => setPartnerForm(p)} style={{ ...iconBtn }}><Edit2 size={14} /></button>
                            <button onClick={() => deletePartner(p.id)} style={{ ...iconBtn, color: WLF.danger }}><Trash2 size={14} /></button>
                          </div>
                        </div>

                        <PlanBadge plan={p.plan} />

                        {isExpired && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 12, color: WLF.danger }}>
                            <AlertCircle size={13} /> Plan expiré
                          </div>
                        )}

                        {(plan.videosMax > 0 || plan.contentsMax > 0) && (
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                            {plan.videosMax > 0 && <ContentBar delivered={p.videos_delivered || 0} max={plan.videosMax} label="Vidéos" />}
                            {plan.contentsMax > 0 && <ContentBar delivered={p.contents_delivered || 0} max={plan.contentsMax} label="Contenus" />}
                          </div>
                        )}

                        {(p.contact_email || p.contact_phone) && (
                          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                            {p.contact_email && <a href={`mailto:${p.contact_email}`} style={{ color: WLF.stone, display: "flex", alignItems: "center", gap: 4, fontSize: 12, textDecoration: "none" }}>
                              <Mail size={12} />{p.contact_name || p.contact_email}
                            </a>}
                          </div>
                        )}

                        {/* Footer chips */}
                        <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${WLF.border}` }}>
                          {partnerTodos.length > 0 && (
                            <span style={{ fontSize: 11, color: WLF.warning, display: "flex", alignItems: "center", gap: 3 }}>
                              <Clock size={11} />{partnerTodos.length} tâche{partnerTodos.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {partnerDocs.length > 0 && (
                            <span style={{ fontSize: 11, color: WLF.stone, display: "flex", alignItems: "center", gap: 3 }}>
                              <FileText size={11} />{partnerDocs.length} doc{partnerDocs.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {p.website && (
                            <a href={p.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: WLF.stone, display: "flex", alignItems: "center", gap: 3, textDecoration: "none", marginLeft: "auto" }}>
                              <Globe size={11} /> Site <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TODOS TAB ── */}
        {tab === "todos" && (
          <div>
            {loadingT ? (
              <div style={{ textAlign: "center", padding: 48, color: WLF.stone }}>Chargement...</div>
            ) : filteredTodos.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <CheckSquare size={36} color={WLF.border} style={{ margin: "0 auto 12px" }} />
                <p style={{ color: WLF.stone, fontSize: 15 }}>Aucune tâche</p>
                <button onClick={() => setTodoForm({})} style={{ ...btnBase, background: WLF.olive, color: WLF.paper, marginTop: 16 }}>
                  <Plus size={14} /> Créer une tâche
                </button>
              </div>
            ) : (
              <div>
                {/* Group: open */}
                {["urgent", "high", "medium", "low"].map(prio => {
                  const group = filteredTodos.filter(t => t.priority === prio && t.status !== "done");
                  if (!group.length) return null;
                  return (
                    <div key={prio} style={{ marginBottom: 24 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: prioColors[prio], marginBottom: 8 }}>
                        {PRIORITIES[prio]}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {group.map(t => (
                          <TodoRow key={t.id} t={t} onToggle={() => toggleTodo(t)} onEdit={() => setTodoForm(t)} partnerName={partnerName(t.partner_id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Done */}
                {(() => {
                  const done = filteredTodos.filter(t => t.status === "done");
                  if (!done.length) return null;
                  return (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, color: WLF.stone, marginBottom: 8 }}>Terminées ({done.length})</summary>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                        {done.map(t => <TodoRow key={t.id} t={t} onToggle={() => toggleTodo(t)} onEdit={() => setTodoForm(t)} partnerName={partnerName(t.partner_id)} />)}
                      </div>
                    </details>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── DOCS TAB ── */}
        {tab === "docs" && (
          <div>
            {loadingD ? (
              <div style={{ textAlign: "center", padding: 48, color: WLF.stone }}>Chargement...</div>
            ) : docs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <FileText size={36} color={WLF.border} style={{ margin: "0 auto 12px" }} />
                <p style={{ color: WLF.stone }}>Aucun document</p>
                <button onClick={() => setDocForm(true)} style={{ ...btnBase, background: WLF.olive, color: WLF.paper, marginTop: 16 }}>
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {docs.map(d => {
                  const pName = d.partner_id ? partnerName(d.partner_id) : null;
                  return (
                    <div key={d.id} style={{ padding: 16, borderRadius: 10, background: WLF.paper2, border: `1px solid ${WLF.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <FileText size={16} color={WLF.olive300} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: WLF.ink, margin: 0 }}>{d.title}</p>
                          <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 99, background: WLF.paperSunken, color: WLF.stone }}>{DOC_TYPES[d.type] || d.type}</span>
                            {pName && <span style={{ fontSize: 11, color: WLF.olive500 }}>{pName}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" style={{ color: WLF.olive, display: "flex" }}><ExternalLink size={14} /></a>}
                          <button onClick={async () => {
                            const ok = await confirm({ title: "Supprimer ?", confirmLabel: "Supprimer", destructive: true });
                            if (ok) { await db.docs.delete(d.id); qc.invalidateQueries({ queryKey: ["wlf", "docs"] }); }
                          }} style={{ background: "none", border: "none", cursor: "pointer", color: WLF.stone }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {d.notes && <p style={{ fontSize: 12, color: WLF.ink3, margin: 0 }}>{d.notes}</p>}
                      <p style={{ fontSize: 11, color: WLF.stone, margin: 0 }}>{format(new Date(d.created_at), "d MMM yyyy", { locale: fr })}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DIALOGS ── */}
      <Dialog open={!!partnerForm} onOpenChange={v => !v && setPartnerForm(null)}>
        <DialogContent style={{ background: WLF.paper, border: `1px solid ${WLF.border}`, maxWidth: 600 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Chelsea Market', cursive", color: WLF.olive, fontSize: 22 }}>
              {partnerForm?.id ? "Modifier le partenaire" : "Nouveau partenaire"}
            </DialogTitle>
          </DialogHeader>
          {partnerForm && <PartnerForm partner={partnerForm?.id ? partnerForm : null} onClose={() => setPartnerForm(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!todoForm} onOpenChange={v => !v && setTodoForm(null)}>
        <DialogContent style={{ background: WLF.paper, border: `1px solid ${WLF.border}`, maxWidth: 520 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Chelsea Market', cursive", color: WLF.olive, fontSize: 22 }}>
              {todoForm?.id ? "Modifier la tâche" : "Nouvelle tâche"}
            </DialogTitle>
          </DialogHeader>
          {todoForm !== null && <TodoForm todo={todoForm?.id ? todoForm : {}} partners={partners} onClose={() => setTodoForm(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={docForm} onOpenChange={setDocForm}>
        <DialogContent style={{ background: WLF.paper, border: `1px solid ${WLF.border}`, maxWidth: 520 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Chelsea Market', cursive", color: WLF.olive, fontSize: 22 }}>Ajouter un document</DialogTitle>
          </DialogHeader>
          <DocForm partners={partners} onClose={() => setDocForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailPartner} onOpenChange={v => !v && setDetailPartner(null)}>
        <DialogContent style={{ background: WLF.paper, border: `1px solid ${WLF.border}`, maxWidth: 580, maxHeight: "90vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Chelsea Market', cursive", color: WLF.olive, fontSize: 22 }}>Fiche partenaire</DialogTitle>
          </DialogHeader>
          {detailPartner && (
            <PartnerDetail
              partner={detailPartner}
              todos={todos}
              docs={docs}
              onEdit={() => { setPartnerForm(detailPartner); setDetailPartner(null); }}
              onClose={() => setDetailPartner(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TODO ROW ────────────────────────────────────────────────────────────────
function TodoRow({ t, onToggle, onEdit, partnerName }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const prioColors = { urgent: WLF.danger, high: "#D4793A", medium: WLF.warning, low: WLF.stone };

  const deleteTodo = async () => {
    const ok = await confirm({ title: "Supprimer ?", confirmLabel: "Supprimer", destructive: true });
    if (ok) { await db.todos.delete(t.id); qc.invalidateQueries({ queryKey: ["wlf", "todos"] }); }
  };

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
      borderRadius: 8, background: t.status === "done" ? WLF.paperSunken : WLF.paper2,
      border: `1px solid ${WLF.border}`, opacity: t.status === "done" ? 0.6 : 1,
    }}>
      <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}>
        {t.status === "done" ? <CheckCircle2 size={17} color={WLF.success} /> : <Circle size={17} color={WLF.border} />}
      </button>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: WLF.ink, textDecoration: t.status === "done" ? "line-through" : "none", margin: 0 }}>{t.title}</p>
        {t.description && <p style={{ fontSize: 12, color: WLF.ink3, margin: "2px 0 0" }}>{t.description}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 5, alignItems: "center" }}>
          {partnerName && <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 99, background: WLF.olive100, color: WLF.olive500 }}>{partnerName}</span>}
          {t.due_date && <span style={{ fontSize: 11, color: isAfter(new Date(), parseISO(t.due_date)) && t.status !== "done" ? WLF.danger : WLF.stone, display: "flex", alignItems: "center", gap: 3 }}>
            <Calendar size={10} />{format(parseISO(t.due_date), "d MMM", { locale: fr })}
          </span>}
          {t.assigned_to && <span style={{ fontSize: 11, color: WLF.stone }}>→ {t.assigned_to}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={onEdit} style={{ ...iconBtn }}><Edit2 size={13} /></button>
        <button onClick={deleteTodo} style={{ ...iconBtn, color: WLF.danger }}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600, color: WLF.ink3,
  marginBottom: 5, fontFamily: "Inter, sans-serif",
};
const inputStyle = {
  background: WLF.paper2, border: `1px solid ${WLF.borderStrong}`, borderRadius: 8,
  fontSize: 14, color: WLF.ink, fontFamily: "Inter, sans-serif",
};
const btnBase = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
  fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
  transition: "opacity .15s",
};
const iconBtn = {
  background: "none", border: "none", cursor: "pointer",
  color: WLF.stone, padding: 4, borderRadius: 6, display: "flex", alignItems: "center",
};
