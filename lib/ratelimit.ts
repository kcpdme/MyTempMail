import { createHash } from "node:crypto";
import type { DatabaseClient } from "@/lib/database";
import { isMockMode } from "@/lib/env";
import { getTurso } from "@/lib/turso";

const WINDOW_MS = 10 * 60 * 1000;

export async function consumeRateLimit(db: DatabaseClient, scope: "send" | "guest", ip: string, now = Date.now()): Promise<{ ok: boolean; remaining: number }> {
  const limit = scope === "send" ? 10 : 5;
  const bucket = `${scope}:${createHash("sha256").update(ip || "unknown").digest("hex")}`;
  // A single write transaction serializes the count and insert across all
  // Vercel instances. Denied attempts cannot grow the table indefinitely.
  const results = await db.batch([
    { sql: "DELETE FROM rate_events WHERE bucket = ? AND expires_at <= ?", args: [bucket, now] },
    {
      sql: `INSERT INTO rate_events (bucket, expires_at)
        SELECT ?, ? WHERE (SELECT COUNT(*) FROM rate_events WHERE bucket = ?) < ?`,
      args: [bucket, now + WINDOW_MS, bucket, limit],
    },
    { sql: "SELECT COUNT(*) AS used FROM rate_events WHERE bucket = ?", args: [bucket] },
    { sql: "DELETE FROM rate_events WHERE id IN (SELECT id FROM rate_events WHERE expires_at <= ? LIMIT 100)", args: [now] },
  ], "write");
  return { ok: results[1].rowsAffected === 1, remaining: Math.max(0, limit - Number(results[2].rows[0].used)) };
}

export async function limitSend(ip: string): Promise<{ ok: boolean; remaining: number }> {
  if (isMockMode()) return { ok: true, remaining: 10 };
  return consumeRateLimit(getTurso(), "send", ip);
}

export async function limitGuestLogin(ip: string): Promise<{ ok: boolean; remaining: number }> {
  if (isMockMode()) return { ok: true, remaining: 5 };
  return consumeRateLimit(getTurso(), "guest", ip);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
