import { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sendMessage } from './useMessages';
import { toast } from 'sonner';
import { t } from './i18n';

export default function MessageInput({ conversationId, userId, replyTo, onClearReply, isMobile, locale = 'en' }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null); // { file, preview, type }
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const canSend = (text.trim() || attachment) && !sending && conversationId;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const preview = isImage ? URL.createObjectURL(file) : null;
    setAttachment({ file, preview, type: isImage ? 'image' : 'file' });
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      let fileUrl = null;
      let fileName = null;
      let messageType = 'text';

      if (attachment) {
        const { file_url } = await base44.integrations.Core.UploadFile({
          file: attachment.file,
          bucket: 'messages',
        });
        fileUrl = file_url;
        fileName = attachment.file.name;
        messageType = attachment.type;
      }

      await sendMessage({
        conversationId,
        senderId: userId,
        content: text.trim(),
        messageType,
        fileUrl,
        fileName,
        replyToId: replyTo?.id || null,
      });

      setText('');
      setAttachment(null);
      if (onClearReply) onClearReply();
      textareaRef.current?.focus();
    } catch (err) {
      toast.error(t(locale, 'failedToSend'));
      console.error('[MessageInput]', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--divider)',
      padding: isMobile
        ? '10px 16px calc(10px + env(safe-area-inset-bottom))'
        : '10px 14px',
      background: 'var(--card)',
      flexShrink: 0,
    }}>
      {/* Reply banner */}
      {replyTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          marginBottom: 8,
          background: 'var(--bg)',
          borderRadius: 8,
          borderLeft: '3px solid var(--brand)',
        }}>
          <span style={{ flex: 1, fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ↩ {replyTo.content?.slice(0, 80) || '(attachment)'}
          </span>
          <button onClick={onClearReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, display: 'flex' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          marginBottom: 8,
          background: 'var(--bg)',
          borderRadius: 8,
        }}>
          {attachment.preview ? (
            <img src={attachment.preview} alt="preview" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Paperclip style={{ width: 16, height: 16, color: 'var(--muted)' }} />
            </div>
          )}
          <span style={{ flex: 1, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attachment.file.name}
          </span>
          <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, display: 'flex' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {/* File attach */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--bg)',
            border: '1px solid var(--divider)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Paperclip style={{ width: 15, height: 15, color: 'var(--muted)' }} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip" onChange={handleFile} style={{ display: 'none' }} />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t(locale, 'messagePlaceholder')}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid var(--divider)',
            borderRadius: 12,
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: 'var(--ink)',
            background: 'var(--bg)',
            outline: 'none',
            lineHeight: 1.5,
            minHeight: 38,
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: canSend ? 'var(--brand)' : 'var(--divider)',
            border: 'none',
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 150ms',
          }}
        >
          <Send style={{ width: 15, height: 15, color: '#fff' }} />
        </button>
      </div>
    </div>
  );
}
