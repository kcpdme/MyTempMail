import { createClient } from "@tursodatabase/serverless/compat";
import { normalizeResult, type DatabaseClient } from "./database";

let client: DatabaseClient | undefined;

export function getTurso(): DatabaseClient {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) {
    throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, then run npm run db:setup");
  }
  if (!url.startsWith("turso://") && !url.startsWith("https://")) {
    throw new Error("Use a remote TursoDB database URL (turso:// or https://)");
  }
  const remote = createClient({ url, authToken });
  client = {
    execute: async (statement) => normalizeResult(await remote.execute(statement)),
    batch: async (statements, mode) => (await remote.batch(statements, mode)).map(normalizeResult),
    close: () => remote.close(),
  };
  return client;
}

// Explicit setup avoids running DDL on every serverless cold start.
export async function initializeDatabase(db: DatabaseClient): Promise<void> {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS messages (
      email TEXT NOT NULL, id TEXT NOT NULL, summary TEXT NOT NULL,
      body TEXT NOT NULL, received_at TEXT NOT NULL, expires_at INTEGER NOT NULL,
      PRIMARY KEY (email, id)
    )`,
    "CREATE INDEX IF NOT EXISTS messages_inbox ON messages(email, received_at DESC, id DESC)",
    "CREATE INDEX IF NOT EXISTS messages_expiry ON messages(expires_at)",
    "CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL)",
    `CREATE TABLE IF NOT EXISTS shares (
      email TEXT PRIMARY KEY, hash TEXT NOT NULL, salt TEXT NOT NULL,
      version INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS shares_expiry ON shares(expires_at)",
    `CREATE TABLE IF NOT EXISTS rate_events (
      id INTEGER PRIMARY KEY, bucket TEXT NOT NULL, expires_at INTEGER NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS rate_events_bucket ON rate_events(bucket, expires_at)",
    "CREATE INDEX IF NOT EXISTS rate_events_expiry ON rate_events(expires_at)",
  ], "write");
}

// Bounded indexed deletes keep cleanup requests small, including on free plans.
export async function cleanupExpired(db: DatabaseClient, now = Date.now(), batchSize = 500): Promise<number> {
  const results = await db.batch(["messages", "shares", "rate_events"].map((table) => ({
    sql: `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE expires_at <= ? LIMIT ?)`,
    args: [now, batchSize],
  })), "write");
  return results.reduce((count, result) => count + result.rowsAffected, 0);
}
