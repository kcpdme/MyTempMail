import type { DatabaseClient } from "../lib/database";
import { toSummary } from "../lib/normalize";
import type { ShareRecord, StoredMessage } from "../lib/types";

export type RedisSnapshot = { key: string; value: string; expiresAt: number | null };

/** Insert-only so a retry cannot overwrite newer data or prolong a TTL. */
export async function importSnapshot(db: DatabaseClient, snapshot: RedisSnapshot, now = Date.now()): Promise<number> {
  const { key, value, expiresAt } = snapshot;
  if (expiresAt !== null && expiresAt <= now) return 0;
  const data = JSON.parse(value);
  if (key === "app:settings") {
    const result = await db.execute({ sql: "INSERT INTO settings (id, value) VALUES (1, ?) ON CONFLICT DO NOTHING", args: [JSON.stringify(data)] });
    return result.rowsAffected;
  }
  if (key.startsWith("share:")) {
    const record = data as ShareRecord;
    const expiry = Math.min(record.expiresAt, expiresAt ?? record.expiresAt);
    if (!record.hash || !record.salt || !Number.isFinite(expiry) || expiry <= now) return 0;
    const result = await db.execute({
      sql: "INSERT INTO shares (email, hash, salt, version, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      args: [key.slice(6).toLowerCase(), record.hash, record.salt, record.version, record.createdAt, expiry],
    });
    return result.rowsAffected;
  }
  if (key.startsWith("msg:")) {
    if (expiresAt === null) throw new Error("Message without a TTL; inspect source retention before migrating");
    const separator = key.indexOf(":", 4);
    const message = data as StoredMessage;
    if (separator < 0 || message.id !== key.slice(separator + 1)) throw new Error("Invalid source message key");
    const result = await db.execute({
      sql: "INSERT INTO messages (email, id, summary, body, received_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      args: [key.slice(4, separator).toLowerCase(), message.id, JSON.stringify(toSummary(message)), JSON.stringify(message), message.receivedAt, expiresAt],
    });
    return result.rowsAffected;
  }
  return 0;
}

export async function* readRedisSnapshots(url: string, token: string): AsyncGenerator<RedisSnapshot> {
  async function command(args: (string | number)[]): Promise<unknown> {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("Source Redis request failed");
    const data = await response.json() as { result?: unknown; error?: string };
    if (data.error) throw new Error("Source Redis command failed");
    return data.result;
  }
  for (const pattern of ["app:settings", "share:*", "msg:*"]) {
    let cursor = "0";
    const seen = new Set<string>();
    do {
      const result = await command(["SCAN", cursor, "MATCH", pattern, "COUNT", 100]) as [string, string[]];
      cursor = String(result[0]);
      for (const key of result[1]) {
        if (seen.has(key)) continue;
        seen.add(key);
        // GET + PTTL in one atomic, read-only script avoids mixing a rotated
        // guest password with the previous record's expiry. Never log values.
        const startedAt = Date.now();
        const record = await command(["EVAL", "return {redis.call('GET', KEYS[1]), redis.call('PTTL', KEYS[1])}", 1, key]) as [string | null, number];
        if (!record[0] || record[1] === -2) continue;
        yield { key, value: record[0], expiresAt: record[1] === -1 ? null : startedAt + record[1] };
      }
    } while (cursor !== "0");
  }
}
