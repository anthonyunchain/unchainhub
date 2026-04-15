import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, CheckSquare, Square, UserCheck, MessageCircle, Send } from "lucide-react";

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
    blocking_reason: "", checklist: [], notes: ""
  };

  const [data, setData] = useState(task || empty);
  const [newCheck, setNewCheck] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    setData(task || empty);
    setNewCheck("");
    setMessageDraft("");
  }, [task, open]);

  const thread = Array.isArray(data.note_thread) ? data.note_thread : [];

  const sendAdminMessage = async () => {
    if (!task?.id) return;
    const text = messageDraft.trim();
    if (!text) return;
    setSendingMessage(true);
    try {
      const now = new Date().toISOString();
      const newMessage = {
        id: (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
        author_role: "admin",
        author_name: currentUserName || "Admin",
        text,
        created_at: now,
      };
      const nextThread = [...thread, newMessage];

      const { error: updErr } = await supabase.from('tasks')
        .update({ note_thread: nextThread })
        .eq('id', task.id);
      if (updErr) throw updErr;

      // Resolve freelancer id: prefer the column, fall back to matching assigned_to
      let freelancerId = data.assigned_freelancer_id || task.assigned_freelancer_id;
      if ((!freelancerId || freelancerId === "_me" || freelancerId === "_none") && data.assigned_to) {
        const match = freelancers.find(
          f => (f.name || "").toLowerCase().trim() === (data.assigned_to || "").toLowerCase().trim()
        );
        if (match) freelancerId = match.id;
      }

      if (freelancerId) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          recipient_id: freelancerId,
          title: `${currentUserName || 'Admin'} · ${task.title}`,
          message: text.length > 200 ? text.slice(0, 200) + '…' : text,
          type: 'message',
          is_read: false,
          action_required: false,
          created_at: now,
        });
        if (notifErr) console.error('admin-reply notification insert failed:', notifErr);
      }

      setData(d => ({ ...d, note_thread: nextThread }));
      setMessageDraft("");
    } catch (e) {
      alert('Failed to send message: ' + (e?.message || e));
    } finally {
      setSendingMessage(false);
    }
  };

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const addCheck = () => {
    if (!newCheck.trim()) return;
    set("checklist", [...(data.checklist || []), { label: newCheck.trim(), done: false }]);
    setNewCheck("");
  };

  const toggleCheck = (i) => {
    const list = [...(data.checklist || [])];
    list[i] = { ...list[i], done: !list[i].done };
    set("checklist", list);
  };

  const removeCheck = (i) => set("checklist", (data.checklist || []).filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!data.title.trim()) return;
    onSave(data);
  };

  const PRIORITY_COLORS = {
    "Basse": "text-slate-500", "Normale": "text-blue-500",
    "Haute": "text-amber-500", "Urgente": "text-red-500"
  };

  const hasConversation = !!task?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${hasConversation ? "!max-w-[98vw]" : "!max-w-2xl"} w-[98vw] !max-h-[94vh] h-[94vh] p-0 overflow-hidden flex flex-col`}
      >
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
          <DialogTitle>{task?.id ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <div className={`flex-1 min-h-0 flex flex-col ${hasConversation ? "lg:flex-row" : ""}`}>
          {/* LEFT — form fields */}
          <div className={`flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 ${hasConversation ? "lg:border-r lg:border-slate-100" : ""}`}>

          {/* Titre */}
          <div>
            <Label>Title *</Label>
            <Input value={data.title} onChange={e => set("title", e.target.value)} placeholder="Ex: Send the contract to..." />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea value={data.description || ""} onChange={e => set("description", e.target.value)} rows={2} placeholder="Task details..." />
          </div>

          {/* Status + Due date + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={data.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non commencé">Not started</SelectItem>
                  <SelectItem value="En cours">In progress</SelectItem>
                  <SelectItem value="Terminé">Done</SelectItem>
                  <SelectItem value="Bloqué">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={data.due_date || ""} onChange={e => set("due_date", e.target.value)} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={data.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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

          {/* Assigné + Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Assigned to</Label>
                {currentUserName && data.assigned_to !== currentUserName && (
                  <button
                    type="button"
                    onClick={() => setData(d => ({ ...d, assigned_to: currentUserName, assigned_freelancer_id: "_me" }))}
                    className="flex items-center gap-1 text-[10px] font-medium text-[#2A69FF] hover:underline">
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
                  if (v === "_none") {
                    setData(d => ({ ...d, assigned_to: "", assigned_freelancer_id: "" }));
                  } else if (v === "_me") {
                    setData(d => ({ ...d, assigned_to: currentUserName, assigned_freelancer_id: "_me" }));
                  } else {
                    const f = freelancers.find(f => f.id === v);
                    setData(d => ({ ...d, assigned_to: f?.name || "", assigned_freelancer_id: v }));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Nobody" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nobody</SelectItem>
                  {currentUserName && (
                    <SelectItem value="_me">👤 {currentUserName} (me)</SelectItem>
                  )}
                  {freelancers.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} {f.role ? `· ${f.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked client</Label>
              <Select value={data.client_name || "_none"} onValueChange={v => set("client_name", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Raison blocage */}
          {data.status === "Bloqué" && (
            <div>
              <Label>Blocking reason</Label>
              <Input value={data.blocking_reason || ""} onChange={e => set("blocking_reason", e.target.value)} placeholder="Ex: Waiting for client approval..." />
            </div>
          )}

          {/* Checklist */}
          <div>
            <Label>Subtasks</Label>
            <div className="space-y-1.5 mt-1.5">
              {(data.checklist || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button onClick={() => toggleCheck(i)} className="text-slate-400 hover:text-emerald-500">
                    {item.done ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
                  </button>
                  <span className={`text-sm flex-1 ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>{item.label}</span>
                  <button onClick={() => removeCheck(i)} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newCheck}
                  onChange={e => setNewCheck(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCheck())}
                  placeholder="Add a subtask..."
                  className="h-8 text-xs"
                />
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={addCheck}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Internal notes</Label>
            <Textarea value={data.notes || ""} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Notes..." />
          </div>
          </div>
          {/* ─── end LEFT column ─── */}

          {/* RIGHT — conversation panel */}
          {hasConversation && (
            <div className="flex-1 min-h-0 flex flex-col px-5 py-4 bg-slate-50/40">
              <Label className="flex items-center gap-1.5 text-slate-600 mb-2">
                <MessageCircle className="w-3.5 h-3.5" /> Conversation
                {data.assigned_to && <span className="text-slate-400 font-normal">· with {data.assigned_to}</span>}
              </Label>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
                {thread.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No messages yet.</p>
                ) : (
                  thread.map(m => {
                    const fromAdmin = m.author_role === "admin";
                    return (
                      <div
                        key={m.id}
                        className={`rounded-md border px-2.5 py-1.5 ${
                          fromAdmin
                            ? "bg-blue-50 border-blue-200 ml-6"
                            : "bg-amber-50 border-amber-200 mr-6"
                        }`}
                      >
                        <p className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${fromAdmin ? "text-blue-700" : "text-amber-700"}`}>
                          {fromAdmin ? (m.author_name || "You") : (m.author_name || data.assigned_to || "Freelancer")}
                          {m.created_at && (
                            <span className="ml-1.5 text-slate-400 normal-case tracking-normal font-normal">
                              · {format(new Date(m.created_at), "d MMM yyyy HH:mm", { locale: enUS })}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{m.text}</p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-2 flex items-start gap-2 flex-shrink-0">
                <Textarea
                  value={messageDraft}
                  onChange={e => setMessageDraft(e.target.value.slice(0, 5000))}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendAdminMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Write a message…"
                  maxLength={5000}
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={sendAdminMessage}
                  disabled={sendingMessage || !messageDraft.trim()}
                  className="shrink-0"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {sendingMessage ? "…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title.trim()}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}