import { format } from 'date-fns';
import { FileText, CornerUpLeft } from 'lucide-react';
import { t } from './i18n';
import AudioMessage from './AudioMessage';

export default function MessageBubble({ message, isOwn, senderName, replyTo, locale = 'en' }) {
  const isDeleted = !!message.deleted_at;
  const time = message.created_at ? format(new Date(message.created_at), 'HH:mm') : '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isOwn ? 'flex-end' : 'flex-start',
      marginBottom: 2,
    }}>
      {!isOwn && senderName && (
        <span style={{
          fontSize: 10,
          fontFamily: "'DM Mono', monospace",
          color: 'var(--muted)',
          marginBottom: 2,
          paddingLeft: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {senderName}
        </span>
      )}

      <div style={{
        maxWidth: '72%',
        background: isOwn ? 'var(--brand)' : 'var(--card)',
        color: isOwn ? '#fff' : 'var(--ink)',
        borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '8px 12px',
        boxShadow: 'var(--card-shadow)',
        position: 'relative',
        opacity: message._pending ? 0.65 : 1,
        transition: 'opacity 120ms ease-out',
      }}>
        {/* Reply preview */}
        {replyTo && (
          <div style={{
            borderLeft: `2px solid ${isOwn ? 'rgba(255,255,255,0.5)' : 'var(--brand)'}`,
            paddingLeft: 8,
            marginBottom: 6,
            opacity: 0.7,
          }}>
            <p style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0, lineHeight: 1.3 }}>
              {replyTo.deleted_at ? '(message deleted)' : (replyTo.content?.slice(0, 80) || '(attachment)')}
            </p>
          </div>
        )}

        {isDeleted ? (
          <p style={{
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            margin: 0,
            fontStyle: 'italic',
            opacity: 0.5,
          }}>
            {t(locale, 'messageDeleted')}
          </p>
        ) : message.message_type === 'audio' && message.file_url ? (
          <AudioMessage
            message={message}
            isMine={isOwn}
            messageId={message.id}
          />
        ) : message.message_type === 'image' && message.file_url ? (
          <img
            src={message.file_url}
            alt="attachment"
            style={{ maxWidth: 240, maxHeight: 240, borderRadius: 8, display: 'block' }}
          />
        ) : message.message_type === 'file' && message.file_url ? (
          <a
            href={message.file_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: isOwn ? '#fff' : 'var(--brand)',
              textDecoration: 'none',
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <FileText style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-all' }}>{message.file_name || 'File'}</span>
          </a>
        ) : (
          <p style={{
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            margin: 0,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {message.content}
          </p>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 4,
        }}>
          <span style={{
            fontSize: 9,
            fontFamily: "'DM Mono', monospace",
            opacity: 0.55,
            color: isOwn ? '#fff' : 'var(--muted)',
          }}>
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}
