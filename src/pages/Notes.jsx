import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase, base44 } from "@/api/base44Client";
import {
  Plus, Search, Trash2, X, Check, NotebookPen,
  ChevronLeft, Share2, Tag, Cloud, CloudOff,
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

export default function Notes({ embedded = false, autoNewTrigger = 0 }) {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const [currentUser, setCurrentUser]       = useState(null);
  const [selectedId, setSelectedId]         = useState(searchParams.get("note") || null);
  const [editData, setEditData]             = useState(null);
  const [filterTag, setFilterTag]           = useState(null);
  const [search, setSearch]                 = useState("");
  const [mobileView, setMobileView]         = useState(selectedId ? "editor" : "list");
  const [saveError, setSaveError]           = useState(null);
  const [saveStatus, setSaveStatus]         = useState(null); // "saving" | "saved" | "error"
  const [newTagInput, setNewTagInput]       = useState("");
  const [showNewTag, setShowNewTag]         = useState(false);
  const [showShare, setShowShare]           = useState(false);
  const [undoStack, setUndoStack]           = useState([]); // deleted notes for Ctrl+Z
  const [undoToast, setUndoToast]           = useState(false);
  const [focusTitle, setFocusTitle]         = useState(false); // triggers title focus after render

  // Track last-saved snapshot to avoid redundant auto-saves
  const lastSavedRef  = useRef(null);
  const saveTimerRef  = useRef(null);
  const titleInputRef = useRef(null);
  const undoToastTimer = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  // Open a blank new note when ?new=1 is in the URL or autoNewTrigger fires
  const autoNewDoneRef = useRef(false);
  useEffect(() => {
    if (!currentUser) return;
    const wantsNew = searchParams.get("new") === "1";
    if (wantsNew && !autoNewDoneRef.current) {
      autoNewDoneRef.current = true;
      newNote();
    }
  }, [currentUser, searchParams]);

  useEffect(() => {
    if (!currentUser || autoNewTrigger === 0) return;
    newNote();
  }, [autoNewTrigger]);

  // Focus title after render when flagged
  useEffect(() => {
    if (focusTitle) {
      titleInputRef.current?.focus();
      setFocusTitle(false);
    }
  }, [focusTitle]);

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
      if (note && selectedId !== id) openNote(note);
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
    onMutate: () => setSaveStatus("saving"),
    onSuccess: (saved) => {
      lastSavedRef.current = stableKey(saved);
      qc.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(saved.id);
      setEditData(saved);
      setSaveError(null);
      setSaveStatus("saved");
      // fade out "Saved" indicator after 2s
      setTimeout(() => setSaveStatus(null), 2000);
    },
    onError: (e) => {
      setSaveError(e.message);
      setSaveStatus("error");
    },
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
      lastSavedRef.current = null;
      setMobileView("list");
      setSaveStatus(null);
      // Show undo toast for 5s
      setUndoToast(true);
      clearTimeout(undoToastTimer.current);
      undoToastTimer.current = setTimeout(() => setUndoToast(false), 5000);
    },
    onError: (e) => setSaveError(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: async (note) => {
      const { id: _id, created_at, updated_at, ...payload } = note;
      const { data, error } = await supabase.from("notes").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (restored) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setUndoStack(s => s.slice(0, -1));
      setUndoToast(false);
      openNote(restored);
    },
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

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // Produces a stable string key from note data (excluding fields we don't save)
  function stableKey(d) {
    if (!d) return null;
    return JSON.stringify({
      title: d.title, content: d.content,
      tags: d.tags, shared_with: d.shared_with,
    });
  }

  useEffect(() => {
    if (!editData || !currentUser) return;
    const isOwner = !editData.id || editData.created_by === currentUser.id;
    if (!isOwner) return;
    if (!editData.title?.trim()) return;
    if (stableKey(editData) === lastSavedRef.current) return; // no real change

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMut.mutate(editData);
    }, 1500);

    return () => clearTimeout(saveTimerRef.current);
  }, [editData, currentUser]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Backspace (outside inputs) → delete selected note immediately
      if (e.key === "Backspace") {
        if (!selectedId || !editData?.id) return;
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
        e.preventDefault();
        setUndoStack(s => [...s, editData]);
        deleteMut.mutate(editData.id);
        return;
      }
      // Ctrl+Z → restore last deleted note
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        setUndoStack(s => {
          if (!s.length) return s;
          const note = s[s.length - 1];
          restoreMut.mutate(note);
          return s; // slice happens in onSuccess
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editData]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openNote = (note) => {
    clearTimeout(saveTimerRef.current);
    lastSavedRef.current = stableKey(note);
    setSelectedId(note.id);
    setEditData({ ...note });
    setSaveError(null);
    setShowShare(false);
    setMobileView("editor");
    setSaveStatus(null);
  };

  const newNote = () => {
    clearTimeout(saveTimerRef.current);
    lastSavedRef.current = null;
    setSelectedId(null);
    setEditData({ title: "", content: "", tags: [], shared_with: [], created_by: currentUser?.id });
    setSaveError(null);
    setShowShare(false);
    setMobileView("editor");
    setSaveStatus(null);
    setFocusTitle(true); // focus after React re-renders the input
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
      <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Notes</span>
          <button
            onClick={newNote}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "var(--brand)", color: "#fff",
              border: "none", borderRadius: 8, padding: "6px 12px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <Plus style={{ width: 13, height: 13 }} /> New
          </button>
        </div>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--muted)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            style={{
              width: "100%", padding: "7px 10px 7px 30px", borderRadius: 9,
              border: "1px solid var(--divider)", background: "var(--bg)",
              fontSize: 12, fontFamily: "'DM Mono', monospace", color: "var(--ink)",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Tag filters */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
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
                padding: "3px 9px", borderRadius: 99, border: `1.5px solid ${filterTag === key ? (color || "var(--brand)") : "var(--divider)"}`,
                background: filterTag === key ? `${color || "var(--brand)"}18` : "transparent",
                color: filterTag === key ? (color || "var(--brand)") : "var(--muted)",
                fontSize: 10, fontWeight: 500, cursor: "pointer",
                fontFamily: "'DM Mono', monospace",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {color && <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />}
              {label} <span style={{ opacity: 0.55 }}>({count})</span>
            </button>
          ))}
          {/* Add tag button */}
          {!showNewTag ? (
            <button
              onClick={() => setShowNewTag(true)}
              style={{ padding: "3px 9px", borderRadius: 99, border: "1.5px dashed var(--divider)", background: "transparent", color: "var(--muted)", fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}
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
                style={{ width: 80, padding: "3px 7px", borderRadius: 6, border: "1px solid var(--brand)", fontSize: 11, fontFamily: "'DM Mono', monospace", outline: "none", background: "var(--bg)", color: "var(--ink)" }}
              />
              <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", padding: 0 }}><Check style={{ width: 13, height: 13 }} /></button>
              <button type="button" onClick={() => { setShowNewTag(false); setNewTagInput(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}><X style={{ width: 13, height: 13 }} /></button>
            </form>
          )}
        </div>
      </div>

      {/* Note list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "36px 16px", textAlign: "center" }}>
            <NotebookPen style={{ width: 26, height: 26, color: "var(--muted)", opacity: 0.2, margin: "0 auto 8px" }} />
            <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>No notes</p>
          </div>
        ) : filtered.map(note => {
          const isMine = note.created_by === currentUser?.id;
          const isSelected = selectedId === note.id;
          return (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              style={{
                width: "100%", textAlign: "left", padding: "11px 14px",
                borderBottom: "1px solid var(--divider)",
                background: isSelected ? "rgba(42,105,255,0.06)" : "transparent",
                border: "none", cursor: "pointer",
                borderLeft: `3px solid ${isSelected ? "var(--brand)" : "transparent"}`,
                transition: "background 120ms",
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "72%" }}>
                  {note.title || "Untitled"}
                </p>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", flexShrink: 0 }}>
                  {note.updated_at ? format(new Date(note.updated_at), "d MMM", { locale: enUS }) : ""}
                </span>
              </div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {note.content?.slice(0, 60) || "—"}
              </p>
              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                {!isMine && (
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "var(--brand)", background: "rgba(42,105,255,0.08)", padding: "1px 6px", borderRadius: 4 }}>shared with you</span>
                )}
                {isMine && note.shared_with?.length > 0 && (
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#8b5cf6", background: "rgba(139,92,246,0.08)", padding: "1px 6px", borderRadius: 4 }}>shared</span>
                )}
                {(note.tags || []).slice(0, 2).map(tag => {
                  const t = userTags.find(x => x.name === tag);
                  return (
                    <span key={tag} style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: t?.color || "var(--muted)", padding: "1px 6px", borderRadius: 4, border: `1px solid ${(t?.color || "#6B7280")}40` }}>
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
    <div style={{ ...CARD, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <NotebookPen style={{ width: 38, height: 38, color: "var(--muted)", opacity: 0.15 }} />
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--muted)" }}>Select a note or create a new one</p>
      <button
        onClick={newNote}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <Plus style={{ width: 14, height: 14 }} /> New note
      </button>
    </div>
  ) : (
    <div style={{ ...CARD, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Editor toolbar ── */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--divider)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* Mobile back */}
        <button
          className="flex md:hidden"
          onClick={() => setMobileView("list")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}
        >
          <ChevronLeft style={{ width: 14, height: 14 }} /> Notes
        </button>
        <div className="hidden md:block" />

        {/* Right: status + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Save status */}
          {saveStatus === "saving" && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Cloud style={{ width: 11, height: 11, opacity: 0.5 }} /> Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
              <Check style={{ width: 11, height: 11 }} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
              <CloudOff style={{ width: 11, height: 11 }} /> Error
            </span>
          )}

          {/* Read-only badge */}
          {!isOwner && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--brand)", background: "rgba(42,105,255,0.07)", padding: "3px 8px", borderRadius: 6 }}>read only</span>
          )}

          {/* Share button (owner only) */}
          {isOwner && shareableProfiles.length > 0 && (
            <button
              onClick={() => setShowShare(v => !v)}
              title="Share note"
              style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: showShare || editData.shared_with?.length > 0 ? "rgba(42,105,255,0.1)" : "var(--bg)",
                border: `1px solid ${showShare || editData.shared_with?.length > 0 ? "rgba(42,105,255,0.25)" : "var(--divider)"}`,
                cursor: "pointer",
                color: editData.shared_with?.length > 0 ? "var(--brand)" : "var(--muted)",
                position: "relative",
              }}
            >
              <Share2 style={{ width: 14, height: 14 }} />
              {editData.shared_with?.length > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "var(--brand)", color: "#fff",
                  fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {editData.shared_with.length}
                </span>
              )}
            </button>
          )}

          {/* Delete button (owner, existing note only) — no confirmation, Ctrl+Z to undo */}
          {isOwner && editData.id && (
            <button
              onClick={() => { setUndoStack(s => [...s, editData]); deleteMut.mutate(editData.id); }}
              disabled={deleteMut.isPending}
              title="Delete note (Backspace / Ctrl+Z to undo)"
              style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--bg)", border: "1px solid var(--divider)",
                cursor: "pointer", color: "var(--muted)",
                transition: "all 150ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.borderColor = "var(--divider)"; e.currentTarget.style.color = "var(--muted)"; }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* Share picker dropdown */}
      {showShare && isOwner && shareableProfiles.length > 0 && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--divider)", flexShrink: 0, background: "rgba(42,105,255,0.02)" }}>
          <p style={{ ...LABEL, marginBottom: 8 }}>Share with</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {shareableProfiles.map(p => {
              const isShared = editData.shared_with?.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleShare(p.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                    borderRadius: 10, border: `1px solid ${isShared ? "var(--brand)" : "var(--divider)"}`,
                    background: isShared ? "rgba(42,105,255,0.05)" : "transparent",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    transition: "all 150ms",
                  }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: isShared ? "var(--brand)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isShared ? "#fff" : "var(--muted)", flexShrink: 0 }}>
                    {p.full_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <span style={{ flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                    {p.full_name || "Unknown"}
                  </span>
                  {isShared && <Check style={{ width: 13, height: 13, color: "var(--brand)", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Title */}
      <input
        ref={titleInputRef}
        value={editData.title}
        onChange={e => update("title", e.target.value.slice(0, 200))}
        placeholder="Note title..."
        readOnly={!isOwner}
        style={{
          padding: "22px 24px 8px", border: "none", outline: "none",
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 700,
          color: "var(--ink)", background: "transparent", flexShrink: 0,
          letterSpacing: "-0.3px",
        }}
      />

      {/* Content */}
      <textarea
        value={editData.content}
        onChange={e => update("content", e.target.value.slice(0, 50000))}
        placeholder="Start writing..."
        readOnly={!isOwner}
        style={{
          flex: 1, padding: "8px 24px 16px", border: "none", outline: "none",
          resize: "none", fontFamily: "'DM Mono', monospace", fontSize: 14,
          lineHeight: 1.8, color: "var(--ink)", background: "transparent",
          minHeight: 0,
        }}
      />

      {/* Footer: tags */}
      {(isOwner || editData.tags?.length > 0) && (
        <div style={{ padding: "12px 20px 14px", borderTop: "1px solid var(--divider)", flexShrink: 0 }}>
          {/* Tags (owner only) */}
          {isOwner && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                <Tag style={{ width: 11, height: 11, color: "var(--muted)" }} />
                <span style={LABEL}>Tags</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {userTags.map(tag => {
                  const active = editData.tags?.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.name)}
                      style={{
                        padding: "3px 10px", borderRadius: 99,
                        border: `1.5px solid ${active ? tag.color : "var(--divider)"}`,
                        background: active ? `${tag.color}18` : "transparent",
                        color: active ? tag.color : "var(--muted)",
                        fontSize: 11, cursor: "pointer",
                        fontFamily: "'DM Mono', monospace",
                        display: "flex", alignItems: "center", gap: 5,
                        transition: "all 120ms",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? tag.color : "var(--muted)", flexShrink: 0 }} />
                      {tag.name}
                    </button>
                  );
                })}
                {userTags.length === 0 && (
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>Create a tag from the left panel</span>
                )}
              </div>
            </div>
          )}
          {/* Read-only tags */}
          {!isOwner && editData.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {editData.tags.map(tag => (
                <span key={tag} style={{ padding: "3px 10px", borderRadius: 99, border: "1px solid var(--divider)", color: "var(--muted)", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{tag}</span>
              ))}
            </div>
          )}
          {/* Error */}
          {saveError && (
            <p style={{ fontSize: 11, color: "#ef4444", fontFamily: "'DM Mono', monospace", margin: "8px 0 0" }}>{saveError}</p>
          )}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const panelHeight = embedded ? "calc(100dvh - 200px)" : "calc(100dvh - 110px)";

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative" }}>
      {/* Desktop: 2-panel */}
      <div
        className="hidden md:grid"
        style={{ gridTemplateColumns: "320px 1fr", gap: 12, height: panelHeight }}
      >
        {leftPanel}
        {editorPanel}
      </div>

      {/* Mobile: single panel */}
      <div className="flex md:hidden" style={{ height: panelHeight }}>
        {mobileView === "list" ? leftPanel : editorPanel}
      </div>

      {/* Undo toast */}
      {undoToast && undoStack.length > 0 && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "rgba(20,20,30,0.92)", color: "#fff",
          borderRadius: 12, padding: "10px 18px",
          display: "flex", alignItems: "center", gap: 12,
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          zIndex: 9999, backdropFilter: "blur(8px)",
          pointerEvents: "all",
        }}>
          <span style={{ opacity: 0.75 }}>Note deleted</span>
          <button
            onClick={() => {
              const note = undoStack[undoStack.length - 1];
              if (note) restoreMut.mutate(note);
            }}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 7,
              padding: "4px 10px", color: "#fff", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace",
            }}
          >
            Ctrl+Z Undo
          </button>
        </div>
      )}
    </div>
  );
}
