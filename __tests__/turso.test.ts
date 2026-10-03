import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "./helpers/database";
import type { DatabaseClient } from "@/lib/database";
import { cleanupExpired, initializeDatabase } from "@/lib/turso";
import { TursoStore } from "@/lib/turso-store";
import { consumeRateLimit } from "@/lib/ratelimit";
import { importSnapshot, readRedisSnapshots } from "@/scripts/import-redis";
import { envDefaults } from "@/lib/settings";
import type { ShareRecord, StoredMessage } from "@/lib/types";

let db: DatabaseClient;
let store: TursoStore;
const email = "user@example.test";
const now = Date.UTC(2026, 9, 3);
function message(id: string, offset = 0): StoredMessage {
  return { id, from: "sender@example.test", to: [email], subject: id, receivedAt: new Date(now + offset).toISOString(), snippet: id, hasHtml: true, html: "<b>private body</b>", text: "private body", messageId: id, references: "", cc: [], headers: {}, attachments: [] };
}
function grant(overrides: Partial<ShareRecord> = {}): ShareRecord {
  return { hash: "private-hash", salt: "private-salt", version: 1, createdAt: now, expiresAt: now + 60_000, ...overrides };
}
beforeEach(async () => {
  db = await createTestDatabase();
  await initializeDatabase(db);
  store = new TursoStore(db);
  vi.spyOn(Date, "now").mockReturnValue(now);
});
afterEach(() => { db.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Turso mail store (real SQL)", () => {
  it("initializes idempotently and persists settings, bodies and summaries separately", async () => {
    await initializeDatabase(db);
    await store.saveRawSettings(envDefaults());
    expect(await new TursoStore(db).getRawSettings()).toEqual(envDefaults());
    await store.saveMessage(email.toUpperCase(), message("one"), { ttlSeconds: 60, maxMessages: 50 });
    expect((await store.getMessage(email, "one"))?.html).toBe("<b>private body</b>");
    expect((await store.listInbox(email))[0]).not.toHaveProperty("html");
    expect(await store.getMessage("other@example.test", "one")).toBeNull();
    await store.deleteMessage(email, "one");
    expect(await store.listInbox(email)).toEqual([]);
  });

  it("orders out-of-order deliveries, trims atomically, and does not extend duplicate TTLs", async () => {
    const opts = { ttlSeconds: 60, maxMessages: 2 };
    await Promise.all([store.saveMessage(email, message("new", 2), opts), store.saveMessage(email, message("old"), opts), store.saveMessage(email, message("middle", 1), opts)]);
    expect((await store.listInbox(email)).map((m) => m.id)).toEqual(["new", "middle"]);
    expect(await store.getMessage(email, "old")).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now + 30_000);
    await store.saveMessage(email, { ...message("new", 2), text: "updated" }, opts);
    expect((await store.getMessage(email, "new"))?.text).toBe("updated");
    vi.spyOn(Date, "now").mockReturnValue(now + 60_000);
    expect(await store.listInbox(email)).toEqual([]);
    expect(await store.getMessage(email, "new")).toBeNull();
    await store.clearInbox(email);
    expect((await db.execute("SELECT * FROM messages")).rows).toHaveLength(0);
    // A duplicate webhook after cleanup cannot restart the retention clock.
    vi.spyOn(Date, "now").mockReturnValue(now + 120_000);
    await store.saveMessage(email, message("new", 2), opts);
    expect((await db.execute("SELECT * FROM messages")).rows).toHaveLength(0);
  });

  it("lists only live grants with literal search and private fields excluded, across pages", async () => {
    for (let i = 0; i < 53; i++) await store.putShare(`person${String(i).padStart(2, "0")}@example.test`, grant(), 60);
    await store.putShare("expired@example.test", grant({ expiresAt: now }), 60);
    await store.putShare("a%_*?[x]@example.test", grant(), 60);
    const first = await store.listShares("person", "0");
    expect(first.entries).toHaveLength(50);
    expect(first.nextCursor).toBe("50");
    expect(first.entries[0]).not.toHaveProperty("hash");
    expect((await store.listShares("person", first.nextCursor!)).entries).toHaveLength(3);
    expect((await store.listShares("%_*?[x]", "0")).entries.map((e) => e.email)).toEqual(["a%_*?[x]@example.test"]);
    expect((await store.listShares("expired", "0")).entries).toHaveLength(0);
    await expect(store.listShares("", "99999999999999999999")).rejects.toThrow("Invalid cursor");
  });

  it("updates expiry without changing rotated passwords or reviving revoked/expired access", async () => {
    await store.putShare(email, grant(), 60);
    await store.putShare(email, grant({ hash: "rotated", version: 2 }), 60);
    expect(await store.updateShareExpiry(email, now + 120_000)).toBe(true);
    expect(await store.getShare(email)).toEqual(grant({ hash: "rotated", version: 2, expiresAt: now + 120_000 }));
    await store.deleteShare(email);
    expect(await store.updateShareExpiry(email, now + 180_000)).toBe(false);
    await store.putShare(email, grant({ expiresAt: now }), 60);
    expect(await store.updateShareExpiry(email, now + 180_000)).toBe(false);
    expect(await store.getShare(email)).toBeNull();
  });

  it("cleans expired data with bounded deletes and retains live rows", async () => {
    await store.saveMessage(email, message("expired"), { ttlSeconds: 1, maxMessages: 50 });
    await store.saveMessage(email, message("live", 1), { ttlSeconds: 60, maxMessages: 50 });
    await store.putShare(email, grant({ expiresAt: now + 1000 }), 1);
    await consumeRateLimit(db, "send", "ip", now - 600_000);
    expect(await cleanupExpired(db, now + 1000)).toBe(3);
    expect((await db.execute("SELECT id FROM messages")).rows.map((r) => r.id)).toEqual(["live"]);
  });
});

