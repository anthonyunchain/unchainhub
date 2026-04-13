import { useState, useRef } from "react";
import { format, startOfWeek, addDays, addWeeks, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isSameMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_COLORS = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
  Post:     "bg-blue-100 text-blue-700",
};

export default function ProjectsTab({ projects = [] }) {
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterClient, setFilterClient] = useState("all");

  const clients = [...new Set(projects.map(p => p.client_name).filter(Boolean))].sort();

  const navigate = (dir) => {
    if (view === "week") setCurrentDate(d => addWeeks(d, dir));
    else setCurrentDate(d => addMonths(d, dir));
  };

  const goToday = () => setCurrentDate(new Date());

  const filtered = projects.filter(p =>
    filterClient === "all" || p.client_name === filterClient
  );

  const navLabel = view === "week"
    ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: enUS })}`
    : format(currentDate, "MMMM yyyy", { locale: enUS });

  // Shared content card
  const ContentCard = ({ c, compact = false }) => (
    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
      </div>
      <p className={`font-medium text-slate-700 line-clamp-2 ${compact ? "text-[10px]" : "text-[11px]"}`}>{c.title || c.description || "Untitled"}</p>
      {!compact && <p className="text-[9px] text-slate-400 mt-0.5">{c.client_name}</p>}
    </div>
  );

  // ── WEEK VIEW ──
  const WeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
    return (
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid grid-cols-5 gap-3 min-w-[480px]">
          {days.map(day => {
            const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`bg-white rounded-xl border p-3 min-h-[180px] ${isToday ? "border-[#2A69FF] ring-1 ring-[#2A69FF]/10" : "border-slate-100"}`}>
                <div className="mb-2">
                  <p className="text-[10px] text-slate-400 uppercase">{format(day, "EEE", { locale: enUS })}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-[#2A69FF]" : "text-slate-700"}`}>{format(day, "d")}</p>
                </div>
                <div className="space-y-1.5">
                  {dayContent.map(c => <ContentCard key={c.id} c={c} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── MONTH VIEW ──
  const MonthView = () => {
    const [dayPage, setDayPage] = useState(0); // 0 = Mon/Tue/Wed  1 = Wed/Thu/Fri
    const touchStartX = useRef(null);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 });
    const allDays = eachDayOfInterval({ start: calStart, end: addDays(calEnd, 6) }).slice(0, 49);
    const allDaysNoWeekend = allDays.filter(d => d.getDay() !== 0 && d.getDay() !== 6);
    const weeks = [];
    for (let i = 0; i < allDaysNoWeekend.length; i += 5) weeks.push(allDaysNoWeekend.slice(i, i + 5));
    const allWeeks = weeks.filter(week => week.some(d => isSameMonth(d, currentDate)));
    const visibleDays = allWeeks.flat();

    const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const mobileColIdx = dayPage === 0 ? [0, 1, 2] : [2, 3, 4];
    const mobileDays = allWeeks.flatMap(week => mobileColIdx.map(i => week[i]).filter(Boolean));
    const mobileHeaders = mobileColIdx.map(i => weekDayLabels[i]);

    const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 40) setDayPage(dx < 0 ? 1 : 0);
      touchStartX.current = null;
    };

    const DayCell = ({ day }) => {
      const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));
      const isToday = isSameDay(day, new Date());
      const inMonth = isSameMonth(day, currentDate);
      return (
        <div className={`min-h-[100px] p-1.5 border-b border-r border-slate-100 ${!inMonth ? "bg-slate-50/50" : ""}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-[#2A69FF] text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>
              {format(day, "d")}
            </span>
          </div>
          <div className="space-y-0.5">
            {dayContent.slice(0, 2).map(c => <ContentCard key={c.id} c={c} compact />)}
            {dayContent.length > 2 && <p className="text-[9px] text-slate-400 pl-1">+{dayContent.length - 2} more</p>}
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        {/* ── Mobile: 3-col swipeable ── */}
        <div className="sm:hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="grid grid-cols-3 border-b border-slate-100">
            {mobileHeaders.map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-3">
            {mobileDays.map(day => <DayCell key={day.toISOString()} day={day} />)}
          </div>
          <div className="flex justify-center gap-1.5 py-2.5">
            <button onClick={() => setDayPage(0)} className={`h-1.5 rounded-full transition-all ${dayPage === 0 ? "bg-[#2A69FF] w-3" : "bg-slate-200 w-1.5"}`} />
            <button onClick={() => setDayPage(1)} className={`h-1.5 rounded-full transition-all ${dayPage === 1 ? "bg-[#2A69FF] w-3" : "bg-slate-200 w-1.5"}`} />
          </div>
        </div>

        {/* ── Desktop: 5-col ── */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-5 border-b border-slate-100">
            {weekDayLabels.map(d => <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-5">
            {visibleDays.map(day => <DayCell key={day.toISOString()} day={day} />)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Client filter — full width on mobile */}
      <div className="mb-3">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Nav: arrows + label + view switcher */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 flex-1">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-sm font-semibold text-slate-700 capitalize flex-1 text-center">{navLabel}</h3>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" className="hidden sm:inline-flex text-xs h-7 text-slate-500 shrink-0" onClick={goToday}>
            Today
          </Button>
        </div>
        <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 gap-0.5 ml-3">
          {[{ key: "week", label: "Week" }, { key: "month", label: "Month" }].map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "week" && <WeekView />}
      {view === "month" && <MonthView />}
    </div>
  );
}
