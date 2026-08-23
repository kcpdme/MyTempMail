import { getRedis } from "@/lib/redis";
import { isMockMode } from "@/lib/env";
import { toSummary } from "@/lib/normalize";
import type { AppSettings, InboxSummary, StoredMessage } from "@/lib/types";

const SETTINGS_KEY = "app:settings";
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
};

type MemoryState = {
  inboxes: Map<string, InboxSummary[]>;
  messages: Map<string, { message: StoredMessage; expiresAt: number }>;
  settings: AppSettings | null;
};

function globalMemory(): MemoryState {
  const g = globalThis as typeof globalThis & { __tmMemory?: MemoryState };
  if (!g.__tmMemory) {
    g.__tmMemory = {
      inboxes: new Map(),
      messages: new Map(),
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
}

class RedisStore implements MailStore {
  private redis = getRedis();

  async listInbox(email: string): Promise<InboxSummary[]> {
    const list = await this.redis.get<InboxSummary[]>(inboxKey(email));
    return Array.isArray(list) ? list : [];
  }

  async getMessage(email: string, id: string): Promise<StoredMessage | null> {
    const message = await this.redis.get<StoredMessage>(messageKey(email, id));
    return message ?? null;
  }

  async saveMessage(
    email: string,
    message: StoredMessage,
    opts: { ttlSeconds: number; maxMessages: number },
  ): Promise<void> {
    const ttl = opts.ttlSeconds || TTL_DEFAULT;
    const max = opts.maxMessages || MAX_DEFAULT;
    const listKey = inboxKey(email);
    const existing = (await this.redis.get<InboxSummary[]>(listKey)) ?? [];
    const list = existing.filter((m) => m.id !== message.id);
    list.unshift(toSummary(message));
    const trimmed = list.slice(0, max);
    const dropped = list.slice(max);
    const pipe = this.redis.pipeline();
    pipe.set(listKey, trimmed, { ex: ttl });
    pipe.set(messageKey(email, message.id), message, { ex: ttl });
    for (const item of dropped) {
      pipe.del(messageKey(email, item.id));
    }
    await pipe.exec();
  }

  async deleteMessage(email: string, id: string): Promise<void> {
    const listKey = inboxKey(email);
    const existing = (await this.redis.get<InboxSummary[]>(listKey)) ?? [];
    const next = existing.filter((m) => m.id !== id);
    const pipe = this.redis.pipeline();
    if (next.length) {
      pipe.set(listKey, next, { ex: TTL_DEFAULT });
    } else {
      pipe.del(listKey);
    }
    pipe.del(messageKey(email, id));
    await pipe.exec();
  }

  async clearInbox(email: string): Promise<void> {
    const listKey = inboxKey(email);
    const existing = (await this.redis.get<InboxSummary[]>(listKey)) ?? [];
    const pipe = this.redis.pipeline();
    pipe.del(listKey);
    for (const item of existing) {
      pipe.del(messageKey(email, item.id));
    }
    await pipe.exec();
  }

  async getRawSettings(): Promise<Partial<AppSettings> | null> {
    return (await this.redis.get<Partial<AppSettings>>(SETTINGS_KEY)) ?? null;
  }

  async saveRawSettings(settings: AppSettings): Promise<void> {
    await this.redis.set(SETTINGS_KEY, settings);
  }
}

let store: MailStore | null = null;

export function getStore(): MailStore {
  if (store) return store;
  store = isMockMode() ? new MemoryStore() : new RedisStore();
  return store;
}

export function resetStoreForTests(): void {
  store = null;
  const g = globalThis as typeof globalThis & { __tmMemory?: MemoryState };
  delete g.__tmMemory;
}
