import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isMockMode, settingsSecret } from "@/lib/env";

const COOKIE = "tm_settings";
const MAX_AGE = 60 * 60 * 24 * 7;

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function settingsUnlockedWithoutSecret(): boolean {
  return isMockMode() && !settingsSecret();
}

export function settingsAuthConfigured(): boolean {
  return Boolean(settingsSecret()) || settingsUnlockedWithoutSecret();
}

export async function isSettingsAuthed(): Promise<boolean> {
  if (settingsUnlockedWithoutSecret()) return true;
  const secret = settingsSecret();
  if (!secret) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, mac] = raw.split(".");
  if (!exp || !mac) return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  return safeEqual(mac, sign(exp, secret));
}

export async function requireSettingsAuth(): Promise<void> {
  if (await isSettingsAuthed()) return;
  const error = Object.assign(new Error("Unauthorized"), { status: 401 });
  throw error;
}

export async function setSettingsCookie(): Promise<void> {
  const secret = settingsSecret();
  if (!secret) return;
  const exp = String(Date.now() + MAX_AGE * 1000);
  const value = `${exp}.${sign(exp, secret)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSettingsCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export function verifySettingsPassword(password: string): boolean {
  const secret = settingsSecret();
  if (!secret) return settingsUnlockedWithoutSecret();
  return safeEqual(password, secret);
}
