import { Ratelimit } from "@upstash/ratelimit";
import { isMockMode } from "@/lib/env";
import { getRedis } from "@/lib/redis";

let sendLimiter: Ratelimit | null = null;
let guestLimiter: Ratelimit | null = null;

function getSendLimiter(): Ratelimit | null {
  if (isMockMode()) return null;
  if (sendLimiter) return sendLimiter;
  sendLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "rl:send",
    analytics: false,
  });
  return sendLimiter;
}

function getGuestLimiter(): Ratelimit | null {
  if (isMockMode()) return null;
  if (guestLimiter) return guestLimiter;
  guestLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "rl:guest",
    analytics: false,
  });
  return guestLimiter;
}

export async function limitSend(ip: string): Promise<{ ok: boolean; remaining: number }> {
  const rl = getSendLimiter();
  if (!rl) return { ok: true, remaining: 10 };
  const result = await rl.limit(ip || "unknown");
  return { ok: result.success, remaining: result.remaining };
}

export async function limitGuestLogin(ip: string): Promise<{ ok: boolean; remaining: number }> {
  const rl = getGuestLimiter();
  if (!rl) return { ok: true, remaining: 5 };
  const result = await rl.limit(ip || "unknown");
  return { ok: result.success, remaining: result.remaining };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
