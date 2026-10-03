import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as auth from "@/lib/auth";
import * as stores from "@/lib/store";
import { createTestDatabase } from "./helpers/database";
import type { DatabaseClient } from "@/lib/database";
import { initializeDatabase } from "@/lib/turso";
import { TursoStore } from "@/lib/turso-store";
import * as resend from "@/lib/resend";
import * as urls from "@/lib/urls";
import { signAccessToken } from "@/lib/access";
import { guestAccessExpiresAt, GUEST_DURATIONS } from "@/lib/guest-policy";
import { readSession, requireCanRead, requireMember } from "@/lib/session";
import { getSettings, invalidateSettingsCache, saveSettings } from "@/lib/settings";
import { getStore, resetStoreForTests } from "@/lib/store";
import { POST as share } from "@/app/api/share/route";
import { POST as login } from "@/app/api/guest/route";
import { PUT as settings } from "@/app/api/settings/route";
import { GET as listGuests, PATCH as manageGuest } from "@/app/api/settings/guests/route";
import { GET as config } from "@/app/api/config/route";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }) }));

function request(path: string, body: object, method = "POST") {
  return new NextRequest(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe.each(["memory", "turso"])("%s persistence", (backend) => {
let sqlClient: DatabaseClient | undefined;
beforeEach(async () => {
  vi.stubEnv("MOCK_MODE", "1");
  vi.stubEnv("ACCESS_PASSWORD", "test-member-password");
  vi.stubEnv("SETTINGS_SECRET", "");
  vi.stubEnv("DOMAINS", "kcpd.edu.pl,private.example");
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("VERCEL_URL", "");
  resetStoreForTests();
  invalidateSettingsCache();
  if (backend === "turso") {
    sqlClient = await createTestDatabase();
    await initializeDatabase(sqlClient);
    vi.spyOn(stores, "getStore").mockReturnValue(new TursoStore(sqlClient));
  }
  jar.clear();
  jar.set("tm_access", await signAccessToken("test-member-password"));
  await saveSettings({ ...await getSettings(), guestDomains: ["kcpd.edu.pl"], guestAccessDuration: "7d" });
});
afterEach(() => { sqlClient?.close(); sqlClient = undefined; vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("guest access routes", () => {
  it.each(GUEST_DURATIONS)("uses $label for storage, password and cookie expiry", async ({ value }) => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 8, 30, 12);
    vi.setSystemTime(now);
    // Refresh the member token after fixing the clock.
    jar.set("tm_access", await signAccessToken("test-member-password"));
    const res = await share(request("/api/share", { email: "student@kcpd.edu.pl", duration: value }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const expiry = guestAccessExpiresAt(value, now);
    expect(data.expiresAt).toBe(expiry);
    jar.clear();
    const signedIn = await login(request("/api/guest", { email: "student@kcpd.edu.pl", password: data.password }));
    expect(signedIn.status).toBe(200);
    expect((await signedIn.json()).sessionExpiresAt).toBe(expiry);
    expect(signedIn.cookies.get("tm_guest")?.maxAge).toBe((expiry - now) / 1000);
    jar.set("tm_guest", signedIn.cookies.get("tm_guest")!.value);
    expect((await readSession()).role).toBe("guest");
    await expect(requireCanRead("student@kcpd.edu.pl")).resolves.toMatchObject({ role: "guest" });
    await expect(requireCanRead("other@kcpd.edu.pl")).rejects.toThrow("Forbidden");
    await expect(requireMember()).rejects.toThrow("receive-only");
    vi.setSystemTime(expiry - 1);
    expect(await getStore().getShare("student@kcpd.edu.pl")).not.toBeNull();
    vi.setSystemTime(expiry);
    expect(await getStore().getShare("student@kcpd.edu.pl")).toBeNull();
    expect((await readSession()).role).toBe("none");
  });

  it("uses the configured default, rejects invalid durations and disallowed domains", async () => {
    const res = await share(request("/api/share", { email: "student@kcpd.edu.pl" }));
    const data = await res.json();
    expect(data.expiresAt - data.createdAt).toBe(7 * 86400_000);
    expect((await share(request("/api/share", { email: "student@private.example" }))).status).toBe(403);
    expect((await share(request("/api/share", { email: "other@kcpd.edu.pl", duration: "forever" }))).status).toBe(400);
    jar.clear();
    expect((await login(request("/api/guest", { email: "student@private.example", password: data.password }))).status).toBe(400);
    expect((await share(request("/api/share", { email: "other@kcpd.edu.pl" }))).status).toBe(401);
    expect((await (await config()).json()).domains).toEqual(["kcpd.edu.pl"]);
  });

  it("applies settings changes to new logins and existing sessions, while preserving expiry", async () => {
    const created = await (await share(request("/api/share", { email: "student@kcpd.edu.pl" }))).json();
    jar.clear();
    const signedIn = await login(request("/api/guest", { email: "student@kcpd.edu.pl", password: created.password }));
    jar.set("tm_guest", signedIn.cookies.get("tm_guest")!.value);
    expect((await readSession()).role).toBe("guest");
    const saved = await settings(request("/api/settings", { guestDomains: [], guestAccessDuration: "30d" }, "PUT"));
    expect(saved.status).toBe(200);
    expect((await readSession()).role).toBe("none");
    expect((await (await config()).json()).guestDomains).toEqual([]);
    expect((await getStore().getShare("student@kcpd.edu.pl"))?.expiresAt).toBe(created.expiresAt);
    expect((await login(request("/api/guest", { email: "student@kcpd.edu.pl", password: created.password }))).status).toBe(400);
    expect((await settings(request("/api/settings", { guestDomains: ["unconfigured.example"] }, "PUT"))).status).toBe(400);
    expect((await settings(request("/api/settings", { guestAccessDuration: 30 }, "PUT"))).status).toBe(400);
  });

  it("rotates with a new duration and permits revocation after disabling a domain", async () => {
    const email = "student@kcpd.edu.pl";
    const first = await (await share(request("/api/share", { email }))).json();
    const second = await (await share(request("/api/share", { email, action: "rotate", duration: "1d" }))).json();
    expect(second.version).toBe(first.version + 1);
    expect(second.expiresAt - second.createdAt).toBe(86400_000);
    await saveSettings({ ...await getSettings(), guestDomains: [] });
    expect((await share(request("/api/share", { email, action: "revoke" }))).status).toBe(200);
    expect(await getStore().getShare(email)).toBeNull();
  });
});


describe("admin guest management", () => {
  const list = (query = "") => listGuests(new NextRequest(`http://localhost/api/settings/guests?${query}`));
  const change = (body: object) => manageGuest(request("/api/settings/guests", body, "PATCH"));

  it("lists and searches legacy grants without exposing password material, including disabled domains", async () => {
    const store = getStore();
    for (const email of ["alice@kcpd.edu.pl", "bob@private.example"]) {
      await store.putShare(email, { hash: "hidden", salt: "secret", version: 1, createdAt: Date.now(), expiresAt: Date.now() + 60000 }, 60);
    }
    const all = await (await list()).json();
    expect(all.entries.map((entry: { email: string }) => entry.email)).toEqual(["alice@kcpd.edu.pl", "bob@private.example"]);
    expect(JSON.stringify(all)).not.toMatch(/hash|salt|hidden|secret|version/);
    expect((await (await list("q=ALICE")).json()).entries).toHaveLength(1);
    expect((await (await list("q=missing")).json()).entries).toEqual([]);
    expect((await (await list("q=*")).json()).entries).toEqual([]);
    expect((await list("cursor=bad")).status).toBe(400);
    expect((await change({ email: "bob@private.example", action: "revoke" })).status).toBe(200);
    expect(await store.getShare("bob@private.example")).toBeNull();
  });

  it("paginates all grants", async () => {
    const store = getStore();
    for (let i = 0; i < 53; i++) await store.putShare(`guest${i}@kcpd.edu.pl`, { hash: "h", salt: "s", version: 1, createdAt: Date.now(), expiresAt: Date.now() + 60000 }, 60);
    const first = await (await list()).json();
    expect(first.entries).toHaveLength(50);
    const second = await (await list(`cursor=${first.nextCursor}`)).json();
    expect(second.entries).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
  });

  it("requires member AND Settings authentication for reads and changes", async () => {
    vi.stubEnv("SETTINGS_SECRET", "locked-settings");
    expect((await list()).status).toBe(401);
    expect((await change({ email: "alice@kcpd.edu.pl", action: "revoke" })).status).toBe(401);
    vi.stubEnv("SETTINGS_SECRET", "");
    const created = await (await share(request("/api/share", { email: "alice@kcpd.edu.pl" }))).json();
    jar.clear();
    expect((await list()).status).toBe(401);
    const signedIn = await login(request("/api/guest", { email: "alice@kcpd.edu.pl", password: created.password }));
    jar.set("tm_guest", signedIn.cookies.get("tm_guest")!.value);
    expect((await list()).status).toBe(403);
    expect((await change({ email: "alice@kcpd.edu.pl", action: "revoke" })).status).toBe(403);
  });

  it("changes timeout without rotating the password and enforces shortened expiry on existing sessions", async () => {
    const email = "alice@kcpd.edu.pl";
    const created = await (await share(request("/api/share", { email, duration: "30d" }))).json();
    const oldRecord = await getStore().getShare(email);
    const signedIn = await login(request("/api/guest", { email, password: created.password }));
    const guestToken = signedIn.cookies.get("tm_guest")!.value;
    const shortened = await (await change({ email, action: "timeout", duration: "1d" })).json();
    expect(await getStore().getShare(email)).toEqual({ ...oldRecord, expiresAt: shortened.expiresAt });
    jar.clear();
    jar.set("tm_guest", guestToken);
    expect((await readSession()).sessionExpiresAt).toBe(shortened.expiresAt);
    vi.useFakeTimers();
    vi.setSystemTime(shortened.expiresAt);
    expect((await readSession()).role).toBe("none");
  });

  it("extends access, rejects invalid/expired edits, and never revives a revoked cookie", async () => {
    const email = "alice@kcpd.edu.pl";
    const first = await (await share(request("/api/share", { email, duration: "1d" }))).json();
    const signedIn = await login(request("/api/guest", { email, password: first.password }));
    const token = signedIn.cookies.get("tm_guest")!.value;
    const extended = await (await change({ email, action: "timeout", duration: "6m" })).json();
    expect(extended.expiresAt).toBeGreaterThan(first.expiresAt);
    expect((await login(request("/api/guest", { email, password: first.password }))).status).toBe(200);
    expect((await change({ email, action: "timeout", duration: "forever" })).status).toBe(400);
    await change({ email, action: "revoke" });
    expect((await change({ email, action: "timeout", duration: "3d" })).status).toBe(404);
    await share(request("/api/share", { email }));
    jar.clear();
    jar.set("tm_guest", token);
    expect((await readSession()).role).toBe("none");
  });
});


describe("independent guest settings save", () => {
  it("saves guest policy even when the mail integration is unavailable", async () => {
    await saveSettings({ ...await getSettings(), resendApiKey: "re_test", appUrl: "https://mail.example" });
    vi.stubEnv("MOCK_MODE", "0");
    vi.spyOn(auth, "requireSettingsAuth").mockResolvedValue();
    const resolve = vi.spyOn(urls, "resolveCanonicalAppUrl").mockRejectedValue(new Error("Mail endpoint unavailable"));
    const register = vi.spyOn(resend, "registerInboundWebhook").mockRejectedValue(new Error("Resend unavailable"));
    const result = await settings(request("/api/settings", { guestDomains: ["kcpd.edu.pl"], guestAccessDuration: "30d" }, "PUT"));
    expect(result.status).toBe(200);
    expect((await getSettings()).guestAccessDuration).toBe("30d");
    expect(resolve).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect((await getSettings()).resendApiKey).toBe("re_test");
    const mailSave = await settings(request("/api/settings", { appUrl: "https://new.example" }, "PUT"));
    expect(mailSave.status).toBe(500);
    expect(resolve).toHaveBeenCalled();
  });
});


it("preserves fresh settings from another instance when saving guest policy", async () => {
  const stale = await getSettings();
  await getStore().saveRawSettings({ ...stale, maxMessagesPerInbox: 99 });
  const result = await settings(request("/api/settings", { guestAccessDuration: "30d" }, "PUT"));
  expect(result.status).toBe(200);
  expect((await getSettings()).maxMessagesPerInbox).toBe(99);
});

});
