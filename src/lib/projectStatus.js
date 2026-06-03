// ─── Single source of truth for video project status (projects table) ─────────
// Used by the admin Projects board and the Production overview. `order` drives
// list/kanban sorting; bg/text/dot drive pills and headers.

export const PROJECT_STATUS = {
  "Draft":              { label: "Draft",        bg: "bg-violet-50",  text: "text-violet-600", dot: "bg-violet-400",  order: 0 },
  "Unassigned":         { label: "Unassigned",   bg: "bg-slate-50",   text: "text-slate-500",  dot: "bg-slate-400",   order: 1 },
  "Pending acceptance": { label: "Pending",      bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400",   order: 2 },
  "Accepted":           { label: "Accepted",     bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-400",    order: 3 },
  "In progress":        { label: "In progress",  bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500",  order: 4 },
  "Delivered":          { label: "Delivered",    bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500",  order: 5 },
  "Subtitles":          { label: "Subtitles",    bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-teal-500",    order: 6 },
  "Revision requested": { label: "Revision",     bg: "bg-red-50",     text: "text-red-700",    dot: "bg-red-500",     order: 7 },
  "Completed":          { label: "Completed",    bg: "bg-emerald-50", text: "text-emerald-700",dot: "bg-emerald-500", order: 8 },
};

// Combined Tailwind class string for a status pill / chip.
export function projectStatusColor(status) {
  const cfg = PROJECT_STATUS[status];
  return cfg ? `${cfg.bg} ${cfg.text}` : "bg-slate-100 text-slate-600";
}

// 5-step production workflow shown as a progress bar.
export const PRODUCTION_STEPS = [
  { key: "Accepted",    label: "Accept"        },
  { key: "In progress", label: "Rough cut"     },
  { key: "Delivered",   label: "Final"         },
  { key: "Subtitles",   label: "Subtitles"     },
  { key: "Completed",   label: "Ready to post" },
];

export function productionStepIndex(status) {
  if (status === "Completed") return 4;
  return PRODUCTION_STEPS.findIndex(s => s.key === status);
}
