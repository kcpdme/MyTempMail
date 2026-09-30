import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/store";

const redis = vi.hoisted(() => ({ scan: vi.fn(), mget: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));

beforeEach(() => { vi.stubEnv("MOCK_MODE", "0"); resetStoreForTests(); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllEnvs());

describe("Redis guest discovery", () => {
  it("finds older share keys across empty scan batches, ignoring expired and duplicate entries", async () => {
    redis.scan.mockResolvedValueOnce(["12", []]).mockResolvedValueOnce(["0", ["share:alice@example.test", "share:gone@example.test", "share:alice@example.test", "share:expired@example.test"]]);
    const active = { hash: "private", salt: "private", version: 1, createdAt: 1, expiresAt: Date.now() + 60000 };
    redis.mget.mockResolvedValueOnce([active, null, active, { ...active, expiresAt: 1 }]);
    const result = await getStore().listShares("example", "0");
    expect(result).toEqual({ entries: [{ email: "alice@example.test", createdAt: 1, expiresAt: active.expiresAt }], nextCursor: null });
    expect(redis.scan).toHaveBeenNthCalledWith(2, "12", { match: "share:*example*", count: 100 });
  });

  it("bounds sparse scans and returns a cursor to continue", async () => {
    redis.scan.mockResolvedValue(["88", []]);
    expect(await getStore().listShares("missing", "0")).toEqual({ entries: [], nextCursor: "88" });
    expect(redis.scan).toHaveBeenCalledTimes(10);
    expect(redis.mget).not.toHaveBeenCalled();
  });

  it("treats search glob characters literally", async () => {
    redis.scan.mockResolvedValue(["0", []]);
    await getStore().listShares("*?[x]", "0");
    expect(redis.scan).toHaveBeenCalledWith("0", { match: "share:*\\*\\?\\[x\\]*", count: 100 });
  });
});
