import { useState, useRef } from "react";
import { supabase } from "@/api/base44Client";
import { Upload, X, File as FileIcon, Loader2, AlertCircle } from "lucide-react";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — Supabase Free plan limit

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Controlled component: parent passes `files` array + `onChange` callback.
// File shape: { path, name, size, uploaded_at }
export default function FileDropzone({
  files = [],
  onChange,
  bucket = "deliverables",
  pathPrefix = "misc",
  disabled = false,
  accept,
}) {
  const [uploading, setUploading] = useState([]);  // [{ name, progress }]
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const uploadOne = async (file) => {
    if (file.size > MAX_BYTES) {
      throw new Error(`${file.name} exceeds 50 MB (Supabase Free limit)`);
    }
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${pathPrefix}/${Date.now()}-${rand}${ext ? "." + ext : ""}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) throw upErr;
    return {
      path,
      name: file.name,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };
  };

  const handleFiles = async (fileList) => {
    setError(null);
    const picked = Array.from(fileList);
    if (picked.length === 0) return;

    setUploading(picked.map(f => ({ name: f.name })));
    try {
      const results = [];
      for (const f of picked) {
        results.push(await uploadOne(f));
      }
      onChange([...files, ...results]);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setUploading([]);
    }
  };

  const removeAt = async (idx) => {
    const f = files[idx];
    try {
      await supabase.storage.from(bucket).remove([f.path]);
    } catch {
      /* ignore — we still remove from the list */
    }
    onChange(files.filter((_, i) => i !== idx));
  };

  const onDragOver = (e) => { e.preventDefault(); if (!disabled) setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        disabled={disabled || uploading.length > 0}
        className={`w-full border-2 border-dashed rounded-lg px-4 py-6 flex flex-col items-center gap-1.5 transition-colors ${
          dragging ? "border-brand bg-brand/5" :
          disabled ? "border-slate-100 bg-slate-50 cursor-not-allowed" :
          "border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
        }`}
      >
        {uploading.length > 0 ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-brand" />
            <span className="text-xs text-slate-500">Uploading {uploading.length} file{uploading.length > 1 ? "s" : ""}…</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-xs text-slate-600 font-medium">Drop files or click to upload</span>
            <span className="text-[10px] text-slate-400">Max 50 MB per file</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={accept}
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </button>

      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={f.path} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1.5">
              <FileIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-slate-400 shrink-0">{fmtSize(f.size)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
