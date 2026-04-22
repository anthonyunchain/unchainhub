import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquarePlus, Users, MessageSquare } from 'lucide-react';
import { useConversations } from './useConversations';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Hier';
  return format(d, 'd MMM');
}

function getConversationName(conversation, currentUserId) {
  if (conversation.type === 'group') return conversation.name || 'Groupe';
  const other = conversation.participants?.find(p => p.user_id !== currentUserId);
  return other?.profile?.full_name || 'Chat';
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function lastMessagePreview(conv) {
  const m = conv.last_message;
  if (!m) return 'Pas encore de messages';
  if (m.message_type === 'image') return '📷 Image';
  if (m.message_type === 'file') return '📎 Fichier';
  return m.content?.slice(0, 60) || '';
}

// Color palette for avatars
const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function ConversationList({ selectedId, onSelect, onNew, userId, isAdmin, isMobile }) {
  const { data: conversations = [], isLoading } = useConversations(userId);
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <div style={{
      width: isMobile ? '100%' : 300,
      minWidth: isMobile ? '100%' : 260,
      borderRight: isMobile ? 'none' : '1px solid var(--divider)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--card)',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '16px 20px 14px' : '14px 16px 12px',
        borderBottom: '1px solid var(--divider)',
        flexShrink: 0,
        paddingTop: isMobile ? 'calc(16px + env(safe-area-inset-top))' : '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: isMobile ? 18 : 14,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: 'var(--ink)',
          }}>
            Messages
          </span>
          {totalUnread > 0 && (
            <span style={{
              background: '#E8421A', color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              borderRadius: 99, fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>
        <button
          onClick={onNew}
          title="Nouvelle conversation"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px',
            background: 'var(--brand)',
            border: 'none',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 600,
            color: '#fff',
          }}
        >
          <MessageSquarePlus style={{ width: 14, height: 14 }} />
          Nouveau
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          // Skeleton placeholders
          <div style={{ padding: '8px 0' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--divider)', flexShrink: 0, opacity: 0.5 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, width: '60%', background: 'var(--divider)', borderRadius: 6, marginBottom: 6, opacity: 0.5 }} />
                  <div style={{ height: 10, width: '80%', background: 'var(--divider)', borderRadius: 6, opacity: 0.35 }} />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div style={{
            padding: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, opacity: 0.5, textAlign: 'center',
          }}>
            <MessageSquare style={{ width: 36, height: 36, color: 'var(--muted)' }} />
            <p style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Aucune conversation.<br />Commencez-en une ci-dessus.
            </p>
          </div>
        ) : (
          conversations.map(conv => {
            const name = getConversationName(conv, userId);
            const initials = getInitials(name);
            const isSelected = conv.id === selectedId;
            const unread = conv.unread_count || 0;
            const lastMsg = conv.last_message;
            const bgColor = avatarColor(name);

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: isMobile ? '14px 20px' : '11px 16px',
                  background: isSelected ? 'var(--brand-muted, rgba(42,105,255,0.08))' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--divider)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 150ms',
                  minHeight: 64,
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Avatar */}
                <div style={{
                  width: isMobile ? 46 : 40,
                  height: isMobile ? 46 : 40,
                  borderRadius: '50%',
                  background: conv.type === 'group' ? 'var(--divider)' : bgColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, position: 'relative',
                }}>
                  {conv.type === 'group' ? (
                    <Users style={{ width: 18, height: 18, color: 'var(--muted)' }} />
                  ) : (
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: '#fff',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}>
                      {initials}
                    </span>
                  )}
                  {unread > 0 && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2,
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: '#E8421A', color: '#fff',
                      fontSize: 9, fontWeight: 700, padding: '0 4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      border: '2px solid var(--card)',
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{
                      fontSize: 14, fontWeight: unread > 0 ? 700 : 600,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      color: isSelected ? 'var(--brand)' : 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </span>
                    {lastMsg && (
                      <span style={{
                        fontSize: 10,
                        fontFamily: "'DM Mono', monospace",
                        color: unread > 0 ? 'var(--brand)' : 'var(--muted)',
                        flexShrink: 0,
                        fontWeight: unread > 0 ? 600 : 400,
                      }}>
                        {formatTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <p style={{
                    margin: '2px 0 0', fontSize: 12,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    color: unread > 0 ? 'var(--ink)' : 'var(--muted)',
                    fontWeight: unread > 0 ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}>
                    {lastMessagePreview(conv)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
