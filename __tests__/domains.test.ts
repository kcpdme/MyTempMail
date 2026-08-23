import { describe, expect, it } from "vitest";
import {
  assertDisposableAddress,
  isValidLocalPart,
  normalizeEmail,
  parseEmail,
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
});
