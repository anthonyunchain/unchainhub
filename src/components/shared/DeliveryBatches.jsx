import { Download, ExternalLink, X } from "lucide-react";
import { openDeliveryEntry, groupDeliveryBatches, formatBytes } from "@/lib/deliverables";

// Renders delivery_files grouped into "Delivery #N" batches (multiple/split
// deliveries). Pass onRemoveBatch(key) to show a remove button per batch.
export default function DeliveryBatches({ files, onRemoveBatch, busy }) {
  const rounds = groupDeliveryBatches(files);
  if (rounds.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {rounds.map(round => (
        <div key={round.key} className="flex-shrink-0 p-2.5 bg-violet-50 rounded-lg border border-violet-100 min-w-[170px] max-w-[240px]">
          <p className="text-[11px] font-semibold text-violet-700 mb-1.5 flex items-baseline justify-between gap-1">
            <span>Delivery #{round.index}</span>
            <span className="flex items-center gap-1.5">
              {round.at && <span className="text-violet-400 font-normal">{new Date(round.at).toLocaleDateString()}</span>}
              {onRemoveBatch && (
                <button type="button" disabled={busy} onClick={() => onRemoveBatch(round.key)}
                  className="text-violet-300 hover:text-red-500 disabled:opacity-40">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          </p>
          <div className="flex flex-col gap-1">
            {round.files.map((f, i) => (
              <button key={i} type="button" onClick={() => openDeliveryEntry(f)}
                className="flex items-center gap-1 bg-white border border-violet-200 rounded-md px-2 py-1 text-[11px] text-violet-700 hover:bg-violet-100">
                {f.kind === "link"
                  ? <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  : <Download className="w-3 h-3 flex-shrink-0" />}
                <span className="flex-1 truncate text-left">{f.name || f.url || "File"}</span>
                {f.size ? <span className="text-violet-400 flex-shrink-0">{formatBytes(f.size)}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
