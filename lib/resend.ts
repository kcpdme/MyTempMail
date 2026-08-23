import { Resend } from "resend";
import { pickExistingResendDomain } from "@/lib/domains";
import { isMockMode } from "@/lib/env";
import { coerceAddresses, incomingToStored, mapAttachments, recipientsForInbox } from "@/lib/normalize";
import { randomId } from "@/lib/random";
import { getStore } from "@/lib/store";
import type { DnsRecord, IncomingEmail, ManagedDomain, SendPayload } from "@/lib/types";
import { sameWebhookEndpoint, webhookEndpoint } from "@/lib/urls";

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
    to: coerceAddresses(data.to),
    cc: coerceAddresses(data.cc),
    receivedFor: coerceAddresses(data.received_for),
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
  existing?: { id?: string; hasSecret?: boolean },
): Promise<{ id: string; signingSecret?: string }> {
  const endpoint = webhookEndpoint(appUrl);
  const resend = createResend(apiKey);
  if (existing?.id && existing.hasSecret) {
    await resend.webhooks.update(existing.id, {
      endpoint,
      events: ["email.received"],
    });
    return { id: existing.id };
  }

  const listed = await resend.webhooks.list();
  const match = listed.data?.data?.find((w) => sameWebhookEndpoint(w.endpoint, endpoint));
  if (match && existing?.hasSecret) {
    await resend.webhooks.update(match.id, { endpoint, events: ["email.received"] });
    return { id: match.id };
  }

  const created = await resend.webhooks.create({
    endpoint,
    events: ["email.received"],
  });
  if (created.error || !created.data) {
    throw Object.assign(
      new Error(
        created.error?.message ||
          "Failed to create webhook. Set the endpoint to the HTTPS URL (no trailing slash) and paste the signing secret.",
      ),
      { status: 502 },
    );
  }
  return { id: created.data.id, signingSecret: created.data.signing_secret };
}

export async function ingestReceivedForAddress(
  apiKey: string,
  email: string,
  opts: { ttlSeconds: number; maxMessages: number; allowlist: string[] },
): Promise<number> {
  if (!apiKey || isMockMode()) return 0;
  const resend = createResend(apiKey);
  const listed = await resend.emails.receiving.list({ limit: 20 });
  if (listed.error) return 0;
  const items = listed.data?.data ?? [];
  const want = email.toLowerCase();
  const cutoff = Date.now() - (opts.ttlSeconds || 86400) * 1000;
  const store = getStore();
  const have = new Set((await store.listInbox(want)).map((item) => item.id));
  let stored = 0;
  for (const item of items) {
    if (stored >= 10) break;
    if (have.has(item.id)) continue;
    const created = Date.parse(item.created_at);
    if (Number.isFinite(created) && created < cutoff) continue;
    const recipients = recipientsForInbox(
      {
        to: item.to,
        cc: item.cc,
        receivedFor: item.received_for,
      },
      opts.allowlist,
    );
    if (!recipients.includes(want)) continue;
    const incoming = await fetchReceivedEmail(apiKey, item.id);
    const message = incomingToStored(incoming);
    for (const addr of recipients) {
      await store.saveMessage(addr, message, opts);
    }
    have.add(item.id);
    stored += 1;
  }
  return stored;
}

type ResendDomainSource = {
  id: string;
  name: string;
  status?: string;
  capabilities?: { sending?: string; receiving?: string };
  records?: unknown;
};

function toManagedDomain(source: ResendDomainSource): ManagedDomain {
  return {
    name: source.name.toLowerCase(),
    resendId: source.id,
    status: source.status,
    sending: source.capabilities?.sending,
    receiving: source.capabilities?.receiving,
    records: mapDnsRecords(source.records),
  };
}

async function ensureInbound(resend: Resend, domain: { id: string; capabilities?: { sending?: string; receiving?: string } }) {
  if (domain.capabilities?.sending === "enabled" && domain.capabilities?.receiving === "enabled") return;
  await resend.domains.update({
    id: domain.id,
    capabilities: { sending: "enabled", receiving: "enabled" },
  });
}

async function loadManagedDomain(resend: Resend, id: string): Promise<ManagedDomain> {
  const { data, error } = await resend.domains.get(id);
  if (error || !data) {
    throw Object.assign(new Error(error?.message || "Failed to load domain"), { status: 502 });
  }
  return toManagedDomain(data);
}

async function findListedDomain(resend: Resend, name: string) {
  const listed = await resend.domains.list();
  if (listed.error) {
    throw Object.assign(new Error(listed.error.message || "Failed to list domains"), { status: 502 });
  }
  return pickExistingResendDomain(listed.data?.data, name);
}

async function attachExistingDomain(resend: Resend, existing: { id: string; capabilities?: { sending?: string; receiving?: string } }) {
  await ensureInbound(resend, existing);
  return loadManagedDomain(resend, existing.id);
}

export async function addResendDomain(
  apiKey: string,
  name: string,
): Promise<{ domain: ManagedDomain; imported: boolean }> {
  const resend = createResend(apiKey);
  const existing = await findListedDomain(resend, name);
  if (existing) {
    return { domain: await attachExistingDomain(resend, existing), imported: true };
  }

  const created = await resend.domains.create({
    name,
    capabilities: { sending: "enabled", receiving: "enabled" },
  });
  if (created.error || !created.data) {
    const retry = await findListedDomain(resend, name);
    if (retry) {
      return { domain: await attachExistingDomain(resend, retry), imported: true };
    }
    throw Object.assign(new Error(created.error?.message || "Failed to add domain"), { status: 502 });
  }
  await ensureInbound(resend, created.data);
  const fetched = await resend.domains.get(created.data.id);
  return {
    domain: toManagedDomain(fetched.data ?? created.data),
    imported: false,
  };
}

export async function importResendDomains(apiKey: string, already: string[]): Promise<ManagedDomain[]> {
  const resend = createResend(apiKey);
  const listed = await resend.domains.list();
  if (listed.error) {
    throw Object.assign(new Error(listed.error.message || "Failed to list domains"), { status: 502 });
  }
  const have = new Set(already.map((n) => n.toLowerCase()));
  const incoming: ManagedDomain[] = [];
  for (const item of listed.data?.data ?? []) {
    if (have.has(item.name.toLowerCase())) continue;
    await ensureInbound(resend, item);
    incoming.push(await loadManagedDomain(resend, item.id));
  }
  return incoming;
}

export async function refreshResendDomain(apiKey: string, id: string): Promise<ManagedDomain> {
  return loadManagedDomain(createResend(apiKey), id);
}

export async function verifyResendDomain(apiKey: string, id: string): Promise<void> {
  const resend = createResend(apiKey);
  const { error } = await resend.domains.verify(id);
  if (error) {
    throw Object.assign(new Error(error.message || "Failed to verify domain"), { status: 502 });
  }
}
