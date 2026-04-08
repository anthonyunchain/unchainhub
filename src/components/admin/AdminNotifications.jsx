import { useState, useEffect, useRef } from "react";
import { base44, supabase } from "@/api/base44Client";
import { format } from "date-fns";
import { Bell, Check, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";

const TYPE_ICONS = {
  project_assigned: "📋",
  project_accepted: "✅",
  project_declined: "❌",
  project_delivered: "📦",
  project_completed: "🏆",
  revision_requested: "🔄",
  clarification_requested: "💬",
  deadline_warning: "⏰",
  availability_reminder: "📅",
  message: "💬",
};

const NOTIFICATION_TYPES = [
  { value: "message", label: "Message" },
  { value: "deadline_warning", label: "Deadline warning" },
  { value: "availability_reminder", label: "Availability reminder" },
  { value: "project_assigned", label: "Project assigned" },
];

export default function AdminNotifications({ adminId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFreelancer, setFilterFreelancer] = useState("all");
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendForm, setSendForm] = useState({ recipient_id: "", title: "", message: "", type: "message" });
  const [sendError, setSendError] = useState("");
  const channelRef = useRef(null);

  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: () => base44.entities.Freelancer.list(),
  });

  const load = async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getNotifications', { recipient_id: adminId });
      setNotifications(res.data?.notifications || []);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [adminId]);

  // Real-time subscription
  useEffect(() => {
    if (!adminId) return;

    const channel = supabase
      .channel(`admin-notif-${adminId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${adminId}` },
        (payload) => {
          const n = { ...payload.new, created_date: payload.new.created_at };
          setNotifications((prev) => [n, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${adminId}` },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => n.id === payload.new.id ? { ...payload.new, created_date: payload.new.created_at } : n)
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId]);

  const markAllRead = async () => {
    await base44.functions.invoke('markAllNotificationsRead', { recipient_id: adminId });
    setNotifications((ns) => ns.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await base44.functions.invoke('markNotificationRead', { notification_id: id });
    setNotifications((ns) => ns.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleSend = async () => {
    if (!sendForm.recipient_id || !sendForm.title || !sendForm.message) {
      setSendError("All fields required.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const { error } = await supabase.from('notifications').insert({
        recipient_id: sendForm.recipient_id,
        title: sendForm.title,
        message: sendForm.message,
        type: sendForm.type,
        is_read: false,
        action_required: false,
      });
      if (error) throw error;
      setSendOpen(false);
      setSendForm({ recipient_id: "", title: "", message: "", type: "message" });
    } catch (e) {
      setSendError(e.message || "Failed to send notification.");
    }
    setSending(false);
  };

  const freelancerNames = [...new Set(notifications.map((n) => n.freelancer_name).filter(Boolean))];
  const filtered = notifications.filter((n) => filterFreelancer === "all" || n.freelancer_name === filterFreelancer);
  const unread = notifications.filter((n) => !n.is_read).length;

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">All Notifications</span>
          {unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread} unread</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {freelancerNames.length > 0 && (
            <Select value={filterFreelancer} onValueChange={setFilterFreelancer}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Freelancer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All freelancers</SelectItem>
                {freelancerNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-8" onClick={markAllRead}>
              <Check className="w-3 h-3 mr-1" /> Mark all read
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={load}>↻ Refresh</Button>
          <Button size="sm" className="text-xs h-8 bg-brand hover:bg-brand/90 text-brand-foreground" onClick={() => setSendOpen(true)}>
            <Plus className="w-3 h-3 mr-1" /> Send notification
          </Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.is_read && markRead(n.id)}
            className={`rounded-xl border p-4 cursor-pointer transition-all ${n.is_read ? "bg-white border-slate-100 opacity-70" : "bg-blue-50 border-blue-100"} ${n.action_required && !n.is_read ? "border-l-4 border-l-amber-400" : ""}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">{TYPE_ICONS[n.type] || "🔔"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold ${n.is_read ? "text-slate-600" : "text-slate-900"}`}>{n.title}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.action_required && !n.is_read && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Action needed</span>}
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                {n.freelancer_name && <p className="text-[10px] text-slate-400 mt-1">From: {n.freelancer_name}</p>}
                {n.created_date && (
                  <p className="text-[10px] text-slate-300 mt-2">{format(new Date(n.created_date), "d MMM yyyy · HH:mm")}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Send notification dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send a notification</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Recipient freelancer *</Label>
              <Select value={sendForm.recipient_id} onValueChange={(v) => setSendForm({ ...sendForm, recipient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select a freelancer..." /></SelectTrigger>
                <SelectContent>
                  {freelancers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={sendForm.type} onValueChange={(v) => setSendForm({ ...sendForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={sendForm.title} onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })} placeholder="Notification title..." />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea value={sendForm.message} onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })} placeholder="Write your message..." rows={3} />
            </div>
            {sendError && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{sendError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSend}
                disabled={sending || !sendForm.recipient_id || !sendForm.title || !sendForm.message}
                className="bg-brand hover:bg-brand/90 text-brand-foreground"
              >
                {sending ? "Sending…" : <><Send className="w-4 h-4 mr-1" />Send</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
