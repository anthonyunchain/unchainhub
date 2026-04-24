import { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  FileText, Image as ImageIcon, Upload, Trash2, RefreshCw, Download, Loader2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FileDropzone from "@/components/shared/FileDropzone";
import EmptyState from "@/components/shared/EmptyState";
import { useConfirm } from "@/lib/confirm";

const BUCKET = "client-documents";
const ACCEPT = "application/pdf,image/*";

function isImage(file) {
  const name = (file?.name || "").toLowerCase();
  if (file?.type?.startsWith?.("image/")) return true;
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(name);
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ClientDocumentsTab({ clientId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState({});
  const confirm = useConfirm();

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("client_documents")
      .select("id, title, files, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load documents: " + error.message);
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || files.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_documents").insert({
        client_id: clientId,
        title: title.trim(),
        files,
      });
      if (error) throw error;
      toast.success("Document saved");
      setTitle("");
      setFiles([]);
      load();
    } catch (err) {
      toast.error("Save failed: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

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

  const remove = async (doc) => {
    const ok = await confirm({
      title: "Delete this document?",
      description: "All attached files will also be removed from storage. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const paths = (doc.files || []).map(f => f.path).filter(Boolean);
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    const { error } = await supabase.from("client_documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted");
    load();
  };

  const canSubmit = title.trim().length > 0 && files.length > 0 && !saving;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="text-label-mono" style={{ margin: 0 }}>
            Shared documents{docs.length > 0 ? ` (${docs.length})` : ""}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={load} aria-label="Refresh">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />Refresh
        </Button>
      </div>

      <p className="text-body-sm" style={{ color: 'var(--muted)' }}>
        Upload documents (PDF or images) that staff and the client can download from their portals. You can attach multiple files under one title.
      </p>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3"
      >
        <div>
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Menu template – July"
            disabled={saving}
          />
        </div>
        <div>
          <Label>Files (PDF or images — max 50 MB each)</Label>
          <div className="mt-1">
            <FileDropzone
              files={files}
              onChange={setFiles}
              bucket={BUCKET}
              pathPrefix={clientId || "unknown"}
              accept={ACCEPT}
              disabled={saving}
            />
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!canSubmit} className="bg-brand hover:bg-brand/90 text-brand-foreground">
            {saving
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</>
              : <><Upload className="w-4 h-4 mr-1.5" />Save</>}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 92 }} aria-hidden="true" />)}
        </div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload a PDF or image above to share it with the staff and the client."
        />
      ) : (
        <ul className="space-y-2" aria-label="Client documents">
          {docs.map((d) => {
            const docFiles = Array.isArray(d.files) ? d.files : [];
            return (
              <li key={d.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-h3" style={{ margin: 0 }}>{d.title}</p>
                    <p className="text-body-sm" style={{ marginTop: 2 }}>
                      {format(new Date(d.created_at), "d MMM yyyy", { locale: enUS })} · {docFiles.length} file{docFiles.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                    aria-label={`Delete ${d.title}`}
                    onClick={() => remove(d)}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>

                {docFiles.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attached files">
                    {docFiles.map((f) => (
                      <li key={f.path}>
                        <button
                          type="button"
                          onClick={() => openFile(f.path)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-colors"
                        >
                          {isImage(f) ? <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> : <FileText className="w-3.5 h-3.5" aria-hidden="true" />}
                          <span className="truncate max-w-[180px]">{f.name}</span>
                          {f.size ? <span className="text-slate-400">· {fmtSize(f.size)}</span> : null}
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
