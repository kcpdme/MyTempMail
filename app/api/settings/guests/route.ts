import { NextRequest } from "next/server";
import { requireSettingsAuth } from "@/lib/auth";
import { assertDisposableAddress, HttpError, parseEmail } from "@/lib/domains";
import { guestAccessExpiresAt, isGuestDuration } from "@/lib/guest-policy";
import { jsonError, jsonOk } from "@/lib/http";
import { requireMember } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  await requireMember();
  await requireSettingsAuth();
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const cursor = request.nextUrl.searchParams.get("cursor") ?? "0";
    if (query.length > 254 || !/^\d{1,20}$/.test(cursor)) throw new HttpError("Invalid search or cursor");
    return jsonOk(await getStore().listShares(query, cursor));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json() as { email?: unknown; action?: unknown; duration?: unknown };
    if (typeof body.email !== "string") throw new HttpError("Email is required");
    // Existing grants remain manageable even if their domain was removed from Settings.
    const domain = parseEmail(body.email)?.domain;
    const { email } = assertDisposableAddress(body.email, domain ? [domain] : []);
    const store = getStore();
    if (body.action === "revoke") {
      await store.deleteShare(email);
      return jsonOk({ ok: true });
    }
    if (body.action !== "timeout" || !isGuestDuration(body.duration)) throw new HttpError("Invalid action or duration");
    const expiresAt = guestAccessExpiresAt(body.duration);
    if (!await store.updateShareExpiry(email, expiresAt)) throw new HttpError("Guest access has expired or was revoked. Refresh the list.", 404);
    return jsonOk({ ok: true, expiresAt });
  } catch (error) {
    return jsonError(error);
  }
}
