import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, X, UserCheck, MessageCircle, Send, Trash2, AlertTriangle, Paperclip, FileText, Loader2, ThumbsUp, CalendarIcon, Link2 } from "lucide-react";

const isPdfUrl   = (url) => typeof url === "string" && /\.pdf(\?|#|$)/i.test(url);
const isVideoUrl = (url) => typeof url === "string" && /\.(mp4|mov|webm|avi|mkv)(\?|#|$)/i.test(url);
const fileNameFromUrl = (url) => {
  try {
    const clean = url.split("?")[0].split("#")[0];
    return decodeURIComponent(clean.split("/").pop() || "document.pdf");
  } catch { return "document.pdf"; }
};
import TaskComments from "./TaskComments";

// ─── Category-specific fields ────────────────────────────────────────────────

const CATEGORY_COLORS = {
  Design:         { bg: "bg-purple-50", border: "border-purple-100", dot: "bg-purple-400", label: "text-purple-700" },
  "Video Editing":{ bg: "bg-red-50",    border: "border-red-100",    dot: "bg-red-400",    label: "text-red-700" },
  Web:            { bg: "bg-blue-50",   border: "border-blue-100",   dot: "bg-blue-400",   label: "text-blue-700" },
  Merch:          { bg: "bg-amber-50",  border: "border-amber-100",  dot: "bg-amber-400",  label: "text-amber-700" },
  Analytics:      { bg: "bg-green-50",  border: "border-green-100",  dot: "bg-green-400",  label: "text-green-700" },
  Administrative: { bg: "bg-slate-50",  border: "border-slate-200",  dot: "bg-slate-400",  label: "text-slate-600" },
  Posting:        { bg: "bg-pink-50",   border: "border-pink-100",   dot: "bg-pink-400",   label: "text-pink-700" },
};

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function MetaSelect({ value, onChange, placeholder, children }) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function CategoryFields({ category, meta = {}, onChange }) {
  const set = (k, v) => onChange({ ...meta, [k]: v });

  const CATEGORIES_WITH_FIELDS = ["Design", "Video Editing"];
  if (!CATEGORIES_WITH_FIELDS.includes(category)) return null;

  const theme = CATEGORY_COLORS[category] || CATEGORY_COLORS.Administrative;

  let fields = null;

  if (category === "Design") {
    fields = (
      <>
        <Field label="Dimensions">
          <MetaSelect value={meta.dimensions} onChange={v => set("dimensions", v)} placeholder="A5, A4, 16:9…">
            <SelectItem value="A5">A5</SelectItem>
            <SelectItem value="A4">A4</SelectItem>
            <SelectItem value="A3">A3</SelectItem>
            <SelectItem value="A2">A2</SelectItem>
            <SelectItem value="A1">A1</SelectItem>
            <SelectItem value="50x70">50×70 cm</SelectItem>
            <SelectItem value="4:5">4:5</SelectItem>
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="9:16">9:16</SelectItem>
            <SelectItem value="1:1">1:1</SelectItem>
          </MetaSelect>
        </Field>
        <Field label="Export format">
          <MetaSelect value={meta.format} onChange={v => set("format", v)} placeholder="PDF, PNG…">
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="PNG">PNG</SelectItem>
            <SelectItem value="JPEG">JPEG</SelectItem>
            <SelectItem value="SVG">SVG</SelectItem>
            <SelectItem value="PDF+PNG">PDF + PNG</SelectItem>
            <SelectItem value="AI">Adobe Illustrator (.ai)</SelectItem>
            <SelectItem value="PSD">Photoshop (.psd)</SelectItem>
          </MetaSelect>
        </Field>
      </>
    );
  }

  if (category === "Video Editing") {
    fields = (
      <>
        <Field label="Duration">
          <MetaSelect value={meta.duration} onChange={v => set("duration", v)} placeholder="8s, 25s, 1min…">
            <SelectItem value="8s">8 sec</SelectItem>
            <SelectItem value="12s">12 sec</SelectItem>
            <SelectItem value="25s">25 sec</SelectItem>
            <SelectItem value="35s">35 sec</SelectItem>
            <SelectItem value="45s">45 sec</SelectItem>
            <SelectItem value="1min">1 min</SelectItem>
          </MetaSelect>
        </Field>
        <Field label="Ratio / Format">
          <MetaSelect value={meta.ratio} onChange={v => set("ratio", v)} placeholder="9:16, 16:9…">
            <SelectItem value="9:16">9:16 — Reels / Stories / TikTok</SelectItem>
            <SelectItem value="16:9">16:9 — YouTube / Horizontal</SelectItem>
            <SelectItem value="1:1">1:1 — Square feed</SelectItem>
            <SelectItem value="4:5">4:5 — Portrait feed</SelectItem>
          </MetaSelect>
        </Field>
      </>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${theme.bg} ${theme.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${theme.label}`}>{category} details</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {fields}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TaskFormDialog({ open, onOpenChange, task, onSave }) {
  const [currentUserName, setCurrentUserName] = useState("");

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUserName(u?.full_name || u?.email || "")).catch(() => {});
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: () => base44.entities.Client.filter({ status: "Actif" }),
  });

  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: () => base44.entities.Freelancer.list(),
  });

  const empty = {
    title: "", description: "", status: "Non commencé",
    due_date: "", assigned_to: "", client_name: "", category: "Update",
    blocking_reason: "", urls: [], urgent: false, category_meta: {},
  };

  const [data, setData] = useState(task ? { ...task, category_meta: task.category_meta || {} } : empty);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [clearStep, setClearStep] = useState(0);
  const [convImageFile, setConvImageFile] = useState(null);
  const [convImagePreview, setConvImagePreview] = useState(null);
  const [uploadingConvImage, setUploadingConvImage] = useState(false);
  const [uploadingTaskImage, setUploadingTaskImage] = useState(false);

  useEffect(() => {
    setData(task ? { ...task, category_meta: task.category_meta || {} } : empty);
    setMessageDraft("");
    setClearStep(0);
    setConvImageFile(null);
    setConvImagePreview(null);
  }, [task, open]);

  const thread = Array.isArray(data.note_thread) ? data.note_thread : [];

  const sendAdminMessage = async () => {
    if (!task?.id) return;
    const text = messageDraft.trim();
    if (!text && !convImageFile) return;
    setSendingMessage(true);
    try {
      let image_url = null;
      if (convImageFile) {
        setUploadingConvImage(true);
        const res = await base44.integrations.Core.UploadFile({ file: convImageFile });
        image_url = res.file_url;
        setUploadingConvImage(false);
      }
      const now = new Date().toISOString();
      const newMessage = {
        id: (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
        author_role: "admin",
        author_name: currentUserName || "Admin",
        text: text || "",
        image_url,
        created_at: now,
      };
      const nextThread = [...thread, newMessage];

      const { error: updErr } = await supabase.from('tasks')
        .update({ note_thread: nextThread })
        .eq('id', task.id);
      if (updErr) throw updErr;

      let freelancerId = data.assigned_freelancer_id || task.assigned_freelancer_id;
      if ((!freelancerId || freelancerId === "_me" || freelancerId === "_none") && data.assigned_to) {
        const match = freelancers.find(
          f => (f.name || "").toLowerCase().trim() === (data.assigned_to || "").toLowerCase().trim()
        );
        if (match) freelancerId = match.id;
      }

      if (freelancerId) {
        await supabase.from('notifications').insert({
          recipient_id: freelancerId,
          title: `${currentUserName || 'Admin'} · ${task.title}`,
          message: text.length > 200 ? text.slice(0, 200) + '…' : text,
          type: 'message',
          is_read: false,
          action_required: false,
          created_at: now,
        }).then(({ error }) => { if (error) console.error('admin-reply notification insert failed:', error); });
      }

      setData(d => ({ ...d, note_thread: nextThread }));
      setMessageDraft("");
      setConvImageFile(null);
      setConvImagePreview(null);
    } catch (e) {
      setUploadingConvImage(false);
      toast.error('Failed to send message: ' + (e?.message || e));
    } finally {
      setSendingMessage(false);
    }
  };

  const toggleReaction = async (msgId) => {
    if (!task?.id) return;
    const userName = currentUserName || "Admin";
    const updatedThread = thread.map(m => {
      if (m.id !== msgId) return m;
      const reactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
      const existing = reactions.findIndex(r => r.user_role === "admin");
      if (existing >= 0) reactions.splice(existing, 1);
      else reactions.push({ emoji: "👍", user_name: userName, user_role: "admin" });
      return { ...m, reactions };
    });
    setData(d => ({ ...d, note_thread: updatedThread }));
    await supabase.from('tasks').update({ note_thread: updatedThread }).eq('id', task.id);
    const msg = updatedThread.find(m => m.id === msgId);
    const hasReaction = msg?.reactions?.some(r => r.user_role === "admin");
    if (hasReaction && data.assigned_freelancer_id && data.assigned_freelancer_id !== "_me") {
      await supabase.from('notifications').insert({
        recipient_id: data.assigned_freelancer_id,
        title: `👍 ${userName} reacted`,
        message: `${userName} reacted to a message in "${task.title}"`,
        type: 'reaction', is_read: false, action_required: false,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  const handleConvImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConvImageFile(file);
    if (file.type === "application/pdf") {
      setConvImagePreview({ type: "pdf", name: file.name });
    } else if (file.type.startsWith("video/")) {
      setConvImagePreview({ type: "video", name: file.name });
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setConvImagePreview({ type: "image", dataUrl: ev.target.result });
      reader.readAsDataURL(file);
    }
  };

  const handleTaskImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTaskImage(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      set("images", [...(data.images || []), res.file_url]);
    } catch (err) {
      toast.error('Upload failed: ' + (err?.message || err));
    } finally {
      setUploadingTaskImage(false);
      e.target.value = "";
    }
  };

  const removeTaskImage = (idx) => set("images", (data.images || []).filter((_, i) => i !== idx));
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const handleSave = () => {
    if (!data.title.trim()) return;
    onSave(data);
  };

  const hasConversation = !!task?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`!left-2 !right-2 !translate-x-0 !w-auto !max-w-none sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%] sm:!w-[80vw] ${hasConversation ? "sm:!max-w-5xl" : "sm:!max-w-xl"} !max-h-[92vh] md:!max-h-[90vh] p-0 overflow-hidden flex flex-col`}
      >
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
          <DialogTitle>{task?.id ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <div className={`flex-1 min-h-0 flex flex-col ${hasConversation ? "lg:flex-row" : ""}`}>
          {/* LEFT — form */}
          <div className={`min-h-0 overflow-y-auto px-4 md:px-6 py-4 md:py-5 space-y-3 ${hasConversation ? "lg:w-[60%] lg:border-r lg:border-slate-100 flex-shrink-0" : "flex-1"}`}>

            {/* ── Row 1: Title + Category ── */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5 min-w-0">
                <Label>Title *</Label>
                <Input
                  value={data.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="Ex: Send the contract to..."
                />
              </div>
              <div className="w-44 space-y-1.5 shrink-0">
                <Label>Category</Label>
                <Select
                  value={data.category || ""}
                  onValueChange={v => setData(d => ({ ...d, category: v, category_meta: {} }))}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Video Editing">Video Editing</SelectItem>
                    <SelectItem value="Web">Web</SelectItem>
                    <SelectItem value="Merch">Merch</SelectItem>
                    <SelectItem value="Analytics">Analytics</SelectItem>
                    <SelectItem value="Administrative">Administrative</SelectItem>
                    <SelectItem value="Posting">Posting</SelectItem>
                    <SelectItem value="Update">Update</SelectItem>
                    <SelectItem value="Personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Row 2: Description ── */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={data.description || ""}
                onChange={e => set("description", e.target.value)}
                rows={1}
                className="min-h-[36px]"
                placeholder="Task details..."
              />
            </div>

            {/* ── Row 3: Category-specific fields ── */}
            <CategoryFields
              category={data.category}
              meta={data.category_meta || {}}
              onChange={v => set("category_meta", v)}
            />

            {/* ── Row 4: Status + Due date + Assigned + Client ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={data.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Non commencé">Not started</SelectItem>
                    <SelectItem value="En cours">In progress</SelectItem>
                    <SelectItem value="Terminé">Done</SelectItem>
                    <SelectItem value="Bloqué">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="flex items-center gap-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm hover:bg-accent hover:text-accent-foreground">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className={data.due_date ? "text-slate-800" : "text-slate-400"}>
                        {data.due_date ? format(new Date(data.due_date + "T00:00:00"), "dd MMM yyyy") : "Pick a date"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={data.due_date ? new Date(data.due_date + "T00:00:00") : undefined}
                      onSelect={d => set("due_date", d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Assigned to</Label>
                  {currentUserName && data.assigned_to !== currentUserName && (
                    <button
                      type="button"
                      onClick={() => setData(d => ({ ...d, assigned_to: currentUserName, assigned_freelancer_id: "_me" }))}
                      className="flex items-center gap-1 text-[10px] font-medium text-[#2A69FF] hover:underline"
                    >
                      <UserCheck className="w-3 h-3" />Me
                    </button>
                  )}
                </div>
                <Select
                  value={(() => {
                    if (data.assigned_freelancer_id) return data.assigned_freelancer_id;
                    if (data.assigned_to && currentUserName && data.assigned_to === currentUserName) return "_me";
                    if (data.assigned_to) {
                      const match = freelancers.find(f => (f.name || "").toLowerCase().trim() === data.assigned_to.toLowerCase().trim());
                      if (match) return match.id;
                    }
                    return "_none";
                  })()}
                  onValueChange={v => {
                    if (v === "_none") setData(d => ({ ...d, assigned_to: "", assigned_freelancer_id: "" }));
                    else if (v === "_me") setData(d => ({ ...d, assigned_to: currentUserName, assigned_freelancer_id: "_me" }));
                    else {
                      const f = freelancers.find(f => f.id === v);
                      setData(d => ({ ...d, assigned_to: f?.name || "", assigned_freelancer_id: v }));
                    }
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Nobody" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nobody</SelectItem>
                    {currentUserName && <SelectItem value="_me">👤 {currentUserName} (me)</SelectItem>}
                    {freelancers.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}{f.role ? ` · ${f.role}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Linked client</Label>
                <Select value={data.client_name || "_none"} onValueChange={v => set("client_name", v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Urgent ── */}
            <div>
              <button
                type="button"
                onClick={() => set("urgent", !data.urgent)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                  data.urgent
                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                    : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {data.urgent ? "Urgent" : "Mark as urgent"}
              </button>
            </div>

            {/* ── Blocking reason ── */}
            {data.status === "Bloqué" && (
              <div>
                <Label>Blocking reason</Label>
                <Input value={data.blocking_reason || ""} onChange={e => set("blocking_reason", e.target.value)} placeholder="Ex: Waiting for client approval..." />
              </div>
            )}

            {/* ── Attachments ── */}
            <div>
              <Label>Attachments</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {(data.images || []).map((url, i) => (
                  <div key={i} className="relative group">
                    {isPdfUrl(url) ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" title={fileNameFromUrl(url)}
                        className="w-14 h-14 md:w-20 md:h-20 rounded-lg border border-slate-200 bg-red-50 flex flex-col items-center justify-center gap-1 hover:bg-red-100 transition-colors p-1">
                        <FileText className="w-6 h-6 md:w-7 md:h-7 text-red-500" />
                        <span className="text-[9px] md:text-[10px] font-semibold text-red-600 truncate max-w-full px-0.5">PDF</span>
                      </a>
                    ) : isVideoUrl(url) ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" title={fileNameFromUrl(url)}
                        className="w-14 h-14 md:w-20 md:h-20 rounded-lg border border-slate-200 bg-slate-900 flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity overflow-hidden relative">
                        <video src={url} className="absolute inset-0 w-full h-full object-cover opacity-60" muted preload="metadata" />
                        <span className="relative z-10 text-[9px] md:text-[10px] font-bold text-white bg-black/50 px-1 py-0.5 rounded">
                          {fileNameFromUrl(url).split('.').pop().toUpperCase()}
                        </span>
                      </a>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="w-14 h-14 md:w-20 md:h-20 rounded-lg border border-slate-200 object-cover hover:opacity-90" />
                      </a>
                    )}
                    <button type="button" onClick={() => removeTaskImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className={`w-14 h-14 md:w-20 md:h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-colors ${uploadingTaskImage ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploadingTaskImage ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Paperclip className="w-5 h-5 text-slate-400" />}
                  <input type="file" accept="image/*,application/pdf,video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleTaskImageUpload} />
                </label>
              </div>
            </div>

            {/* ── Links ── */}
            <div>
              <Label>Links</Label>
              <div className="mt-1.5 space-y-2">
                {(data.urls || []).map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="url" value={url}
                      onChange={e => { const next = [...(data.urls || [])]; next[i] = e.target.value; set("urls", next); }}
                      placeholder="https://..."
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                    <a href={url} target="_blank" rel="noopener noreferrer" className={`text-[#2A69FF] hover:underline text-xs ${!url ? 'pointer-events-none opacity-30' : ''}`}>Open</a>
                    <button type="button" onClick={() => set("urls", (data.urls || []).filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => set("urls", [...(data.urls || []), ""])}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add a link
                </button>
              </div>
            </div>

          </div>
          {/* ─── end LEFT column ─── */}

          {/* RIGHT — conversation */}
          {hasConversation && (
            <div className="flex-1 min-h-0 flex flex-col px-5 py-4 bg-slate-50/40">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-1.5 text-slate-600">
                  <MessageCircle className="w-3.5 h-3.5" /> Conversation
                  {data.assigned_to && <span className="text-slate-400 font-normal">· with {data.assigned_to}</span>}
                </Label>
                {thread.length > 0 && (
                  clearStep === 0 ? (
                    <button type="button" onClick={() => setClearStep(1)} className="text-slate-300 hover:text-red-400 transition-colors" title="Clear conversation">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : clearStep === 1 ? (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-red-500 font-medium">Delete all messages?</span>
                      <button type="button" onClick={() => setClearStep(2)} className="px-2 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 font-medium">Yes</button>
                      <button type="button" onClick={() => setClearStep(0)} className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 font-medium">No</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-red-600 font-semibold">Are you really sure?</span>
                      <button type="button" onClick={async () => { await supabase.from('tasks').update({ note_thread: [] }).eq('id', task.id); setData(d => ({ ...d, note_thread: [] })); setClearStep(0); }} className="px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 font-medium">Delete permanently</button>
                      <button type="button" onClick={() => setClearStep(0)} className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 font-medium">Cancel</button>
                    </div>
                  )
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
                {thread.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No messages yet.</p>
                ) : (
                  thread.map(m => {
                    const fromAdmin = m.author_role === "admin";
                    return (
                      <div key={m.id} className={`rounded-md border px-2.5 py-1.5 ${fromAdmin ? "bg-blue-50 border-blue-200 ml-6" : "bg-amber-50 border-amber-200 mr-6"}`}>
                        <p className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${fromAdmin ? "text-blue-700" : "text-amber-700"}`}>
                          {fromAdmin ? (m.author_name || "You") : (m.author_name || data.assigned_to || "Freelancer")}
                          {m.created_at && (
                            <span className="ml-1.5 text-slate-400 normal-case tracking-normal font-normal">
                              · {format(new Date(m.created_at), "d MMM yyyy HH:mm", { locale: enUS })}
                            </span>
                          )}
                        </p>
                        {m.text && <p className="text-xs text-slate-700 whitespace-pre-wrap">{m.text}</p>}
                        {m.image_url && (
                          isPdfUrl(m.image_url) ? (
                            <a href={m.image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors max-w-full">
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-xs font-medium truncate">{fileNameFromUrl(m.image_url)}</span>
                            </a>
                          ) : (
                            <a href={m.image_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                              <img src={m.image_url} alt="" className="max-w-[200px] max-h-[150px] rounded-md border border-slate-200 object-cover hover:opacity-90" />
                            </a>
                          )
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <button type="button" onClick={() => toggleReaction(m.id)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${(m.reactions || []).length > 0 ? "bg-blue-50 border-blue-200 text-blue-600" : "border-transparent text-slate-300 hover:text-slate-500"}`}>
                            <ThumbsUp className="w-3 h-3" />
                            {(m.reactions || []).length > 0 && <span>{m.reactions.length}</span>}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-2 flex-shrink-0 space-y-2">
                {convImagePreview && (
                  <div className="relative inline-block">
                    {convImagePreview.type === "pdf" ? (
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 bg-red-50 max-w-[200px]">
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="text-xs text-slate-700 truncate">{convImagePreview.name}</span>
                      </div>
                    ) : convImagePreview.type === "video" ? (
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-800 max-w-[200px]">
                        <span className="text-base">🎬</span>
                        <span className="text-xs text-white truncate">{convImagePreview.name}</span>
                      </div>
                    ) : (
                      <img src={convImagePreview.dataUrl} alt="Preview" className="max-w-[100px] max-h-[60px] rounded-md border border-slate-200 object-cover" />
                    )}
                    <button type="button" onClick={() => { setConvImageFile(null); setConvImagePreview(null); }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus-within:border-brand/50 focus-within:bg-white transition-colors">
                  <label className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" title="Attach image or PDF">
                    <Paperclip className="w-4 h-4" />
                    <input type="file" accept="image/*,application/pdf,video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleConvImageSelect} />
                  </label>
                  <textarea
                    value={messageDraft}
                    onChange={e => setMessageDraft(e.target.value.slice(0, 5000))}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (messageDraft.trim() || convImageFile) sendAdminMessage(); } }}
                    rows={1} placeholder="Write a message…" maxLength={5000}
                    className="flex-1 text-sm bg-transparent border-0 outline-none resize-none py-1 placeholder:text-slate-400"
                    style={{ minHeight: 28, maxHeight: 100 }}
                    onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
                  />
                  <button type="button" onClick={sendAdminMessage}
                    disabled={sendingMessage || uploadingConvImage || (!messageDraft.trim() && !convImageFile)}
                    className="shrink-0 p-1.5 rounded-lg text-white bg-brand hover:bg-brand/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    {sendingMessage || uploadingConvImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title.trim()}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
