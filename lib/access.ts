const COOKIE = "tm_access";
const MAX_AGE = 60 * 60 * 24 * 7;

export function accessPassword(): string {
  return process.env.ACCESS_PASSWORD?.trim() ?? "";
}

export function accessRequired(): boolean {
  return Boolean(accessPassword());
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(sig);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function signAccessToken(secret: string): Promise<string> {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${await hmac(secret, exp)}`;
}

export async function verifyAccessToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const [exp, mac] = token.split(".");
  if (!exp || !mac) return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmac(secret, exp);
  return safeEqual(mac, expected);
}

export function verifyAccessPassword(password: string): boolean {
  const secret = accessPassword();
  if (!secret) return false;
  return safeEqual(password, secret);
}

export { COOKIE as ACCESS_COOKIE, MAX_AGE as ACCESS_MAX_AGE };
