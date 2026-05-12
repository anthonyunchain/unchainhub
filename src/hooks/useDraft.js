import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

const DEBOUNCE_MS = 1500;

/**
 * Universal auto-save draft hook.
 *
 * @param {object} params
 * @param {string}  params.entityType  - e.g. 'task', 'project', 'brief', 'shooting'
 * @param {string|null} params.entityId - null when creating a new record, UUID when editing
 * @param {object}  params.content     - the current form data to persist
 * @param {boolean} params.enabled     - set false to skip (e.g. form not yet opened)
 *
 * Returns { status, clearDraft, loadDraft }
 *   status: 'idle' | 'saving' | 'saved' | 'error'
 *   clearDraft(): deletes the draft from DB (call on final submit)
 *   loadDraft(): returns the persisted draft content or null
 */
export function useDraft({ entityType, entityId = null, content, enabled = true }) {
  const [status, setStatus] = useState('idle');
  const timerRef = useRef(null);
  const contentRef = useRef(content);
  const userIdRef = useRef(null);

  // Keep ref in sync to avoid stale closure in debounce
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Resolve current user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data?.user?.id || null;
    });
  }, []);

  const saveDraftNow = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId || !entityType) return;

    setStatus('saving');
    try {
      const { error } = await supabase
        .from('drafts')
        .upsert(
          {
            user_id: userId,
            entity_type: entityType,
            entity_id: entityId ?? null,
            content: contentRef.current,
            auto_saved_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,entity_type,entity_id',
            ignoreDuplicates: false,
          },
        );

      setStatus(error ? 'error' : 'saved');
    } catch {
      setStatus('error');
    }
  }, [entityType, entityId]);

  // Debounced save whenever content changes
  useEffect(() => {
    if (!enabled) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(saveDraftNow, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [content, enabled, saveDraftNow]);

  // Delete draft after final submit
  const clearDraft = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId || !entityType) return;
    await supabase
      .from('drafts')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .is('entity_id', entityId ?? null);
    setStatus('idle');
  }, [entityType, entityId]);

  // Load persisted draft (call on form open)
  const loadDraft = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId || !entityType) return null;

    let query = supabase
      .from('drafts')
      .select('content, auto_saved_at')
      .eq('user_id', userId)
      .eq('entity_type', entityType);

    if (entityId) {
      query = query.eq('entity_id', entityId);
    } else {
      query = query.is('entity_id', null);
    }

    const { data } = await query.maybeSingle();
    return data || null;
  }, [entityType, entityId]);

  return { status, clearDraft, loadDraft };
}

/**
 * Lightweight status label for UI display.
 * Returns null when idle (no label needed).
 */
export function draftStatusLabel(status) {
  if (status === 'saving') return 'Sauvegarde…';
  if (status === 'saved') return 'Brouillon sauvegardé';
  if (status === 'error') return 'Erreur de sauvegarde';
  return null;
}
