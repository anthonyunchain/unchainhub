import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/api/base44Client';

const DEBOUNCE_MS = 1500;

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export function useDraft({ entityType, entityId = null, content, enabled = true }) {
  const [status, setStatus] = useState('idle');
  const timerRef = useRef(null);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const saveDraftNow = useCallback(async () => {
    if (!entityType) return;
    const userId = await getCurrentUserId();
    if (!userId) return;

    setStatus('saving');
    try {
      // Find existing draft first — avoids relying on expression-index upsert
      const matchQuery = supabase
        .from('drafts')
        .select('id')
        .eq('user_id', userId)
        .eq('entity_type', entityType);

      const existing = await (entityId
        ? matchQuery.eq('entity_id', entityId).maybeSingle()
        : matchQuery.is('entity_id', null).maybeSingle());

      let error;
      if (existing.data?.id) {
        ({ error } = await supabase
          .from('drafts')
          .update({ content: contentRef.current, auto_saved_at: new Date().toISOString() })
          .eq('id', existing.data.id));
      } else {
        ({ error } = await supabase
          .from('drafts')
          .insert({
            user_id: userId,
            entity_type: entityType,
            entity_id: entityId ?? null,
            content: contentRef.current,
            auto_saved_at: new Date().toISOString(),
          }));
      }

      setStatus(error ? 'error' : 'saved');
    } catch {
      setStatus('error');
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (!enabled) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(saveDraftNow, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [content, enabled, saveDraftNow]);

  const clearDraft = useCallback(async () => {
    if (!entityType) return;
    const userId = await getCurrentUserId();
    if (!userId) return;

    const q = supabase
      .from('drafts')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', entityType);

    await (entityId ? q.eq('entity_id', entityId) : q.is('entity_id', null));
    setStatus('idle');
  }, [entityType, entityId]);

  const loadDraft = useCallback(async () => {
    if (!entityType) return null;
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const q = supabase
      .from('drafts')
      .select('content, auto_saved_at')
      .eq('user_id', userId)
      .eq('entity_type', entityType);

    const { data } = await (entityId
      ? q.eq('entity_id', entityId).maybeSingle()
      : q.is('entity_id', null).maybeSingle());

    return data || null;
  }, [entityType, entityId]);

  return { status, clearDraft, loadDraft };
}

export function draftStatusLabel(status) {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Draft saved';
  if (status === 'error') return 'Save error';
  return null;
}
