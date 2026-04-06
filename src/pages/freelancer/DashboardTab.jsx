import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { ClipboardList, FolderOpen, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

const TASK_STATUS_COLORS = {
  "Non commencé": "bg-slate-100 text-slate-600",
  "En cours": "bg-blue-100 text-blue-700",
  "Terminé": "bg-emerald-100 text-emerald-700",
  "Bloqué": "bg-red-100 text-red-700",
};

export default function DashboardTab({ freelancerName, freelancerEmail, onTabChange }) {
  const now = new Date();
  const interval = { start: startOfMonth(now), end: endOfMonth(now) };

  const { data: tasks = [] } = useQuery({
    queryKey: ["freelancer-tasks", freelancerEmail],
    queryFn: () => base44.entities.Task.list("-created_date"),
    select: (data) => data.filter(t =>
      t.assigned_to?.toLowerCase() === freelancerName?.toLowerCase() ||
      t.assigned_to?.toLowerCase() === freelancerEmail?.toLowerCase()
    ),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["editorial"],
    queryFn: () => base44.entities.EditorialContent.list(),
    select: (data) => data.filter(c => c.assigned_editor_name === freelancerName),
  });

  const urgentTasks = tasks
    .filter(t => t.status !== "Terminé")
    .sort((a, b) => {
      const priOrder = { "Urgente": 0, "Haute": 1, "Normale": 2, "Basse": 3 };
      return (priOrder[a.priority] ?? 2) - (priOrder[b.priority] ?? 2);
    })
    .slice(0, 5);

  const ongoingProjects = projects.filter(p =>
    p.editing_status === "En cours de montage" || p.editing_status === "À faire"
  );

  const doneThisMonth = projects.filter(p =>
    p.editing_status === "Terminé" &&
    p.scheduled_date &&
    isWithinInterval(new Date(p.scheduled_date), interval)
  ).length;

  const monthLabel = format(now, "MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tasks pending</p>
          <p className="text-2xl font-bold text-slate-900">{tasks.filter(t => t.status !== "Terminé").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Projects in progress</p>
          <p className="text-2xl font-bold text-blue-600">{ongoingProjects.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Completed this month</p>
          <p className="text-2xl font-bold text-emerald-600">{doneThisMonth}</p>
          <p className="text-[10px] text-slate-400 mt-1 capitalize">{monthLabel}</p>
        </div>
      </div>

      {/* Urgent tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Urgent Tasks
          </h2>
          <button onClick={() => onTabChange("tasks")} className="text-xs text-[#2A69FF] hover:underline">View all</button>
        </div>
        {urgentTasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-slate-400 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No pending tasks
          </div>
        ) : (
          <div className="space-y-2">
            {urgentTasks.map(task => (
              <div key={task.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLORS[task.status] || "bg-slate-100 text-slate-600"}`}>
                      {task.status}
                    </span>
                    {task.priority && (
                      <span className={`text-[10px] font-medium ${task.priority === "Urgente" ? "text-red-500" : task.priority === "Haute" ? "text-orange-500" : "text-slate-400"}`}>
                        {task.priority}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-slate-400">
                        Due {format(new Date(task.due_date), "d MMM", { locale: fr })}
                      </span>
                    )}
                  </div>
                </div>
                {task.priority === "Urgente" && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ongoing projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Projects in Progress
          </h2>
          <button onClick={() => onTabChange("projects")} className="text-xs text-[#2A69FF] hover:underline">View all</button>
        </div>
        {ongoingProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-slate-400 text-sm">No active projects</div>
        ) : (
          <div className="space-y-2">
            {ongoingProjects.slice(0, 4).map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.title || "Untitled"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.client_name} {p.scheduled_date && `· Due ${format(new Date(p.scheduled_date), "d MMM", { locale: fr })}`}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  p.editing_status === "En cours de montage" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                }`}>{p.editing_status || "À faire"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}