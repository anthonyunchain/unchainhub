import { NotebookPen } from "lucide-react";

/**
 * One-click shortcut for FreelancerPortal.
 * Calls onNewNote() which switches to the notes tab and opens a blank note.
 */
export default function NotesFABFreelancer({ onNewNote }) {
  return (
    <button
      onClick={() => onNewNote?.()}
      title="New note"
      style={{
        width: 36, height: 36,
        borderRadius: "50%",
        background: "var(--card)",
        boxShadow: "var(--card-shadow)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "background 150ms, box-shadow 150ms",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--card-shadow-hover)"; e.currentTarget.style.background = "var(--brand-soft)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--card-shadow)"; e.currentTarget.style.background = "var(--card)"; }}
    >
      <NotebookPen style={{ width: 15, height: 15, color: "var(--muted)" }} />
    </button>
  );
}
