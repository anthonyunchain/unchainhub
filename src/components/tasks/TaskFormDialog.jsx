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
  const [replyDraft, setReplyDraft] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    setData(task || empty);
    setNewCheck("");
    setReplyDraft(task?.admin_reply || "");
  }, [task, open]);

  const sendAdminReply = async () => {
    if (!task?.id) return;
    if (!replyDraft.trim()) return;
    setSendingReply(true);
    try {
      const now = new Date().toISOString();
      await supabase.from('tasks').update({
        admin_reply: replyDraft.trim(),
        admin_reply_at: now,
        admin_reply_author: currentUserName || null,
      }).eq('id', task.id);

      // Notify the assigned freelancer
      if (task.assigned_freelancer_id) {
        await supabase.from('notifications').insert({
          recipient_id: task.assigned_freelancer_id,
          title: `${currentUserName || 'Admin'} replied · ${task.title}`,
          message: replyDraft.trim().slice(0, 200),
          type: 'message',
          is_read: false,
          action_required: false,
          created_at: now,
        });
      }

      setData(d => ({ ...d, admin_reply: replyDraft.trim(), admin_reply_at: now, admin_reply_author: currentUserName || null }));
    } catch (e) {
      alert('Failed to send reply: ' + (e?.message || e));
    } finally {
      setSendingReply(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task?.id ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">

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

          {/* Statut */}
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

          {/* Date + Catégorie */}
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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

          {/* Freelancer ↔ admin note thread */}
          {task?.id && (data.freelancer_note || data.admin_reply || data.assigned_freelancer_id) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-amber-800">
                <MessageCircle className="w-3.5 h-3.5" /> Conversation with {data.assigned_to || "the freelancer"}
              </Label>

              {data.freelancer_note ? (
                <div className="rounded-md bg-white border border-amber-200 p-2.5">
                  <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wider mb-1">
                    {data.assigned_to || "Freelancer"}
                    {data.freelancer_note_updated_at && (
                      <span className="ml-1.5 text-slate-400 normal-case tracking-normal font-normal">
                        · {format(new Date(data.freelancer_note_updated_at), "d MMM yyyy HH:mm", { locale: enUS })}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{data.freelancer_note}</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No note from the freelancer yet.</p>
              )}

              {data.admin_reply && (
                <div className="rounded-md bg-white border border-blue-200 p-2.5">
                  <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wider mb-1">
                    {data.admin_reply_author || "You"}
                    {data.admin_reply_at && (
                      <span className="ml-1.5 text-slate-400 normal-case tracking-normal font-normal">
                        · {format(new Date(data.admin_reply_at), "d MMM yyyy HH:mm", { locale: enUS })}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{data.admin_reply}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Textarea
                  value={replyDraft}
                  onChange={e => setReplyDraft(e.target.value)}
                  rows={2}
                  placeholder={data.admin_reply ? "Update your reply…" : "Reply to the freelancer…"}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">
                    {data.assigned_freelancer_id
                      ? "The freelancer will get notified."
                      : "Assign a freelancer first to notify them."}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={sendAdminReply}
                    disabled={sendingReply || !replyDraft.trim() || replyDraft.trim() === (data.admin_reply || "").trim()}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    {sendingReply ? "Sending…" : data.admin_reply ? "Update reply" : "Send reply"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={!data.title.trim()}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}