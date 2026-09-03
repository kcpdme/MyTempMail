import { describe, expect, it } from "vitest";
import { isAddressFresh, pruneExpiredAddressTabs } from "@/hooks/useAddresses";

describe("pruneExpiredAddressTabs", () => {
  const ttl = 86_400;
  const now = 1_000_000_000_000;

  it("drops tabs whose createdAt plus TTL has passed", () => {
    const pruned = pruneExpiredAddressTabs(
      ["fresh@mail.test", "old@mail.test"],
      { "fresh@mail.test": now - 1_000, "old@mail.test": now - ttl * 1000 },
      ttl,
      now,
    );
    expect(pruned.addresses).toEqual(["fresh@mail.test"]);
    expect(pruned.createdAt).toEqual({ "fresh@mail.test": now - 1_000 });
  });

  it("keeps tabs that have no createdAt", () => {
    const pruned = pruneExpiredAddressTabs(["legacy@mail.test"], {}, ttl, now);
    expect(pruned.addresses).toEqual(["legacy@mail.test"]);
    expect(pruned.createdAt).toEqual({});
  });
});

describe("isAddressFresh", () => {
  it("treats the exact expiry instant as expired", () => {
    const ttl = 60;
    const createdAt = 1_000;
    expect(isAddressFresh(createdAt, ttl, createdAt + ttl * 1000)).toBe(false);
    expect(isAddressFresh(createdAt, ttl, createdAt + ttl * 1000 - 1)).toBe(true);
  });
});
