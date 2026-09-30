"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { GuestAccessManager } from "@/components/GuestAccessManager";
import { DomainCard } from "@/components/DomainRecords";
import { GUEST_DURATIONS, type GuestDuration } from "@/lib/guest-policy";
import type { ManagedDomain } from "@/lib/types";

export type SettingsPayload = {
  mockMode: boolean;
  resendApiKeySet: boolean;
  resendApiKeyLast4: string;
  webhookConfigured: boolean;
  webhookUrl?: string;
  appUrl: string;
  inboxTtlSeconds: number;
  maxMessagesPerInbox: number;
  domains: ManagedDomain[];
  guestDomains: string[];
  guestAccessDuration: GuestDuration;
};

export function SettingsForm({
  initial,
  onReload,
}: {
  initial: SettingsPayload;
  onReload: () => Promise<void>;
}) {
  const [guestDomains, setGuestDomains] = useState(initial.guestDomains);
  const [guestDuration, setGuestDuration] = useState(initial.guestAccessDuration);
  useEffect(() => {
    setGuestDomains(initial.guestDomains);
    setGuestDuration(initial.guestAccessDuration);
  }, [initial.guestDomains, initial.guestAccessDuration]);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [appUrl, setAppUrl] = useState(initial.appUrl);
  const [ttl, setTtl] = useState(String(initial.inboxTtlSeconds));
  const [max, setMax] = useState(String(initial.maxMessagesPerInbox));
  const [domainName, setDomainName] = useState("");
  const [busy, setBusy] = useState(false);
  const [guestMessage, setGuestMessage] = useState<string | null>(null);
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

  async function saveGuestSettings(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setGuestMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestDomains: guestDomains.filter((name) => initial.domains.some((domain) => domain.name === name)),
          guestAccessDuration: guestDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save guest settings");
      await onReload();
      setGuestMessage("Guest settings saved.");
      toast.success("Guest settings saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save guest settings";
      setGuestMessage(message);
      toast.error(message);
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
      setMessage(data.imported ? "Attached existing Resend domain." : "Domain added. Copy DNS records, then verify.");
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

  async function syncDomains() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not import domains");
      setMessage(
        data.count ? `Imported ${data.count} domain${data.count === 1 ? "" : "s"} from Resend.` : "No new Resend domains to import.",
      );
      await onReload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not import domains");
    } finally {
      setBusy(false);
    }
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
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-base md:text-sm"
          />
        </label>
        <label className="block text-sm">
          Webhook secret {initial.webhookConfigured ? "(saved)" : "(will be created on save)"}
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Optional if the app can register the webhook"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-base md:text-sm"
          />
        </label>
        <label className="block text-sm">
          Public app URL
          <input
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            placeholder="https://your-custom-domain.com"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-base md:text-sm"
          />
        </label>
        {initial.webhookUrl && (
          <p className="text-xs text-zinc-500">
            Resend webhook must be this exact HTTPS URL with no redirect (if the apex
            domain 308s to www, use www):{" "}
            <code className="break-all text-zinc-300">{initial.webhookUrl}</code>
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Inbox TTL (seconds)
            <input value={ttl} onChange={(e) => setTtl(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-base md:text-sm" />
          </label>
          <label className="block text-sm">
            Max messages
            <input value={max} onChange={(e) => setMax(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-base md:text-sm" />
          </label>
        </div>

        <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950">
          Save settings
        </button>
        {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      </form>

      <form onSubmit={saveGuestSettings} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <fieldset className="space-y-3">
          <legend className="px-1 text-base font-semibold text-zinc-50">Guest access</legend>
          <p className="text-sm text-zinc-400">
            Choose the guest email domains shown on the login page. Only selected domains allow guest access.
            Deselecting a domain also ends its existing guest sessions.
          </p>
          <div className="space-y-2" role="group" aria-label="Guest email domains">
            {initial.domains.map((domain) => (
              <label key={domain.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={guestDomains.includes(domain.name)}
                  onChange={(event) => setGuestDomains((current) => event.target.checked
                    ? [...current, domain.name]
                    : current.filter((name) => name !== domain.name))}
                />
                {domain.name}
              </label>
            ))}
            {!initial.domains.length && <p className="text-sm text-zinc-500">Add a domain below first.</p>}
          </div>
          {!guestDomains.length && <p className="text-sm text-amber-300">Guest login is disabled until you select a domain.</p>}
          <label className="block text-sm">
            Default guest access duration
            <select
              value={guestDuration}
              onChange={(event) => setGuestDuration(event.target.value as GuestDuration)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
            >
              {GUEST_DURATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <p className="text-xs text-zinc-500">Applies to new or rotated passwords. You can choose a different duration when creating access. Six months means six calendar months. Existing expiry dates and inbox message retention stay unchanged.</p>
        </fieldset>
        <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">{busy ? "Saving…" : "Save guest settings"}</button>
        {guestMessage && <p role="status" className="text-sm text-emerald-300">{guestMessage}</p>}
      </form>

      <GuestAccessManager defaultDuration={initial.guestAccessDuration} guestDomains={initial.guestDomains} />

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-semibold text-zinc-50">Domains</h2>
        <p className="text-sm text-zinc-400">
          Add a domain you own, or import one already in Resend. DNS records come from Resend — copy them to your
          registrar, then verify. Sending and receiving use any username at that domain.
        </p>
        <form onSubmit={addDomain} className="flex flex-wrap gap-2">
          <input
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="mail.example.com"
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-base md:min-w-[200px] md:text-sm"
          />
          <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950">
            Add domain
          </button>
          {!initial.mockMode && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncDomains()}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200"
            >
              Import from Resend
            </button>
          )}
        </form>
        <div className="space-y-6">
          {initial.domains.map((domain) => (
            <DomainCard
              key={domain.name}
              domain={domain}
              busy={busy}
              onRefresh={(id) => void refreshDomain(id)}
              onVerify={(id) => void verifyDomain(id)}
              onRemove={(name) => void removeDomain(name)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
