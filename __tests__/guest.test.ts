import { describe, expect, it } from "vitest";
import { signGuestToken, verifyGuestToken } from "@/lib/guest-session";
import { isGuestAllowedRequest, isAlwaysPublicPath } from "@/lib/guest-paths";
import { dummyVerify, generateGuestPassword, hashPassword, verifyPassword } from "@/lib/passwords";
import { guestSessionMaxAgeSeconds, isShareActive } from "@/lib/share";
import { guestAccessExpiresAt, isGuestDuration } from "@/lib/guest-policy";
import { formatCountdown } from "@/lib/utils";

describe("guest passwords", () => {
  it("hashes and verifies a password", async () => {
    const { hash, salt } = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", hash, salt)).toBe(true);
    expect(await verifyPassword("wrong-password", hash, salt)).toBe(false);
  });

  it("generates an unambiguous password", () => {
    const password = generateGuestPassword();
    expect(password).toHaveLength(16);
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
  });

  it("dummyVerify completes", async () => {
    await dummyVerify("anything");
  });
});

describe("guest session cookie", () => {
  it("round-trips claims", async () => {
    const exp = Date.now() + 60_000;
    const token = await signGuestToken({ email: "calm.otter@example.test", version: 2, exp }, "secret");
    const claims = await verifyGuestToken(token, "secret");
    expect(claims).toEqual({ email: "calm.otter@example.test", version: 2, exp });
  });

  it("rejects a bad secret, expiry, or mangled token", async () => {
    const exp = Date.now() + 60_000;
    const token = await signGuestToken({ email: "a@example.test", version: 1, exp }, "secret");
    expect(await verifyGuestToken(token, "other")).toBeNull();
    expect(await verifyGuestToken("1.not.a.token", "secret")).toBeNull();
    const expired = await signGuestToken({ email: "a@example.test", version: 1, exp: Date.now() - 1 }, "secret");
    expect(await verifyGuestToken(expired, "secret")).toBeNull();
    const claims = await verifyGuestToken(token, "secret");
    expect(claims?.version).toBe(1);
    const tampered = token.replace(/^1\./, "2.");
    expect(await verifyGuestToken(tampered, "secret")).toBeNull();
  });
});

describe("guest clocks", () => {
  it("lasts until the guest password expires, including long grants", () => {
    const threeDays = 3 * 24 * 3600;
    const now = 1_700_000_000_000;
    expect(guestSessionMaxAgeSeconds(now + 30 * 24 * 3600 * 1000, now)).toBe(30 * 24 * 3600);
    expect(guestSessionMaxAgeSeconds(now + 10 * 60 * 1000, now)).toBe(600);
    expect(guestSessionMaxAgeSeconds(now - 1000, now)).toBe(0);
    expect(formatCountdown(threeDays * 1000)).toBe("3d 0h");
  });

  it("treats expired share records as inactive", () => {
    expect(
      isShareActive({
        hash: "aa",
        salt: "bb",
        version: 1,
        createdAt: 1,
        expiresAt: Date.now() - 1,
      }),
    ).toBe(false);
  });
});

describe("guest path policy", () => {
  it("keeps login, config, session, and guest APIs public", () => {
    expect(isAlwaysPublicPath("/login")).toBe(true);
    expect(isAlwaysPublicPath("/api/config")).toBe(true);
    expect(isAlwaysPublicPath("/api/session")).toBe(true);
    expect(isAlwaysPublicPath("/api/guest")).toBe(true);
    expect(isAlwaysPublicPath("/api/share")).toBe(false);
  });

  it("allows guests to read inbox and forbids send", () => {
    expect(isGuestAllowedRequest("GET", "/")).toBe(true);
    expect(isGuestAllowedRequest("GET", "/api/inbox")).toBe(true);
    expect(isGuestAllowedRequest("GET", "/api/inbox/abc")).toBe(true);
    expect(isGuestAllowedRequest("DELETE", "/api/inbox")).toBe(false);
    expect(isGuestAllowedRequest("POST", "/api/send")).toBe(false);
    expect(isGuestAllowedRequest("POST", "/api/share")).toBe(false);
  });
});


describe("guest duration options", () => {
  it.each([["1d", 1], ["3d", 3], ["7d", 7], ["30d", 30]] as const)("expires %s after the chosen days", (duration, days) => {
    const now = Date.UTC(2026, 8, 30, 12);
    expect(guestAccessExpiresAt(duration, now)).toBe(now + days * 86400_000);
  });

  it.each([
    ["2026-08-31T12:30:00.000Z", "2027-02-28T12:30:00.000Z"],
    ["2027-08-31T12:30:00.000Z", "2028-02-29T12:30:00.000Z"],
    ["2026-09-30T12:30:00.000Z", "2027-03-30T12:30:00.000Z"],
  ])("adds six calendar months to %s", (start, expected) => {
    expect(new Date(guestAccessExpiresAt("6m", Date.parse(start))).toISOString()).toBe(expected);
  });

  it("rejects unsupported duration values", () => {
    for (const value of [0, -1, "365d", null, {}, "", "3"]) expect(isGuestDuration(value)).toBe(false);
  });
});
