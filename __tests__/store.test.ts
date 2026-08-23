import { beforeEach, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/store";
import type { StoredMessage } from "@/lib/types";

function msg(id: string, receivedAt: string): StoredMessage {
  return {
    id,
    from: "a@b.com",
    to: ["user@example.test"],
    subject: id,
    receivedAt,
    snippet: id,
    hasHtml: false,
    html: "",
    text: id,
    messageId: `<${id}@x>`,
    references: "",
    cc: [],
    headers: {},
    attachments: [],
  };
}

describe("store", () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it("saves, lists, reads, and deletes messages", async () => {
    const store = getStore();
    const email = "user@example.test";
    await store.saveMessage(email, msg("one", "2026-01-01T00:00:00.000Z"), {
      ttlSeconds: 86400,
      maxMessages: 50,
    });
    await store.saveMessage(email, msg("two", "2026-01-01T00:01:00.000Z"), {
      ttlSeconds: 86400,
      maxMessages: 50,
    });
    const list = await store.listInbox(email);
    expect(list.map((m) => m.id)).toEqual(["two", "one"]);
    expect((await store.getMessage(email, "two"))?.text).toBe("two");
    await store.deleteMessage(email, "two");
    expect(await store.getMessage(email, "two")).toBeNull();
    expect((await store.listInbox(email)).map((m) => m.id)).toEqual(["one"]);
  });

  it("is idempotent on the same email id and trims the cap", async () => {
    const store = getStore();
    const email = "user@example.test";
    await store.saveMessage(email, msg("one", "2026-01-01T00:00:00.000Z"), {
      ttlSeconds: 86400,
      maxMessages: 2,
    });
    await store.saveMessage(email, { ...msg("one", "2026-01-01T00:00:00.000Z"), text: "updated" }, {
      ttlSeconds: 86400,
      maxMessages: 2,
    });
    await store.saveMessage(email, msg("two", "2026-01-01T00:02:00.000Z"), {
      ttlSeconds: 86400,
      maxMessages: 2,
    });
    await store.saveMessage(email, msg("three", "2026-01-01T00:03:00.000Z"), {
      ttlSeconds: 86400,
      maxMessages: 2,
    });
    const list = await store.listInbox(email);
    expect(list.map((m) => m.id)).toEqual(["three", "two"]);
    expect(await store.getMessage(email, "one")).toBeNull();
  });
});
