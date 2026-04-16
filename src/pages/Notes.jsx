import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase, base44 } from "@/api/base44Client";
import {
  Plus, Search, Trash2, X, Check, NotebookPen,
  ChevronLeft, Share2, Tag,
} from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

// ─── Validation & sanitization ───────────────────────────────────────────────
function validateNote({ title }) {
  if (!title?.trim()) return "Title is required";
  if (title.trim().length > 200) return "Title too long (max 200 chars)";
  return null;
}
function sanitizeTag(t) { return (t || "").trim().slice(0, 50); }

const TAG_COLORS = ["#2A69FF", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6B7280"];

// ─── Shared styles ────────────────────────────────────────────────────────────
const CARD = { background: "var(--card)", borderRadius: "var(--card-radius)", boxShadow: "var(--card-shadow)" };
const LABEL = { fontFamily: "'DM Mono', monospace", fontSize: "10px", fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" };

export default function Notes({ embedded = false }) {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const [currentUser, setCurrentUser]       = useState(null);
  const [selectedId, setSelectedId]         = useState(searchParams.get("note") || null);
  const [editData, setEditData]             = useState(null);
  const [filterTag, setFilterTag]           = useState(null);
  const [search, setSearch]                 = useState("");
  const [mobileView, setMobileView]         = useState(selectedId ? "editor" : "list");
  const [saveError, setSaveError]           = useState(null);
  const [newTagInput, setNewTagInput]       = useState("");
  const [showNewTag, setShowNewTag]         = useState(false);
  const [showShare, setShowShare]           = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: notes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: userTags = [] } = useQuery({
    queryKey: ["user-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_tags").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: shareableProfiles = [] } = useQuery({
    queryKey: ["shareable-profiles", currentUser?.role],
    queryFn: async () => {
      if (!currentUser?.role) return [];
      const targetRole = currentUser.role === "admin" ? "freelancer" : "admin";
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", targetRole)
        .neq("id", currentUser.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
  });

  // Open note from URL param
  useEffect(() => {
    const id = searchParams.get("note");
    if (id && notes.length > 0) {
      const note = notes.find(n => n.id === id);
      if (note && selectedId !== id) { openNote(note); }
    }
  }, [searchParams, notes]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async (note) => {
      const err = validateNote(note);
      if (err) throw new Error(err);
      const payload = {
        title: note.title.trim().slice(0, 200),
        content: (note.content || "").slice(0, 50000),
        tags: (note.tags || []).map(sanitizeTag).filter(Boolean).slice(0, 20),
        shared_with: (note.shared_with || []).slice(0, 50),
        created_by: currentUser.id,
      };
      if (note.id) {
        const { data, error } = await supabase.from("notes").update(payload).eq("id", note.id).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from("notes").insert(payload).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(saved.id);
      setEditData(saved);
      setSaveError(null);
      setDeleteConfirm(false);
    },
    onError: (e) => setSaveError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(null);
      setEditData(null);
      setMobileView("list");
      setDeleteConfirm(false);
    },
    onError: (e) => setSaveError(e.message),
  });

  const createTagMut = useMutation({
    mutationFn: async ({ name, color }) => {
      const cleanName = sanitizeTag(name);
      if (!cleanName) throw new Error("Tag name required");
      const { data, error } = await supabase.from("user_tags").insert({
        user_id: currentUser.id,
        name: cleanName,
        color,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-tags"] });
      setNewTagInput("");
      setShowNewTag(false);
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openNote = (note) => {
    setSelectedId(note.id);
    setEditData({ ...note });
    setSaveError(null);
    setDeleteConfirm(false);
    setShowShare(false);
    setMobileView("editor");
  };

  const newNote = () => {
    setSelectedId(null);
    setEditData({ title: "", content: "", tags: [], shared_with: [], created_by: currentUser?.id });
    setSaveError(null);
    setDeleteConfirm(false);
    setShowShare(false);
    setMobileView("editor");
  };

  const update = (field, value) => setEditData(prev => ({ ...prev, [field]: value }));

  const toggleTag = (name) => {
    const cur = editData?.tags || [];
    update("tags", cur.includes(name) ? cur.filter(t => t !== name) : [...cur, name]);
  };

  const toggleShare = (uid) => {
    const cur = editData?.shared_with || [];
    update("shared_with", cur.includes(uid) ? cur.filter(id => id !== uid) : [...cur, uid]);
  };

  const isOwner = !editData?.id || editData?.created_by === currentUser?.id;

  // ── Filtered note list ────────────────────────────────────────────────────
  const filtered = notes.filter(n => {
    if (search) {
      const q = search.toLowerCase();
      if (!n.title?.toLowerCase().includes(q) && !n.content?.toLowerCase().includes(q)) return false;
    }
    if (filterTag === "shared") return (n.shared_with?.length > 0) || n.created_by !== currentUser?.id;
    if (filterTag === "mine")   return n.created_by === currentUser?.id;
    if (filterTag)              return n.tags?.includes(filterTag);
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LEFT PANEL
  // ─────────────────────────────────────────────────────────────────────────
  const leftPanel = (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Notes</span>
          <button
            onClick={newNote}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "var(--brand)", color: "#fff",
              border: "none", borderRadius: 8, padding: "5px 10px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <Plus style={{ width: 12, height: 12 }} /> New
          </button>
        </div>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "var(--muted)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            style={{
              width: "100%", padding: "6px 8px 6px 26px", borderRadius: 8,
              border: "1px solid var(--divider)", background: "var(--bg)",
              fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--ink)",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Tag filters */}
      <div style={{ padding: "8px 12px 8px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[
            { key: null,     label: "All",      count: notes.length },
            { key: "mine",   label: "My notes", count: notes.filter(n => n.created_by === currentUser?.id).length },
            { key: "shared", label: "Shared",   count: notes.filter(n => n.shared_with?.length > 0 || n.created_by !== currentUser?.id).length },
            ...userTags.map(t => ({ key: t.name, label: t.name, count: notes.filter(n => n.tags?.includes(t.name)).length, color: t.color })),
          ].map(({ key, label, count, color }) => (
            <button
              key={String(key)}
              onClick={() => setFilterTag(key)}
              style={{
                padding: "2px 8px", borderRadius: 99, border: `1.5px solid ${filterTag === key ? (color || "var(--brand)") : "var(--divider)"}`,
                background: filterTag === key ? `${color || "var(--brand)"}18` : "transparent",
                color: filterTag === key ? (color || "var(--brand)") : "var(--muted)",
                fontSize: 10, fontWeight: 500, cursor: "pointer",
                fontFamily: "'DM Mono', monospace",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {color && <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />}
              {label} <span style={{ opacity: 0.55 }}>({count})</span>
            </button>
          ))}
          {/* Add tag button */}
          {!showNewTag ? (
            <button
              onClick={() => setShowNewTag(true)}
              style={{ padding: "2px 8px", borderRadius: 99, border: "1.5px dashed var(--divider)", background: "transparent", color: "var(--muted)", fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}
            >
              + Tag
            </button>
          ) : (
            <form
              onSubmit={e => { e.preventDefault(); createTagMut.mutate({ name: newTagInput, color: TAG_COLORS[userTags.length % TAG_COLORS.length] }); }}
              style={{ display: "flex", gap: 4, alignItems: "center" }}
            >
              <input
                autoFocus
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value.slice(0, 50))}
                placeholder="Tag name"
                style={{ width: 75, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--brand)", fontSize: 10, fontFamily: "'DM Mono', monospace", outline: "none", background: "var(--bg)", color: "var(--ink)" }}
              />
              <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", padding: 0 }}><Check style={{ width: 12, height: 12 }} /></button>
              <button type="button" onClick={() => { setShowNewTag(false); setNewTagInput(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}><X style={{ width: 12, height: 12 }} /></button>
            </form>
          )}
        </div>
      </div>

      {/* Note list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "28px 14px", textAlign: "center" }}>
            <NotebookPen style={{ width: 22, height: 22, color: "var(--muted)", opacity: 0.2, margin: "0 auto 6px" }} />
            <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>No notes</p>
          </div>
        ) : filtered.map(note => {
          const isMine = note.created_by === currentUser?.id;
          const isSelected = selectedId === note.id;
          return (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              style={{
                width: "100%", textAlign: "left", padding: "9px 12px",
                borderBottom: "1px solid var(--divider)",
                background: isSelected ? "rgba(42,105,255,0.06)" : "transparent",
                border: "none", cursor: "pointer",
                borderLeft: `3px solid ${isSelected ? "var(--brand)" : "transparent"}`,
                transition: "background 120ms",
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "72%" }}>
                  {note.title || "Untitled"}
                </p>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", flexShrink: 0 }}>
                  {note.updated_at ? format(new Date(note.updated_at), "d MMM", { locale: enUS }) : ""}
                </span>
              </div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {note.content?.slice(0, 55) || "—"}
              </p>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                {!isMine && (
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "var(--brand)", background: "rgba(42,105,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>shared with you</span>
                )}
                {isMine && note.shared_with?.length > 0 && (
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#8b5cf6", background: "rgba(139,92,246,0.08)", padding: "1px 5px", borderRadius: 4 }}>shared</span>
                )}
                {(note.tags || []).slice(0, 2).map(tag => {
                  const t = userTags.find(x => x.name === tag);
                  return (
                    <span key={tag} style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: t?.color || "var(--muted)", padding: "1px 5px", borderRadius: 4, border: `1px solid ${(t?.color || "#6B7280")}40` }}>
                      {tag}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // EDITOR PANEL
  // ─────────────────────────────────────────────────────────────────────────
  const editorPanel = !editData ? (
    <div style={{ ...CARD, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <NotebookPen style={{ width: 32, height: 32, color: "var(--muted)", opacity: 0.15 }} />
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)" }}>Select a note or create a new one</p>
      <button
        onClick={newNote}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <Plus style={{ width: 13, height: 13 }} /> New note
      </button>
    </div>
  ) : (
    <div style={{ ...CARD, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Mobile back */}
      <div className="flex md:hidden" style={{ padding: "8px 12px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
        <button
          onClick={() => setMobileView("list")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}
        >
          <ChevronLeft style={{ width: 13, height: 13 }} /> All notes
        </button>
      </div>

      {/* Read-only shared badge */}
      {!isOwner && (
        <div style={{ padding: "6px 20px", background: "rgba(42,105,255,0.06)", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--brand)" }}>Shared with you — read only</span>
        </div>
      )}

      {/* Title */}
      <input
        value={editData.title}
        onChange={e => update("title", e.target.value.slice(0, 200))}
        placeholder="Note title..."
        readOnly={!isOwner}
        style={{
          padding: "20px 22px 6px", border: "none", outline: "none",
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700,
          color: "var(--ink)", background: "transparent", flexShrink: 0,
        }}
      />

      {/* Content */}
      <textarea
        value={editData.content}
        onChange={e => update("content", e.target.value.slice(0, 50000))}
        placeholder="Start writing..."
        readOnly={!isOwner}
        style={{
          flex: 1, padding: "6px 22px", border: "none", outline: "none",
          resize: "none", fontFamily: "'DM Mono', monospace", fontSize: 13,
          lineHeight: 1.75, color: "var(--ink)", background: "transparent",
          minHeight: 0,
        }}
      />

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--divider)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Tags (owner only) */}
        {isOwner && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <Tag style={{ width: 10, height: 10, color: "var(--muted)" }} />
              <span style={LABEL}>Tags</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {userTags.map(tag => {
                const active = editData.tags?.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    style={{
                      padding: "2px 8px", borderRadius: 99,
                      border: `1.5px solid ${active ? tag.color : "var(--divider)"}`,
                      background: active ? `${tag.color}18` : "transparent",
                      color: active ? tag.color : "var(--muted)",
                      fontSize: 10, cursor: "pointer",
                      fontFamily: "'DM Mono', monospace",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? tag.color : "var(--muted)" }} />
                    {tag.name}
                  </button>
                );
              })}
              {userTags.length === 0 && (
                <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>Create a tag from the left panel</span>
              )}
            </div>
          </div>
        )}
        {/* Read-only tags */}
        {!isOwner && editData.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {editData.tags.map(tag => (
              <span key={tag} style={{ padding: "2px 8px", borderRadius: 99, border: "1px solid var(--divider)", color: "var(--muted)", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Share (owner only, if there are profiles to share with) */}
        {isOwner && shareableProfiles.length > 0 && (
          <div>
            <button
              onClick={() => setShowShare(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "none", cursor: "pointer",
                color: editData.shared_with?.length > 0 ? "var(--brand)" : "var(--muted)",
                fontFamily: "'DM Mono', monospace", fontSize: 10,
              }}
            >
              <Share2 style={{ width: 10, height: 10 }} />
              {editData.shared_with?.length > 0 ? `Shared with ${editData.shared_with.length} person${editData.shared_with.length > 1 ? "s" : ""}` : "Share note"}
            </button>
            {showShare && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {shareableProfiles.map(p => {
                  const isShared = editData.shared_with?.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleShare(p.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                        borderRadius: 8, border: `1px solid ${isShared ? "var(--brand)" : "var(--divider)"}`,
                        background: isShared ? "rgba(42,105,255,0.05)" : "transparent",
                        cursor: "pointer", width: "100%", textAlign: "left",
                      }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: isShared ? "var(--brand)" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {p.full_name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <span style={{ flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: "var(--ink)" }}>
                        {p.full_name || "Unknown"}
                      </span>
                      {isShared && <Check style={{ width: 12, height: 12, color: "var(--brand)", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {saveError && (
          <p style={{ fontSize: 11, color: "#ef4444", fontFamily: "'DM Mono', monospace", margin: 0 }}>{saveError}</p>
        )}

        {/* Actions */}
        {isOwner && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editData.id ? (
              deleteConfirm ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#ef4444" }}>Confirm?</span>
                  <button
                    onClick={() => deleteMut.mutate(editData.id)}
                    disabled={deleteMut.isPending}
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#ef4444", fontWeight: 600 }}
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}
                >
                  <Trash2 style={{ width: 12, height: 12 }} /> Delete
                </button>
              )
            ) : <div />}

            <button
              onClick={() => saveMut.mutate(editData)}
              disabled={saveMut.isPending}
              style={{
                background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8,
                padding: "7px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: saveMut.isPending ? 0.7 : 1,
              }}
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Desktop: 2-panel */}
      <div
        className="hidden md:grid"
        style={{ gridTemplateColumns: "260px 1fr", gap: 12, height: embedded ? "calc(100dvh - 200px)" : "calc(100dvh - 110px)" }}
      >
        {leftPanel}
        {editorPanel}
      </div>

      {/* Mobile: single panel */}
      <div className="flex md:hidden" style={{ height: embedded ? "calc(100dvh - 200px)" : "calc(100dvh - 110px)" }}>
        {mobileView === "list" ? leftPanel : editorPanel}
      </div>
    </div>
  );
}
