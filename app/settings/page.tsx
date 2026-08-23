"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SettingsForm, type SettingsPayload } from "@/components/SettingsForm";

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (res.status === 401) {
      router.replace("/settings/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load settings");
    setData(json);
  }, [router]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  async function logout() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">MyTempMail</p>
          <h1 className="text-2xl font-semibold text-zinc-50">Settings</h1>
        </div>
        <div className="flex shrink-0 gap-3 text-sm text-zinc-400">
          <Link href="/" className="hover:text-zinc-100">
            Inbox
          </Link>
          <button type="button" onClick={() => void logout()} className="hover:text-zinc-100">
            Log out
          </button>
        </div>
      </div>
      {error && <p className="text-red-400">{error}</p>}
      {data && <SettingsForm initial={data} onReload={load} />}
    </div>
  );
}
