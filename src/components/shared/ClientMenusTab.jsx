import { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChefHat, ExternalLink, FileText, Image as ImageIcon, Clock, Send, CheckCircle2, Archive,
  Trash2, RefreshCw, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";
import { useConfirm } from "@/lib/confirm";

const STATUS_META = {
  received:    { label: "Received",    color: 'var(--warning-text)',  bg: 'var(--warning-bg)', icon: Clock },
  transmitted: { label: "Transmitted", color: 'var(--brand)',          bg: 'var(--brand-muted)', icon: Send },
  published:   { label: "Published",   color: 'var(--success-text)',  bg: 'var(--success-bg)', icon: CheckCircle2 },
  archived:    { label: "Archived",    color: 'var(--muted)',          bg: 'var(--divider)',     icon: Archive },
};

const STATUS_OPTIONS = ["received", "transmitted", "published", "archived"];
const BUCKET = "menu-submissions";

function isImage(file) {
  const name = (file?.name || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(name);
}

export default function ClientMenusTab({ clientId, staffLinked }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState({}); // path -> url
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_submissions")
      .select("id, title, period, notes, files, status, created_at, updated_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load menus: " + error.message);
    setSubmissions(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const openFile = async (path) => {
    try {
      const cached = signedUrls[path];
      if (cached) { window.open(cached, "_blank", "noopener,noreferrer"); return; }
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      setSignedUrls((m) => ({ ...m, [path]: data.signedUrl }));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Could not open file: " + (e?.message || e));
    }
  };

  const changeStatus = async (id, status) => {
    const { error } = await supabase.from("menu_submissions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${STATUS_META[status]?.label || status}`);
    load();
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: "Delete this menu submission?",
      description: "Files will also be removed from storage. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const paths = Array.isArray(row.files) ? row.files.map(f => f.path).filter(Boolean) : [];
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
    const { error } = await supabase.from("menu_submissions").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Menu submission deleted");
    load();
  };

  const Chevron = open ? ChevronDown : ChevronRight;
  const latest = submissions[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex items-center gap-2"
        >
          <Chevron className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <ChefHat className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="text-label-mono" style={{ margin: 0 }}>
            Staff menu submissions{submissions.length > 0 ? ` (${submissions.length})` : ""}
          </span>
        </button>
        <Button variant="outline" size="sm" onClick={load} aria-label="Refresh">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />Refresh
        </Button>
      </div>

      {!open && latest && (
        <p className="text-xs pl-6" style={{ color: 'var(--muted)' }}>
          Latest: <span style={{ color: 'var(--ink)' }}>{latest.title}</span>
          {" · "}{format(new Date(latest.created_at), "d MMM", { locale: enUS })}
          {" · "}{(STATUS_META[latest.status] || STATUS_META.received).label}
        </p>
      )}

      {!staffLinked && (
        <p className="text-sm p-3 rounded-lg" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
          No staff account is linked to this client yet. Use the <strong>ChefHat</strong> icon on the client list to invite a staff member.
        </p>
      )}

      {open && (loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110 }} aria-hidden="true" />)}
        </div>
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No menus submitted yet"
          description="When the restaurant staff sends a menu from their portal, it will show up here."
        />
      ) : (
        <ul className="space-y-3" aria-label="Menu submissions">
          {submissions.map((s) => {
            const meta = STATUS_META[s.status] || STATUS_META.received;
            const Icon = meta.icon;
            const files = Array.isArray(s.files) ? s.files : [];
            return (
              <li key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-h3" style={{ margin: 0 }}>{s.title}</p>
                    <p className="text-body-sm" style={{ marginTop: 2 }}>
                      {format(new Date(s.created_at), "d MMM yyyy · HH:mm", { locale: enUS })}
                      {s.period ? ` · ${s.period}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <Icon className="w-3 h-3" aria-hidden="true" />
                      {meta.label}
                    </span>
                    <Select value={s.status} onValueChange={(v) => changeStatus(s.id, v)}>
                      <SelectTrigger className="h-8 text-xs w-36" aria-label="Change status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{STATUS_META[opt].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                      aria-label={`Delete submission ${s.title}`}
                      onClick={() => remove(s)}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {s.notes && (
                  <p className="text-sm mt-3" style={{ whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
                    {s.notes}
                  </p>
                )}

                {files.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attached files">
                    {files.map((f) => (
                      <li key={f.path}>
                        <button
                          type="button"
                          onClick={() => openFile(f.path)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-colors"
                        >
                          {isImage(f) ? <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> : <FileText className="w-3.5 h-3.5" aria-hidden="true" />}
                          <span className="truncate max-w-[180px]">{f.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-50" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}
