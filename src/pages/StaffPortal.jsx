import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChefHat, ClipboardList, Croissant, LogOut, Send, History, CheckCircle2,
  Clock, FileText, Image as ImageIcon, CalendarClock, Flame, ChevronDown, ChevronRight,
  Download, FolderOpen
} from "lucide-react";
import FileDropzone from "@/components/shared/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";

const ACCEPT = "application/pdf,image/*";

const MENU_STATUS_META = {
  received:    { label: "Received",    color: 'var(--warning-text)', bg: 'var(--warning-bg)', icon: Clock },
  transmitted: { label: "Transmitted", color: 'var(--brand)',        bg: 'var(--brand-muted)', icon: Send },
  published:   { label: "Published",   color: 'var(--success-text)', bg: 'var(--success-bg)', icon: CheckCircle2 },
  archived:    { label: "Archived",    color: 'var(--muted)',        bg: 'var(--divider)',    icon: FileText },
};

const REQUEST_STATUS_META = {
  received:    { label: "Received",    color: 'var(--warning-text)', bg: 'var(--warning-bg)', icon: Clock },
  in_progress: { label: "In progress", color: 'var(--brand)',        bg: 'var(--brand-muted)', icon: Send },
  completed:   { label: "Completed",   color: 'var(--success-text)', bg: 'var(--success-bg)', icon: CheckCircle2 },
  archived:    { label: "Archived",    color: 'var(--muted)',        bg: 'var(--divider)',    icon: FileText },
};

const IMPORTANCE_META = {
  low:    { label: "Low",    color: '#64748b', bg: '#f1f5f9' },
  medium: { label: "Medium", color: '#b45309', bg: '#fef3c7' },
  high:   { label: "High",   color: '#c2410c', bg: '#ffedd5' },
  urgent: { label: "Urgent", color: '#b91c1c', bg: '#fee2e2' },
};

const ROLES = [
  { id: "chef",    label: "Chef",           icon: ChefHat,       tagline: "Send your monthly menu" },
  { id: "manager", label: "Manager",        icon: ClipboardList, tagline: "Request a label, info or asset" },
  { id: "pastry",  label: "Bread & Pastry", icon: Croissant,     tagline: "Announce a new product or photo need" },
];

