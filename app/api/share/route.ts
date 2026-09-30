import { NextRequest } from "next/server";
import { assertDisposableAddress, domainAllowlist, HttpError } from "@/lib/domains";
import { guestAccessExpiresAt, guestDomainAllowlist, isGuestDuration, type GuestDuration } from "@/lib/guest-policy";
import { jsonError, jsonOk } from "@/lib/http";
import { generateGuestPassword, hashPassword } from "@/lib/passwords";
import { requireMember } from "@/lib/session";
import {
  MAX_GUEST_PASSWORD_LENGTH,
  MIN_GUEST_PASSWORD_LENGTH,
  isShareActive,
  publicShareStatus,
} from "@/lib/share";
import { getSettings } from "@/lib/settings";
import { getStore } from "@/lib/store";
import type { ShareRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

async function parsedEmail(raw: string) {
  const settings = await getSettings();
  return assertDisposableAddress(raw, domainAllowlist(settings.domains));
}

function resolvePassword(custom: string | undefined): string {
  const trimmed = custom?.trim() ?? "";
  if (!trimmed) return generateGuestPassword();
  if (trimmed.length < MIN_GUEST_PASSWORD_LENGTH || trimmed.length > MAX_GUEST_PASSWORD_LENGTH) {
    throw new HttpError(`Password must be ${MIN_GUEST_PASSWORD_LENGTH}–${MAX_GUEST_PASSWORD_LENGTH} characters`);
  }
  return trimmed;
}

async function publishShare(email: string, previous: ShareRecord | null, password: string, duration: GuestDuration) {
  const now = Date.now();
  const { hash, salt } = await hashPassword(password);
  const record: ShareRecord = {
    hash,
    salt,
    version: (previous?.version ?? 0) + 1,
    createdAt: now,
    expiresAt: guestAccessExpiresAt(duration, now),
  };
  await getStore().putShare(email, record, Math.ceil((record.expiresAt - now) / 1000));
  return { password, ...publicShareStatus(record) };
}

export async function GET(request: NextRequest) {
  try {
    await requireMember();
    const parsed = await parsedEmail(request.nextUrl.searchParams.get("email") ?? "");
    const share = await getStore().getShare(parsed.email);
    return jsonOk(publicShareStatus(share));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMember();
    const body = (await request.json()) as { email?: string; action?: string; password?: string; duration?: unknown };
    const parsed = await parsedEmail(body.email ?? "");
    const store = getStore();
    const existing = await store.getShare(parsed.email);
    const action = body.action ?? "create";

    if (action === "revoke") {
      await store.deleteShare(parsed.email);
      return jsonOk({ enabled: false });
    }

    const settings = await getSettings({ fresh: true });
    if (!guestDomainAllowlist(settings).includes(parsed.domain)) {
      throw new HttpError("Enable this domain in Settings → Guest email domains first.", 403);
    }
    const duration = body.duration ?? settings.guestAccessDuration;
    if (!isGuestDuration(duration)) throw new HttpError("Invalid guest access duration");

    if (action === "create") {
      if (isShareActive(existing)) {
        throw new HttpError("Guest access is already on. Rotate to issue a new password.", 409);
      }
      const password = resolvePassword(body.password);
      return jsonOk(await publishShare(parsed.email, existing, password, duration));
    }

    if (action === "rotate") {
      if (!isShareActive(existing)) {
        throw new HttpError("Create a guest password first.", 400);
      }
      const password = resolvePassword(body.password);
      return jsonOk(await publishShare(parsed.email, existing, password, duration));
    }

    throw new HttpError("Unknown action");
  } catch (error) {
    return jsonError(error);
  }
}
