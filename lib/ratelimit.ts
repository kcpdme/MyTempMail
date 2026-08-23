import { Ratelimit } from "@upstash/ratelimit";
import { isMockMode } from "@/lib/env";
import { getRedis } from "@/lib/redis";

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (isMockMode()) return null;
  if (limiter) return limiter;
  limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "rl:send",
    analytics: false,
  });
  return limiter;
}

export async function limitSend(ip: string): Promise<{ ok: boolean; remaining: number }> {
  const rl = getLimiter();
  if (!rl) return { ok: true, remaining: 10 };
  const result = await rl.limit(ip || "unknown");
  return { ok: result.success, remaining: result.remaining };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
