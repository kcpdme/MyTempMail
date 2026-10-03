export function isMockMode(): boolean {
  if (process.env.MOCK_MODE === "1") return true;
  if (process.env.MOCK_MODE === "0" || process.env.NODE_ENV === "production" || process.env.VERCEL) return false;
  // Partial/legacy configuration must fail visibly, never silently lose mail in memory.
  return !process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN &&
    !process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL;
}

export function settingsSecret(): string {
  return process.env.SETTINGS_SECRET?.trim() ?? "";
}

export function defaultDomainsFromEnv(): string[] {
  const raw = process.env.DOMAINS ?? "";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}
