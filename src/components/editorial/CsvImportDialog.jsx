import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Expected CSV columns (order doesn't matter, matched by header name):
// client_name, title, post_type, scheduled_date, platform, status, description, notes, drive_link

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(/[;,]/).map(v => v.trim().replace(/^["']|["']$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

const STATUS_OPTIONS = ["Planifié", "En cours", "Publié", "Annulé"];
const STATUS_EN_TO_FR = { "planned": "Planifié", "in progress": "En cours", "published": "Publié", "cancelled": "Annulé" };
const TYPE_OPTIONS = ["Reel", "Story", "Carousel"];

export default function CsvImportDialog({ open, onOpenChange }) {
  const [rows, setRows] = useState([]);
  const [clientOverride, setClientOverride] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.filter({ status: "Actif" }) });

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target.result);
      if (parsed.length === 0) { setError("Empty file or invalid format."); return; }
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const normalizeType = (v) => {
    if (!v) return "Reel";
    const lower = v.toLowerCase();
    if (lower.includes("story")) return "Story";
    if (lower.includes("carousel")) return "Carousel";
    return "Reel";
  };

  const normalizeStatus = (v) => {
    if (!v) return "Planifié";
    const lower = v.toLowerCase();
    if (STATUS_EN_TO_FR[lower]) return STATUS_EN_TO_FR[lower];
    const match = STATUS_OPTIONS.find(s => s.toLowerCase() === lower);
    return match || "Planifié";
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    setResult(null);
    setError("");
    let success = 0; let failed = 0; let firstError = "";
    for (const row of rows) {
      const clientName = clientOverride || row.client_name || "";
      if (!clientName) { failed++; if (!firstError) firstError = "Missing client_name in one or more rows."; continue; }
      const record = {
        client_name: clientName,
        title: row.title || row.titre || "",
        post_type: normalizeType(row.post_type || row.type || ""),
        scheduled_date: row.scheduled_date || row.date || null,
        status: normalizeStatus(row.status || row.statut || ""),
        description: row.description || "",
        notes: row.notes || "",
      };
      try {
        await base44.entities.EditorialContent.create(record);
        success++;
      } catch (e) {
        failed++;
        console.error("[CSV Import] Failed row:", record, e);
        if (!firstError) {
          firstError = e?.message || e?.details || e?.error_description
            || (typeof e === "string" ? e : null)
            || JSON.stringify(e, null, 2)
            || "Unknown error";
        }
      }
    }
    qc.invalidateQueries({ queryKey: ["editorial"] });
    setResult({ success, failed });
    if (firstError && failed > 0) setError(`Error: ${firstError}`);
    setImporting(false);
    setRows([]);
  };

  const downloadTemplate = () => {
    const csv = "client_name;title;post_type;scheduled_date;platform;status;description;notes;drive_link\nClient Name;My title;Reel;2026-05-01;Instagram;Planned;Post description;;";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "editorial_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setRows([]); setResult(null); setError(""); setClientOverride("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import editorial calendar (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Template download */}
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-brand hover:underline">
            <Download className="w-3.5 h-3.5" /> Download CSV template
          </button>

          {/* Client override */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Assign to a client (optional — overrides client_name column in CSV)</p>
            <Select value={clientOverride} onValueChange={setClientOverride}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Use CSV client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Use CSV</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* File input */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-8 cursor-pointer hover:border-brand/40 hover:bg-slate-50 transition-colors">
            <Upload className="w-6 h-6 text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 font-medium">Choose a CSV file</p>
            <p className="text-xs text-slate-400 mt-1">Separator: comma or semicolon</p>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs font-medium text-slate-700 mb-1">{rows.length} row{rows.length > 1 ? "s" : ""} detected — preview:</p>
              <div className="overflow-x-auto max-h-32 text-[10px] text-slate-500 space-y-0.5">
                {rows.slice(0, 5).map((r, i) => (
                  <p key={i} className="truncate">{clientOverride || r.client_name} · {r.title || r.titre} · {r.post_type || r.type} · {r.scheduled_date || r.date}</p>
                ))}
                {rows.length > 5 && <p className="text-slate-400">…and {rows.length - 5} more</p>}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {result.success} imported successfully{result.failed > 0 ? ` · ${result.failed} failed` : ""}.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose}>Close</Button>
            <Button
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {importing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Importing…</> : <><Upload className="w-4 h-4 mr-1" />Import {rows.length > 0 ? `(${rows.length})` : ""}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
