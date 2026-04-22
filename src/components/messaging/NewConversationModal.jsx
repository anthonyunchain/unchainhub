import { useState, useEffect } from 'react';
import { X, Search, Users, MessageSquare } from 'lucide-react';
import { supabase, base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const ROLE_LABEL = { admin: 'Admin', freelancer: 'Freelancer', client: 'Client', staff: 'Staff', user: 'User' };

export default function NewConversationModal({ onClose, onCreated, isAdmin, currentUserId }) {
  const [mode, setMode] = useState('direct'); // 'direct' | 'group'
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    let query = supabase.from('profiles').select('id, full_name, role');
    if (!isAdmin) {
      // Non-admins can only DM admins
      query = query.eq('role', 'admin');
    }
    query.neq('id', currentUserId).then(({ data }) => {
      setUsers(data || []);
      setLoading(false);
    });
  }, [isAdmin, currentUserId]);

  const filtered = users.filter(u =>
    !search || (u.full_name || '').toLowerCase().includes(search.toLowerCase())
      || (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (user) => {
    if (mode === 'direct') {
      setSelected([user]);
    } else {
      setSelected(prev =>
        prev.find(u => u.id === user.id)
          ? prev.filter(u => u.id !== user.id)
          : [...prev, user]
      );
    }
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    if (mode === 'group' && !groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    setCreating(true);
    try {
      const { data } = await base44.functions.invoke('createConversation', {
        type: mode,
        participant_ids: selected.map(u => u.id),
        name: mode === 'group' ? groupName.trim() : undefined,
      });
      onCreated(data.conversation_id);
    } catch (err) {
      toast.error('Failed to create conversation');
      console.error('[NewConversationModal]', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--card-shadow-hover)',
        width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column',
        maxHeight: '80vh',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--divider)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)' }}>
            New Conversation
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Mode toggle (admin only) */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', flexShrink: 0 }}>
            {[
              { value: 'direct', label: 'Direct', icon: MessageSquare },
              { value: 'group', label: 'Group', icon: Users },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => { setMode(value); setSelected([]); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 10,
                  background: mode === value ? 'var(--brand)' : 'var(--bg)',
                  color: mode === value ? '#fff' : 'var(--muted)',
                  border: mode === value ? 'none' : '1px solid var(--divider)',
                  cursor: 'pointer', fontSize: 12,
                  fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Group name */}
        {mode === 'group' && (
          <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Group name…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 10,
                border: '1px solid var(--divider)', background: 'var(--bg)',
                fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 10, padding: '7px 12px', border: '1px solid var(--divider)' }}>
            <Search style={{ width: 14, height: 14, color: 'var(--muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* Selected chips (group mode) */}
        {mode === 'group' && selected.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 16px 0', flexShrink: 0 }}>
            {selected.map(u => (
              <span key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--brand)', color: '#fff',
                fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500,
                padding: '3px 8px', borderRadius: 99,
              }}>
                {u.full_name || u.role}
                <button onClick={() => toggleUser(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, display: 'flex', lineHeight: 1 }}>
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* User list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No users found</p>
          ) : (
            filtered.map(u => {
              const isSelected = selected.find(s => s.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUser(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 10px', borderRadius: 10,
                    background: isSelected ? 'rgba(42,105,255,0.08)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    marginBottom: 2,
                    transition: 'background 150ms',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: isSelected ? 'var(--brand)' : 'var(--divider)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#fff' : 'var(--muted)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {getInitials(u.full_name)}
                    </span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)' }}>
                      {u.full_name || '(no name)'}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, fontFamily: "'DM Mono', monospace", color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {ROLE_LABEL[u.role] || u.role}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--divider)', flexShrink: 0 }}>
          <button
            onClick={handleCreate}
            disabled={creating || selected.length === 0 || (mode === 'group' && !groupName.trim())}
            style={{
              width: '100%', padding: '10px', borderRadius: 12,
              background: 'var(--brand)', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              opacity: (selected.length === 0 || creating) ? 0.5 : 1,
            }}
          >
            {creating ? 'Creating…' : mode === 'group' ? `Create group (${selected.length} selected)` : 'Start conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}
