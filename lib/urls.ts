export function normalizeAppUrl(appUrl: string): string {
  return appUrl.trim().replace(/\/+$/, "");
}

export function webhookEndpoint(appUrl: string): string {
  return `${normalizeAppUrl(appUrl)}/api/webhooks/resend`;
}

export function sameWebhookEndpoint(left: string, right: string): boolean {
  return normalizeAppUrl(left) === normalizeAppUrl(right);
}
