import { useEffect, useRef, useCallback, useState } from "react";
import * as Y from "yjs";
import { supabase } from "@/api/base44Client";

export function useYjsNote({ noteId, enabled, initialContent, currentUser, onContentUpdate }) {
  const ydocRef = useRef(null);
  const yTextRef = useRef(null);
  const prevValueRef = useRef(initialContent || "");
  const [peers, setPeers] = useState([]);

  useEffect(() => {
    if (!enabled || !noteId || !currentUser?.id) return;

    const ydoc = new Y.Doc();
    const yText = ydoc.getText("content");
    ydocRef.current = ydoc;
    yTextRef.current = yText;

    (async () => {
      const { data } = await supabase
        .from("notes")
        .select("ydoc_state, content")
        .eq("id", noteId)
        .single();

      if (data?.ydoc_state) {
        const bytes = Uint8Array.from(atob(data.ydoc_state), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc, bytes, "remote-init");
      } else {
        const seed = data?.content ?? initialContent ?? "";
        if (seed) ydoc.transact(() => yText.insert(0, seed));
      }
      prevValueRef.current = yText.toString();
    })();

    yText.observe(() => {
      const val = yText.toString();
      prevValueRef.current = val;
      onContentUpdate?.(val);
    });

    const channel = supabase.channel(`note-collab:${noteId}`, {
      config: { broadcast: { self: false }, presence: { key: currentUser.id } },
    });

    channel
      .on("broadcast", { event: "yjs-update" }, ({ payload }) => {
        if (!payload?.update) return;
        const bytes = Uint8Array.from(atob(payload.update), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc, bytes, "remote");
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPeers(
          Object.values(state)
            .flat()
            .filter(p => p.userId !== currentUser.id)
        );
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setPeers(prev => {
          const existing = new Set(prev.map(p => p.userId));
          return [
            ...prev,
            ...newPresences.filter(p => p.userId !== currentUser.id && !existing.has(p.userId)),
          ];
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const leaving = new Set(leftPresences.map(p => p.userId));
        setPeers(prev => prev.filter(p => !leaving.has(p.userId)));
      })
      .subscribe(async status => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: currentUser.id, name: currentUser.full_name || "Unknown" });
        }
      });

    ydoc.on("update", (update, origin) => {
      if (origin === "remote" || origin === "remote-init") return;
      const encoded = btoa(String.fromCharCode(...update));
      channel.send({ type: "broadcast", event: "yjs-update", payload: { update: encoded } });
    });

    return () => {
      supabase.removeChannel(channel);
      ydoc.destroy();
      ydocRef.current = null;
      yTextRef.current = null;
      setPeers([]);
    };
  }, [noteId, enabled, currentUser?.id]);

  const applyLocalChange = useCallback((newValue) => {
    const yText = yTextRef.current;
    const ydoc = ydocRef.current;
    if (!yText || !ydoc) return;

    const oldValue = prevValueRef.current;
    if (newValue === oldValue) return;

    let start = 0;
    while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) start++;
    let oldEnd = oldValue.length;
    let newEnd = newValue.length;
    while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }

    ydoc.transact(() => {
      if (oldEnd > start) yText.delete(start, oldEnd - start);
      if (newEnd > start) yText.insert(start, newValue.slice(start, newEnd));
    });
  }, []);

  const getYdocState = useCallback(() => {
    const ydoc = ydocRef.current;
    if (!ydoc) return null;
    const state = Y.encodeStateAsUpdate(ydoc);
    return btoa(String.fromCharCode(...state));
  }, []);

  return { peers, applyLocalChange, getYdocState };
}
