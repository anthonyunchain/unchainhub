import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMessages } from './useMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { t } from './i18n';

function getConversationName(conversation, currentUserId, locale) {
  if (conversation.type === 'group') return conversation.name || t(locale, 'group');
  const other = conversation.participants?.find(p => p.user_id !== currentUserId);
  return other?.profile?.full_name || other?.profile?.role || 'Chat';
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function ChatWindow({ conversation, userId, onBack, locale = 'en' }) {
  const { data: messages = [], isLoading } = useMessages(conversation?.id, userId);
  const [replyTo, setReplyTo] = useState(null);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!conversation) return null;

  const conversationName = getConversationName(conversation, userId, locale);
  const isGroup = conversation.type === 'group';
  const bgColor = avatarColor(conversationName);

  const profileMap = Object.fromEntries(
    (conversation.participants || []).map(p => [p.user_id, p.profile])
  );
  const messageMap = Object.fromEntries(messages.map(m => [m.id, m]));

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minWidth: 0,
      background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: onBack ? '0 16px 0 4px' : '0 16px',
        height: onBack ? 'calc(56px + env(safe-area-inset-top))' : 56,
        paddingTop: onBack ? 'env(safe-area-inset-top)' : 0,
        borderBottom: '1px solid var(--divider)',
        background: 'var(--card)',
        flexShrink: 0,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink)', display: 'flex', alignItems: 'center',
              padding: '12px 14px', margin: 0,
              minWidth: 44, minHeight: 44, justifyContent: 'center',
            }}
          >
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </button>
        )}
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: isGroup ? 'var(--divider)' : bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {getInitials(conversationName)}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 15, fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {conversationName}
          </p>
          {isGroup && (
            <p style={{
              margin: 0, fontSize: 10,
              fontFamily: "'DM Mono', monospace",
              color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {conversation.participants?.length} {t(locale, 'members')}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: 'var(--bg)',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end',
              }}>
                <div style={{
                  height: 36, width: `${40 + (i % 3) * 20}%`,
                  background: 'var(--divider)', borderRadius: 16, opacity: 0.5,
                }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, opacity: 0.5, textAlign: 'center', padding: 40,
          }}>
            <p style={{
              fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: 'var(--muted)', margin: 0,
            }}>
              {t(locale, 'sayHello')}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.sender_id === userId;
            const prevMsg = messages[i - 1];
            const nextMsg = messages[i + 1];
            const showSender = !isOwn && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
            const isLast = !nextMsg || nextMsg.sender_id !== msg.sender_id;
            const senderProfile = profileMap[msg.sender_id];
            const replyToMsg = msg.reply_to_id ? messageMap[msg.reply_to_id] : null;

            return (
              <div
                key={msg.id}
                onDoubleClick={() => setReplyTo(msg)}
                style={{ cursor: 'default', marginBottom: isLast ? 6 : 1 }}
              >
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  senderName={showSender ? (senderProfile?.full_name || t(locale, 'unknown')) : null}
                  replyTo={replyToMsg}
                  locale={locale}
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        conversationId={conversation.id}
        userId={userId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        isMobile={!!onBack}
        locale={locale}
      />
    </div>
  );
}
