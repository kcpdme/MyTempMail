"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { Globe2, History, KeyRound, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { GuestAccessManager } from "@/components/GuestAccessManager";
import { DomainCard } from "@/components/DomainRecords";
import { GUEST_DURATIONS, type GuestDuration } from "@/lib/guest-policy";
import type { ManagedDomain } from "@/lib/types";

type SettingsTab = "app" | "guest-access" | "guest-inboxes" | "domains";

const TABS = [
  { id: "app", label: "App & delivery", hint: "Resend, URL, retention", icon: SlidersHorizontal },
  { id: "guest-access", label: "Guest policy", hint: "Domains and default expiry", icon: KeyRound },
  { id: "guest-inboxes", label: "Guest inboxes", hint: "Search and manage access", icon: History },
  { id: "domains", label: "Domains", hint: "Receiving and DNS", icon: Globe2 },
] as const;

function tabFromHash(hash: string): SettingsTab {
  const found = TABS.find((tab) => hash === `#settings-${tab.id}`);
  return found?.id ?? "app";
}

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
  const [activeTab, setActiveTab] = useState<SettingsTab>("app");
  useEffect(() => {
    const syncTab = () => setActiveTab(tabFromHash(window.location.hash));
    syncTab();
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);

  function selectTab(tab: SettingsTab) {
    setActiveTab(tab);
    window.location.hash = `settings-${tab}`;
  }

  function tabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    const next = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (index + 1) % TABS.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? (index - 1 + TABS.length) % TABS.length
        : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
    if (next === -1) return;
    event.preventDefault();
    selectTab(TABS[next].id);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next]?.focus();
  }

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

  const durationLabel = GUEST_DURATIONS.find((option) => option.value === initial.guestAccessDuration)?.label ?? "3 days";
  const currentTab = TABS.find((tab) => tab.id === activeTab)!;

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500">Configured domains</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">{initial.domains.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500">Guest domains</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{initial.guestDomains.length}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:col-span-1">
          <p className="text-xs text-zinc-500">Default guest access</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">{durationLabel}</p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div role="tablist" aria-label="Settings sections" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:sticky lg:top-6 lg:flex lg:flex-col">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-controls={`settings-panel-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={tabKeyDown}
                className={`flex min-w-0 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:w-full ${selected ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium">{tab.label}</span>
                  <span className="mt-0.5 hidden text-xs opacity-70 lg:block">{tab.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div id={`settings-panel-${activeTab}`} role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} tabIndex={0} className="min-w-0 space-y-4 outline-none">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Settings / {currentTab.label}</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-50">{currentTab.label}</h2>
            <p className="mt-1 text-sm text-zinc-500">{currentTab.hint}</p>
          </div>
          {activeTab === "app" && <form onSubmit={save} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
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
          </form>}

          {activeTab === "guest-access" && <form onSubmit={saveGuestSettings} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <fieldset className="space-y-3">
              <legend className="sr-only">Guest access</legend>
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
          </form>}

          {activeTab === "guest-inboxes" && <GuestAccessManager defaultDuration={initial.guestAccessDuration} guestDomains={initial.guestDomains} />}

          {activeTab === "domains" && <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
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
          </section>}
        </div>
      </div>
    </div>
  );
}
