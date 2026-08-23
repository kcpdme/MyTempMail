import { describe, expect, it } from "vitest";
import {
  assertDisposableAddress,
  domainCardStartsCollapsed,
  isValidLocalPart,
  normalizeEmail,
  parseEmail,
  pickExistingResendDomain,
} from "@/lib/domains";

describe("domains", () => {
  it("extracts and lowercases addresses", () => {
    expect(normalizeEmail("Name <Bob@Mail.Example.COM>")).toBe("bob@mail.example.com");
    expect(parseEmail("user@mail.example.com")).toEqual({
      local: "user",
      domain: "mail.example.com",
    });
  });

  it("rejects reserved and malformed local parts", () => {
    expect(isValidLocalPart("admin")).toBe(false);
    expect(isValidLocalPart("no-reply")).toBe(false);
    expect(isValidLocalPart("bad..dot")).toBe(false);
    expect(isValidLocalPart("ok.user-1")).toBe(true);
  });

  it("allowlists configured domains only", () => {
    const ok = assertDisposableAddress("alice@mail.example.com", ["mail.example.com"]);
    expect(ok.email).toBe("alice@mail.example.com");
    expect(() => assertDisposableAddress("alice@gmail.com", ["mail.example.com"])).toThrow(
      /not configured/,
    );
  });

  it("prefers a verified Resend domain when names collide", () => {
    const picked = pickExistingResendDomain(
      [
        { name: "Mail.Example.com", status: "not_started", id: "old" },
        { name: "mail.example.com", status: "verified", id: "good" },
      ],
      "MAIL.EXAMPLE.COM",
    );
    expect(picked?.id).toBe("good");
  });

  it("collapses verified domain cards and mock rows without DNS", () => {
    expect(domainCardStartsCollapsed({ status: "verified", records: [{ type: "MX" }] })).toBe(true);
    expect(domainCardStartsCollapsed({ status: "pending", records: [{ type: "MX" }] })).toBe(false);
    expect(domainCardStartsCollapsed({ status: "mock" })).toBe(true);
  });
});
