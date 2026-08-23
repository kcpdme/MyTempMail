import { describe, expect, it } from "vitest";
import { incomingToStored, recipientsForInbox } from "@/lib/normalize";
import { originFromRedirect, webhookEndpoint } from "@/lib/urls";
import type { IncomingEmail } from "@/lib/types";

const incoming: IncomingEmail = {
  id: "email_1",
  from: "Shop <shop@store.com>",
  to: ["Ada Lovelace <ada@mail.example.com>"],
  cc: ["other@elsewhere.com"],
  receivedFor: ["ada@mail.example.com"],
  subject: "Your code",
  html: "<p>123456</p>",
  text: "123456",
  headers: { "message-id": "<mid@store.com>", references: "<prev@store.com>" },
  messageId: "<mid@store.com>",
  receivedAt: "2026-01-01T00:00:00.000Z",
  attachments: [],
};

describe("normalize", () => {
  it("keeps threading ids on stored messages", () => {
    const stored = incomingToStored(incoming);
    expect(stored.id).toBe("email_1");
    expect(stored.messageId).toBe("<mid@store.com>");
    expect(stored.references).toBe("<prev@store.com>");
    expect(stored.snippet).toBe("123456");
  });

  it("stores only recipients on configured domains", () => {
    const recipients = recipientsForInbox(incoming, ["mail.example.com"]);
    expect(recipients).toEqual(["ada@mail.example.com"]);
  });

  it("still stores received_for when the allowlist is stale", () => {
    const recipients = recipientsForInbox(
      { to: ["other@gmail.com"], cc: [], receivedFor: ["kcpd@check-my.email"] },
      ["mail.example.com"],
    );
    expect(recipients).toEqual(["kcpd@check-my.email"]);
  });

  it("builds a trailing-slash-free webhook URL", () => {
    expect(webhookEndpoint("https://check-my.email/")).toBe("https://check-my.email/api/webhooks/resend");
  });

  it("follows apex-to-www webhook redirects", () => {
    expect(
      originFromRedirect(
        "https://www.check-my.email/api/webhooks/resend",
        "https://check-my.email/api/webhooks/resend",
      ),
    ).toBe("https://www.check-my.email");
  });
});
