import { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Croissant, ExternalLink, FileText, Image as ImageIcon, Clock, Send, CheckCircle2, Archive,
  Trash2, RefreshCw, CalendarClock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";
import { useConfirm } from "@/lib/confirm";

const STATUS_META = {
  received:    { label: "Received",    color: 'var(--warning-text)', bg: 'var(--warning-bg)', icon: Clock },
  in_progress: { label: "In progress", color: 'var(--brand)',        bg: 'var(--brand-muted)', icon: Send },
  completed:   { label: "Completed",   color: 'var(--success-text)', bg: 'var(--success-bg)', icon: CheckCircle2 },
  archived:    { label: "Archived",    color: 'var(--muted)',        bg: 'var(--divider)',    icon: Archive },
};

const STATUS_OPTIONS = ["received", "in_progress", "completed", "archived"];
const BUCKET = "menu-submissions";

function isImage(file) {
  const name = (file?.name || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(name);
}

export default function ClientPastryRequestsTab({ clientId, staffLinked }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState({});
  const confirm = useConfirm();

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("pastry_chef_requests")
      .select("id, title, description, deadline, files, status, created_at, updated_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load requests: " + error.message);
    setRows(data || []);
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
    const { error } = await supabase.from("pastry_chef_requests").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${STATUS_META[status]?.label || status}`);
    load();
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: "Delete this request?",
      description: "Files will also be removed from storage. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const paths = Array.isArray(row.files) ? row.files.map(f => f.path).filter(Boolean) : [];
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    const { error } = await supabase.from("pastry_chef_requests").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Request deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Croissant className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="text-label-mono" style={{ margin: 0 }}>Pastry / baker chef requests</span>
        </div>
        <Button variant="outline" size="sm" onClick={load} aria-label="Refresh">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />Refresh
        </Button>
      </div>

      {!staffLinked && (
        <p className="text-sm p-3 rounded-lg" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
          No staff account is linked to this client yet.
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110 }} aria-hidden="true" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No pastry / bread requests yet"
          description="When the pastry or baker chef sends a request from the staff portal, it will show up here."
        />
      ) : (
        <ul className="space-y-3" aria-label="Pastry requests">
          {rows.map((s) => {
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
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: meta.bg, color: meta.color }}>
                      <Icon className="w-3 h-3" aria-hidden="true" />{meta.label}
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
                      aria-label={`Delete request ${s.title}`}
                      onClick={() => remove(s)}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {s.deadline && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--divider)', color: 'var(--muted)' }}>
                      <CalendarClock className="w-3 h-3" aria-hidden="true" />Needed by {s.deadline}
                    </span>
                  </div>
                )}

                {s.description && (
                  <p className="text-sm mt-3" style={{ whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
                    {s.description}
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
      )}
    </div>
  );
}
