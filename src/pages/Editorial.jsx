import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Upload, X, Clapperboard, Link2, Trash2, Pencil, List, Calendar as CalendarIcon } from "lucide-react";
import CsvImportDialog from "../components/editorial/CsvImportDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { AlignLeft } from "lucide-react";
import StatusBadge from "../components/shared/StatusBadge";
import {
  format, startOfWeek, addDays, addWeeks, isSameDay,
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths,
  isSameMonth
} from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_COLORS = {
  Reel: "bg-pink-100 text-pink-700",
  Story: "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

export default function Editorial() {
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [user, setUser] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [filterClient, setFilterClient] = useState("all");
  const [filterTypes, setFilterTypes] = useState(["Reel", "Story", "Carousel"]);
  const [draggingId, setDraggingId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const qc = useQueryClient();

  // Check user role for read-only mode
  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Freelancers and 'user' role are read-only
      setIsReadOnly(u?.role === 'user' || u?.role === 'freelancer');
    }).catch(() => setIsReadOnly(true));
  }, []);

  const { data: content = [] } = useQuery({ queryKey: ["editorial"], queryFn: () => base44.entities.EditorialContent.list() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.filter({ status: "Actif" }) });
  const { data: allFreelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });
  // Only video editors can be assigned to montage
  const videoEditors = allFreelancers.filter(f => (f.tags || []).map(t => t.toLowerCase()).includes("video editor") || f.role?.toLowerCase().includes("monteur") || f.role?.toLowerCase().includes("video editor"));

  const createMut = useMutation({ mutationFn: (d) => base44.entities.EditorialContent.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial"] }); setDialogOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => base44.entities.EditorialContent.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial"] }); setDialogOpen(false); } });
  const deleteMut = useMutation({
    mutationFn: (id) => {
      console.log('deleteMut.mutationFn called with id:', id);
      return base44.entities.EditorialContent.delete(id);
    },
    onSuccess: () => {
      console.log('deleteMut onSuccess fired');
      qc.invalidateQueries({ queryKey: ["editorial"] });
      setDialogOpen(false);
    },
    onError: (err) => {
      console.error('deleteMut onError:', err);
    }
  });

  // Apply URL param for client filter (from Dashboard link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const client = params.get("client");
    if (client) setFilterClient(client);
  });

  const filtered = content
    .filter(c => filterClient === "all" || c.client_name === filterClient)
    .filter(c => filterTypes.includes(c.post_type));

  const toggleType = (type) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleDrop = (date) => {
    if (!draggingId || isReadOnly) return;
    const newDate = format(date, "yyyy-MM-dd");
    updateMut.mutate({ id: draggingId, d: { scheduled_date: newDate } });
    setDraggingId(null);
  };

  const openNew = (date) => {
    if (isReadOnly) return;
    setEditData({ client_id: "", client_name: "", title: "", post_type: "Reel", scheduled_date: format(date || new Date(), "yyyy-MM-dd"), status: "Planifié", description: "", notes: "" });
    setDialogOpen(true);
  };
  const openEdit = (c) => { 
    setEditData({ ...c });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editData.id) updateMut.mutate({ id: editData.id, d: editData });
    else createMut.mutate(editData);
  };

  const handleDelete = () => {
    console.log('handleDelete called');
    if (!editData?.id) {
      alert('No content to delete');
      return;
    }
    setDeleteConfirmId(editData.id);
    setDeleteConfirmOpen(true);
  };

  const handleQuickDelete = (e, id) => {
    if (isReadOnly) return;
    e.stopPropagation();
    console.log('handleQuickDelete called with id:', id);
    setDeleteConfirmId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      console.log('User confirmed, calling deleteMut.mutate with id:', deleteConfirmId);
      deleteMut.mutate(deleteConfirmId);
    }
    setDeleteConfirmOpen(false);
    setDeleteConfirmId(null);
  };

  const navigate = (dir) => {
    if (view === "day") setCurrentDate(d => addDays(d, dir));
    else if (view === "week") setCurrentDate(d => addWeeks(d, dir));
    else setCurrentDate(d => addMonths(d, dir));
  };

  const goToday = () => setCurrentDate(new Date());

  const navLabel = () => {
    if (view === "day") return format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      return `Week of ${format(ws, "d MMMM yyyy", { locale: fr })}`;
    }
    if (view === "list") return "All content";
    return format(currentDate, "MMMM yyyy", { locale: fr });
  };

  // CONTENT CARD (calendar views)
  const ContentCard = ({ c, compact = false }) => (
    <div
      className="group relative"
      draggable={!isReadOnly}
      onDragStart={(e) => { if (!isReadOnly) { e.stopPropagation(); setDraggingId(c.id); } }}
      onDragEnd={() => setDraggingId(null)}
    >
      <div
        onClick={() => openEdit(c)}
        className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-grab active:cursor-grabbing border border-slate-100 transition-colors pr-6"
      >
        <div className="flex items-center gap-1 mb-0.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
        </div>
        <p className={`font-medium text-slate-700 line-clamp-2 ${compact ? "text-[10px]" : "text-[11px]"}`}>{c.title || c.description || "Untitled"}</p>
        {!compact && <p className="text-[9px] text-slate-400 mt-0.5">{c.client_name}</p>}
      </div>
      {!isReadOnly && (
        <button
          onClick={(e) => handleQuickDelete(e, c.id)}
          className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  // DAY VIEW
  const DayView = () => {
    const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), currentDate));
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 capitalize">{format(currentDate, "EEEE d MMMM", { locale: fr })}</h3>
          {!isReadOnly && <button onClick={() => openNew(currentDate)} className="text-emerald-600 hover:text-emerald-700 text-sm flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add</button>}
        </div>
        {dayContent.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No content this day</p>
        ) : (
          <div className="space-y-3">
            {dayContent.map(c => (
              <div key={c.id} className="group flex items-start gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 cursor-pointer" onClick={() => openEdit(c)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
                    <span className="text-xs text-slate-400">{c.client_name}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{c.title || "Untitled"}</p>
                  {c.description && <p className="text-xs text-slate-500 mt-1">{c.description}</p>}
                </div>
                {!isReadOnly && <button onClick={(e) => handleQuickDelete(e, c.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // WEEK VIEW
  const WeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
    return (
      <div className="overflow-x-auto -mx-1 px-1">
      <div className="grid grid-cols-5 gap-3 min-w-[560px]">
        {days.map(day => {
          const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));
          const isToday = isSameDay(day, new Date());
          return (
            <div
            key={day.toISOString()}
            className={`bg-white rounded-xl border p-3 min-h-[200px] transition-colors ${isToday ? "border-[#2A69FF] ring-1 ring-[#2A69FF]/10" : "border-slate-100"} ${draggingId ? "hover:bg-blue-50/40 hover:border-blue-200" : ""}`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(day)}
          >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">{format(day, "EEE", { locale: fr })}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-[#2A69FF]" : "text-slate-700"}`}>{format(day, "d")}</p>
                </div>
                {!isReadOnly && <button onClick={() => openNew(day)} className="text-slate-300 hover:text-emerald-500 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>}
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

  // MONTH VIEW
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
    const visibleDays = allWeeks.flat(); // desktop: all days

    const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    // Mobile: page 0 → cols 0,1,2 (Mon/Tue/Wed)  page 1 → cols 2,3,4 (Wed/Thu/Fri)
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

    const DayCell = ({ day, border = true }) => {
      const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));
      const isToday = isSameDay(day, new Date());
      const inMonth = isSameMonth(day, currentDate);
      return (
        <div
          className={`min-h-[100px] p-1.5 transition-colors ${border ? "border-b border-r border-slate-100" : ""} ${!inMonth ? "bg-slate-50/50" : ""} ${draggingId && inMonth ? "hover:bg-blue-50/40" : ""}`}
          onDragOver={e => e.preventDefault()}
          onDrop={() => inMonth && handleDrop(day)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-[#2A69FF] text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>
              {format(day, "d")}
            </span>
            {inMonth && !isReadOnly && <button onClick={() => openNew(day)} className="text-slate-200 hover:text-emerald-500 transition-colors"><Plus className="w-3 h-3" /></button>}
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

        {/* ── Mobile swipeable (3 cols) ── */}
        <div className="sm:hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="grid grid-cols-3 border-b border-slate-100">
            {mobileHeaders.map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-3">
            {mobileDays.map(day => <DayCell key={day.toISOString()} day={day} />)}
          </div>
          {/* Swipe dots */}
          <div className="flex justify-center gap-1.5 py-2.5">
            <button onClick={() => setDayPage(0)} className={`w-1.5 h-1.5 rounded-full transition-all ${dayPage === 0 ? "bg-[#2A69FF] w-3" : "bg-slate-200"}`} />
            <button onClick={() => setDayPage(1)} className={`w-1.5 h-1.5 rounded-full transition-all ${dayPage === 1 ? "bg-[#2A69FF] w-3" : "bg-slate-200"}`} />
          </div>
        </div>

        {/* ── Desktop (5 cols) ── */}
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

  // LIST VIEW
  const ListView = () => {
    const sorted = [...filtered].sort((a, b) => new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0));
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Client</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Title</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Type</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Editing</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">No content</td></tr>
            )}
            {sorted.map(c => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 group">
                <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                  {c.scheduled_date ? format(new Date(c.scheduled_date), "d MMM yyyy", { locale: fr }) : "—"}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{c.client_name || "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-700 max-w-[200px] truncate">{c.title || c.description || "Untitled"}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
                </td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3">
                  {c.assigned_editor_name ? (
                    <span className="text-xs text-slate-500">{c.assigned_editor_name}</span>
                  ) : <span className="text-xs text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-[#2A69FF]">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => handleQuickDelete(e, c.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Editorial Calendar" subtitle="Content planning">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Link to="/ContentDescriptions" className="contents">
            <Button variant="outline" className="w-full sm:w-auto h-9">
              <AlignLeft className="w-4 h-4 mr-1" /> Descriptions
            </Button>
          </Link>
          {!isReadOnly && (
            <>
              <Button variant="outline" className="w-full sm:w-auto h-9" onClick={() => setCsvOpen(true)}>
                <Upload className="w-4 h-4 mr-1" /> Import CSV
              </Button>
              <Button onClick={() => openNew()} className="w-full sm:w-auto bg-brand hover:bg-brand/90 text-brand-foreground h-9">
                <Plus className="w-4 h-4 mr-1" /> New content
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Controls */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {view !== "list" && (
            <>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <h3 className="text-sm font-semibold text-slate-700 capitalize min-w-[220px] text-center">{navLabel()}</h3>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="ghost" className="text-xs h-7 text-slate-500" onClick={goToday}>Today</Button>
            </>
          )}
          {view === "list" && <h3 className="text-sm font-semibold text-slate-700">{filtered.length} content{filtered.length > 1 ? "s" : ""}</h3>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1">
            {["Reel", "Story", "Carousel"].map(type => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                  filterTypes.includes(type)
                    ? TYPE_COLORS[type] + " border-transparent"
                    : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            {[
              { key: "day", label: "Day", icon: CalendarIcon },
                { key: "week", label: "Week", icon: CalendarIcon },
                { key: "month", label: "Month", icon: CalendarIcon },
                { key: "list", label: "List", icon: List },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "day" && <DayView />}
      {view === "week" && <WeekView />}
      {view === "month" && <MonthView />}
      {view === "list" && <ListView />}

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete content</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to delete this content? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl overflow-y-auto" style={{ maxHeight: '90vh' }}>
          <DialogHeader><DialogTitle>{editData?.id ? (isReadOnly ? "View content" : "Edit content") : "New content"}</DialogTitle></DialogHeader>
          {editData && (
            <div className="mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">

                {/* ── Left column ── */}
                <div className="space-y-3">
                  {isReadOnly && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700 font-medium">📖 View-only mode: descriptions only</p>
                    </div>
                  )}
                  <div>
                    <Label>Client</Label>
                    {isReadOnly ? (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700">{editData.client_name || "—"}</div>
                    ) : (
                      <Select value={editData.client_id || ""} onValueChange={v => { const cl = clients.find(c => c.id === v); setEditData({ ...editData, client_id: v, client_name: cl?.company_name || "" }); }}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label>Title</Label>
                    {isReadOnly ? (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700">{editData.title || "—"}</div>
                    ) : (
                      <Input value={editData.title || ""} onChange={e => setEditData({ ...editData, title: e.target.value })} />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      {isReadOnly ? (
                        <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700">{editData.post_type || "—"}</div>
                      ) : (
                        <Select value={editData.post_type} onValueChange={v => setEditData({ ...editData, post_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Reel">Reel</SelectItem>
                            <SelectItem value="Story">Story</SelectItem>
                            <SelectItem value="Carousel">Carousel</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label>Status</Label>
                      {isReadOnly ? (
                        <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700">{editData.status || "—"}</div>
                      ) : (
                        <Select value={editData.status} onValueChange={v => setEditData({ ...editData, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Planifié">Planned</SelectItem>
                            <SelectItem value="En cours">In progress</SelectItem>
                            <SelectItem value="Publié">Published</SelectItem>
                            <SelectItem value="Annulé">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Scheduled date</Label>
                    {isReadOnly ? (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700">{editData.scheduled_date || "—"}</div>
                    ) : (
                      <Input type="date" value={editData.scheduled_date || ""} onChange={e => setEditData({ ...editData, scheduled_date: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={editData.description || ""} onChange={e => setEditData({ ...editData, description: e.target.value })} rows={3} disabled={isReadOnly} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" />Drive link (content)</Label>
                    {isReadOnly ? (
                      editData.drive_link ? (
                        <a href={editData.drive_link} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-50 rounded border border-blue-200 text-sm text-blue-700 hover:underline block">
                          View on Drive
                        </a>
                      ) : (
                        <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-500">—</div>
                      )
                    ) : (
                      <Input value={editData.drive_link || ""} onChange={e => setEditData({ ...editData, drive_link: e.target.value })} placeholder="https://drive.google.com/..." />
                    )}
                  </div>
                </div>

                {/* ── Right column — Montage ── */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Clapperboard className="w-3.5 h-3.5" />Video editing</p>
                  <div>
                    <Label>Assigned editor</Label>
                    <Select value={editData.assigned_editor_id || ""} onValueChange={v => {
                      const fl = videoEditors.find(f => f.id === v);
                      const isReel = editData.post_type === "Reel";
                      setEditData({ ...editData, assigned_editor_id: v, assigned_editor_name: fl?.name || "",
                        editing_status: v ? (isReel ? "En attente d'acceptation" : (editData.editing_status === "Non assigné" ? "À faire" : editData.editing_status)) : "Non assigné"
                      });
                    }}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None</SelectItem>
                        {videoEditors.length === 0 && <SelectItem value="_none" disabled>No video editors</SelectItem>}
                        {videoEditors.map(f => <SelectItem key={f.id} value={f.id}>{f.name} {f.status === "Indisponible" ? "⚠️" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Editing status</Label>
                    <Select value={editData.editing_status || "Non assigné"} onValueChange={v => setEditData({ ...editData, editing_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Non assigné">Unassigned</SelectItem>
                        <SelectItem value="En attente d'acceptation">Pending acceptance</SelectItem>
                        <SelectItem value="À faire">To do</SelectItem>
                        <SelectItem value="En cours de montage">In progress</SelectItem>
                        <SelectItem value="En attente de retour">Awaiting feedback</SelectItem>
                        <SelectItem value="Terminé">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Editing instructions</Label>
                    <Textarea value={editData.editing_instructions || ""} onChange={e => setEditData({ ...editData, editing_instructions: e.target.value })} rows={4} placeholder="e.g. Start on wide shot, music from 0:03..." />
                  </div>
                  <div>
                    <Label>Reference files</Label>
                    <div className="mt-1 space-y-1.5">
                      {(editData.editing_files || []).map((url, i) => {
                        const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2A69FF] hover:underline truncate max-w-[200px]">{name}</a>
                            <button onClick={() => setEditData({ ...editData, editing_files: editData.editing_files.filter((_, idx) => idx !== i) })} className="text-slate-300 hover:text-red-400 ml-2"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        );
                      })}
                      <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs text-[#2A69FF] hover:underline ${uploadingFile ? "opacity-50 pointer-events-none" : ""}`}>
                        <Upload className="w-3 h-3" />{uploadingFile ? "Uploading..." : "Add a file"}
                        <input type="file" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          setUploadingFile(true);
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          setEditData(d => ({ ...d, editing_files: [...(d.editing_files || []), file_url] }));
                          setUploadingFile(false); e.target.value = "";
                        }} />
                      </label>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-between items-center pt-4">
                {!isReadOnly && editData.id ? (
                  <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
                  {!isReadOnly && <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground">Save</Button>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}