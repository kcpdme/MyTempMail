"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { GUEST_DURATIONS, type GuestDuration } from "@/lib/guest-policy";
import type { GuestAccessEntry, GuestAccessPage } from "@/lib/types";

export function GuestAccessManager({ defaultDuration, guestDomains }: { defaultDuration: GuestDuration; guestDomains: string[] }) {
  const [entries, setEntries] = useState<GuestAccessEntry[]>([]);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [durations, setDurations] = useState<Record<string, GuestDuration>>({});
  const requestId = useRef(0);

  const load = useCallback(async (search: string, next = "0") => {
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: search, cursor: next });
      const res = await fetch(`/api/settings/guests?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load guest access");
      if (id !== requestId.current) return;
      const page = data as GuestAccessPage;
      setEntries((current) => [...new Map((next === "0" ? page.entries : [...current, ...page.entries]).map((entry) => [entry.email, entry])).values()]
        .sort((a, b) => a.email.localeCompare(b.email)));
      setCursor(page.nextCursor);
      setActiveQuery(search);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : "Could not load guest access");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load("");
    const requests = requestId;
    return () => { requests.current++; };
  }, [load]);

  async function update(email: string, action: "timeout" | "revoke") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/guests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action, duration: durations[email] ?? defaultDuration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update guest access");
      setEntries((current) => action === "revoke"
        ? current.filter((entry) => entry.email !== email)
        : current.map((entry) => entry.email === email ? { ...entry, expiresAt: data.expiresAt } : entry));
      setNotice(action === "revoke" ? `Guest access revoked for ${email}.` : `Expiry updated for ${email}. The password is unchanged.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update guest access");
    } finally {
      setBusy(false);
    }
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    void load(query.trim());
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5" aria-label="Current guest access">
      <p className="text-sm text-zinc-400">Search existing guest email addresses, reset their timeout, or revoke access. Expired and revoked grants are removed automatically.</p>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <input
          aria-label="Search guest email"
          placeholder="Search email or domain"
          value={query}
          maxLength={254}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm sm:min-w-0 sm:flex-1"
        />
        <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">Search</button>
        <button type="button" disabled={busy} onClick={() => void load(activeQuery)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50">Refresh</button>
      </form>
      <p className="text-xs text-zinc-500">Timeout starts when you click Update timeout. The password stays the same. After an extension, guests may need to sign in again when their current session ends.</p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
      {busy && <p role="status" className="text-sm text-zinc-500">Loading…</p>}
      {!busy && !error && !entries.length && <p className="text-sm text-zinc-400">{cursor ? "No matches in this batch. Load more to continue searching." : "No guest inboxes found."}</p>}
      <div className="space-y-3">
        {entries.map((entry) => (
          <article key={entry.email} aria-label={entry.email} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div>
              <h3 className="break-all font-mono text-sm text-zinc-100">{entry.email}</h3>
              <p className="mt-1 text-xs text-zinc-400">Created {new Date(entry.createdAt).toLocaleString()} · Expires {new Date(entry.expiresAt).toLocaleString()}</p>
              {!guestDomains.includes(entry.email.split("@")[1]) && <p className="mt-1 text-xs text-amber-300">Domain disabled for guests. Enable it in Settings to allow sign-in.</p>}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-zinc-400">
                New timeout
                <select
                  aria-label={`New timeout for ${entry.email}`}
                  value={durations[entry.email] ?? defaultDuration}
                  disabled={busy}
                  onChange={(event) => setDurations((current) => ({ ...current, [entry.email]: event.target.value as GuestDuration }))}
                  className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  {GUEST_DURATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <button type="button" disabled={busy} onClick={() => void update(entry.email, "timeout")} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50">Update timeout</button>
              <button type="button" disabled={busy} onClick={() => void update(entry.email, "revoke")} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 disabled:opacity-50">Revoke access</button>
            </div>
          </article>
        ))}
      </div>
      {cursor && <button type="button" disabled={busy} onClick={() => void load(activeQuery, cursor)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50">Load more</button>}
    </section>
  );
}
