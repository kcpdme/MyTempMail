import { HttpError } from "@/lib/domains";
import type { AppSettings } from "@/lib/types";

export const GUEST_DURATIONS = [
  { value: "1d", label: "1 day", days: 1 },
  { value: "3d", label: "3 days", days: 3 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "6m", label: "6 months", days: null },
] as const;

export type GuestDuration = (typeof GUEST_DURATIONS)[number]["value"];
export const DEFAULT_GUEST_DURATION: GuestDuration = "3d";

export function isGuestDuration(value: unknown): value is GuestDuration {
  return GUEST_DURATIONS.some((option) => option.value === value);
}

export function guestAccessExpiresAt(duration: GuestDuration, now = Date.now()): number {
  const option = GUEST_DURATIONS.find((item) => item.value === duration);
  if (!option) throw new HttpError("Invalid guest access duration");
  if (option.days !== null) return now + option.days * 86400_000;
  const date = new Date(now);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

export function guestDomainAllowlist(settings: Pick<AppSettings, "domains" | "guestDomains">): string[] {
  const selected = new Set(settings.guestDomains.map((name) => name.toLowerCase()));
  return settings.domains.map((domain) => domain.name.toLowerCase()).filter((name) => selected.has(name));
}

export function validateGuestDomains(value: unknown, settings: Pick<AppSettings, "domains">): string[] {
  if (!Array.isArray(value) || value.some((name) => typeof name !== "string")) {
    throw new HttpError("Guest email domains must be a list of configured domains");
  }
  const domains = [...new Set((value as string[]).map((name) => name.trim().toLowerCase()))];
  const configured = new Set(settings.domains.map((domain) => domain.name.toLowerCase()));
  if (domains.some((name) => !configured.has(name))) {
    throw new HttpError("Select guest email domains from the configured domains");
  }
  return domains;
}
