import { NotebookPen } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * One-click shortcut: navigates straight to /Notes?new=1
 * which opens the full Notes page with a blank new note ready.
 */
export default function NotesFAB() {
  return (
    <Link
      to="/Notes?new=1"
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
        textDecoration: "none",
        transition: "background 150ms, box-shadow 150ms",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--card-shadow-hover)"; e.currentTarget.style.background = "var(--brand-soft)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--card-shadow)"; e.currentTarget.style.background = "var(--card)"; }}
    >
      <NotebookPen style={{ width: 15, height: 15, color: "var(--muted)" }} />
    </Link>
  );
}
