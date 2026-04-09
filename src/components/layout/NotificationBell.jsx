import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/base44Client";
import { Bell, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";

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

export default function NotificationBell({ recipientId }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const channelRef = useRef(null);

  const fetchNotifications = async () => {
    if (!recipientId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data || []);
  };

  useEffect(() => {
    if (!recipientId) return;
    fetchNotifications();

    const channelName = `bell-${recipientId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` },
        (payload) => {
          const n = { ...payload.new };
          setNotifications(prev => [n, ...prev]);
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` },
        (payload) => {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [recipientId]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const markRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', recipientId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const deleteAll = async () => {
    await supabase.from('notifications').delete().eq('recipient_id', recipientId);
    setNotifications([]);
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'relative',
          width: 36, height: 36,
          borderRadius: '50%',
          background: open ? 'var(--brand)' : 'var(--card)',
          boxShadow: 'var(--card-shadow)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 150ms, box-shadow 150ms',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--card-shadow)'}
      >
        <Bell style={{ width: 15, height: 15, color: open ? '#fff' : 'var(--muted)' }} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            width: 16, height: 16,
            background: '#E8421A',
            borderRadius: '50%',
            fontSize: '9px', fontWeight: 700,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            border: '2px solid var(--bg)',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'fixed',
          top: '72px',
          right: '20px',
          width: 340,
          maxHeight: 480,
          background: 'var(--card)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow-hover)',
          border: '1px solid var(--divider)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px 10px',
            borderBottom: '1px solid var(--divider)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Notifications
              </span>
              {unread > 0 && (
                <span style={{
                  background: '#E8421A', color: '#fff',
                  fontSize: 9, fontWeight: 700, padding: '1px 5px',
                  borderRadius: 99, fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {unread}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: 'var(--muted)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <Check style={{ width: 11, height: 11 }} /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={deleteAll}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: '#ef4444',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <Trash2 style={{ width: 11, height: 11 }} /> Remove all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 14px', textAlign: 'center' }}>
                <Bell style={{ width: 28, height: 28, color: 'var(--muted)', opacity: 0.3, margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--divider)',
                    background: n.is_read ? 'transparent' : 'rgba(42,105,255,0.04)',
                    cursor: n.is_read ? 'default' : 'pointer',
                    transition: 'background 150ms',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <p style={{
                        fontSize: 12, fontWeight: 600,
                        color: n.is_read ? 'var(--muted)' : 'var(--ink)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        margin: 0, lineHeight: 1.3,
                      }}>{n.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {!n.is_read && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)' }} />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted)', opacity: 0.4, display: 'flex' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                        >
                          <Trash2 style={{ width: 12, height: 12, color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                    <p style={{
                      fontSize: 11, color: 'var(--muted)',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      margin: '3px 0 0', lineHeight: 1.4,
                    }}>{n.message}</p>
                    {n.created_at && (
                      <p style={{
                        fontSize: 10, color: 'var(--muted)', opacity: 0.5,
                        fontFamily: "'DM Mono', monospace",
                        margin: '4px 0 0',
                      }}>
                        {format(new Date(n.created_at), "d MMM · HH:mm")}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
