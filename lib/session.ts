import { cookies } from "next/headers";
import { ACCESS_COOKIE, accessPassword, accessRequired, verifyAccessToken } from "@/lib/access";
import { HttpError } from "@/lib/domains";
import { GUEST_COOKIE, verifyGuestToken } from "@/lib/guest-session";
import { isShareActive } from "@/lib/share";
import { getStore } from "@/lib/store";
import type { SessionInfo } from "@/lib/types";

export async function readSession(): Promise<SessionInfo> {
  if (!accessRequired()) {
    return { role: "member" };
  }
  const secret = accessPassword();
  const jar = await cookies();
  if (await verifyAccessToken(jar.get(ACCESS_COOKIE)?.value, secret)) {
    return { role: "member" };
  }
  const guest = await verifyGuestToken(jar.get(GUEST_COOKIE)?.value, secret);
  if (!guest) return { role: "none" };
  const share = await getStore().getShare(guest.email);
  if (!isShareActive(share) || share.version !== guest.version) {
    return { role: "none" };
  }
  return {
    role: "guest",
    email: guest.email,
    sessionExpiresAt: guest.exp,
    shareExpiresAt: share.expiresAt,
  };
}

export async function requireMember(): Promise<void> {
  const session = await readSession();
  if (session.role === "member") return;
  if (session.role === "guest") {
    throw new HttpError("Guest sessions are receive-only", 403);
  }
  throw new HttpError("Unauthorized", 401);
}

export async function requireCanRead(email: string): Promise<SessionInfo> {
  const session = await readSession();
  if (session.role === "member") return session;
  const normalized = email.toLowerCase();
  if (session.role === "guest" && session.email === normalized) return session;
  if (session.role === "guest") {
    throw new HttpError("Forbidden", 403);
  }
  throw new HttpError("Unauthorized", 401);
}
