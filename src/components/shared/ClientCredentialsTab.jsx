import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import {
  KeyRound, Plus, Trash2, ExternalLink, Copy, Eye, EyeOff, Pencil, Search,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";
import { useConfirm } from "@/lib/confirm";

const CATEGORIES = ["CMS", "Ads", "Analytics", "Social", "Storage", "Email", "Other"];

const emptyForm = {
  id: null,
  label: "",
  category: "",
  login_url: "",
  username: "",
  password: "",
  notes: "",
  position: 0,
};

async function copyToClipboard(value, successMsg) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMsg);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export default function ClientCredentialsTab({ clientId, clientName, canEdit = false, tr }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState({}); // id -> bool

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [logRows, setLogRows] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const confirm = useConfirm();

  const t = (key, fallback) => (tr && tr[key]) || fallback;

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_client_credentials", { p_client_id: clientId });
    if (error) toast.error("Failed to load credentials: " + error.message);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const categories = useMemo(() => {
    const s = new Set();
    rows.forEach(r => r.category && s.add(r.category));
    return ["all", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = rows.filter(r => {
    if (filterCat !== "all" && r.category !== filterCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${r.label} ${r.username || ""} ${r.notes || ""} ${r.category || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const openNew = () => { setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (r) => {
    setForm({
      id: r.id,
      label: r.label || "",
      category: r.category || "",
      login_url: r.login_url || "",
      username: r.username || "",
      password: r.password || "",
      notes: r.notes || "",
      position: r.position ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    const { error } = await supabase.rpc("upsert_client_credential", {
      p_id: form.id,
      p_client_id: clientId,
      p_label: form.label.trim(),
      p_login_url: form.login_url.trim(),
      p_username: form.username.trim(),
      p_password: form.password,
      p_category: form.category || "",
      p_notes: form.notes.trim(),
      p_position: form.position === "" ? 0 : Number(form.position) || 0,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Credential updated" : "Credential added");
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (r) => {
    const ok = await confirm({
      title: `Delete "${r.label}"?`,
      description: "This credential will be removed from the client portal.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc("delete_client_credential", { p_id: r.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Credential deleted");
    load();
  };

  const toggleReveal = (id) => {
    setRevealed(m => {
      const next = !m[id];
      if (next) {
        supabase.rpc("log_credential_reveal", { p_credential_id: id }).catch(() => {});
      }
      return { ...m, [id]: next };
    });
  };

  const openLog = async () => {
    setLogOpen(true);
    setLogLoading(true);
    const { data, error } = await supabase
      .from("client_credentials_access_log")
      .select("id, credential_id, actor_id, actor_email, action, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Failed to load access log: " + error.message);
    setLogRows(data || []);
    setLogLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="text-label-mono" style={{ margin: 0 }}>
            {t("credentials", "Credentials")}{clientName ? ` — ${clientName}` : ""}
          </span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openLog} className="h-9">
              <History className="w-4 h-4 mr-1" aria-hidden="true" /> Activity
            </Button>
            <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
              <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add credential
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input
            placeholder={t("searchCredentials", "Search label, username, notes…")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 w-64"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-9 w-44 text-sm" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c} value={c}>
                {c === "all" ? t("allCategories", "All categories") : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} {filtered.length === 1 ? "credential" : "credentials"}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 96 }} aria-hidden="true" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={rows.length === 0 ? t("noCredentials", "No credentials yet") : t("noCredentialsFiltered", "No credentials match your filters")}
          description={rows.length === 0 ? (canEdit
            ? "Add Webflow, Meta Business, Google Analytics, etc."
            : t("noCredentialsDesc", "Unchain Studio will add your logins here."))
            : undefined}
          action={rows.length === 0 && canEdit
            ? <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add first credential</Button>
            : undefined}
        />
      ) : (
        <ul className="space-y-2" aria-label="Credentials">
          {filtered.map(r => {
            const isRevealed = !!revealed[r.id];
            return (
              <li key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div aria-hidden="true"
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}>
                    <KeyRound className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.label}</p>
                      {r.category && (
                        <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {r.category}
                        </span>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="mt-2 space-y-1.5">
                      {r.login_url && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 w-16 shrink-0">{t("loginUrl", "URL")}</span>
                          <a href={r.login_url} target="_blank" rel="noopener noreferrer"
                            className="text-slate-700 truncate hover:text-brand hover:underline flex-1"
                            title={r.login_url}>
                            {r.login_url}
                          </a>
                          <a href={r.login_url} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label={t("openLogin", "Open login page")} title={t("openLogin", "Open login page")}>
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                          <button type="button"
                            onClick={() => copyToClipboard(r.login_url, t("urlCopied", "URL copied"))}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label={t("copyUrl", "Copy URL")} title={t("copyUrl", "Copy URL")}>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}

                      {r.username && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 w-16 shrink-0">{t("username", "Username")}</span>
                          <span className="font-mono text-slate-700 truncate flex-1" title={r.username}>{r.username}</span>
                          <button type="button"
                            onClick={() => copyToClipboard(r.username, t("usernameCopied", "Username copied"))}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label={t("copyUsername", "Copy username")} title={t("copyUsername", "Copy username")}>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}

                      {r.password && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 w-16 shrink-0">{t("password", "Password")}</span>
                          <span className="font-mono text-slate-700 truncate flex-1">
                            {isRevealed ? r.password : "•".repeat(Math.min(r.password.length, 12))}
                          </span>
                          <button type="button"
                            onClick={() => toggleReveal(r.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label={isRevealed ? t("hidePassword", "Hide") : t("showPassword", "Show")}
                            title={isRevealed ? t("hidePassword", "Hide") : t("showPassword", "Show")}>
                            {isRevealed
                              ? <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                              : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
                          </button>
                          <button type="button"
                            onClick={() => copyToClipboard(r.password, t("passwordCopied", "Password copied"))}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label={t("copyPassword", "Copy password")} title={t("copyPassword", "Copy password")}>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>

                    {r.notes && <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{r.notes}</p>}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => openEdit(r)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        aria-label={`Edit ${r.label}`}>
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => handleDelete(r)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
                        aria-label={`Delete ${r.label}`}>
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit / create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-brand" /> {form.id ? "Edit credential" : "Add credential"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label htmlFor="cred-label">Label *</Label>
              <Input id="cred-label" value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Webflow, Meta Business, Google Analytics…"
                className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cred-category">Category</Label>
                <Select value={form.category || "_none"}
                  onValueChange={v => setForm(f => ({ ...f, category: v === "_none" ? "" : v }))}>
                  <SelectTrigger id="cred-category" className="mt-1"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cred-position">Position</Label>
                <Input id="cred-position" type="number" value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="cred-url">Login URL</Label>
              <Input id="cred-url" type="url" value={form.login_url}
                onChange={e => setForm(f => ({ ...f, login_url: e.target.value }))}
                placeholder="https://webflow.com/dashboard/login"
                className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cred-username">Username / Email</Label>
              <Input id="cred-username" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                autoComplete="off" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cred-password">Password</Label>
              <Input id="cred-password" type="text" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="off" className="mt-1 font-mono" />
            </div>
            <div>
              <Label htmlFor="cred-notes">Notes</Label>
              <Textarea id="cred-notes" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="2FA codes location, account owner, special instructions…"
                className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.label.trim()}
                className="bg-brand hover:bg-brand/90 text-brand-foreground">
                {saving ? "Saving…" : (form.id ? "Save" : "Add credential")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access log dialog (admin only) */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-brand" /> Access activity{clientName ? ` — ${clientName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {logLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 36 }} aria-hidden="true" />)}
              </div>
            ) : logRows.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {logRows.map(l => {
                  const color = {
                    create: "bg-emerald-50 text-emerald-700",
                    update: "bg-amber-50 text-amber-700",
                    delete: "bg-red-50 text-red-700",
                    reveal: "bg-blue-50 text-blue-700",
                  }[l.action] || "bg-slate-100 text-slate-700";
                  const when = l.created_at ? new Date(l.created_at).toLocaleString() : "";
                  return (
                    <li key={l.id} className="py-2 flex items-center gap-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${color}`}>
                        {l.action}
                      </span>
                      <span className="text-slate-700 truncate flex-1" title={l.actor_email || l.actor_id || ""}>
                        {l.actor_email || l.actor_id || "—"}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{when}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
