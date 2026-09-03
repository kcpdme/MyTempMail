"use client";

import { useCallback, useEffect, useState } from "react";

export type ShareStatus = {
  enabled: boolean;
  createdAt?: number;
  expiresAt?: number;
};

export function useShareStatus(email: string, enabled: boolean) {
  const [status, setStatus] = useState<ShareStatus>({ enabled: false });
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !email) {
      setStatus({ enabled: false });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/share?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load guest access");
      setStatus({
        enabled: Boolean(data.enabled),
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      });
    } catch {
      setStatus({ enabled: false });
    } finally {
      setLoading(false);
    }
  }, [email, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, loading, reload, setStatus };
}
