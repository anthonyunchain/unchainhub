// ─── Single source of truth for video-editing status (editorial_content) ──────
// Option A: editorial_content is the single source of truth for video editing.
// A piece of content that needs editing is tracked here via `editing_status`,
// no separate `projects` row. Import these everywhere instead of redefining maps.

// Display config for status pills (bg / text / dot Tailwind classes).
export const EDITING_STATUS = {
  "Non assigné":               { label: "Unassigned",      bg: "bg-slate-50",   text: "text-slate-500",  dot: "bg-slate-300"  },
  "En attente d'acceptation":  { label: "Pending",         bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400"  },
  "À faire":                   { label: "To do",           bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-400"   },
  "En cours de montage":       { label: "Editing",         bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500" },
  "En attente de retour":      { label: "Awaiting review", bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-500" },
  "Subtitles":                 { label: "Subtitles",       bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-teal-500"   },
  "Terminé":                   { label: "Done",            bg: "bg-emerald-50", text: "text-emerald-700",dot: "bg-emerald-500"},
};

// Order shown in admin selects (assignment dropdowns).
export const EDITING_STATUS_OPTIONS = [
  "Non assigné",
  "En attente d'acceptation",
  "À faire",
  "En cours de montage",
  "En attente de retour",
  "Subtitles",
  "Terminé",
];

// English labels (mirrors EDITING_STATUS[x].label, kept as a flat map for convenience).
export const EDITING_STATUS_LABELS = Object.fromEntries(
  Object.entries(EDITING_STATUS).map(([k, v]) => [k, v.label])
);

// Active editing workflow used for the step-progress bar.
// "Non assigné" / "En attente d'acceptation" are pre-steps (index -1 = not started).
export const EDITING_STEPS = [
  { key: "À faire",              label: "To do"     },
  { key: "En cours de montage",  label: "Editing"   },
  { key: "En attente de retour", label: "Review"    },
  { key: "Subtitles",            label: "Subtitles" },
  { key: "Terminé",              label: "Done"      },
];

export function editingStepIndex(status) {
  return EDITING_STEPS.findIndex(s => s.key === status);
}

// The next status a freelancer can advance to, given the current one.
// Returns null when there is no self-service transition (e.g. already done).
export function nextEditingStatus(status) {
  switch (status) {
    case "En attente d'acceptation": return "À faire";              // accept
    case "À faire":                  return "En cours de montage";  // start editing
    case "En cours de montage":      return "En attente de retour"; // submit for review
    case "En attente de retour":     return "Terminé";              // mark done
    default:                         return null;
  }
}

export function nextEditingActionLabel(status) {
  switch (status) {
    case "En attente d'acceptation": return "Accept";
    case "À faire":                  return "Start editing";
    case "En cours de montage":      return "Submit for review";
    case "En attente de retour":     return "Mark as done";
    default:                         return null;
  }
}
