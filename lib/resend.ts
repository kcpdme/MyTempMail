import { Resend } from "resend";
import { isMockMode } from "@/lib/env";
import { mapAttachments } from "@/lib/normalize";
import { randomId } from "@/lib/random";
import type { DnsRecord, IncomingEmail, ManagedDomain, SendPayload } from "@/lib/types";

export function createResend(apiKey: string): Resend {
  return new Resend(apiKey);
}

function mapDnsRecords(records: unknown): DnsRecord[] {
  if (!Array.isArray(records)) return [];
  return records.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      record: String(r.record ?? ""),
      name: String(r.name ?? ""),
      type: String(r.type ?? ""),
      value: String(r.value ?? ""),
      ttl: r.ttl != null ? String(r.ttl) : undefined,
      status: r.status != null ? String(r.status) : undefined,
      priority: typeof r.priority === "number" ? r.priority : undefined,
    };
  });
}

export async function sendMail(apiKey: string, payload: SendPayload): Promise<{ id: string }> {
  if (isMockMode() || !apiKey) {
    return { id: randomId("mock") };
  }
  const resend = createResend(apiKey);
  const { data, error } = await resend.emails.send({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: payload.replyTo ?? payload.from,
    headers: payload.headers,
  });
  if (error || !data) {
    throw Object.assign(new Error(error?.message || "Failed to send email"), { status: 502 });
  }
  return { id: data.id };
}

export function verifyWebhook(
  apiKey: string,
  webhookSecret: string,
  payload: string,
  headers: { id: string; timestamp: string; signature: string },
) {
  const resend = createResend(apiKey || "re_mock");
  return resend.webhooks.verify({ payload, headers, webhookSecret });
}

export async function fetchReceivedEmail(apiKey: string, emailId: string): Promise<IncomingEmail> {
  if (isMockMode() && !apiKey) {
    throw new Error("Cannot fetch received email in mock mode without Resend");
  }
  const resend = createResend(apiKey);
  const { data, error } = await resend.emails.receiving.get(emailId);
  if (error || !data) {
    throw Object.assign(new Error(error?.message || "Failed to fetch received email"), { status: 502 });
  }
  return {
    id: data.id,
    from: data.from,
    to: data.to ?? [],
    cc: data.cc ?? [],
    receivedFor: data.received_for ?? [],
    subject: data.subject ?? "",
    html: data.html,
    text: data.text,
    headers: data.headers,
    messageId: data.message_id,
    receivedAt: data.created_at,
    attachments: mapAttachments(data.attachments),
  };
}

export async function registerInboundWebhook(
  apiKey: string,
  appUrl: string,
  existingId?: string,
): Promise<{ id: string; signingSecret?: string }> {
  const endpoint = `${appUrl.replace(/\/$/, "")}/api/webhooks/resend`;
  const resend = createResend(apiKey);
  if (existingId) {
    await resend.webhooks.update(existingId, {
      endpoint,
      events: ["email.received"],
    });
    return { id: existingId };
  }
  const listed = await resend.webhooks.list();
  const match = listed.data?.data?.find((w) => w.endpoint === endpoint);
  if (match) {
    await resend.webhooks.update(match.id, { events: ["email.received"] });
    return { id: match.id };
  }
  const created = await resend.webhooks.create({
    endpoint,
    events: ["email.received"],
  });
  if (created.error || !created.data) {
    throw Object.assign(new Error(created.error?.message || "Failed to create webhook"), { status: 502 });
  }
  return { id: created.data.id, signingSecret: created.data.signing_secret };
}

export async function addResendDomain(apiKey: string, name: string): Promise<ManagedDomain> {
  const resend = createResend(apiKey);
  const created = await resend.domains.create({
    name,
    capabilities: { sending: "enabled", receiving: "enabled" },
  });
  if (created.error || !created.data) {
    throw Object.assign(new Error(created.error?.message || "Failed to add domain"), { status: 502 });
  }
  if (created.data.id) {
    await resend.domains.update({
      id: created.data.id,
      capabilities: { sending: "enabled", receiving: "enabled" },
    });
  }
  const fetched = created.data.id ? await resend.domains.get(created.data.id) : null;
  const source = fetched?.data ?? created.data;
  return {
    name: source.name.toLowerCase(),
    resendId: source.id,
    status: source.status,
    sending: source.capabilities?.sending,
    receiving: source.capabilities?.receiving,
    records: mapDnsRecords("records" in source ? source.records : created.data.records),
  };
}

export async function refreshResendDomain(apiKey: string, id: string): Promise<ManagedDomain> {
  const resend = createResend(apiKey);
  const { data, error } = await resend.domains.get(id);
  if (error || !data) {
    throw Object.assign(new Error(error?.message || "Failed to load domain"), { status: 502 });
  }
  return {
    name: data.name.toLowerCase(),
    resendId: data.id,
    status: data.status,
    sending: data.capabilities?.sending,
    receiving: data.capabilities?.receiving,
    records: mapDnsRecords(data.records),
  };
}

export async function verifyResendDomain(apiKey: string, id: string): Promise<void> {
  const resend = createResend(apiKey);
  const { error } = await resend.domains.verify(id);
  if (error) {
    throw Object.assign(new Error(error.message || "Failed to verify domain"), { status: 502 });
  }
}
