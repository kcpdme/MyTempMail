import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/lib/access";
import { guestAccessExpiresAt, GUEST_DURATIONS } from "@/lib/guest-policy";
import { readSession, requireCanRead, requireMember } from "@/lib/session";
import { getSettings, invalidateSettingsCache, saveSettings } from "@/lib/settings";
import { getStore, resetStoreForTests } from "@/lib/store";
import { POST as share } from "@/app/api/share/route";
import { POST as login } from "@/app/api/guest/route";
import { PUT as settings } from "@/app/api/settings/route";
import { GET as config } from "@/app/api/config/route";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }) }));

function request(path: string, body: object, method = "POST") {
  return new NextRequest(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(async () => {
  vi.stubEnv("MOCK_MODE", "1");
  vi.stubEnv("ACCESS_PASSWORD", "test-member-password");
  vi.stubEnv("SETTINGS_SECRET", "");
  vi.stubEnv("DOMAINS", "kcpd.edu.pl,private.example");
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("VERCEL_URL", "");
  resetStoreForTests();
  invalidateSettingsCache();
  jar.clear();
  jar.set("tm_access", await signAccessToken("test-member-password"));
  await saveSettings({ ...await getSettings(), guestDomains: ["kcpd.edu.pl"], guestAccessDuration: "7d" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

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
