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
