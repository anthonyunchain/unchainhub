import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import {
  Plus, Trash2, X, Check, ChevronLeft, NotebookPen,
  Bold, Italic, Cloud, CloudOff, Users,
} from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

function stripHtml(html) { return (html || "").replace(/<[^>]*>/g, ""); }

function toEditorHtml(content) {
  if (!content) return "";
  if (/<[a-z][\s\S]*?>/i.test(content)) return content;
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

const CARD  = { background: "var(--card)", borderRadius: "var(--card-radius)", boxShadow: "var(--card-shadow)" };
const LABEL = { fontFamily: "'DM Mono', monospace", fontSize: "10px", fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" };

export default function MeetingNotes() {
  const qc = useQueryClient();

  const [selectedId, setSelectedId]     = useState(null);
  const [editData, setEditData]         = useState(null);
  const [search, setSearch]             = useState("");
  const [mobileView, setMobileView]     = useState("list");
  const [isMobile, setIsMobile]         = useState(() => window.matchMedia("(max-width: 639px)").matches);
  const [saveStatus, setSaveStatus]     = useState(null);
  const [saveError, setSaveError]       = useState(null);
  const [filterClient, setFilterClient] = useState(null);

  const lastSavedRef  = useRef(null);
  const saveTimerRef  = useRef(null);
  const editDataRef   = useRef(null);
  const editorRef     = useRef(null);
  const titleInputRef = useRef(null);

  useEffect(() => { editDataRef.current = editData; }, [editData]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: notes = [] } = useQuery({
    queryKey: ["meeting-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_notes")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("status", "Actif")
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  // ── Stable key ───────────────────────────────────────────────────────────
  function stableKey(d) {
    if (!d) return null;
    return JSON.stringify({ title: d.title, content: d.content, date: d.date, client_id: d.client_id ?? null, client_name: d.client_name ?? "" });
  }

  // ── Auto-save ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editData) return;
    if (!editData.title?.trim()) return;
    if (stableKey(editData) === lastSavedRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveMut.mutate(editData); }, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [editData]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async (note) => {
      if (!note.title?.trim()) throw new Error("Title is required");
      const payload = {
        title: note.title.trim().slice(0, 200),
        content: (note.content || "").slice(0, 100000),
        date: note.date || new Date().toISOString().slice(0, 10),
        client_id: note.client_id || null,
        client_name: note.client_name || "",
      };
      if (note.id) {
        const { data, error } = await supabase.from("meeting_notes").update(payload).eq("id", note.id).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from("meeting_notes").insert(payload).select().single();
        if (error) throw error;
        return data;
      }
    },
    onMutate: () => setSaveStatus("saving"),
    onSuccess: (saved) => {
      lastSavedRef.current = stableKey(saved);
      qc.invalidateQueries({ queryKey: ["meeting-notes"] });
      setSelectedId(saved.id);
      setEditData(prev => prev ? { ...prev, id: saved.id, created_at: saved.created_at, updated_at: saved.updated_at } : saved);
      setSaveError(null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    },
    onError: (e) => { setSaveError(e.message); setSaveStatus("error"); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("meeting_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting-notes"] });
      setSelectedId(null);
      setEditData(null);
      lastSavedRef.current = null;
      setMobileView("list");
      setSaveStatus(null);
    },
    onError: (e) => setSaveError(e.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const flushAndSwitch = (cb) => {
    clearTimeout(saveTimerRef.current);
    const cur = editDataRef.current;
    if (cur?.id && stableKey(cur) !== lastSavedRef.current && cur.title?.trim()) {
      supabase.from("meeting_notes").update({
        title: cur.title.trim().slice(0, 200),
        content: (cur.content || "").slice(0, 100000),
        date: cur.date || new Date().toISOString().slice(0, 10),
        client_id: cur.client_id || null,
        client_name: cur.client_name || "",
      }).eq("id", cur.id);
    }
    cb();
  };

  const openNote = (note) => {
    flushAndSwitch(() => {
      lastSavedRef.current = stableKey(note);
      setSelectedId(note.id);
      setEditData({ ...note });
      setSaveError(null);
      setMobileView("editor");
      setSaveStatus(null);
    });
  };

  const newNote = () => {
    flushAndSwitch(() => {
      lastSavedRef.current = null;
      const today = new Date().toISOString().slice(0, 10);
      setSelectedId(null);
      setEditData({ title: "", content: "", date: today, client_id: filterClient || null, client_name: "" });
      setSaveError(null);
      setMobileView("editor");
      setSaveStatus(null);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    });
  };

  const update = (field, value) => setEditData(prev => ({ ...prev, [field]: value }));

  const setEditorRef = useCallback((el) => {
    editorRef.current = el;
    if (el) el.innerHTML = toEditorHtml(editData?.content || "");
  }, [editData?.id]); // eslint-disable-line

  const applyFormat = useCallback((cmd) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false, null);
    update("content", editorRef.current.innerHTML.slice(0, 100000));
  }, []);

  // ── Filtered / grouped list ───────────────────────────────────────────────
  const filtered = notes.filter(n => {
    if (filterClient && n.client_id !== filterClient) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!n.title?.toLowerCase().includes(q) && !n.client_name?.toLowerCase().includes(q) && !stripHtml(n.content).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group by client for sidebar display
  const uniqueClients = [...new Map(notes.filter(n => n.client_id).map(n => [n.client_id, { id: n.client_id, name: n.client_name }])).values()];

  // ─────────────────────────────────────────────────────────────────────────
  // LEFT PANEL
  // ─────────────────────────────────────────────────────────────────────────
  const leftPanel = (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Meeting Notes</span>
          <button
            onClick={newNote}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "var(--brand)", color: "#fff", border: "none",
              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <Plus style={{ width: 13, height: 13 }} /> New
          </button>
        </div>
        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search meetings..."
          style={{
            width: "100%", padding: "7px 10px", borderRadius: 9,
            border: "1px solid var(--divider)", background: "var(--bg)",
            fontSize: 12, fontFamily: "'DM Mono', monospace", color: "var(--ink)",
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Client filter pills */}
      {uniqueClients.length > 0 && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--divider)", flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 5 }}>
          <button
            onClick={() => setFilterClient(null)}
            style={{
              padding: "3px 9px", borderRadius: 99, fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: "pointer",
              border: `1.5px solid ${filterClient === null ? "var(--brand)" : "var(--divider)"}`,
              background: filterClient === null ? "rgba(42,105,255,0.08)" : "transparent",
              color: filterClient === null ? "var(--brand)" : "var(--muted)",
            }}
          >
            All
          </button>
          {uniqueClients.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterClient(filterClient === c.id ? null : c.id)}
              style={{
                padding: "3px 9px", borderRadius: 99, fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: "pointer",
                border: `1.5px solid ${filterClient === c.id ? "var(--brand)" : "var(--divider)"}`,
                background: filterClient === c.id ? "rgba(42,105,255,0.08)" : "transparent",
                color: filterClient === c.id ? "var(--brand)" : "var(--muted)",
              }}
            >
              {c.company_name}
            </button>
          ))}
        </div>
      )}

      {/* Note list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "36px 16px", textAlign: "center" }}>
            <NotebookPen style={{ width: 26, height: 26, color: "var(--muted)", opacity: 0.2, margin: "0 auto 8px" }} />
            <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>No meeting notes</p>
          </div>
        ) : filtered.map(note => {
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
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>
                  {note.title || "Untitled"}
                </p>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", flexShrink: 0 }}>
                  {note.date ? format(new Date(note.date + "T12:00:00"), "d MMM yyyy", { locale: enUS }) : ""}
                </span>
              </div>
              {note.client_name && (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--brand)", margin: "0 0 3px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Users style={{ width: 9, height: 9 }} /> {note.client_name}
                </p>
              )}
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stripHtml(note.content)?.slice(0, 60) || "—"}
              </p>
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
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--muted)" }}>Select a meeting note or create a new one</p>
      <button
        onClick={newNote}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <Plus style={{ width: 14, height: 14 }} /> New meeting note
      </button>
    </div>
  ) : (
    <div style={{ ...CARD, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Toolbar */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--divider)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* Mobile back */}
        <button
          className="flex sm:hidden"
          onClick={() => setMobileView("list")}
          style={{ alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}
        >
          <ChevronLeft style={{ width: 14, height: 14 }} /> Meetings
        </button>
        <div className="hidden sm:block" />

        {/* Save status + delete */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
          {editData.id && (
            <button
              onClick={() => deleteMut.mutate(editData.id)}
              disabled={deleteMut.isPending}
              title="Delete note"
              style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--bg)", border: "1px solid var(--divider)", cursor: "pointer", color: "var(--muted)", transition: "all 150ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.borderColor = "var(--divider)"; e.currentTarget.style.color = "var(--muted)"; }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* Meta: client + date */}
      <div style={{ padding: "14px 24px 0", display: "flex", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        {/* Client selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={LABEL}>Client</span>
          <select
            value={editData.client_id || ""}
            onChange={e => {
              const id = e.target.value || null;
              const name = id ? (clients.find(c => c.id === id)?.company_name || "") : "";
              setEditData(prev => ({ ...prev, client_id: id, client_name: name }));
            }}
            style={{
              padding: "5px 10px", borderRadius: 8, border: "1px solid var(--divider)",
              background: "var(--bg)", color: "var(--ink)",
              fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", cursor: "pointer",
              minWidth: 140,
            }}
          >
            <option value="">— No client —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>

        {/* Date picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={LABEL}>Date</span>
          <input
            type="date"
            value={editData.date || ""}
            onChange={e => update("date", e.target.value)}
            style={{
              padding: "5px 10px", borderRadius: 8, border: "1px solid var(--divider)",
              background: "var(--bg)", color: "var(--ink)",
              fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
            }}
          />
        </div>
      </div>

      {/* Title */}
      <input
        ref={titleInputRef}
        value={editData.title}
        onChange={e => update("title", e.target.value.slice(0, 200))}
        onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
        placeholder="Meeting title..."
        style={{
          padding: "18px 24px 8px", border: "none", outline: "none",
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 700,
          color: "var(--ink)", background: "transparent", flexShrink: 0,
          letterSpacing: "-0.3px",
        }}
      />

      {/* Format toolbar */}
      <div style={{ padding: "0 20px 6px", display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
        {[
          { icon: Bold,   cmd: "bold",   title: "Bold (Ctrl+B)" },
          { icon: Italic, cmd: "italic", title: "Italic (Ctrl+I)" },
        ].map(({ icon: Icon, cmd, title }) => (
          <button
            key={cmd}
            onMouseDown={e => { e.preventDefault(); applyFormat(cmd); }}
            title={title}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "1px solid transparent",
              background: "transparent", cursor: "pointer", color: "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            <Icon style={{ width: 13, height: 13 }} />
          </button>
        ))}
      </div>

      {/* Content editor */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {!stripHtml(editData.content || "").trim() && (
          <span style={{
            position: "absolute", top: 8, left: 24, pointerEvents: "none", userSelect: "none",
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "var(--muted)", lineHeight: 1.8,
          }}>
            Meeting notes...
          </span>
        )}
        <div
          key={editData.id ?? "new"}
          ref={setEditorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            const newContent = editorRef.current.innerHTML.slice(0, 100000);
            update("content", newContent);
          }}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); applyFormat("bold"); }
            if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); applyFormat("italic"); }
          }}
          style={{
            flex: 1, padding: "8px 24px 16px", border: "none", outline: "none",
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15,
            lineHeight: 1.75, color: "var(--ink)", background: "transparent",
            overflowY: "auto", wordBreak: "break-word",
          }}
        />
      </div>

      {/* Footer error */}
      {saveError && (
        <div style={{ padding: "8px 20px 10px", borderTop: "1px solid var(--divider)", flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: "#ef4444", fontFamily: "'DM Mono', monospace", margin: 0 }}>{saveError}</p>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const panelHeight = "calc(100dvh - 110px)";

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {isMobile ? (
        <div style={{ margin: "0 -16px", height: panelHeight, background: "var(--card)" }}>
          {mobileView === "list" ? leftPanel : editorPanel}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, height: panelHeight }}>
          {leftPanel}
          {editorPanel}
        </div>
      )}
    </div>
  );
}
