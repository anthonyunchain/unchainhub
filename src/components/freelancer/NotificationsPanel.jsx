import { Bell, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function NotificationsPanel({ notifications = [], loading = false, onMarkRead, onMarkAllRead, onDelete, onAccept, onDecline }) {
  const unread = notifications.filter((n) => !n.is_read).length;

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          {unread > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-7" onClick={onMarkAllRead}>
            <Check className="w-3 h-3 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.is_read && onMarkRead(n.id)}
            className={`rounded-xl border p-4 cursor-pointer transition-all group ${n.is_read ? "bg-white border-slate-100 opacity-70" : "bg-blue-50 border-blue-100"}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold ${n.is_read ? "text-slate-600" : "text-slate-900"}`}>{n.title}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                {(n.created_date || n.created_at) && (
                  <p className="text-[10px] text-slate-300 mt-2">
                    {format(new Date(n.created_date || n.created_at), "d MMM yyyy · HH:mm")}
                  </p>
                )}

                {n.type === 'project_assigned' && n.action_required && !n.is_read && onAccept && onDecline && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={(e) => { e.stopPropagation(); onAccept(n.project_id); onMarkRead(n.id); }}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); onDecline(n.project_id); onMarkRead(n.id); }}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
