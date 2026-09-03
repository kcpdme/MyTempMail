import { NextRequest } from "next/server";
import { assertDisposableAddress, domainAllowlist, HttpError } from "@/lib/domains";
import { isMockMode } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { incomingToStored } from "@/lib/normalize";
import { randomId } from "@/lib/random";
import { getSettings } from "@/lib/settings";
import { requireMember } from "@/lib/session";
import { getStore } from "@/lib/store";
import type { IncomingEmail } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!isMockMode()) {
      throw new HttpError("Seed is only available in mock mode", 403);
    }
    await requireMember();
    const body = (await request.json()) as {
      email?: string;
      from?: string;
      subject?: string;
      text?: string;
      html?: string;
    };
    const settings = await getSettings();
    const parsed = assertDisposableAddress(body.email ?? "", domainAllowlist(settings.domains));
    const incoming: IncomingEmail = {
      id: randomId("seed"),
      from: body.from || "Sender <alerts@example.com>",
      to: [parsed.email],
      cc: [],
      receivedFor: [parsed.email],
      subject: body.subject || "Welcome to MyTempMail",
      html: body.html || "<p>This is a <strong>test message</strong> seeded in mock mode.</p>",
      text: body.text || "This is a test message seeded in mock mode.",
      headers: { "message-id": `<${randomId("mid")}@example.test>` },
      messageId: `<${randomId("mid")}@example.test>`,
      receivedAt: new Date().toISOString(),
      attachments: [],
    };
    const stored = incomingToStored(incoming);
    await getStore().saveMessage(parsed.email, stored, {
      ttlSeconds: settings.inboxTtlSeconds,
      maxMessages: settings.maxMessagesPerInbox,
    });
    return jsonOk({ id: stored.id });
  } catch (error) {
    return jsonError(error);
  }
}
