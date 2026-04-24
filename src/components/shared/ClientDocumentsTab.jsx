import { useEffect, useRef, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  FileText, Image as ImageIcon, Upload, Trash2, RefreshCw, Download, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmptyState from "@/components/shared/EmptyState";
import { useConfirm } from "@/lib/confirm";

const BUCKET = "client-documents";
const ACCEPT = "application/pdf,image/*";
const MAX_BYTES = 50 * 1024 * 1024;

function isImage(mime, name = "") {
  if (mime?.startsWith("image/")) return true;
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
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState({});
  const fileRef = useRef(null);
  const confirm = useConfirm();

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("client_documents")
      .select("id, title, file_path, file_name, file_size, mime_type, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load documents: " + error.message);
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File exceeds 50 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const rand = Math.random().toString(36).slice(2, 10);
      const path = `${clientId}/${Date.now()}-${rand}${ext ? "." + ext : ""}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("client_documents").insert({
        client_id: clientId,
        title: title.trim(),
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
      toast.success("Document uploaded");
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) {
      toast.error("Upload failed: " + (err?.message || err));
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (doc) => {
    try {
      const cached = signedUrls[doc.file_path];
      if (cached) { window.open(cached, "_blank", "noopener,noreferrer"); return; }
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 3600);
      if (error) throw error;
      setSignedUrls((m) => ({ ...m, [doc.file_path]: data.signedUrl }));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Could not open file: " + (e?.message || e));
    }
  };

  const remove = async (doc) => {
    const ok = await confirm({
      title: "Delete this document?",
      description: "The file will also be removed from storage. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    const { error } = await supabase.from("client_documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted");
    load();
  };

  const canSubmit = title.trim().length > 0 && !!file && !uploading;

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
        Upload documents (PDF or images) that staff and the client can download from their portals.
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
            disabled={uploading}
          />
        </div>
        <div>
          <Label htmlFor="doc-file">File (PDF or image — max 50 MB)</Label>
          <Input
            id="doc-file"
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={uploading}
          />
          {file && (
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {file.name} · {fmtSize(file.size)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!canSubmit} className="bg-brand hover:bg-brand/90 text-brand-foreground">
            {uploading
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Uploading…</>
              : <><Upload className="w-4 h-4 mr-1.5" />Upload</>}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} aria-hidden="true" />)}
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
            const Icon = isImage(d.mime_type, d.file_name) ? ImageIcon : FileText;
            return (
              <li key={d.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
                      <Icon className="w-4 h-4" style={{ color: 'var(--brand)' }} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-h3" style={{ margin: 0 }}>{d.title}</p>
                      <p className="text-body-sm" style={{ marginTop: 2 }}>
                        {d.file_name}{d.file_size ? ` · ${fmtSize(d.file_size)}` : ""} · {format(new Date(d.created_at), "d MMM yyyy", { locale: enUS })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openFile(d)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />Open
                    </Button>
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
