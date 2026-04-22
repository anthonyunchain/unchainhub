import { useState, useEffect } from 'react';
import { supabase } from '@/api/base44Client';
import ConversationList from '@/components/messaging/ConversationList';
import ChatWindow from '@/components/messaging/ChatWindow';
import NewConversationModal from '@/components/messaging/NewConversationModal';
import { MessageSquare } from 'lucide-react';

export default function Messages() {
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 100px)',
      borderRadius: 'var(--card-radius)',
      boxShadow: 'var(--card-shadow)',
      overflow: 'hidden',
      border: '1px solid var(--divider)',
    }}>
      {/* Left: Conversation List */}
      {showList && (
        <ConversationList
          selectedId={selectedConversation?.id}
          onSelect={(conv) => setSelectedConversation(conv)}
          onNew={() => setShowNewModal(true)}
          userId={userId}
          isAdmin={isAdmin}
        />
      )}

      {/* Right: Chat or Empty State */}
      {showChat && (
        selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            userId={userId}
            onBack={isMobile ? () => setSelectedConversation(null) : null}
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
            opacity: 0.4,
          }}>
            <MessageSquare style={{ width: 48, height: 48, color: 'var(--muted)' }} />
            <p style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--muted)', margin: 0 }}>
              Select a conversation to start messaging
            </p>
          </div>
        )
      )}

      {/* New Conversation Modal */}
      {showNewModal && userId && (
        <NewConversationModal
          isAdmin={isAdmin}
          currentUserId={userId}
          onClose={() => setShowNewModal(false)}
          onCreated={(convId) => {
            setShowNewModal(false);
            // Reload conversations and select the new one
            // The conversation data will come from useConversations hook
            // We store a minimal object and let the list provide the full data
            setSelectedConversation({ id: convId, type: 'direct', participants: [] });
          }}
        />
      )}
    </div>
  );
}
