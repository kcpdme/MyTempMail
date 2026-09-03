import { hmac, safeEqual } from "@/lib/hmac";

const COOKIE = "tm_access";
const MAX_AGE = 60 * 60 * 24 * 7;

export function accessPassword(): string {
  return process.env.ACCESS_PASSWORD?.trim() ?? "";
}

export function accessRequired(): boolean {
  return Boolean(accessPassword());
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
