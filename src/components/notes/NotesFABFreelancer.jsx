/**
 * NotesFAB variant for FreelancerPortal — uses onOpenNotes() callback
 * instead of react-router <Link> since navigation happens via setActiveTab.
 */
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Plus, X, Check } from "lucide-react";
import { supabase } from "@/api/base44Client";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

function validateNote({ title }) {
  if (!title?.trim()) return "Title is required";
  if (title.trim().length > 200) return "Title too long";
  return null;
}

export default function NotesFABFreelancer({ userId, onOpenNotes }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveError, setSaveError] = useState(null);
  const ref = useRef(null);
  const qc = useQueryClient();

  const { data: recentNotes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setCreating(false); }
    };
    if (open) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      const err = validateNote({ title });
      if (err) throw new Error(err);
      const { data, error } = await supabase.from("notes").insert({
        title: title.trim().slice(0, 200),
        content: content.slice(0, 50000),
        tags: [], shared_with: [], created_by: userId,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setTitle(""); setContent(""); setCreating(false); setSaveError(null);
    },
    onError: (e) => setSaveError(e.message),
  });

  const PANEL = {
    position: "fixed", top: "72px", right: "20px", width: 300, maxHeight: 400,
    background: "var(--card)", borderRadius: "var(--card-radius)",
    boxShadow: "var(--card-shadow-hover)", border: "1px solid var(--divider)",
    zIndex: 9999, display: "flex", flexDirection: "column", overflow: "hidden",
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => { setOpen(v => !v); if (open) setCreating(false); }}
        style={{
          position: "relative", width: 36, height: 36, borderRadius: "50%",
          background: open ? "var(--brand)" : "var(--card)",
          boxShadow: "var(--card-shadow)", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 150ms, box-shadow 150ms", flexShrink: 0,
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.boxShadow = "var(--card-shadow-hover)"; }}
        onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--card-shadow)"}
        title="Notes"
      >
        <NotebookPen style={{ width: 15, height: 15, color: open ? "#fff" : "var(--muted)" }} />
      </button>

      {open && (
        <div style={PANEL}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Notes</span>
            <button
              onClick={() => setCreating(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: creating ? "var(--brand)" : "var(--card-blue)", color: creating ? "#fff" : "var(--brand)", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {creating ? <X style={{ width: 11, height: 11 }} /> : <Plus style={{ width: 11, height: 11 }} />}
              {creating ? "Cancel" : "New note"}
            </button>
          </div>

          {creating && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value.slice(0, 200))} placeholder="Note title *"
                style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--divider)", borderRadius: 7, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)", background: "var(--bg)", outline: "none", marginBottom: 6, boxSizing: "border-box" }}
                onKeyDown={e => { if (e.key === "Enter") createMut.mutate(); }}
              />
              <textarea value={content} onChange={e => setContent(e.target.value.slice(0, 50000))} placeholder="Content (optional)..." rows={3}
                style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--divider)", borderRadius: 7, fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--ink)", background: "var(--bg)", outline: "none", resize: "none", boxSizing: "border-box" }}
              />
              {saveError && <p style={{ fontSize: 10, color: "#ef4444", fontFamily: "'DM Mono', monospace", margin: "4px 0" }}>{saveError}</p>}
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !title.trim()}
                style={{ marginTop: 6, width: "100%", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: (createMut.isPending || !title.trim()) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                {createMut.isPending ? "Saving…" : <><Check style={{ width: 12, height: 12 }} /> Save note</>}
              </button>
            </div>
          )}

          <div style={{ overflowY: "auto", flex: 1 }}>
            {recentNotes.length === 0 && !creating ? (
              <div style={{ padding: "24px 12px", textAlign: "center" }}>
                <NotebookPen style={{ width: 22, height: 22, color: "var(--muted)", opacity: 0.25, margin: "0 auto 6px" }} />
                <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>No notes yet</p>
              </div>
            ) : recentNotes.slice(0, 6).map(note => (
              <button key={note.id} onClick={() => { setOpen(false); onOpenNotes?.(); }}
                style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--divider)", background: "transparent", border: "none", cursor: "pointer", display: "block", transition: "background 120ms" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(42,105,255,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "75%" }}>
                    {note.title || "Untitled"}
                  </p>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", flexShrink: 0 }}>
                    {note.updated_at ? format(new Date(note.updated_at), "d MMM", { locale: enUS }) : ""}
                  </span>
                </div>
                {note.content && (
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {note.content.slice(0, 55)}
                  </p>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--divider)", flexShrink: 0 }}>
            <button
              onClick={() => { setOpen(false); onOpenNotes?.(); }}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--brand)", fontWeight: 500 }}
            >
              All notes →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
