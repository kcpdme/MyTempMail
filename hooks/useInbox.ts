"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InboxSummary, StoredMessage } from "@/lib/types";

const POLL_MS = 5000;

export function useInbox(email: string, autoRefresh: boolean) {
  const [messages, setMessages] = useState<InboxSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<StoredMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchList = useCallback(async (opts?: { silent?: boolean }) => {
    if (!email) return [];
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox?email=${encodeURIComponent(email)}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load inbox");
      const list = (data.messages ?? []) as InboxSummary[];
      setMessages(list);
      setLastFetchAt(Date.now());
      return list;
    } catch (err) {
      if ((err as Error).name === "AbortError") return [];
      setError(err instanceof Error ? err.message : "Failed to load inbox");
      return [];
    } finally {
      setLoading(false);
    }
  }, [email]);

  const fetchMessage = useCallback(
    async (id: string) => {
      if (!email) return;
      const res = await fetch(`/api/inbox/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load message");
      setMessage(data.message);
      setSelectedId(id);
    },
    [email],
  );

  const remove = useCallback(
    async (id?: string) => {
      if (!email) return;
      const params = new URLSearchParams({ email });
      if (id) params.set("id", id);
      const res = await fetch(`/api/inbox?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      if (!id || selectedId === id) {
        setSelectedId(null);
        setMessage(null);
      }
      await fetchList({ silent: true });
    },
    [email, fetchList, selectedId],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setMessage(null);
  }, []);

  useEffect(() => {
    setSelectedId(null);
    setMessage(null);
    setMessages([]);
    void fetchList();
  }, [email, fetchList]);

  useEffect(() => {
    if (!email || !autoRefresh) return;
    const tick = () => {
      if (document.hidden) return;
      void fetchList({ silent: true });
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) void fetchList({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [email, autoRefresh, fetchList]);

  return {
    messages,
    selectedId,
    message,
    loading,
    error,
    lastFetchAt,
    pollMs: POLL_MS,
    fetchList,
    fetchMessage,
    remove,
    setSelectedId,
    clearSelection,
  };
}
