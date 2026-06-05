import { supabase } from "@/api/base44Client";
import { toast } from "sonner";

const BUCKET = "deliverables";

// Get a short-lived signed URL to view/download a deliverable file.
export async function getSignedDeliverableUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// Open a deliverable in a new tab (fetches signed URL first).
export async function openDeliverable(path) {
  try {
    const url = await getSignedDeliverableUrl(path);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    toast.error("Failed to open file: " + (e?.message || e));
  }
}

export function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Open a delivery entry: links open directly, files via a signed URL.
export function openDeliveryEntry(entry) {
  if (!entry) return;
  if (entry.kind === "link" && entry.url) {
    window.open(entry.url, "_blank", "noopener,noreferrer");
  } else if (entry.path) {
    openDeliverable(entry.path);
  } else if (entry.url) {
    window.open(entry.url, "_blank", "noopener,noreferrer");
  }
}

// Group flat delivery_files into ordered "Delivery #N" batches. All entries
// delivered in one action share a `batch` timestamp; fall back to uploaded_at.
export function groupDeliveryBatches(files) {
  const arr = Array.isArray(files) ? files : [];
  const map = new Map();
  for (const f of arr) {
    const key = f?.batch || f?.uploaded_at || "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  return [...map.entries()]
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([key, items], i) => ({ index: i + 1, key, at: items[0]?.uploaded_at || key, files: items }));
}
