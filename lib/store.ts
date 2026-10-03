import { getTurso } from "@/lib/turso";
import { TursoStore } from "@/lib/turso-store";
import { isMockMode } from "@/lib/env";
import { toSummary } from "@/lib/normalize";
import { isShareActive, shareKey } from "@/lib/share";
import type { AppSettings, GuestAccessPage, InboxSummary, ShareRecord, StoredMessage } from "@/lib/types";

const MAX_DEFAULT = 50;
const TTL_DEFAULT = 86400;

export function inboxKey(email: string): string {
  return `inbox:${email.toLowerCase()}`;
}

export function messageKey(email: string, id: string): string {
  return `msg:${email.toLowerCase()}:${id}`;
}

export type MailStore = {
  listInbox(email: string): Promise<InboxSummary[]>;
  getMessage(email: string, id: string): Promise<StoredMessage | null>;
  saveMessage(
    email: string,
    message: StoredMessage,
    opts: { ttlSeconds: number; maxMessages: number },
  ): Promise<void>;
  deleteMessage(email: string, id: string): Promise<void>;
  clearInbox(email: string): Promise<void>;
  getRawSettings(): Promise<Partial<AppSettings> | null>;
  saveRawSettings(settings: AppSettings): Promise<void>;
  listShares(query: string, cursor: string): Promise<GuestAccessPage>;
  updateShareExpiry(email: string, expiresAt: number): Promise<boolean>;
  getShare(email: string): Promise<ShareRecord | null>;
  putShare(email: string, record: ShareRecord, ttlSeconds: number): Promise<void>;
  deleteShare(email: string): Promise<void>;
};

type MemoryState = {
  inboxes: Map<string, InboxSummary[]>;
  messages: Map<string, { message: StoredMessage; expiresAt: number }>;
  shares: Map<string, ShareRecord>;
  settings: AppSettings | null;
};

function globalMemory(): MemoryState {
  const g = globalThis as typeof globalThis & { __tmMemory?: MemoryState };
  if (!g.__tmMemory) {
    g.__tmMemory = {
      inboxes: new Map(),
      messages: new Map(),
      shares: new Map(),
      settings: null,
    };
  }
  return g.__tmMemory;
}

class MemoryStore implements MailStore {
  private get state(): MemoryState {
    return globalMemory();
  }
  async listInbox(email: string): Promise<InboxSummary[]> {
    const key = inboxKey(email);
    const list = (this.state.inboxes.get(key) ?? []).filter((item) => {
      const entry = this.state.messages.get(messageKey(email, item.id));
      return Boolean(entry && entry.expiresAt >= Date.now());
    });
    this.state.inboxes.set(key, list);
    return list;
  }

  async getMessage(email: string, id: string): Promise<StoredMessage | null> {
    const entry = this.state.messages.get(messageKey(email, id));
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.state.messages.delete(messageKey(email, id));
      return null;
    }
    return entry.message;
  }

  async saveMessage(
    email: string,
    message: StoredMessage,
    opts: { ttlSeconds: number; maxMessages: number },
  ): Promise<void> {
    const key = inboxKey(email);
    const ttl = opts.ttlSeconds || TTL_DEFAULT;
    const max = opts.maxMessages || MAX_DEFAULT;
    const expiresAt = Date.now() + ttl * 1000;
    let list = (this.state.inboxes.get(key) ?? []).filter((m) => m.id !== message.id);
    list.unshift(toSummary(message));
    list = list.slice(0, max);
    this.state.inboxes.set(key, list);
    this.state.messages.set(messageKey(email, message.id), { message, expiresAt });
    const keep = new Set(list.map((m) => m.id));
    for (const [mk] of this.state.messages) {
      if (mk.startsWith(`msg:${email.toLowerCase()}:`)) {
        const id = mk.split(":").slice(2).join(":");
        if (!keep.has(id)) this.state.messages.delete(mk);
      }
    }
  }

  async deleteMessage(email: string, id: string): Promise<void> {
    const key = inboxKey(email);
    const list = (this.state.inboxes.get(key) ?? []).filter((m) => m.id !== id);
    this.state.inboxes.set(key, list);
    this.state.messages.delete(messageKey(email, id));
  }

  async clearInbox(email: string): Promise<void> {
    const key = inboxKey(email);
    const list = this.state.inboxes.get(key) ?? [];
    this.state.inboxes.delete(key);
    for (const item of list) {
      this.state.messages.delete(messageKey(email, item.id));
    }
  }

  async getRawSettings(): Promise<Partial<AppSettings> | null> {
    return this.state.settings;
  }

  async saveRawSettings(settings: AppSettings): Promise<void> {
    this.state.settings = settings;
  }

  async listShares(query: string, cursor: string): Promise<GuestAccessPage> {
    const entries = [...this.state.shares.entries()]
      .filter(([key, record]) => key.slice(6).includes(query) && isShareActive(record))
      .map(([key, record]) => ({ email: key.slice(6), createdAt: record.createdAt, expiresAt: record.expiresAt }))
      .sort((a, b) => a.email.localeCompare(b.email));
    const offset = Number(cursor);
    return { entries: entries.slice(offset, offset + 50), nextCursor: offset + 50 < entries.length ? String(offset + 50) : null };
  }

  async updateShareExpiry(email: string, expiresAt: number): Promise<boolean> {
    const key = shareKey(email);
    const record = this.state.shares.get(key);
    if (!isShareActive(record)) return false;
    this.state.shares.set(key, { ...record, expiresAt });
    return true;
  }

  async getShare(email: string): Promise<ShareRecord | null> {
    const record = this.state.shares.get(shareKey(email)) ?? null;
    if (!isShareActive(record)) {
      if (record) this.state.shares.delete(shareKey(email));
      return null;
    }
    return record;
  }

  async putShare(email: string, record: ShareRecord, ttlSeconds: number): Promise<void> {
    void ttlSeconds;
    this.state.shares.set(shareKey(email), record);
  }

  async deleteShare(email: string): Promise<void> {
    this.state.shares.delete(shareKey(email));
  }
}

let store: MailStore | null = null;

export function getStore(): MailStore {
  if (store) return store;
  store = isMockMode() ? new MemoryStore() : new TursoStore(getTurso());
  return store;
}

export function resetStoreForTests(): void {
  store = null;
  const g = globalThis as typeof globalThis & { __tmMemory?: MemoryState };
  delete g.__tmMemory;
}
