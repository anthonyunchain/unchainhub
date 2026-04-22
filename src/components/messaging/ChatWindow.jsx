import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useMessages } from './useMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { supabase } from '@/api/base44Client';

function getConversationName(conversation, currentUserId) {
  if (conversation.type === 'group') return conversation.name || 'Group';
  const other = conversation.participants?.find(p => p.user_id !== currentUserId);
  return other?.profile?.full_name || other?.profile?.role || 'Chat';
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ChatWindow({ conversation, userId, onBack }) {
  const { data: messages = [], isLoading } = useMessages(conversation?.id, userId);
  const [replyTo, setReplyTo] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!conversation) return null;

  const conversationName = getConversationName(conversation, userId);
  const isGroup = conversation.type === 'group';

  // Build a map of sender profiles
  const profileMap = Object.fromEntries(
    (conversation.participants || []).map(p => [p.user_id, p.profile])
  );

  // Build a map of messages for reply lookup
  const messageMap = Object.fromEntries(messages.map(m => [m.id, m]));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid var(--divider)',
        background: 'var(--card)',
        flexShrink: 0,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>
        )}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {getInitials(conversationName)}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversationName}
          </p>
          {isGroup && (
            <p style={{ margin: 0, fontSize: 10, fontFamily: "'DM Mono', monospace", color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {conversation.participants?.length} members
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: 'var(--bg)',
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Loading…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.4 }}>
            <p style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--muted)' }}>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.sender_id === userId;
            const prevMsg = messages[i - 1];
            const showSender = !isOwn && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
            const senderProfile = profileMap[msg.sender_id];
            const replyToMsg = msg.reply_to_id ? messageMap[msg.reply_to_id] : null;

            return (
              <div key={msg.id} onDoubleClick={() => setReplyTo(msg)} style={{ cursor: 'default' }}>
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  senderName={showSender ? (senderProfile?.full_name || 'Unknown') : null}
                  replyTo={replyToMsg}
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
      />
    </div>
  );
}
