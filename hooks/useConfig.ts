"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicConfig } from "@/lib/types";

export function useConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load config");
      if (id === requestId.current) {
        setConfig(data as PublicConfig);
        setError(null);
      }
      return data as PublicConfig;
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : "Failed to load config");
      return null;
    }
  }, []);

  useEffect(() => {
    void reload();
    const refresh = () => { if (document.visibilityState === "visible") void reload(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const requests = requestId;
    return () => {
      requests.current++;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  return { config, error, reload };
}
