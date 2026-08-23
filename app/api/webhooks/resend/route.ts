import { NextRequest } from "next/server";
import { domainAllowlist } from "@/lib/domains";
import { jsonError, jsonOk } from "@/lib/http";
import { incomingToStored, recipientsForInbox } from "@/lib/normalize";
import { fetchReceivedEmail, verifyWebhook } from "@/lib/resend";
import { getSettings } from "@/lib/settings";
import { getStore } from "@/lib/store";
import type { IncomingEmail } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function webhookHeaders(request: NextRequest) {
  return {
    id: request.headers.get("svix-id") || request.headers.get("webhook-id") || "",
    timestamp: request.headers.get("svix-timestamp") || request.headers.get("webhook-timestamp") || "",
    signature: request.headers.get("svix-signature") || request.headers.get("webhook-signature") || "",
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const settings = await getSettings();
    if (!settings.resendWebhookSecret) {
      return jsonError(Object.assign(new Error("Webhook secret is not configured"), { status: 503 }));
    }

    let event: ReturnType<typeof verifyWebhook>;
    try {
      event = verifyWebhook(settings.resendApiKey, settings.resendWebhookSecret, payload, webhookHeaders(request));
    } catch {
      return jsonError(Object.assign(new Error("Invalid webhook signature"), { status: 400 }));
    }

    if (event.type !== "email.received") {
      return jsonOk({ ignored: true });
    }

    const incoming: IncomingEmail = await fetchReceivedEmail(settings.resendApiKey, event.data.email_id);
    if (!incoming.messageId) incoming.messageId = event.data.message_id;
    const stored = incomingToStored(incoming);
    const recipients = recipientsForInbox(
      {
        ...incoming,
        to: event.data.to?.length ? event.data.to : incoming.to,
        cc: event.data.cc?.length ? event.data.cc : incoming.cc,
        receivedFor: event.data.received_for?.length ? event.data.received_for : incoming.receivedFor,
      },
      domainAllowlist(settings.domains),
    );

    const store = getStore();
    const opts = {
      ttlSeconds: settings.inboxTtlSeconds,
      maxMessages: settings.maxMessagesPerInbox,
    };
    for (const email of recipients) {
      await store.saveMessage(email, stored, opts);
    }

    return jsonOk({ stored: recipients.length });
  } catch (error) {
    return jsonError(error);
  }
}
