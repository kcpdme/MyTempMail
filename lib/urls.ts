export function normalizeAppUrl(appUrl: string): string {
  return appUrl.trim().replace(/\/+$/, "");
}

export function webhookEndpoint(appUrl: string): string {
  return `${normalizeAppUrl(appUrl)}/api/webhooks/resend`;
}

export function sameWebhookEndpoint(left: string, right: string): boolean {
  return normalizeAppUrl(left) === normalizeAppUrl(right);
}

export function originFromRedirect(location: string, current: string): string | null {
  try {
    const next = new URL(location, current);
    const cur = new URL(current);
    if (!next.host || next.host === cur.host) return null;
    return `${next.protocol}//${next.host}`;
  } catch {
    return null;
  }
}

export async function resolveCanonicalAppUrl(appUrl: string): Promise<string> {
  const base = normalizeAppUrl(appUrl);
  if (!base.startsWith("http")) return base;
  const endpoint = webhookEndpoint(base);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        const origin = originFromRedirect(loc, endpoint);
        if (origin) return origin;
      }
    }
  } catch {
    /* keep the URL the user entered */
  }
  return base;
}
