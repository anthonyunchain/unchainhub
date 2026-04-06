import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, addDays, addWeeks, addMonths, subWeeks, subMonths, startOfMonth, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { FolderOpen, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_COLORS = {
  "Non assigné": "bg-slate-100 text-slate-500",
  "À faire": "bg-amber-100 text-amber-700",
  "En cours de montage": "bg-blue-100 text-blue-700",
  "En attente de retour": "bg-violet-100 text-violet-700",
  "Terminé": "bg-emerald-100 text-emerald-700",
};

const EDITING_STATUSES = ["À faire", "En cours de montage", "En attente de retour", "Terminé"];

function ProjectCard({ p, onAction }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(p.notes || "");
  const [expanded, setExpanded] = useState(false);
  const hasDetails = p.editing_instructions || (p.editing_files?.length > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{p.title || "Untitled"}</p>
            <p className="text-xs text-slate-400 mt-0.5">{p.client_name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {p.post_type && <span className="text-[10px] px-2 py-0.5 bg-pink-50 text-pink-700 rounded-full">{p.post_type}</span>}
              {p.platform && <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{p.platform}</span>}
              {p.scheduled_date && <span className="text-[10px] text-slate-400">Due {format(new Date(p.scheduled_date), "d MMM yyyy", { locale: fr })}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0 items-end">
            {p.drive_link && (
              <a href={p.drive_link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs hover:bg-blue-100 transition-colors">
                <ExternalLink className="w-3 h-3" /> Drive
              </a>
            )}
            <button onClick={() => setNoteOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs hover:bg-slate-100 transition-colors">
              Note
            </button>
          </div>
        </div>

        {/* Status selector */}
        <div className="mt-3 flex items-center gap-2">
          <Select
            value={p.editing_status || "Non assigné"}
            onValueChange={v => onAction(p, "status", v)}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITING_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasDetails && (
            <button onClick={() => setExpanded(v => !v)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Accordion details */}
      {expanded && hasDetails && (
        <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/50">
          {p.editing_instructions && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Instructions</p>
              <p className="text-xs text-slate-600 leading-relaxed">{p.editing_instructions}</p>
            </div>
          )}
          {p.editing_files?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Reference files</p>
              <div className="flex flex-wrap gap-2">
                {p.editing_files.map((url, i) => {
                  const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2A69FF]/10 text-[#2A69FF] rounded-lg text-xs hover:bg-[#2A69FF]/20 transition-colors">
                      <ExternalLink className="w-3 h-3" />
                      {name.length > 25 ? name.slice(0, 25) + "…" : name}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add a note</DialogTitle></DialogHeader>
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Your note..." />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button onClick={() => { onAction(p, "note", note); setNoteOpen(false); }} className="bg-slate-800 hover:bg-slate-700">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProjectsTab({ projects = [], onProjectUpdate }) {
  const [view, setView] = useState("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const clients = [...new Set(projects.map(p => p.client_name).filter(Boolean))];

  const handleAction = async (p, action, value) => {
    if (action === "status") {
      await base44.functions.invoke('updateProjectStatus', { project_id: p.id, editing_status: value });
    } else if (action === "note") {
      await base44.functions.invoke('updateProjectStatus', { project_id: p.id, notes: value });
    }
    if (onProjectUpdate) onProjectUpdate();
  };

  const navigate = (dir) => {
    if (view === "day") setCurrentDate(d => addDays(d, dir));
    else if (view === "week") setCurrentDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    else if (view === "month") setCurrentDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const filteredProjects = projects.filter(p => {
    const clientOk = filterClient === "all" || p.client_name === filterClient;
    const statusOk = filterStatus === "all" || p.editing_status === filterStatus;
    return clientOk && statusOk;
  });

  const getProjectsForDay = (day) =>
    filteredProjects.filter(p => p.scheduled_date && isSameDay(new Date(p.scheduled_date), day));

  const renderCalendarCell = (day, ps) => (
    <div className="min-h-[80px] p-1">
      <p className={`text-xs font-medium mb-1 ${isSameDay(day, new Date()) ? "text-[#2A69FF]" : "text-slate-500"}`}>{format(day, "d")}</p>
      {ps.slice(0, 3).map(p => (
        <div key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate ${STATUS_COLORS[p.editing_status] || STATUS_COLORS["Non assigné"]}`}>
          {p.title || p.client_name}
        </div>
      ))}
      {ps.length > 3 && <div className="text-[10px] text-slate-400">+{ps.length - 3}</div>}
    </div>
  );

  const renderView = () => {
    if (view === "list") {
      if (filteredProjects.length === 0) return (
        <div className="text-center py-16 text-slate-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No projects assigned</p>
        </div>
      );
      const grouped = filteredProjects.reduce((acc, p) => {
        const k = p.client_name || "No client";
        if (!acc[k]) acc[k] = [];
        acc[k].push(p);
        return acc;
      }, {});
      return (
        <div className="space-y-4">
          {Object.entries(grouped).map(([client, items]) => (
            <div key={client}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{client}</p>
              <div className="space-y-3">{items.map(p => <ProjectCard key={p.id} p={p} onAction={handleAction} />)}</div>
            </div>
          ))}
        </div>
      );
    }
    if (view === "day") {
      const dayProjects = getProjectsForDay(currentDate);
      return (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-4">{format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}</p>
          {dayProjects.length === 0
            ? <p className="text-sm text-slate-400 text-center py-10">No projects this day</p>
            : <div className="space-y-3">{dayProjects.map(p => <ProjectCard key={p.id} p={p} onAction={handleAction} />)}</div>
          }
        </div>
      );
    }
    if (view === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      return (
        <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
          <div className="grid grid-cols-7 border-b border-slate-100 min-w-[500px]">
            {days.map(day => (
              <div key={day.toISOString()} className="border-r border-slate-100 last:border-r-0">
                <div className={`px-2 py-2 text-center text-xs font-medium ${isSameDay(day, new Date()) ? "bg-[#2A69FF]/10 text-[#2A69FF]" : "text-slate-500"}`}>
                  {format(day, "EEE d", { locale: fr })}
                </div>
                {renderCalendarCell(day, getProjectsForDay(day))}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (view === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: calStart, end: calEnd });
      return (
        <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
          <div className="grid grid-cols-7 border-b border-slate-100 min-w-[400px]">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-r border-slate-100 last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-w-[400px]">
            {days.map(day => (
              <div key={day.toISOString()} className={`border-r border-b border-slate-100 last:border-r-0 ${!isWithinInterval(day, { start: monthStart, end: monthEnd }) ? "bg-slate-50/50 opacity-50" : ""}`}>
                {renderCalendarCell(day, getProjectsForDay(day))}
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  const viewLabel = {
    day: format(currentDate, "d MMMM yyyy", { locale: fr }),
    week: `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })}`,
    month: format(currentDate, "MMMM yyyy", { locale: fr }),
    list: "All projects",
  }[view];

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {clients.length > 0 && (
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* View switcher + nav */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-lg p-1 shadow-sm">
          {[{ id: "list", label: "List" }, { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${view === v.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
              {v.label}
            </button>
          ))}
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">{viewLabel}</span>
            <button onClick={() => navigate(1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {renderView()}
    </div>
  );
}