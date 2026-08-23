import { defaultDomainsFromEnv, isMockMode, parsePositiveInt } from "@/lib/env";
import { getStore } from "@/lib/store";
import type { AppSettings, ManagedDomain, PublicConfig } from "@/lib/types";

const CACHE_MS = 60_000;

let cache: { value: AppSettings; at: number } | null = null;

export function invalidateSettingsCache(): void {
  cache = null;
}

function envDefaults(): AppSettings {
  const names = defaultDomainsFromEnv();
  const domains: ManagedDomain[] =
    names.length > 0
      ? names.map((name) => ({ name, status: "env" }))
      : isMockMode()
        ? [{ name: "example.test", status: "mock" }]
        : [];

  return {
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? "",
    resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "",
    resendWebhookId: "",
    domains,
    inboxTtlSeconds: parsePositiveInt(process.env.INBOX_TTL_SECONDS, 86400),
    maxMessagesPerInbox: parsePositiveInt(process.env.MAX_MESSAGES_PER_INBOX, 50),
    appUrl: process.env.APP_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""),
  };
}

function overlay(base: AppSettings, stored: Partial<AppSettings> | null): AppSettings {
  if (!stored) return base;
  const domains =
    stored.domains && stored.domains.length > 0
      ? stored.domains.map((d) => ({ ...d, name: d.name.toLowerCase() }))
      : base.domains;
  return {
    resendApiKey: stored.resendApiKey || base.resendApiKey,
    resendWebhookSecret: stored.resendWebhookSecret || base.resendWebhookSecret,
    resendWebhookId: stored.resendWebhookId || base.resendWebhookId,
    domains,
    inboxTtlSeconds: stored.inboxTtlSeconds || base.inboxTtlSeconds,
    maxMessagesPerInbox: stored.maxMessagesPerInbox || base.maxMessagesPerInbox,
    appUrl: stored.appUrl || base.appUrl,
  };
}

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }
  const stored = await getStore().getRawSettings();
  const value = overlay(envDefaults(), stored);
  cache = { value, at: Date.now() };
  return value;
}

export async function saveSettings(next: AppSettings): Promise<AppSettings> {
  await getStore().saveRawSettings(next);
  cache = { value: next, at: Date.now() };
  return next;
}

export function publicConfig(settings: AppSettings): PublicConfig {
  return {
    domains: settings.domains.map((d) => d.name),
    inboxTtlSeconds: settings.inboxTtlSeconds,
    mockMode: isMockMode(),
  };
}

export function maskKey(key: string): { set: boolean; last4: string } {
  if (!key) return { set: false, last4: "" };
  return { set: true, last4: key.slice(-4) };
}

export { envDefaults, overlay };
