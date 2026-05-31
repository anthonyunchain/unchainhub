import { useState, useEffect, useRef } from "react";
import * as tus from "tus-js-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Upload, X, Clapperboard, Link2, Trash2, Pencil, List, Calendar as CalendarIcon, Download, Loader2, FileVideo, Lightbulb, Repeat2, PanelRight, EyeOff } from "lucide-react";
import CsvImportDialog from "../components/editorial/CsvImportDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { AlignLeft } from "lucide-react";
import StatusBadge from "../components/shared/StatusBadge";
import {
  format, startOfWeek, addDays, addWeeks, isSameDay,
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths,
  isSameMonth
} from "date-fns";
import { enUS } from "date-fns/locale";

const TYPE_COLORS = {
  Reel: "bg-pink-100 text-pink-700",
  Story: "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

export default function Editorial({ onDescriptionsClick } = {}) {
  const { toast } = useToast();
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
  const [draggingIdeaId, setDraggingIdeaId] = useState(null);
  const [ideasPanelOpen, setIdeasPanelOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingFinalFile, setUploadingFinalFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dialogTab, setDialogTab] = useState("general");
  const [csvOpen, setCsvOpen] = useState(false);
  const [hideCancelled, setHideCancelled] = useState(false);
  const qc = useQueryClient();

  // Check user role for read-only mode
  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Only 'user' (client portal) is fully read-only — freelancers can add/edit/delete
      setIsReadOnly(u?.role === 'user');
    }).catch(() => setIsReadOnly(true));
  }, []);

  const isFreelancer = user?.role === 'freelancer';
  const canEditDescription = true; // freelancers and admins can all edit description

  const { data: content = [] } = useQuery({ queryKey: ["editorial"], queryFn: () => base44.entities.EditorialContent.list() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.filter({ status: "Actif" }) });
  const { data: allFreelancers = [] } = useQuery({ queryKey: ["freelancers"], queryFn: () => base44.entities.Freelancer.list() });
  const { data: ideas = [] } = useQuery({
    queryKey: ["content-ideas"],
    enabled: ideasPanelOpen,
    queryFn: async () => {
      const { data, error } = await supabase.from("content_ideas").select("*").is("used_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  // Only video editors can be assigned to montage
  const videoEditors = allFreelancers.filter(f => (f.tags || []).map(t => t.toLowerCase()).includes("video editor") || f.role?.toLowerCase().includes("monteur") || f.role?.toLowerCase().includes("video editor"));

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.EditorialContent.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial"] }); setDialogOpen(false); },
    onError: (err) => toast({ title: "Erreur lors de la création", description: err?.message || String(err), variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.EditorialContent.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial"] }); setDialogOpen(false); },
    onError: (err) => toast({ title: "Erreur lors de la sauvegarde", description: err?.message || String(err), variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.EditorialContent.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["editorial"] });
      setDialogOpen(false);
    },
  });

  // Apply URL param for client filter (from Dashboard link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const client = params.get("client");
    if (client) setFilterClient(client);
  });

  const filtered = content
    .filter(c => filterClient === "all" || c.client_name === filterClient)
    .filter(c => filterTypes.includes(c.post_type))
    .filter(c => !hideCancelled || c.status !== 'Annulé');

  const toggleType = (type) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleDrop = (date) => {
    if (isReadOnly) return;
    const newDate = format(date, "yyyy-MM-dd");

    if (draggingIdeaId) {
      const idea = ideas.find(i => i.id === draggingIdeaId);
      if (!idea) { setDraggingIdeaId(null); return; }
      // Create editorial content from the idea
      createMut.mutate({
        client_name: idea.client_name,
        title: idea.title,
        post_type: idea.post_type,
        scheduled_date: newDate,
        status: "Planifié",
        description: idea.caption || "",
        notes: "",
        needs_shooting: false,
        shoot_timing: "in-month",
      });
      // Mark specific ideas as used
      if (idea.category === "specific") {
        supabase.from("content_ideas").update({ used_at: new Date().toISOString() }).eq("id", idea.id)
          .then(() => qc.invalidateQueries({ queryKey: ["content-ideas"] }));
      }
      setDraggingIdeaId(null);
      return;
    }

    if (!draggingId) return;
    updateMut.mutate({ id: draggingId, d: { scheduled_date: newDate } });
    setDraggingId(null);
  };

  const openNew = (date) => {
    if (isReadOnly) return;
    setEditData({ client_id: "", client_name: "", title: "", post_type: "Reel", scheduled_date: format(date || new Date(), "yyyy-MM-dd"), status: "Planifié", description: "", notes: "", needs_shooting: true, shoot_timing: "in-month" });
    setDialogTab("general");
    setDialogOpen(true);
  };
  const openEdit = (c) => {
    setEditData({ ...c });
    setDialogTab("general");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editData.id) updateMut.mutate({ id: editData.id, d: editData });
    else createMut.mutate(editData);
  };

  const handleDelete = () => {
    if (!editData?.id) return;
    setDeleteConfirmId(editData.id);
    setDeleteConfirmOpen(true);
  };

  const handleQuickDelete = (e, id) => {
    if (isReadOnly) return;
    e.stopPropagation();
    setDeleteConfirmId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) deleteMut.mutate(deleteConfirmId);
    setDeleteConfirmOpen(false);
    setDeleteConfirmId(null);
  };

  const handleFinalFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editData?.id) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 50 MB (upgrade Supabase plan for larger files)", variant: "destructive" });
      return;
    }

    setUploadingFinalFile(true);
    setUploadProgress(0);

    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `final-files/${filename}`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const fileUrl = await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000],
          headers: {
            authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: 'content',
            objectName: path,
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
          },
          chunkSize: 6 * 1024 * 1024, // 6 MB chunks
          onError: reject,
          onProgress: (bytesUploaded, bytesTotal) => {
            setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess: () => {
            const { data } = supabase.storage.from('content').getPublicUrl(path);
            resolve(data.publicUrl);
          },
        });
        upload.start();
      });

      await supabase.from('editorial_content')
        .update({ final_file_url: fileUrl, final_file_name: file.name })
        .eq('id', editData.id);

      setEditData(d => ({ ...d, final_file_url: fileUrl, final_file_name: file.name }));
      qc.invalidateQueries({ queryKey: ["editorial"] });
      toast({ title: "File uploaded", description: file.name });
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setUploadingFinalFile(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleRemoveFinalFile = async () => {
    if (!editData?.id) return;
    await supabase.from('editorial_content')
      .update({ final_file_url: null, final_file_name: null })
      .eq('id', editData.id);
    setEditData(d => ({ ...d, final_file_url: null, final_file_name: null }));
    qc.invalidateQueries({ queryKey: ["editorial"] });
  };

  const navigate = (dir) => {
    if (view === "day") setCurrentDate(d => addDays(d, dir));
    else if (view === "week") setCurrentDate(d => addWeeks(d, dir));
    else setCurrentDate(d => addMonths(d, dir));
  };

  const goToday = () => setCurrentDate(new Date());

  const navLabel = () => {
    if (view === "day") return format(currentDate, "EEEE d MMMM yyyy", { locale: enUS });
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      return `Week of ${format(ws, "d MMMM yyyy", { locale: enUS })}`;
    }
    if (view === "list") return "All content";
    return format(currentDate, "MMMM yyyy", { locale: enUS });
  };

  // CONTENT CARD (calendar views)
  const ContentCard = ({ c, compact = false }) => {
    const isCancelled = c.status === 'Annulé';
    const isBeingDragged = draggingId === c.id;
    return (
      <div
        className="group relative"
        draggable={!isReadOnly && !isCancelled}
        onDragStart={(e) => { if (!isReadOnly && !isCancelled) { e.stopPropagation(); setDraggingId(c.id); } }}
        onDragEnd={() => setDraggingId(null)}
        style={{
          ...(isCancelled ? { filter: 'grayscale(1)', opacity: 0.5 } : undefined),
          ...(isBeingDragged ? { opacity: 0.4, transform: 'scale(0.97)' } : undefined),
          transition: 'opacity 0.15s, transform 0.15s',
        }}
      >
        <div
          onClick={() => openEdit(c)}
          className={`p-2 rounded-lg border transition-all pr-6 select-none
            ${isCancelled
              ? 'bg-slate-50 border-slate-100 cursor-default'
              : 'bg-slate-50 border-slate-200 cursor-grab active:cursor-grabbing hover:border-brand/40 hover:bg-blue-50/40'
            }`}
        >
          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
            {isCancelled
              ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-slate-200 text-slate-500">Cancelled</span>
              : <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
            }
            {!isCancelled && c.shoot_timing === "advance" && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">📅 Advance</span>}
          </div>
          <p
            className={`font-medium text-slate-700 line-clamp-2 ${compact ? "text-[10px]" : "text-[11px]"}`}
            style={isCancelled ? { textDecoration: 'line-through' } : undefined}
          >{c.title || c.description || "Untitled"}</p>
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
  };

  // DAY VIEW
  const DayView = () => {
    const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), currentDate));
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 capitalize">{format(currentDate, "EEEE d MMMM", { locale: enUS })}</h3>
          {!isReadOnly && <button onClick={() => openNew(currentDate)} className="text-emerald-600 hover:text-emerald-700 text-sm flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add</button>}
        </div>
        {dayContent.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No content this day</p>
        ) : (
          <div className="space-y-3">
            {dayContent.map(c => {
              const isCancelled = c.status === 'Annulé';
              return (
                <div key={c.id} className="group flex items-start gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 cursor-pointer" onClick={() => openEdit(c)}
                  style={isCancelled ? { filter: 'grayscale(1)', opacity: 0.5 } : undefined}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isCancelled
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-200 text-slate-500">Cancelled</span>
                        : <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
                      }
                      <span className="text-xs text-slate-400">{c.client_name}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800" style={isCancelled ? { textDecoration: 'line-through' } : undefined}>{c.title || "Untitled"}</p>
                    {c.description && <p className="text-xs text-slate-500 mt-1">{c.description}</p>}
                  </div>
                  {!isReadOnly && <button onClick={(e) => handleQuickDelete(e, c.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // WEEK VIEW
  const WeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Mon–Fri only
    return (
      <div className="overflow-x-auto -mx-1 px-1">
      <div className="grid grid-cols-5 gap-3 min-w-[560px]">
        {days.map(day => {
          const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));
          const isToday = isSameDay(day, new Date());
          return (
            <div
            key={day.toISOString()}
            className={`bg-white rounded-xl border p-3 min-h-[200px] transition-colors ${isToday ? "border-[#2A69FF] ring-1 ring-[#2A69FF]/10" : "border-slate-100"} ${(draggingId || draggingIdeaId) ? "hover:bg-blue-50/40 hover:border-blue-200" : ""}`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(day)}
          >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">{format(day, "EEE", { locale: enUS })}</p>
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
    const [dayPage, setDayPage] = useState(0);
    const [expandedDays, setExpandedDays] = useState({});
    const touchStartX = useRef(null);
    const toggleExpand = (key) => setExpandedDays(prev => ({ ...prev, [key]: !prev[key] }));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 });
    const allDays = eachDayOfInterval({ start: calStart, end: addDays(calEnd, 6) }).slice(0, 49);
    const weeks = [];
    for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));
    const allWeeks = weeks.filter(week => week.some(d => isSameMonth(d, currentDate)));
    const visibleDays = allWeeks.flat().filter(d => d.getDay() !== 0 && d.getDay() !== 6); // desktop: Mon–Fri only

    const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"]; // Mon–Fri only
    // Mobile: 2 pages. page 0 → Mon/Tue/Wed  page 1 → Wed/Thu/Fri (overlap on Wed)
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
      const dayKey = format(day, "yyyy-MM-dd");
      const dayContent = filtered.filter(c => c.scheduled_date && isSameDay(new Date(c.scheduled_date), day));
      const isToday = isSameDay(day, new Date());
      const inMonth = isSameMonth(day, currentDate);
      const expanded = !!expandedDays[dayKey];
      const visible = expanded ? dayContent : dayContent.slice(0, 2);
      const hidden = dayContent.length - 2;
      return (
        <div
          className={`min-h-[100px] p-1.5 transition-colors ${border ? "border-b border-r border-slate-100" : ""} ${!inMonth ? "bg-slate-50/50" : ""} ${(draggingId || draggingIdeaId) && inMonth ? "hover:bg-blue-50/40" : ""}`}
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
            {visible.map(c => <ContentCard key={c.id} c={c} compact />)}
            {!expanded && hidden > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(dayKey); }}
                className="text-[9px] text-[#2A69FF] hover:text-[#1a4fd6] pl-1 hover:underline transition-colors"
              >
                +{hidden} more
              </button>
            )}
            {expanded && dayContent.length > 2 && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(dayKey); }}
                className="text-[9px] text-slate-400 hover:text-slate-600 pl-1 hover:underline transition-colors"
              >
                Show less
              </button>
            )}
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
            <button aria-label="Show Mon–Wed" onClick={() => setDayPage(0)} className={`w-1.5 h-1.5 rounded-full transition-all ${dayPage === 0 ? "bg-[#2A69FF] w-3" : "bg-slate-200"}`} />
            <button aria-label="Show Wed–Fri" onClick={() => setDayPage(1)} className={`w-1.5 h-1.5 rounded-full transition-all ${dayPage === 1 ? "bg-[#2A69FF] w-3" : "bg-slate-200"}`} />
          </div>
        </div>

        {/* ── Desktop (5 cols, Mon–Fri) ── */}
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
            {sorted.map(c => {
              const isCancelled = c.status === 'Annulé';
              return (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 group"
                style={isCancelled ? { filter: 'grayscale(1)', opacity: 0.5 } : undefined}>
                <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                  {c.scheduled_date ? format(new Date(c.scheduled_date), "d MMM yyyy", { locale: enUS }) : "—"}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{c.client_name || "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-700 max-w-[200px] truncate"
                  style={isCancelled ? { textDecoration: 'line-through' } : undefined}>{c.title || c.description || "Untitled"}</td>
                <td className="px-5 py-3">
                  {isCancelled
                    ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-200 text-slate-500">Cancelled</span>
                    : <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
                  }
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
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const ShootingPlannerView = () => {
    const [plannerMonth, setPlannerMonth] = useState(() => format(addMonths(new Date(), 1), "yyyy-MM"));
    const [plannerClient, setPlannerClient] = useState("all");
    const { data: advanceItems = [], isLoading } = useQuery({
      queryKey: ["advance-shoot", plannerMonth, plannerClient],
      queryFn: async () => {
        let q = supabase.from("editorial_content")
          .select("*")
          .eq("shoot_timing", "advance")
          .like("scheduled_date", `${plannerMonth}%`)
          .order("scheduled_date");
        if (plannerClient !== "all") q = q.eq("client_name", plannerClient);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      },
    });
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input type="month" value={plannerMonth} onChange={e => setPlannerMonth(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30" />
          <Select value={plannerClient} onValueChange={setPlannerClient}>
            <SelectTrigger className="w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-400">{advanceItems.length} advance-shoot item{advanceItems.length !== 1 ? "s" : ""}</span>
        </div>
        {isLoading && <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>}
        {!isLoading && advanceItems.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-sm text-slate-400">
            No advance-shoot content for this month
          </div>
        )}
        {!isLoading && advanceItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Title</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Shooting</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {advanceItems.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 group">
                    <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {c.scheduled_date ? format(new Date(c.scheduled_date), "d MMM yyyy", { locale: enUS }) : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{c.client_name || "—"}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 max-w-[200px] truncate">{c.title || c.description || "Untitled"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
                    </td>
                    <td className="px-5 py-3">
                      {c.needs_shooting === false ? (
                        <span className="text-xs text-slate-400">Not needed</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                          📅 Needs shooting
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {!isReadOnly && (
                        <button onClick={() => openEdit(c)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#2A69FF] transition-opacity">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Filter ideas for the currently selected client
  const panelIdeas = filterClient === "all" ? ideas : ideas.filter(i => i.client_name === filterClient);
  const panelGeneral = panelIdeas.filter(i => i.category === "general");
  const panelSpecific = panelIdeas.filter(i => i.category === "specific");

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Editorial Calendar" subtitle="Content planning">
        {/* Desktop: all controls */}
        <div className="hidden sm:flex flex-wrap gap-2">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className={`h-9 ${ideasPanelOpen ? "bg-amber-50 border-amber-300 text-amber-700" : ""}`}
            onClick={() => setIdeasPanelOpen(v => !v)}
          >
            <Lightbulb className="w-4 h-4 mr-1" /> Ideas
          </Button>
          {onDescriptionsClick ? (
            <Button variant="outline" className="h-9" onClick={onDescriptionsClick}>
              <AlignLeft className="w-4 h-4 mr-1" /> Descriptions
            </Button>
          ) : (
            <Link to="/ContentDescriptions">
              <Button variant="outline" className="h-9">
                <AlignLeft className="w-4 h-4 mr-1" /> Descriptions
              </Button>
            </Link>
          )}
          {!isReadOnly && (
            <>
              <Button variant="outline" className="h-9" onClick={() => setCsvOpen(true)}>
                <Upload className="w-4 h-4 mr-1" /> Import CSV
              </Button>
              <Button onClick={() => openNew()} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
                <Plus className="w-4 h-4 mr-1" /> New content
              </Button>
            </>
          )}
        </div>
        {/* Mobile: only New content */}
        {!isReadOnly && (
          <Button onClick={() => openNew()} className="sm:hidden bg-brand hover:bg-brand/90 text-brand-foreground h-9">
            <Plus className="w-4 h-4 mr-1" /> New content
          </Button>
        )}
      </PageHeader>

      {/* Mobile: client filter below header */}
      <div className="sm:hidden mb-3">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-full h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 flex-1">
          {view !== "list" && (
            <>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <h3 className="text-sm font-semibold text-slate-700 capitalize flex-1 text-center">{navLabel()}</h3>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="ghost" className="hidden sm:inline-flex text-xs h-7 text-slate-500 shrink-0" onClick={goToday}>Today</Button>
            </>
          )}
          {view === "list" && <h3 className="text-sm font-semibold text-slate-700">{filtered.length} content{filtered.length > 1 ? "s" : ""}</h3>}
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1">
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
            <button
              onClick={() => setHideCancelled(v => !v)}
              title={hideCancelled ? "Show cancelled" : "Hide cancelled"}
              className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all flex items-center gap-1 ${
                hideCancelled
                  ? "bg-slate-700 text-white border-transparent"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
              }`}
            >
              <EyeOff className="w-3 h-3" />
              Cancelled
            </button>
          </div>
          <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            {[
              { key: "day", label: "Day", icon: CalendarIcon },
                { key: "week", label: "Week", icon: CalendarIcon },
                { key: "month", label: "Month", icon: CalendarIcon },
                { key: "list", label: "List", icon: List },
                { key: "planner", label: "Planner", icon: CalendarIcon },
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

      <div className="flex gap-4 items-start">
        {/* Ideas side panel — LEFT */}
        {ideasPanelOpen && (
          <div className="hidden lg:flex flex-col w-64 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ maxHeight: 'calc(100vh - 160px)', position: 'sticky', top: 16 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-800">Ideas</span>
                {filterClient !== "all" && <span className="text-xs text-slate-400 truncate max-w-[80px]">{filterClient}</span>}
              </div>
              <button onClick={() => setIdeasPanelOpen(false)} className="text-slate-300 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-3 py-3 space-y-4">
              {filterClient === "all" && (
                <p className="text-xs text-slate-400 text-center py-4">Select a client to see their ideas</p>
              )}

              {filterClient !== "all" && panelIdeas.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No ideas for {filterClient}</p>
              )}

              {filterClient !== "all" && panelGeneral.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Repeat2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">General</span>
                    <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">{panelGeneral.length}</span>
                  </div>
                  <div className="space-y-2">
                    {panelGeneral.map(idea => (
                      <IdeaPanelCard
                        key={idea.id}
                        idea={idea}
                        onDragStart={() => setDraggingIdeaId(idea.id)}
                        onDragEnd={() => setDraggingIdeaId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filterClient !== "all" && panelSpecific.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Specific</span>
                    <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">{panelSpecific.length}</span>
                  </div>
                  <div className="space-y-2">
                    {panelSpecific.map(idea => (
                      <IdeaPanelCard
                        key={idea.id}
                        idea={idea}
                        onDragStart={() => setDraggingIdeaId(idea.id)}
                        onDragEnd={() => setDraggingIdeaId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar views */}
        <div className="flex-1 min-w-0">
          {view === "day" && <DayView />}
          {view === "week" && <WeekView />}
          {view === "month" && <MonthView />}
          {view === "list" && <ListView />}
          {view === "planner" && <ShootingPlannerView />}
        </div>
      </div>

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
        <DialogContent className="max-w-xl overflow-y-auto" style={{ maxHeight: '90vh' }}>
          <DialogHeader>
            <DialogTitle>{editData?.id ? (isReadOnly && !isFreelancer ? "View content" : "Edit content") : "New content"}</DialogTitle>
          </DialogHeader>

          {editData && (
            <div className="mt-1">

              {/* ── Tab bar ── */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
                {[
                  { key: "general", label: "General" },
                  { key: "editing", label: "Video editing" },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setDialogTab(t.key)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${dialogTab === t.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Tab: General ── */}
              {dialogTab === "general" && (
                <div className="space-y-4">
                  {isFreelancer && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700 font-medium">✏️ You can create, edit and delete content for your assigned clients</p>
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
                        <Select value={editData.status} onValueChange={v => setEditData({ ...editData, status: v, ...(v === 'Annulé' ? { needs_shooting: false } : {}) })}>
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
                    <Textarea value={editData.description || ""} onChange={e => setEditData({ ...editData, description: e.target.value })} rows={4} disabled={!canEditDescription} />
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

                  {!isReadOnly && (
                    <div className={`flex items-center justify-between py-1 ${editData.status === 'Annulé' ? "opacity-40 pointer-events-none" : ""}`}>
                      <Label className="text-sm text-slate-600">Need a shooting</Label>
                      <button
                        type="button"
                        onClick={() => setEditData(d => ({ ...d, needs_shooting: !d.needs_shooting }))}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${editData.needs_shooting !== false ? "bg-brand" : "bg-slate-200"}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${editData.needs_shooting !== false ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                  )}

                  <div>
                    <Label>Shoot timing</Label>
                    {isReadOnly ? (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700 capitalize">
                        {editData.shoot_timing === "advance" ? "Advance shoot (prior month)" : editData.shoot_timing === "no-shoot" ? "No shoot needed" : "In-month shoot"}
                      </div>
                    ) : (
                      <Select value={editData.shoot_timing || "in-month"} onValueChange={v => setEditData({ ...editData, shoot_timing: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in-month">In-month shoot</SelectItem>
                          <SelectItem value="advance">Advance shoot (prior month)</SelectItem>
                          <SelectItem value="no-shoot">No shoot needed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* ── Final file ── */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <FileVideo className="w-4 h-4 text-emerald-600" />
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Final file</p>
                      <span className="text-xs text-slate-400">— max 50 MB</span>
                    </div>

                    {!editData.id && (
                      <p className="text-xs text-slate-400 italic">Save the content first to attach a final file.</p>
                    )}

                    {editData.id && editData.final_file_url && (
                      <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileVideo className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-sm text-emerald-800 font-medium truncate">{editData.final_file_name || "Final file"}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <a
                            href={editData.final_file_url}
                            download={editData.final_file_name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                          <label className={`cursor-pointer flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors ${uploadingFinalFile ? "opacity-50 pointer-events-none" : ""}`}>
                            <Upload className="w-3.5 h-3.5" /> Replace
                            <input type="file" className="hidden" onChange={handleFinalFileUpload} disabled={uploadingFinalFile} />
                          </label>
                          <button onClick={handleRemoveFinalFile} className="text-slate-300 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {editData.id && !editData.final_file_url && (
                      <label className={`flex flex-col items-center justify-center gap-2 py-7 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-all ${uploadingFinalFile ? "opacity-60 pointer-events-none" : ""}`}>
                        {uploadingFinalFile ? (
                          <>
                            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                            <span className="text-sm text-emerald-700 font-medium">
                              Uploading{uploadProgress > 0 ? ` ${uploadProgress}%` : "…"}
                            </span>
                            {uploadProgress > 0 && (
                              <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-slate-400" />
                            <span className="text-sm text-slate-500 font-medium">Upload final file</span>
                            <span className="text-xs text-slate-400">MP4, MOV, ZIP, PDF… up to 50 MB</span>
                          </>
                        )}
                        <input type="file" className="hidden" onChange={handleFinalFileUpload} disabled={uploadingFinalFile} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab: Video editing ── */}
              {dialogTab === "editing" && (
                <div className="space-y-4">
                  <div>
                    <Label>Assigned editor</Label>
                    <Select value={editData.assigned_editor_id || "__none__"} onValueChange={v => {
                      const editorId = v === "__none__" ? null : v;
                      const fl = videoEditors.find(f => f.id === editorId);
                      const isReel = editData.post_type === "Reel";
                      setEditData({ ...editData, assigned_editor_id: editorId, assigned_editor_name: fl?.name || "",
                        editing_status: editorId ? (isReel ? "En attente d'acceptation" : (editData.editing_status === "Non assigné" ? "À faire" : editData.editing_status)) : "Non assigné"
                      });
                    }}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {videoEditors.length === 0 && <SelectItem value="_none" disabled>No video editors</SelectItem>}
                        {videoEditors.map(f => <SelectItem key={f.id} value={f.id}>{f.name}{f.status === "Indisponible" ? " — unavailable" : ""}</SelectItem>)}
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
                    <Textarea value={editData.editing_instructions || ""} onChange={e => setEditData({ ...editData, editing_instructions: e.target.value })} rows={5} placeholder="e.g. Start on wide shot, music from 0:03..." />
                  </div>

                  <div>
                    <Label>Reference files</Label>
                    <div className="mt-1 space-y-1.5">
                      {(editData.editing_files || []).map((url, i) => {
                        const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2A69FF] hover:underline truncate max-w-[240px]">{name}</a>
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

                  {/* Portal V2 fields */}
                  <div>
                    <Label>Drive / content link (Portal V2)</Label>
                    <input
                      type="url"
                      value={editData.drive_url || ""}
                      onChange={e => setEditData({ ...editData, drive_url: e.target.value })}
                      placeholder="https://drive.google.com/…"
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2A69FF]"
                    />
                  </div>
                  <div>
                    <Label>Cover image URL (Portal V2)</Label>
                    <input
                      type="url"
                      value={editData.cover_image_url || ""}
                      onChange={e => setEditData({ ...editData, cover_image_url: e.target.value })}
                      placeholder="https://…"
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2A69FF]"
                    />
                  </div>
                  <div>
                    <Label>Reel caption / description (Portal V2)</Label>
                    <Textarea value={editData.reel_description || ""} onChange={e => setEditData({ ...editData, reel_description: e.target.value })} rows={3} placeholder="Caption to copy-paste for this reel…" />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-5 mt-2 border-t border-slate-100">
                {!isReadOnly && editData.id ? (
                  <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
                  {(!isReadOnly || isFreelancer) && <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground">Save</Button>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const IDEA_TYPE_COLORS = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

function IdeaPanelCard({ idea, onDragStart, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(); }}
      onDragEnd={onDragEnd}
      className="bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-brand/40 hover:bg-blue-50/40 transition-colors select-none"
    >
      <p className="text-xs font-semibold text-slate-800 leading-tight mb-1.5">{idea.title}</p>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${IDEA_TYPE_COLORS[idea.post_type] || "bg-slate-100 text-slate-600"}`}>
          {idea.post_type}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">{idea.platform}</span>
      </div>
      {idea.caption && (
        <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{idea.caption}</p>
      )}
      {idea.reference_file_url && (
        <img src={idea.reference_file_url} alt="" className="mt-2 h-16 w-full object-cover rounded-lg" />
      )}
    </div>
  );
}