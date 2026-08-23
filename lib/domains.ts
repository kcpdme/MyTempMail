const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/i;

const RESERVED = new Set([
  "admin",
  "administrator",
  "postmaster",
  "abuse",
  "webmaster",
  "hostmaster",
  "noreply",
  "no-reply",
  "root",
  "security",
  "ssladmin",
  "mailer-daemon",
]);

export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeEmail(value: string): string {
  return extractAddress(value).toLowerCase();
}

export function extractAddress(raw: string): string {
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle ? angle[1] : trimmed).trim();
}

export function parseEmail(value: string): { local: string; domain: string } | null {
  const addr = normalizeEmail(value);
  const at = addr.lastIndexOf("@");
  if (at <= 0 || at === addr.length - 1) return null;
  if (addr.includes(" ")) return null;
  return { local: addr.slice(0, at), domain: addr.slice(at + 1) };
}

export function isValidLocalPart(local: string): boolean {
  if (!LOCAL_PART.test(local)) return false;
  if (local.includes("..")) return false;
  if (RESERVED.has(local.toLowerCase())) return false;
  return true;
}

export function isAllowedDomain(domain: string, allowlist: string[]): boolean {
  const d = domain.toLowerCase();
  return allowlist.some((allowed) => allowed.toLowerCase() === d);
}

export function assertDisposableAddress(
  email: string,
  allowlist: string[],
): { email: string; local: string; domain: string } {
  const parsed = parseEmail(email);
  if (!parsed) {
    throw new HttpError("Invalid email address");
  }
  if (!isValidLocalPart(parsed.local)) {
    throw new HttpError("Invalid or reserved username");
  }
  if (!isAllowedDomain(parsed.domain, allowlist)) {
    throw new HttpError("Domain is not configured");
  }
  return {
    email: `${parsed.local}@${parsed.domain}`,
    local: parsed.local,
    domain: parsed.domain,
  };
}

export function isExternalEmail(value: string): boolean {
  const parsed = parseEmail(value);
  if (!parsed) return false;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.domain);
}

export function domainAllowlist(domains: { name: string }[]): string[] {
  return domains.map((d) => d.name.toLowerCase()).filter(Boolean);
}
