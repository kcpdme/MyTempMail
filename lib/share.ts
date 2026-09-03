import type { ShareRecord } from "@/lib/types";

export const SHARE_TTL_SECONDS = 3 * 60 * 60;
export const GUEST_SESSION_SECONDS = 30 * 60;
export const MIN_GUEST_PASSWORD_LENGTH = 8;
export const MAX_GUEST_PASSWORD_LENGTH = 64;

export function shareKey(email: string): string {
  return `share:${email.toLowerCase()}`;
}

export function isShareActive(record: ShareRecord | null | undefined, now = Date.now()): record is ShareRecord {
  if (!record) return false;
  return record.expiresAt > now && Boolean(record.hash) && Boolean(record.salt);
}

export function guestSessionMaxAgeSeconds(shareExpiresAt: number, now = Date.now()): number {
  const sessionEnd = now + GUEST_SESSION_SECONDS * 1000;
  const end = Math.min(sessionEnd, shareExpiresAt);
  return Math.max(0, Math.floor((end - now) / 1000));
}

export function publicShareStatus(record: ShareRecord | null | undefined, now = Date.now()) {
  if (!isShareActive(record, now) || !record) {
    return { enabled: false as const };
  }
  return {
    enabled: true as const,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    version: record.version,
  };
}