describe("SQL rate limits", () => {
  it("enforces limits under concurrent requests and isolates IPs and actions", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeRateLimit(db, "guest", "same-ip", now)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.at(-1)).toEqual({ ok: false, remaining: 0 });
    expect((await consumeRateLimit(db, "guest", "other-ip", now)).ok).toBe(true);
    const sends = await Promise.all(Array.from({ length: 11 }, () => consumeRateLimit(db, "send", "same-ip", now)));
    expect(sends.filter((r) => r.ok)).toHaveLength(10);
    expect((await consumeRateLimit(db, "guest", "same-ip", now + 599_999)).ok).toBe(false);
    expect(await consumeRateLimit(db, "guest", "same-ip", now + 600_000)).toEqual({ ok: true, remaining: 4 });
    expect(JSON.stringify((await db.execute("SELECT bucket FROM rate_events")).rows)).not.toContain("same-ip");
  });

  it("fails closed when the database is unavailable", async () => {
    db.close();
    await expect(consumeRateLimit(db, "send", "ip")).rejects.toThrow();
  });
});

describe("Redis migration", () => {
  it("preserves expiry and guest identity, skips expired data, and is safe to retry", async () => {
    const snapshot = { key: `msg:${email}:one`, value: JSON.stringify(message("one")), expiresAt: now + 1234 };
    expect(await importSnapshot(db, snapshot)).toBe(1);
    expect(await importSnapshot(db, { ...snapshot, expiresAt: now + 60_000 })).toBe(0);
    expect(Number((await db.execute("SELECT expires_at FROM messages")).rows[0].expires_at)).toBe(now + 1234);
    expect(await importSnapshot(db, { ...snapshot, key: `msg:${email}:two`, value: JSON.stringify(message("two")), expiresAt: now })).toBe(0);
    await importSnapshot(db, { key: `share:${email}`, value: JSON.stringify(grant()), expiresAt: now + 30_000 });
    expect(await store.getShare(email)).toEqual(grant({ expiresAt: now + 30_000 }));
    await importSnapshot(db, { key: "app:settings", value: JSON.stringify(envDefaults()), expiresAt: null });
    await store.saveRawSettings({ ...envDefaults(), maxMessagesPerInbox: 99 });
    await importSnapshot(db, { key: "app:settings", value: JSON.stringify(envDefaults()), expiresAt: null });
    expect((await store.getRawSettings())?.maxMessagesPerInbox).toBe(99);
  });

  it("reads SCAN pages and deduplicates keys without ever deleting source records", async () => {
    const responses = [["1", []], ["0", ["app:settings", "app:settings"]], [JSON.stringify(envDefaults()), -1], ["0", []], ["0", [`msg:${email}:one`]], [JSON.stringify(message("one")), 5000]];
    const fetcher = vi.fn(async () => Response.json({ result: responses.shift() }));
    vi.stubGlobal("fetch", fetcher);
    const snapshots = [];
    for await (const snapshot of readRedisSnapshots("https://redis.example", "secret")) snapshots.push(snapshot);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].expiresAt).toBe(now + 5000);
    expect(responses).toHaveLength(0);
  });
});
