"use client";

import { FormEvent, useState } from "react";
import { DomainRecords } from "@/components/DomainRecords";
import type { ManagedDomain } from "@/lib/types";

export type SettingsPayload = {
  mockMode: boolean;
  resendApiKeySet: boolean;
  resendApiKeyLast4: string;
  webhookConfigured: boolean;
  appUrl: string;
  inboxTtlSeconds: number;
  maxMessagesPerInbox: number;
  domains: ManagedDomain[];
};

export function SettingsForm({
  initial,
  onReload,
}: {
  initial: SettingsPayload;
  onReload: () => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [appUrl, setAppUrl] = useState(initial.appUrl);
  const [ttl, setTtl] = useState(String(initial.inboxTtlSeconds));
  const [max, setMax] = useState(String(initial.maxMessagesPerInbox));
  const [domainName, setDomainName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resendApiKey: apiKey || undefined,
          resendWebhookSecret: webhookSecret || undefined,
          appUrl,
          inboxTtlSeconds: Number(ttl),
          maxMessagesPerInbox: Number(max),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setApiKey("");
      setWebhookSecret("");
      setMessage("Saved. Webhook is registered when an API key and app URL are present.");
      await onReload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addDomain(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: domainName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add domain");
      setDomainName("");
      await onReload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add domain");
    } finally {
      setBusy(false);
    }
  }

  async function removeDomain(name: string) {
    await fetch(`/api/settings/domains?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    await onReload();
  }

  async function verifyDomain(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/domains/${id}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verify failed");
      await onReload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshDomain(id: string) {
    const res = await fetch(`/api/settings/domains?id=${encodeURIComponent(id)}`);
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "Refresh failed");
      return;
    }
    await onReload();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-semibold text-zinc-50">Resend & app</h2>
        <p className="text-sm text-zinc-400">
          Env values are defaults. Saving here writes Redis and does not require a redeploy.
          {initial.mockMode ? " Mock mode is on — sends are stubbed." : ""}
        </p>
        <label className="block text-sm">
          Resend API key {initial.resendApiKeySet ? `(saved …${initial.resendApiKeyLast4})` : "(not set)"}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="re_…"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Webhook secret {initial.webhookConfigured ? "(saved)" : "(will be created on save)"}
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Optional if the app can register the webhook"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Public app URL
          <input
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            placeholder="https://your-app.vercel.app"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Inbox TTL (seconds)
            <input value={ttl} onChange={(e) => setTtl(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" />
          </label>
          <label className="block text-sm">
            Max messages
            <input value={max} onChange={(e) => setMax(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" />
          </label>
        </div>
        <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950">
          Save settings
        </button>
      </form>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-semibold text-zinc-50">Domains</h2>
        <p className="text-sm text-zinc-400">
          Add a domain you own. Copy the DNS records to your registrar, then verify. Sending and receiving use any
          username at that domain.
        </p>
        <form onSubmit={addDomain} className="flex gap-2">
          <input
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="mail.example.com"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950">
            Add domain
          </button>
        </form>
        <div className="space-y-6">
          {initial.domains.map((domain) => (
            <div key={domain.name} className="space-y-3 border-t border-zinc-800 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{domain.name}</strong>
                <span className="text-xs text-zinc-500">
                  {domain.status || "added"} · send {domain.sending || "?"} · receive {domain.receiving || "?"}
                </span>
                <div className="ml-auto flex gap-2">
                  {domain.resendId && (
                    <>
                      <button type="button" className="text-sm underline" onClick={() => void refreshDomain(domain.resendId!)}>
                        Refresh
                      </button>
                      <button type="button" className="text-sm underline" onClick={() => void verifyDomain(domain.resendId!)}>
                        I added DNS records
                      </button>
                    </>
                  )}
                  <button type="button" className="text-sm text-red-400" onClick={() => void removeDomain(domain.name)}>
                    Remove
                  </button>
                </div>
              </div>
              <DomainRecords records={domain.records ?? []} />
            </div>
          ))}
        </div>
      </section>
      {message && <p className="text-sm text-emerald-300">{message}</p>}
    </div>
  );
}
