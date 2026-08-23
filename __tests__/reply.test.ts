import { describe, expect, it } from "vitest";
import { buildReplyDraft, replyHeaders, replySubject } from "@/lib/reply";

describe("reply", () => {
  it("prefixes Re: once", () => {
    expect(replySubject("Hello")).toBe("Re: Hello");
    expect(replySubject("Re: Hello")).toBe("Re: Hello");
  });

  it("quotes previous text", () => {
    const draft = buildReplyDraft({
      from: "Ada <ada@example.com>",
      receivedAt: "2026-01-01T00:00:00.000Z",
      subject: "Codes",
      text: "line one\nline two",
    });
    expect(draft.to).toBe("Ada <ada@example.com>");
    expect(draft.subject).toBe("Re: Codes");
    expect(draft.quoted).toContain("--- Original Message ---");
    expect(draft.quoted).toContain("line one");
    expect(draft.quoted).toContain("line two");
  });

  it("builds threading headers", () => {
    expect(replyHeaders("<a@x>", "<b@x>")).toEqual({
      "In-Reply-To": "<a@x>",
      References: "<b@x> <a@x>",
    });
  });
});
