export function isMockMode(): boolean {
  if (process.env.MOCK_MODE === "1") return true;
  if (process.env.MOCK_MODE === "0") return false;
  return !redisUrl() || !redisToken();
}

export function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
}

export function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
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
