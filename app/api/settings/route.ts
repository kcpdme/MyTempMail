import { NextRequest } from "next/server";
import {
  clearSettingsCookie,
  isSettingsAuthed,
  requireSettingsAuth,
  setSettingsCookie,
  settingsAuthConfigured,
  settingsUnlockedWithoutSecret,
  verifySettingsPassword,
} from "@/lib/auth";
import { HttpError } from "@/lib/domains";
import { isMockMode } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { registerInboundWebhook } from "@/lib/resend";
import { getSettings, maskKey, saveSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";
import { webhookEndpoint } from "@/lib/urls";

export const dynamic = "force-dynamic";

function publicSettings(settings: AppSettings) {
  const key = maskKey(settings.resendApiKey);
  return {
    mockMode: isMockMode(),
    unlocked: true,
    needsSecret: !settingsAuthConfigured(),
    resendApiKeySet: key.set,
    resendApiKeyLast4: key.last4,
    webhookConfigured: Boolean(settings.resendWebhookSecret),
    resendWebhookId: settings.resendWebhookId || null,
    webhookUrl: settings.appUrl ? webhookEndpoint(settings.appUrl) : "",
    appUrl: settings.appUrl,
    inboxTtlSeconds: settings.inboxTtlSeconds,
    maxMessagesPerInbox: settings.maxMessagesPerInbox,
    domains: settings.domains,
  };
}

export async function GET() {
  try {
    if (!(await isSettingsAuthed())) {
      return jsonError(new HttpError("Unauthorized", 401));
    }
    const settings = await getSettings();
    return jsonOk(publicSettings(settings));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSettingsAuth();
    const body = (await request.json()) as {
      resendApiKey?: string;
      resendWebhookSecret?: string;
      appUrl?: string;
      inboxTtlSeconds?: number;
      maxMessagesPerInbox?: number;
    };
    const current = await getSettings();
    const next: AppSettings = {
      ...current,
      resendApiKey: body.resendApiKey?.trim() || current.resendApiKey,
      resendWebhookSecret: body.resendWebhookSecret?.trim() || current.resendWebhookSecret,
      appUrl: body.appUrl?.trim() || current.appUrl,
      inboxTtlSeconds: body.inboxTtlSeconds || current.inboxTtlSeconds,
      maxMessagesPerInbox: body.maxMessagesPerInbox || current.maxMessagesPerInbox,
    };

    if (next.resendApiKey && next.appUrl && !isMockMode()) {
      const hook = await registerInboundWebhook(next.resendApiKey, next.appUrl, {
        id: next.resendWebhookId,
        hasSecret: Boolean(next.resendWebhookSecret),
      });
      next.resendWebhookId = hook.id;
      if (hook.signingSecret) next.resendWebhookSecret = hook.signingSecret;
    }

    await saveSettings(next);
    return jsonOk(publicSettings(next));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { action?: string; password?: string };
    if (body.action === "logout") {
      await clearSettingsCookie();
      return jsonOk({ ok: true });
    }
    if (body.action === "login") {
      if (settingsUnlockedWithoutSecret()) {
        return jsonOk({ ok: true });
      }
      if (!verifySettingsPassword(body.password ?? "")) {
        throw new HttpError("Invalid password", 401);
      }
      await setSettingsCookie();
      return jsonOk({ ok: true });
    }
    throw new HttpError("Unknown action");
  } catch (error) {
    return jsonError(error);
  }
}
