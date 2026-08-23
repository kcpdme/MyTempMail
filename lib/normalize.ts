import { extractAddress, isAllowedDomain, normalizeEmail, parseEmail } from "@/lib/domains";
import type { AttachmentMeta, IncomingEmail, StoredMessage } from "@/lib/types";

export const BODY_CAP = 256 * 1024;

export function capBody(value: string, max = BODY_CAP): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

export function snippetFrom(text: string, html: string): string {
  const source = text.trim() || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return source.slice(0, 140);
}

export function toSummary(message: StoredMessage) {
  return {
    id: message.id,
    from: message.from,
    to: message.to,
    subject: message.subject,
    receivedAt: message.receivedAt,
    snippet: message.snippet,
    hasHtml: message.hasHtml,
  };
}

export function incomingToStored(incoming: IncomingEmail): StoredMessage {
  const text = capBody(incoming.text ?? "");
  const html = capBody(incoming.html ?? "");
  const headerRefs =
    incoming.headers?.references ||
    incoming.headers?.References ||
    incoming.headers?.["References"] ||
    "";
  return {
    id: incoming.id,
    from: incoming.from,
    to: incoming.to.map(normalizeEmail),
    subject: incoming.subject || "(no subject)",
    receivedAt: incoming.receivedAt,
    snippet: snippetFrom(text, html),
    hasHtml: html.length > 0,
    html,
    text,
    messageId: incoming.messageId || incoming.headers?.["message-id"] || incoming.headers?.["Message-ID"] || incoming.id,
    references: headerRefs,
    cc: incoming.cc.map(normalizeEmail),
    headers: incoming.headers ?? {},
    attachments: incoming.attachments,
  };
}

export function recipientsForInbox(incoming: IncomingEmail, allowlist: string[]): string[] {
  const raw = [...incoming.to, ...incoming.cc, ...incoming.receivedFor];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const addr = normalizeEmail(extractAddress(item));
    const parsed = parseEmail(addr);
    if (!parsed) continue;
    if (!isAllowedDomain(parsed.domain, allowlist)) continue;
    if (seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

export function mapAttachments(
  attachments: Array<{
    id?: string;
    filename?: string | null;
    content_type?: string;
    size?: number;
  }> | null | undefined,
): AttachmentMeta[] {
  if (!attachments?.length) return [];
  return attachments.map((a, i) => ({
    id: a.id || `att_${i}`,
    filename: a.filename || "attachment",
    contentType: a.content_type || "application/octet-stream",
    size: a.size,
  }));
}
