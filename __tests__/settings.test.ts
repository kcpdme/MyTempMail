import { describe, expect, it } from "vitest";
import { overlay } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";

const base: AppSettings = {
  resendApiKey: "re_env",
  resendWebhookSecret: "whsec_env",
  resendWebhookId: "",
  domains: [{ name: "from-env.com", status: "env" }],
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
