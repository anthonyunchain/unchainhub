import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/api/base44Client';
import ConversationList from '@/components/messaging/ConversationList';
import ChatWindow from '@/components/messaging/ChatWindow';
import NewConversationModal from '@/components/messaging/NewConversationModal';
import { MessageSquare } from 'lucide-react';
import { t } from '@/components/messaging/i18n';

export const MESSAGES_NAV_OFFSET = 90;

// Track visualViewport so the mobile chat container shrinks when the
// iOS/Android soft keyboard opens — otherwise `position: fixed; inset: 0`
// stays locked to the layout viewport and the message input hides behind
// the keyboard.
function useVisualViewport() {
  const [vv, setVv] = useState(() => ({
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    offsetTop: 0,
  }));
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setVv({ height: viewport.height, offsetTop: viewport.offsetTop });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return vv;
}

export default function Messages({ locale = 'en' }) {
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const { height: vvHeight, offsetTop: vvOffset } = useVisualViewport();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setUserRole(data?.role || null));
    });
  }, []);

  const isAdmin = userRole === 'admin';
  const showList = !isMobile || !selectedConversation;
  const showChat = !isMobile || !!selectedConversation;

  const containerStyle = isMobile
    ? {
        position: 'fixed',
        top: vvOffset,
        left: 0,
        right: 0,
        height: vvHeight,
        zIndex: 100,
        display: 'flex',
        background: 'var(--bg)',
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        top: MESSAGES_NAV_OFFSET,
        left: 20,
        right: 20,
        bottom: 20,
        zIndex: 10,
        display: 'flex',
        borderRadius: 'var(--card-radius, 16px)',
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
        border: '1px solid var(--divider)',
      };

  const content = (
    <>
      <div style={containerStyle}>
        {showList && (
          <ConversationList
            selectedId={selectedConversation?.id}
            onSelect={(conv) => setSelectedConversation(conv)}
            onNew={() => setShowNewModal(true)}
            userId={userId}
            isAdmin={isAdmin}
            isMobile={isMobile}
            locale={locale}
          />
        )}

        {showChat && (
          selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              userId={userId}
              onBack={isMobile ? () => setSelectedConversation(null) : null}
              locale={locale}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: 'var(--bg)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--divider)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageSquare style={{ width: 28, height: 28, color: 'var(--muted)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>
                  {t(locale, 'selectConversation')}
                </p>
                <p style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--muted)', margin: 0 }}>
                  {t(locale, 'selectHint')}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {showNewModal && userId && (
        <NewConversationModal
          isAdmin={isAdmin}
          currentUserId={userId}
          onClose={() => setShowNewModal(false)}
          locale={locale}
          onCreated={(convId) => {
            setShowNewModal(false);
            setSelectedConversation({ id: convId, type: 'direct', participants: [] });
          }}
        />
      )}
    </>
  );

  // On mobile, portal to body so the full-screen fixed container escapes the
  // AppLayout stacking context (which would otherwise hide it behind the nav).
  if (isMobile) return createPortal(content, document.body);

  return (
    <>
      {content}
      <div style={{ height: `calc(100dvh - ${MESSAGES_NAV_OFFSET}px - 20px)`, pointerEvents: 'none' }} />
    </>
  );
}
