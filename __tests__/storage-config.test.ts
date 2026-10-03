import { afterEach, describe, expect, it, vi } from "vitest";
import { isMockMode } from "@/lib/env";
import { GET } from "@/app/api/cron/cleanup/route";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
import * as turso from "@/lib/turso";
import { createTestDatabase } from "./helpers/database";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("production storage configuration", () => {
  it("never falls back to mock mode in production or with partial configuration", () => {
    vi.stubEnv("MOCK_MODE", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isMockMode()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TURSO_AUTH_TOKEN", "token");
    expect(isMockMode()).toBe(false);
    vi.stubEnv("MOCK_MODE", "1");
    expect(isMockMode()).toBe(true);
  });

  it("blocks deliveries during maintenance and bypasses cookie auth only for the cron route", async () => {
    vi.stubEnv("STORAGE_MAINTENANCE", "1");
    expect((await proxy(new NextRequest("https://mail.example/api/webhooks/resend", { method: "POST" }))).status).toBe(503);
    vi.stubEnv("STORAGE_MAINTENANCE", "0");
    vi.stubEnv("ACCESS_PASSWORD", "member-only");
    const response = await proxy(new NextRequest("https://mail.example/api/cron/cleanup"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("requires a cron secret, rejects wrong tokens, and runs cleanup only when authorized", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://mail.example/api/cron/cleanup"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "secret");
    expect((await GET(new Request("https://mail.example/api/cron/cleanup"))).status).toBe(401);
    const db = await createTestDatabase();
    try {
      await turso.initializeDatabase(db);
      vi.spyOn(turso, "getTurso").mockReturnValue(db);
      const response = await GET(new Request("https://mail.example/api/cron/cleanup", { headers: { authorization: "Bearer secret" } }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: 0, more: false });
    } finally { db.close(); }
  });
});
