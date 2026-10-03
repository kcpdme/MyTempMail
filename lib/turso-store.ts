import type { DatabaseClient } from "@/lib/database";
import { toSummary } from "@/lib/normalize";
import type { MailStore } from "@/lib/store";
import type { AppSettings, GuestAccessPage, InboxSummary, ShareRecord, StoredMessage } from "@/lib/types";

export class TursoStore implements MailStore {
  constructor(private db: DatabaseClient) {}

  async listInbox(email: string): Promise<InboxSummary[]> {
    const result = await this.db.execute({
      sql: "SELECT summary FROM messages WHERE email = ? AND expires_at > ? ORDER BY received_at DESC, id DESC",
      args: [email.toLowerCase(), Date.now()],
    });
    return result.rows.map((row) => JSON.parse(String(row.summary)));
  }

  async getMessage(email: string, id: string): Promise<StoredMessage | null> {
    const result = await this.db.execute({
      sql: "SELECT body FROM messages WHERE email = ? AND id = ? AND expires_at > ?",
      args: [email.toLowerCase(), id, Date.now()],
    });
    return result.rows[0] ? JSON.parse(String(result.rows[0].body)) : null;
  }

  async saveMessage(email: string, message: StoredMessage, opts: { ttlSeconds: number; maxMessages: number }): Promise<void> {
    const address = email.toLowerCase();
    const now = Date.now();
    const receivedAt = Date.parse(message.receivedAt);
    const expiresAt = (Number.isFinite(receivedAt) ? Math.min(now, receivedAt) : now) + (opts.ttlSeconds || 86400) * 1000;
    // A delayed webhook retry must not resurrect mail already past retention,
    // even after the original row has been physically cleaned up.
    if (expiresAt <= now) return;
    // One write transaction prevents concurrent deliveries from losing messages
    // or exceeding the cap. Retries update content without extending retention.
    await this.db.batch([
      { sql: "DELETE FROM messages WHERE rowid IN (SELECT rowid FROM messages WHERE expires_at <= ? LIMIT 500)", args: [now] },
      {
        sql: `INSERT INTO messages (email, id, summary, body, received_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(email, id) DO UPDATE SET summary = excluded.summary, body = excluded.body`,
        args: [address, message.id, JSON.stringify(toSummary(message)), JSON.stringify(message), message.receivedAt, expiresAt],
      },
      {
        sql: `DELETE FROM messages WHERE email = ? AND id IN (
          SELECT id FROM messages WHERE email = ? ORDER BY received_at DESC, id DESC LIMIT -1 OFFSET ?
        )`,
        args: [address, address, opts.maxMessages || 50],
      },
    ], "write");
  }

  async deleteMessage(email: string, id: string): Promise<void> {
    await this.db.execute({ sql: "DELETE FROM messages WHERE email = ? AND id = ?", args: [email.toLowerCase(), id] });
  }

  async clearInbox(email: string): Promise<void> {
    await this.db.execute({ sql: "DELETE FROM messages WHERE email = ?", args: [email.toLowerCase()] });
  }

  async getRawSettings(): Promise<Partial<AppSettings> | null> {
    const result = await this.db.execute("SELECT value FROM settings WHERE id = 1");
    return result.rows[0] ? JSON.parse(String(result.rows[0].value)) : null;
  }

  async saveRawSettings(settings: AppSettings): Promise<void> {
    await this.db.execute({
      sql: "INSERT INTO settings (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
      args: [JSON.stringify(settings)],
    });
  }

  async listShares(query: string, cursor: string): Promise<GuestAccessPage> {
    const offset = Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) throw Object.assign(new Error("Invalid cursor"), { status: 400 });
    const result = await this.db.execute({
      // instr performs a literal substring search, including %, _, and glob characters.
      sql: `SELECT email, created_at, expires_at FROM shares
        WHERE expires_at > ? AND hash != '' AND salt != '' AND instr(email, ?) > 0
        ORDER BY email LIMIT 51 OFFSET ?`,
      args: [Date.now(), query.toLowerCase(), offset],
    });
    return {
      entries: result.rows.slice(0, 50).map((row) => ({ email: String(row.email), createdAt: Number(row.created_at), expiresAt: Number(row.expires_at) })),
      nextCursor: result.rows.length > 50 ? String(offset + 50) : null,
    };
  }

  async updateShareExpiry(email: string, expiresAt: number): Promise<boolean> {
    const result = await this.db.execute({
      sql: "UPDATE shares SET expires_at = ? WHERE email = ? AND expires_at > ? AND hash != '' AND salt != ''",
      args: [expiresAt, email.toLowerCase(), Date.now()],
    });
    return result.rowsAffected === 1;
  }

  async getShare(email: string): Promise<ShareRecord | null> {
    const result = await this.db.execute({
      sql: "SELECT hash, salt, version, created_at, expires_at FROM shares WHERE email = ? AND expires_at > ? AND hash != '' AND salt != ''",
      args: [email.toLowerCase(), Date.now()],
    });
    const row = result.rows[0];
    return row ? { hash: String(row.hash), salt: String(row.salt), version: Number(row.version), createdAt: Number(row.created_at), expiresAt: Number(row.expires_at) } : null;
  }

  async putShare(email: string, record: ShareRecord, ttlSeconds: number): Promise<void> {
    const expiresAt = Math.min(record.expiresAt, Date.now() + Math.max(1, Math.floor(ttlSeconds)) * 1000);
    await this.db.execute({
      sql: `INSERT INTO shares (email, hash, salt, version, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, salt = excluded.salt,
          version = excluded.version, created_at = excluded.created_at, expires_at = excluded.expires_at`,
      args: [email.toLowerCase(), record.hash, record.salt, record.version, record.createdAt, expiresAt],
    });
  }

  async deleteShare(email: string): Promise<void> {
    await this.db.execute({ sql: "DELETE FROM shares WHERE email = ?", args: [email.toLowerCase()] });
  }
}
