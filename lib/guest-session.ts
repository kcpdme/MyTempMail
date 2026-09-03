import { hmac, safeEqual, utf8ToBase64Url, base64UrlToUtf8 } from "@/lib/hmac";

export const GUEST_COOKIE = "tm_guest";

export type GuestClaims = {
  email: string;
  version: number;
  exp: number;
};

function payload(claims: GuestClaims): string {
  return `${claims.version}\n${claims.exp}\n${claims.email.toLowerCase()}`;
}

export async function signGuestToken(claims: GuestClaims, secret: string): Promise<string> {
  const email = claims.email.toLowerCase();
  const packed = utf8ToBase64Url(email);
  const mac = await hmac(secret, payload({ ...claims, email }));
  return `${claims.version}.${claims.exp}.${packed}.${mac}`;
}

export function guestCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function verifyGuestToken(token: string | undefined, secret: string): Promise<GuestClaims | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [versionRaw, expRaw, packed, mac] = parts;
  const version = Number(versionRaw);
  const exp = Number(expRaw);
  if (!Number.isInteger(version) || version < 1) return null;
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  if (!packed || !mac) return null;
  const email = base64UrlToUtf8(packed);
  if (!email || !email.includes("@")) return null;
  const expected = await hmac(secret, payload({ version, exp, email }));
  if (!safeEqual(mac, expected)) return null;
  return { email: email.toLowerCase(), version, exp };
}
