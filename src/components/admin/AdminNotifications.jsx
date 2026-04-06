import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Bell, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
};

export default function AdminNotifications({ adminId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFreelancer, setFilterFreelancer] = useState("all");

  const load = async () => {
    if (!adminId) return;
    setLoading(true);
    const res = await base44.functions.invoke('getNotifications', { recipient_id: adminId });
    setNotifications(res.data?.notifications || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [adminId]);

  const markAllRead = async () => {
    await base44.functions.invoke('projectAction', { action: 'mark_all_read', recipient_id: adminId });
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await base44.functions.invoke('projectAction', { action: 'mark_read', notification_id: id });
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const freelancerNames = [...new Set(notifications.map(n => n.freelancer_name).filter(Boolean))];
  const filtered = notifications.filter(n => filterFreelancer === "all" || n.freelancer_name === filterFreelancer);
  const unread = notifications.filter(n => !n.is_read).length;

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">All Notifications</span>
          {unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread} unread</span>}
        </div>
        <div className="flex items-center gap-2">
          {freelancerNames.length > 0 && (
            <Select value={filterFreelancer} onValueChange={setFilterFreelancer}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Freelancer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All freelancers</SelectItem>
                {freelancerNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-8" onClick={markAllRead}>
              <Check className="w-3 h-3 mr-1" /> Mark all read
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={load}>↻ Refresh</Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(n => (
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
                {n.created_date && (
                  <p className="text-[10px] text-slate-300 mt-2">{format(new Date(n.created_date), "d MMM yyyy · HH:mm")}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}