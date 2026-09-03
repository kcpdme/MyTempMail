import { NextRequest } from "next/server";
import { ACCESS_COOKIE, accessPassword, accessRequired } from "@/lib/access";
import { assertDisposableAddress, domainAllowlist, HttpError } from "@/lib/domains";
import { GUEST_COOKIE, guestCookieOptions, signGuestToken } from "@/lib/guest-session";
import { jsonError, jsonOk } from "@/lib/http";
import { dummyVerify, verifyPassword } from "@/lib/passwords";
import { clientIp, limitGuestLogin } from "@/lib/ratelimit";
import { guestSessionMaxAgeSeconds, isShareActive } from "@/lib/share";
import { getSettings } from "@/lib/settings";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const INVALID = "Invalid email or password";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { action?: string; email?: string; password?: string };
    if (body.action === "logout") {
      const res = jsonOk({ ok: true });
      res.cookies.delete(GUEST_COOKIE);
      return res;
    }

    const limited = await limitGuestLogin(clientIp(request));
    if (!limited.ok) {
      throw new HttpError("Too many attempts. Try again later.", 429);
    }

    if (!accessRequired()) {
      throw new HttpError("Guest login is only used when the workspace is locked.", 400);
    }

    const settings = await getSettings();
    const parsed = assertDisposableAddress(body.email ?? "", domainAllowlist(settings.domains));
    const share = await getStore().getShare(parsed.email);
    if (!isShareActive(share)) {
      await dummyVerify(body.password ?? "");
      throw new HttpError(INVALID, 401);
    }
    const ok = await verifyPassword(body.password ?? "", share.hash, share.salt);
    if (!ok) {
      throw new HttpError(INVALID, 401);
    }

    const now = Date.now();
    const maxAge = guestSessionMaxAgeSeconds(share.expiresAt, now);
    if (maxAge <= 0) {
      throw new HttpError(INVALID, 401);
    }
    const exp = now + maxAge * 1000;
    const token = await signGuestToken({ email: parsed.email, version: share.version, exp }, accessPassword());
    const res = jsonOk({ ok: true, email: parsed.email, sessionExpiresAt: exp, shareExpiresAt: share.expiresAt });
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.set(GUEST_COOKIE, token, guestCookieOptions(maxAge));
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
