import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { format, startOfWeek, addDays, addWeeks, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isSameMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const TYPE_COLORS = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
  Post:     "bg-blue-100 text-blue-700",
};

export default function ProjectsTab({ clientNames = [] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterClient, setFilterClient] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  // ── Fetch editorial content directly (RLS filters to assigned clients) ──
  const { data: allContent = [] } = useQuery({
    queryKey: ["editorial-freelancer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editorial_content")
        .select("*")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Clients: from content already in DB + from profile's assigned client names
  const clients = [...new Set([
    ...allContent.map(p => p.client_name).filter(Boolean),
    ...clientNames,
  ])].sort();

  const filtered = allContent.filter(p =>
    filterClient === "all" || p.client_name === filterClient
  );

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: async (d) => {
      const { id, created_at, updated_at, ...payload } = d;
      const { data, error } = await supabase.from("editorial_content").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial-freelancer"] }); setDialogOpen(false); },
    onError: (err) => toast({ title: "Erreur", description: err?.message || String(err), variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { id: _id, created_at, updated_at, ...payload } = d;
      const { data, error } = await supabase.from("editorial_content").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial-freelancer"] }); setDialogOpen(false); },
    onError: (err) => toast({ title: "Erreur", description: err?.message || String(err), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("editorial_content").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial-freelancer"] }); },
    onError: (err) => toast({ title: "Erreur suppression", description: err?.message || String(err), variant: "destructive" }),
  });

  // ── Helpers ──
  const navigate = (dir) => {
    if (view === "week") setCurrentDate(d => addWeeks(d, dir));
    else setCurrentDate(d => addMonths(d, dir));
  };
  const goToday = () => setCurrentDate(new Date());

  const openNew = (date) => {
    setEditData({
      client_name: filterClient !== "all" ? filterClient : (clients[0] || ""),
      title: "",
      post_type: "Reel",
      scheduled_date: format(date || new Date(), "yyyy-MM-dd"),
      status: "Planifié",
      description: "",
      notes: "",
      needs_shooting: false,
      shoot_timing: "in-month",
    });
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditData({ ...c });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editData) return;
    if (editData.id) updateMut.mutate({ id: editData.id, d: editData });
    else createMut.mutate(editData);
  };

  const handleDrop = (date) => {
    if (!draggingId) return;
    updateMut.mutate({ id: draggingId, d: { scheduled_date: format(date, "yyyy-MM-dd") } });
    setDraggingId(null);
  };

  const navLabel = view === "week"
    ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: enUS })}`
    : format(currentDate, "MMMM yyyy", { locale: enUS });

  // ── Shared content card ──
  const ContentCard = ({ c, compact = false }) => (
    <div
      className="group p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors relative"
      draggable
      onDragStart={(e) => { e.stopPropagation(); setDraggingId(c.id); }}
      onDragEnd={() => setDraggingId(null)}
      onClick={() => openEdit(c)}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
        <button
          className="ml-auto opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); setDeleteConfirmOpen(true); }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
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
              <div
                key={day.toISOString()}
                className={`bg-white rounded-xl border p-3 min-h-[180px] ${isToday ? "border-[#2A69FF] ring-1 ring-[#2A69FF]/10" : "border-slate-100"}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(day)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">{format(day, "EEE", { locale: enUS })}</p>
                    <p className={`text-sm font-semibold ${isToday ? "text-[#2A69FF]" : "text-slate-700"}`}>{format(day, "d")}</p>
                  </div>
                  <button onClick={() => openNew(day)} className="text-slate-300 hover:text-emerald-500 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
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
    const [dayPage, setDayPage] = useState(0);
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
      const [expanded, setExpanded] = useState(false);
      const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));
      const isToday = isSameDay(day, new Date());
      const inMonth = isSameMonth(day, currentDate);
      const visible = expanded ? dayContent : dayContent.slice(0, 2);
      return (
        <div
          className={`min-h-[100px] p-1.5 border-b border-r border-slate-100 ${!inMonth ? "bg-slate-50/50" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(day)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-[#2A69FF] text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>
              {format(day, "d")}
            </span>
            {inMonth && (
              <button onClick={() => openNew(day)} className="text-slate-200 hover:text-emerald-500 transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {visible.map(c => <ContentCard key={c.id} c={c} compact />)}
            {dayContent.length > 2 && (
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="text-[9px] text-[#2A69FF] pl-1 hover:underline cursor-pointer bg-transparent border-none"
              >
                {expanded ? `− less` : `+${dayContent.length - 2} more`}
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        {/* Mobile: 3-col swipeable */}
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

        {/* Desktop: 5-col */}
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
      {/* Client filter */}
      <div className="mb-3">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Nav */}
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
        <div className="flex items-center gap-2 ml-3">
          <Button
            size="sm"
            className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs gap-1"
            onClick={() => openNew(currentDate)}
          >
            <Plus className="w-3.5 h-3.5" /> New
          </Button>
          <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            {[{ key: "week", label: "Week" }, { key: "month", label: "Month" }].map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "week" && <WeekView />}
      {view === "month" && <MonthView />}

      {/* ── New / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editData?.id ? "Edit content" : "New content"}</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-4 mt-1">
              <div>
                <Label>Client</Label>
                <Select value={editData.client_name || ""} onValueChange={v => setEditData({ ...editData, client_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={editData.title || ""} onChange={e => setEditData({ ...editData, title: e.target.value })} placeholder="Content title..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={editData.post_type || "Reel"} onValueChange={v => setEditData({ ...editData, post_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Reel">Reel</SelectItem>
                      <SelectItem value="Story">Story</SelectItem>
                      <SelectItem value="Carousel">Carousel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editData.status || "Planifié"} onValueChange={v => setEditData({ ...editData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planifié">Planned</SelectItem>
                      <SelectItem value="En cours">In progress</SelectItem>
                      <SelectItem value="Publié">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Scheduled date</Label>
                <Input type="date" value={editData.scheduled_date || ""} onChange={e => setEditData({ ...editData, scheduled_date: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editData.description || ""} onChange={e => setEditData({ ...editData, description: e.target.value })} rows={3} placeholder="Caption, notes..." />
              </div>
              <div className="flex justify-between pt-1">
                {editData.id && (
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => { setDeleteConfirmId(editData.id); setDeleteConfirmOpen(true); setDialogOpen(false); }}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                    {(createMut.isPending || updateMut.isPending) ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete content?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => { deleteMut.mutate(deleteConfirmId); setDeleteConfirmOpen(false); setDeleteConfirmId(null); }}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
