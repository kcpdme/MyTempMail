export type AttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  size?: number;
};

export type InboxSummary = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  receivedAt: string;
  snippet: string;
  hasHtml: boolean;
};

export type StoredMessage = InboxSummary & {
  html: string;
  text: string;
  messageId: string;
  references: string;
  cc: string[];
  headers: Record<string, string>;
  attachments: AttachmentMeta[];
};

export type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  status?: string;
  priority?: number;
};

export type ManagedDomain = {
  name: string;
  resendId?: string;
  status?: string;
  sending?: string;
  receiving?: string;
  records?: DnsRecord[];
};

export type AppSettings = {
  resendApiKey: string;
  resendWebhookSecret: string;
  resendWebhookId: string;
  domains: ManagedDomain[];
  inboxTtlSeconds: number;
  maxMessagesPerInbox: number;
  appUrl: string;
};

export type PublicConfig = {
  domains: string[];
  inboxTtlSeconds: number;
  mockMode: boolean;
};

export type SendPayload = {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export type IncomingEmail = {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  receivedFor: string[];
  subject: string;
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  messageId: string;
  receivedAt: string;
  attachments: AttachmentMeta[];
};
