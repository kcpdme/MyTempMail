"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "tm.seen";

export function useUnread(email: string, ids: string[]) {
  const [seen, setSeen] = useState<Record<string, string[]>>({});

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string[]>;
      setSeen(raw && typeof raw === "object" ? raw : {});
    } catch {
      setSeen({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(seen));
  }, [seen]);

  const markSeen = useCallback((id: string) => {
    if (!email) return;
    setSeen((prev) => {
      const current = new Set(prev[email] ?? []);
      current.add(id);
      return { ...prev, [email]: [...current] };
    });
  }, [email]);

  const seenSet = new Set(seen[email] ?? []);
  const unreadByAddress = (addr: string, messageIds: string[]) =>
    messageIds.filter((id) => !(seen[addr] ?? []).includes(id)).length;

  return {
    unreadCount: ids.filter((id) => !seenSet.has(id)).length,
    isUnread: (id: string) => !seenSet.has(id),
    markSeen,
    unreadByAddress,
    seen,
  };
}
