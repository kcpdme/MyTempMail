"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionInfo } from "@/lib/types";

export function useSession() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetch("/api/session")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load session");
        setSession(data as SessionInfo);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { session, error, reload };
}
