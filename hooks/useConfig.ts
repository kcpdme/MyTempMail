"use client";

import { useEffect, useState } from "react";
import type { PublicConfig } from "@/lib/types";

export function useConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load config");
        setConfig(data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return { config, error };
}
