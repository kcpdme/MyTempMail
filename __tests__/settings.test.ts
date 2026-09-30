import { describe, expect, it } from "vitest";
import { guestDomainAllowlist, validateGuestDomains } from "@/lib/guest-policy";
import { overlay, publicConfig } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";

const base: AppSettings = {
  resendApiKey: "re_env",
  resendWebhookSecret: "whsec_env",
  resendWebhookId: "",
  domains: [{ name: "from-env.com", status: "env" }],
  guestDomains: [],
  guestAccessDuration: "3d",
  inboxTtlSeconds: 86400,
  maxMessagesPerInbox: 50,
  appUrl: "https://env.example",
};

describe("settings overlay", () => {
  it("prefers stored values over env defaults", () => {
    const merged = overlay(base, {
      resendApiKey: "re_portal",
      domains: [{ name: "Mail.Example.COM" }],
      inboxTtlSeconds: 3600,
    });
    expect(merged.resendApiKey).toBe("re_portal");
    expect(merged.resendWebhookSecret).toBe("whsec_env");
    expect(merged.domains[0].name).toBe("mail.example.com");
    expect(merged.inboxTtlSeconds).toBe(3600);
    expect(merged.appUrl).toBe("https://env.example");
  });

  it("keeps env domains when store has none", () => {
    const merged = overlay(base, { resendApiKey: "re_portal", domains: [] });
    expect(merged.domains.map((d) => d.name)).toEqual(["from-env.com"]);
  });
});


describe("guest settings", () => {
  it("requires explicit selection on existing installations", () => {
    const settings = overlay(base, { domains: [{ name: "kcpd.edu.pl" }] });
    expect(settings.guestDomains).toEqual([]);
    expect(settings.guestAccessDuration).toBe("3d");
  });

  it("keeps an explicit empty selection and ignores removed domains", () => {
    expect(overlay({ ...base, guestDomains: ["from-env.com"] }, { guestDomains: [] }).guestDomains).toEqual([]);
    const settings = overlay(base, { guestDomains: ["from-env.com", "removed.com"], guestAccessDuration: "6m" });
    expect(guestDomainAllowlist(settings)).toEqual(["from-env.com"]);
    expect(publicConfig(settings).guestDomains).toEqual(["from-env.com"]);
    expect(settings.guestAccessDuration).toBe("6m");
  });

  it("validates domain selection and normalizes case", () => {
    expect(validateGuestDomains(["FROM-ENV.COM", "from-env.com"], base)).toEqual(["from-env.com"]);
    expect(validateGuestDomains([], base)).toEqual([]);
    for (const value of [null, "from-env.com", [1], ["other.com"]]) {
      expect(() => validateGuestDomains(value, base)).toThrow();
    }
  });
});
