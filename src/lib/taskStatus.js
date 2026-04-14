export const TASK_STATUS_CONFIG = {
  "Non commencé": { color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  "En cours":     { color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"  },
  "Terminé":      { color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  "Bloqué":       { color: "bg-red-100 text-red-700",     dot: "bg-red-500"   },
};

export const TASK_STATUS_LABEL = {
  "Non commencé": "Not started",
  "En cours":     "In progress",
  "Terminé":      "Done",
  "Bloqué":       "Blocked",
};

export const TASK_PRIORITY_LABEL = {
  "Urgente": "Urgent",
  "Haute":   "High",
  "Normale": "Normal",
  "Basse":   "Low",
};

export const TASK_PRIORITY_COLOR = {
  "Urgente": "text-red-500",
  "Haute":   "text-orange-500",
  "Normale": "text-blue-500",
  "Basse":   "text-slate-400",
};

export const TASK_STATUSES = Object.keys(TASK_STATUS_CONFIG);
