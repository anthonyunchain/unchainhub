import { useState } from "react";
import { format, startOfWeek, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, addDays, addWeeks, addMonths, subWeeks, subMonths, startOfMonth, endOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_COLORS = {
  "Reel":     "bg-pink-100 text-pink-700",
  "Story":    "bg-amber-100 text-amber-700",
  "Carousel": "bg-violet-100 text-violet-700",
  "Post":     "bg-blue-100 text-blue-700",
};

export default function ProjectsTab({ projects = [] }) {
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterClient, setFilterClient] = useState("all");

  const clients = [...new Set(projects.map(p => p.client_name).filter(Boolean))];

  const navigate = (dir) => {
    if (view === "day") setCurrentDate(d => addDays(d, dir));
    else if (view === "week") setCurrentDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    else if (view === "month") setCurrentDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const filteredProjects = projects.filter(p =>
    filterClient === "all" || p.client_name === filterClient
  );

  const getProjectsForDay = (day) =>
    filteredProjects.filter(p => p.scheduled_date && isSameDay(new Date(p.scheduled_date), day));

  const renderItem = (p) => (
    <div
      key={p.id}
      className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate ${TYPE_COLORS[p.post_type] || "bg-slate-100 text-slate-600"}`}
    >
      {p.title || p.client_name}
    </div>
  );

  const renderCalendarCell = (day, ps) => (
    <div className="min-h-[80px] p-1">
      <p className={`text-xs font-medium mb-1 ${isSameDay(day, new Date()) ? "text-[#2A69FF]" : "text-slate-500"}`}>
        {format(day, "d")}
      </p>
      {ps.slice(0, 3).map(renderItem)}
      {ps.length > 3 && <div className="text-[10px] text-slate-400">+{ps.length - 3}</div>}
    </div>
  );

  const renderView = () => {
    if (view === "day") {
      const dayProjects = getProjectsForDay(currentDate);
      return (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-4">
            {format(currentDate, "EEEE d MMMM yyyy", { locale: enUS })}
          </p>
          {dayProjects.length === 0
            ? <p className="text-sm text-slate-400 text-center py-10">No content this day</p>
            : <div className="space-y-2">
                {dayProjects.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <p className="text-sm font-semibold text-slate-800">{p.title || "Untitled"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.client_name}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {p.post_type && <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLORS[p.post_type] || "bg-slate-100 text-slate-600"}`}>{p.post_type}</span>}
                    </div>
                    {p.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{p.description}</p>}
                  </div>
                ))}
              </div>
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
                  {format(day, "EEE d", { locale: enUS })}
                </div>
                {renderCalendarCell(day, getProjectsForDay(day))}
              </div>
            ))}
          </div>
        </div>
      );
    }
    // month (default)
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
  };

  const viewLabel = {
    day: format(currentDate, "d MMMM yyyy", { locale: enUS }),
    week: `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: enUS })}`,
    month: format(currentDate, "MMMM yyyy", { locale: enUS }),
  }[view];

  return (
    <div>
      {/* Client filter */}
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
      </div>

      {/* View switcher + nav */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-lg p-1 shadow-sm">
          {[{ id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${view === v.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">{viewLabel}</span>
          <button onClick={() => navigate(1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {renderView()}
    </div>
  );
}
