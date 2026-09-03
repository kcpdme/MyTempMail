import { describe, expect, it } from "vitest";
import { signGuestToken, verifyGuestToken } from "@/lib/guest-session";
import { isGuestAllowedRequest, isAlwaysPublicPath } from "@/lib/guest-paths";
import { dummyVerify, generateGuestPassword, hashPassword, verifyPassword } from "@/lib/passwords";
import { GUEST_SESSION_SECONDS, SHARE_TTL_SECONDS, guestSessionMaxAgeSeconds, isShareActive } from "@/lib/share";

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
  it("caps a session at 30 minutes and never past the 3 hour password", () => {
    expect(SHARE_TTL_SECONDS).toBe(3 * 3600);
    expect(GUEST_SESSION_SECONDS).toBe(1800);
    const now = 1_700_000_000_000;
    expect(guestSessionMaxAgeSeconds(now + 4 * 3600 * 1000, now)).toBe(1800);
    expect(guestSessionMaxAgeSeconds(now + 10 * 60 * 1000, now)).toBe(600);
    expect(guestSessionMaxAgeSeconds(now - 1000, now)).toBe(0);
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