export default function StaffPortal() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState("chef");

  // Chef (menu)
  const [menuTitle, setMenuTitle]   = useState("");
  const [menuPeriod, setMenuPeriod] = useState("");
  const [menuNotes, setMenuNotes]   = useState("");
  const [menuFiles, setMenuFiles]   = useState([]);

  // Manager
  const [mgrTitle, setMgrTitle]             = useState("");
  const [mgrDescription, setMgrDescription] = useState("");
  const [mgrDeadline, setMgrDeadline]       = useState("");
  const [mgrImportance, setMgrImportance]   = useState("medium");
  const [mgrFiles, setMgrFiles]             = useState([]);

  // Pastry / baker chef
  const [pasTitle, setPasTitle]             = useState("");
  const [pasDescription, setPasDescription] = useState("");
  const [pasDeadline, setPasDeadline]       = useState("");
  const [pasFiles, setPasFiles]             = useState([]);

  const [submitting, setSubmitting] = useState(false);

  // History (per role)
  const [menuSubs, setMenuSubs]     = useState([]);
  const [mgrSubs, setMgrSubs]       = useState([]);
  const [pasSubs, setPasSubs]       = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docSignedUrls, setDocSignedUrls] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        setUser(authUser);

        const { data: clientRow } = await supabase
          .from("clients")
          .select("id, company_name, staff_roles")
          .eq("staff_user_id", authUser.id)
          .maybeSingle();

        setClient(clientRow || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadHistory = async (clientId) => {
    if (!clientId) return;
    setLoadingList(true);
    const [menus, managers, pastry] = await Promise.all([
      supabase.from("menu_submissions")
        .select("id, title, period, notes, files, status, created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("manager_requests")
        .select("id, title, description, deadline, importance, files, status, created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("pastry_chef_requests")
        .select("id, title, description, deadline, files, status, created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    setMenuSubs(menus.data || []);
    setMgrSubs(managers.data || []);
    setPasSubs(pastry.data || []);
    setLoadingList(false);
  };

  useEffect(() => {
    if (client?.id) loadHistory(client.id);
  }, [client?.id]);

  const loadDocs = async (clientId) => {
    if (!clientId) return;
    setDocsLoading(true);
    const { data } = await supabase
      .from("client_documents")
      .select("id, title, files, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setDocsLoading(false);
  };

  useEffect(() => {
    if (client?.id) loadDocs(client.id);
  }, [client?.id]);

  const openDocFile = async (path) => {
    try {
      const cached = docSignedUrls[path];
      if (cached) { window.open(cached, "_blank", "noopener,noreferrer"); return; }
      const { data, error } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(path, 3600);
      if (error) throw error;
      setDocSignedUrls((m) => ({ ...m, [path]: data.signedUrl }));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Could not open file: " + (e?.message || e));
    }
  };

  const pathPrefix = useMemo(() => client?.id || "unknown", [client?.id]);

  const canSubmitMenu = !!menuTitle.trim() && !submitting && !!client?.id;
  const canSubmitMgr  = !!mgrTitle.trim()  && !submitting && !!client?.id;
  const canSubmitPas  = !!pasTitle.trim()  && !submitting && !!client?.id;

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitMenu) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submitMenu", {
        body: {
          title: menuTitle.trim(),
          period: menuPeriod.trim() || null,
          notes: menuNotes.trim() || null,
          files: menuFiles,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Menu submitted");
      setMenuTitle(""); setMenuPeriod(""); setMenuNotes(""); setMenuFiles([]);
      loadHistory(client.id);
    } catch (e) {
      toast.error("Submission failed: " + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMgrSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitMgr) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submitManagerRequest", {
        body: {
          title: mgrTitle.trim(),
          description: mgrDescription.trim() || null,
          deadline: mgrDeadline || null,
          importance: mgrImportance,
          files: mgrFiles,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Request sent");
      setMgrTitle(""); setMgrDescription(""); setMgrDeadline(""); setMgrImportance("medium"); setMgrFiles([]);
      loadHistory(client.id);
    } catch (e) {
      toast.error("Submission failed: " + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitPas) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submitPastryRequest", {
        body: {
          title: pasTitle.trim(),
          description: pasDescription.trim() || null,
          deadline: pasDeadline || null,
          files: pasFiles,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Request sent");
      setPasTitle(""); setPasDescription(""); setPasDeadline(""); setPasFiles([]);
      loadHistory(client.id);
    } catch (e) {
      toast.error("Submission failed: " + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => supabase.auth.signOut();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label="Loading">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: 'var(--divider)', borderTopColor: 'var(--ink)' }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-md w-full">
          <EmptyState
            icon={ChefHat}
            title="No restaurant linked"
            description="Your account isn't linked to a restaurant yet. Please contact Unchain Studio so we can set this up."
            action={<Button variant="outline" onClick={signOut}><LogOut className="w-4 h-4 mr-1.5" />Sign out</Button>}
          />
        </div>
      </div>
    );
  }

  const enabledRoles = Array.isArray(client.staff_roles) && client.staff_roles.length > 0
    ? ROLES.filter(r => client.staff_roles.includes(r.id))
    : ROLES;
  const effectiveRole = enabledRoles.find(r => r.id === activeRole)?.id || enabledRoles[0]?.id;
  const activeRoleMeta = enabledRoles.find(r => r.id === effectiveRole) || enabledRoles[0] || ROLES[0];
  const hideTabs = enabledRoles.length <= 1;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label-mono">Staff portal</p>
            <h1 className="text-h1 truncate" style={{ marginTop: 2 }}>{client.company_name}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="w-4 h-4 mr-1.5" />Sign out
          </Button>
        </div>

        {/* Role switcher (hidden when only one role is enabled for this client) */}
        {!hideTabs && (
        <div
          role="tablist"
          aria-label="Choose what you want to send"
          className={`grid gap-2 p-1 rounded-2xl`}
          style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)', gridTemplateColumns: `repeat(${enabledRoles.length}, minmax(0, 1fr))` }}
        >
          {enabledRoles.map((r) => {
            const Icon = r.icon;
            const active = r.id === effectiveRole;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveRole(r.id)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-medium transition-colors"
                style={{
                  background: active ? 'var(--brand-muted)' : 'transparent',
                  color: active ? 'var(--brand)' : 'var(--muted)',
                }}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="text-center leading-tight">{r.label}</span>
              </button>
            );
          })}
        </div>
        )}

        {/* Form */}
        <section
          aria-labelledby="form-heading"
          className="rounded-2xl p-5 sm:p-6"
          style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }} aria-hidden="true">
              <activeRoleMeta.icon className="w-4 h-4" />
            </div>
            <h2 id="form-heading" className="text-h3" style={{ margin: 0 }}>{activeRoleMeta.tagline}</h2>
          </div>

          {/* CHEF — MENU FORM */}
          {effectiveRole === "chef" && (
            <>
              <p className="text-body-sm" style={{ marginBottom: 18 }}>
                Add your monthly menu below. You can attach PDFs or photos. We'll pick it up and pass it to the designer.
              </p>
              <form onSubmit={handleMenuSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="menu-title">Title *</Label>
                  <Input id="menu-title" value={menuTitle} onChange={(e) => setMenuTitle(e.target.value)} placeholder="e.g. Menu — May 2026" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="menu-period">Period <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
                  <Input id="menu-period" value={menuPeriod} onChange={(e) => setMenuPeriod(e.target.value)} placeholder="e.g. May 1 – May 31" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="menu-notes">Menu text / notes <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
                  <Textarea id="menu-notes" value={menuNotes} onChange={(e) => setMenuNotes(e.target.value)} placeholder="Dishes, prices, allergens, designer instructions…" rows={8} className="mt-1" />
                </div>
                <div>
                  <Label>Attachments <span style={{ color: 'var(--subtle)' }}>(PDF or photos)</span></Label>
                  <div className="mt-1">
                    <FileDropzone files={menuFiles} onChange={setMenuFiles} bucket="menu-submissions" pathPrefix={pathPrefix} accept={ACCEPT} disabled={submitting} />
                  </div>
                </div>
                <div className="flex items-center justify-end pt-2">
                  <Button type="submit" disabled={!canSubmitMenu} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                    <Send className="w-4 h-4 mr-1.5" />
                    {submitting ? "Sending…" : "Send menu"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* MANAGER FORM */}
          {effectiveRole === "manager" && (
            <>
              <p className="text-body-sm" style={{ marginBottom: 18 }}>
                Need a new label, a poster, social copy, or any info passed to us? Fill in what you need and when.
              </p>
              <form onSubmit={handleMgrSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="mgr-title">What do you need? *</Label>
                  <Input id="mgr-title" value={mgrTitle} onChange={(e) => setMgrTitle(e.target.value)} placeholder="e.g. New allergen label for sourdough" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="mgr-description">Details <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
                  <Textarea id="mgr-description" value={mgrDescription} onChange={(e) => setMgrDescription(e.target.value)} placeholder="Dimensions, content, context, links…" rows={6} className="mt-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mgr-deadline">Deadline <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
                    <Input id="mgr-deadline" type="date" value={mgrDeadline} onChange={(e) => setMgrDeadline(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="mgr-importance">Importance</Label>
                    <Select value={mgrImportance} onValueChange={setMgrImportance}>
                      <SelectTrigger id="mgr-importance" className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Attachments <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
                  <div className="mt-1">
                    <FileDropzone files={mgrFiles} onChange={setMgrFiles} bucket="menu-submissions" pathPrefix={pathPrefix} accept={ACCEPT} disabled={submitting} />
                  </div>
                </div>
                <div className="flex items-center justify-end pt-2">
                  <Button type="submit" disabled={!canSubmitMgr} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                    <Send className="w-4 h-4 mr-1.5" />
                    {submitting ? "Sending…" : "Send request"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* PASTRY / BAKER CHEF FORM */}
          {effectiveRole === "pastry" && (
            <>
              <p className="text-body-sm" style={{ marginBottom: 18 }}>
                New bread or pastry coming up? Need a photo? Tell us what's happening and when.
              </p>
              <form onSubmit={handlePasSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="pas-title">What's new? *</Label>
                  <Input id="pas-title" value={pasTitle} onChange={(e) => setPasTitle(e.target.value)} placeholder="e.g. New sourdough launch — needs photo" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pas-description">Details <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
                  <Textarea id="pas-description" value={pasDescription} onChange={(e) => setPasDescription(e.target.value)} placeholder="Story of the product, ingredients, what you'd like to highlight…" rows={6} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pas-deadline">Launch / needed by <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
                  <Input id="pas-deadline" type="date" value={pasDeadline} onChange={(e) => setPasDeadline(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Attachments <span style={{ color: 'var(--subtle)' }}>(optional — reference photos, sketches)</span></Label>
                  <div className="mt-1">
                    <FileDropzone files={pasFiles} onChange={setPasFiles} bucket="menu-submissions" pathPrefix={pathPrefix} accept={ACCEPT} disabled={submitting} />
                  </div>
                </div>
                <div className="flex items-center justify-end pt-2">
                  <Button type="submit" disabled={!canSubmitPas} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                    <Send className="w-4 h-4 mr-1.5" />
                    {submitting ? "Sending…" : "Send request"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* Shared documents — uploaded by admin, download-only for staff */}
        <section aria-labelledby="docs-heading" className="space-y-3">
          {(() => {
            const DocsChevron = docsOpen ? ChevronDown : ChevronRight;
            return (
              <button
                type="button"
                onClick={() => setDocsOpen(o => !o)}
                aria-expanded={docsOpen}
                className="flex items-center gap-2 w-full text-left"
              >
                <FolderOpen className="w-4 h-4" style={{ color: 'var(--muted)' }} aria-hidden="true" />
                <h2 id="docs-heading" className="text-label-mono" style={{ margin: 0 }}>
                  Shared documents{docs.length > 0 ? ` (${docs.length})` : ""}
                </h2>
                <DocsChevron className="w-4 h-4 ml-auto" style={{ color: 'var(--muted)' }} aria-hidden="true" />
              </button>
            );
          })()}

          {docsOpen && (docsLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64 }} aria-hidden="true" />)}
            </div>
          ) : docs.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet" description="Documents shared by Unchain Studio will appear here." />
          ) : (
            <ul className="space-y-2" aria-label="Shared documents">
              {docs.map((d) => {
                const docFiles = Array.isArray(d.files) ? d.files : [];
                return (
                  <li key={d.id} className="rounded-2xl p-3" style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
                          <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-h3" style={{ margin: 0 }}>{d.title}</p>
                          <p className="text-body-sm" style={{ marginTop: 2 }}>
                            {format(new Date(d.created_at), "d MMM yyyy", { locale: enUS })} · {docFiles.length} file{docFiles.length > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    {docFiles.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Attached files">
                        {docFiles.map((f) => {
                          const isImg = f?.type?.startsWith?.("image/") || /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(f?.name || "");
                          const Icon = isImg ? ImageIcon : FileText;
                          return (
                            <li key={f.path}>
                              <button
                                type="button"
                                onClick={() => openDocFile(f.path)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-colors"
                              >
                                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                                <span className="truncate max-w-[180px]">{f.name}</span>
                                <Download className="w-3 h-3 opacity-60" aria-hidden="true" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </section>

        {/* History — filtered by active role */}
        <section aria-labelledby="history-heading" className="space-y-3">
          {(() => {
            const historyCount =
              effectiveRole === "chef"    ? menuSubs.length :
              effectiveRole === "manager" ? mgrSubs.length  :
              effectiveRole === "pastry"  ? pasSubs.length  : 0;
            const Chevron = historyOpen ? ChevronDown : ChevronRight;
            return (
              <button
                type="button"
                onClick={() => setHistoryOpen(o => !o)}
                aria-expanded={historyOpen}
                className="flex items-center gap-2 w-full text-left"
              >
                <History className="w-4 h-4" style={{ color: 'var(--muted)' }} aria-hidden="true" />
                <h2 id="history-heading" className="text-label-mono" style={{ margin: 0 }}>
                  Previous submissions{historyCount > 0 ? ` (${historyCount})` : ""}
                </h2>
                <Chevron className="w-4 h-4 ml-auto" style={{ color: 'var(--muted)' }} aria-hidden="true" />
              </button>
            );
          })()}

          {historyOpen && (loadingList ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 82 }} aria-hidden="true" />)}
            </div>
          ) : (
            <>
              {effectiveRole === "chef"    && <MenuHistory items={menuSubs} />}
              {effectiveRole === "manager" && <ManagerHistory items={mgrSubs} />}
              {effectiveRole === "pastry"  && <PastryHistory items={pasSubs} />}
            </>
          ))}
        </section>

      </div>
    </div>
  );
}

/* ─── History blocks ─────────────────────────────────────────────────────── */

function MenuHistory({ items }) {
  if (!items.length) {
    return <EmptyState icon={FileText} title="No menus yet" description="Your first menu will show up here after you send it." />;
  }
  return (
    <ul className="space-y-2" aria-label="Menu submissions">
      {items.map((s) => {
        const meta = MENU_STATUS_META[s.status] || MENU_STATUS_META.received;
        const Icon = meta.icon;
        const fileCount = Array.isArray(s.files) ? s.files.length : 0;
        return (
          <li key={s.id} className="rounded-2xl p-4" style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-h3" style={{ margin: 0 }}>{s.title}</p>
                <p className="text-body-sm" style={{ marginTop: 2 }}>
                  {format(new Date(s.created_at), "d MMM yyyy · HH:mm", { locale: enUS })}
                  {s.period ? ` · ${s.period}` : ""}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0" style={{ background: meta.bg, color: meta.color }}>
                <Icon className="w-3 h-3" aria-hidden="true" />{meta.label}
              </span>
            </div>
            {(s.notes || fileCount > 0) && (
              <div className="mt-2 text-body-sm space-y-1">
                {s.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{s.notes}</p>}
                {fileCount > 0 && (
                  <p className="inline-flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                    <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />{fileCount} file{fileCount > 1 ? "s" : ""} attached
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ManagerHistory({ items }) {
  if (!items.length) {
    return <EmptyState icon={ClipboardList} title="No requests yet" description="Your manager requests will show up here after you send them." />;
  }
  return (
    <ul className="space-y-2" aria-label="Manager requests">
      {items.map((s) => {
        const meta = REQUEST_STATUS_META[s.status] || REQUEST_STATUS_META.received;
        const imp = IMPORTANCE_META[s.importance] || IMPORTANCE_META.medium;
        const Icon = meta.icon;
        const fileCount = Array.isArray(s.files) ? s.files.length : 0;
        return (
          <li key={s.id} className="rounded-2xl p-4" style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-h3" style={{ margin: 0 }}>{s.title}</p>
                <p className="text-body-sm" style={{ marginTop: 2 }}>
                  {format(new Date(s.created_at), "d MMM yyyy · HH:mm", { locale: enUS })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0" style={{ background: meta.bg, color: meta.color }}>
                <Icon className="w-3 h-3" aria-hidden="true" />{meta.label}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: imp.bg, color: imp.color }}>
                <Flame className="w-3 h-3" aria-hidden="true" />{imp.label}
              </span>
              {s.deadline && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--divider)', color: 'var(--muted)' }}>
                  <CalendarClock className="w-3 h-3" aria-hidden="true" />Due {s.deadline}
                </span>
              )}
            </div>
            {(s.description || fileCount > 0) && (
              <div className="mt-2 text-body-sm space-y-1">
                {s.description && <p style={{ whiteSpace: 'pre-wrap' }}>{s.description}</p>}
                {fileCount > 0 && (
                  <p className="inline-flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                    <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />{fileCount} file{fileCount > 1 ? "s" : ""} attached
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PastryHistory({ items }) {
  if (!items.length) {
    return <EmptyState icon={Croissant} title="No requests yet" description="Your pastry / bread announcements will show up here after you send them." />;
  }
  return (
    <ul className="space-y-2" aria-label="Pastry / baker chef requests">
      {items.map((s) => {
        const meta = REQUEST_STATUS_META[s.status] || REQUEST_STATUS_META.received;
        const Icon = meta.icon;
        const fileCount = Array.isArray(s.files) ? s.files.length : 0;
        return (
          <li key={s.id} className="rounded-2xl p-4" style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-h3" style={{ margin: 0 }}>{s.title}</p>
                <p className="text-body-sm" style={{ marginTop: 2 }}>
                  {format(new Date(s.created_at), "d MMM yyyy · HH:mm", { locale: enUS })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0" style={{ background: meta.bg, color: meta.color }}>
                <Icon className="w-3 h-3" aria-hidden="true" />{meta.label}
              </span>
            </div>
            {s.deadline && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--divider)', color: 'var(--muted)' }}>
                  <CalendarClock className="w-3 h-3" aria-hidden="true" />Needed by {s.deadline}
                </span>
              </div>
            )}
            {(s.description || fileCount > 0) && (
              <div className="mt-2 text-body-sm space-y-1">
                {s.description && <p style={{ whiteSpace: 'pre-wrap' }}>{s.description}</p>}
                {fileCount > 0 && (
                  <p className="inline-flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                    <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />{fileCount} file{fileCount > 1 ? "s" : ""} attached
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
