import { Redis } from "@upstash/redis";
import { isMockMode, redisToken, redisUrl } from "@/lib/env";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (isMockMode()) {
    throw new Error("Redis is not used in mock mode");
  }
  if (client) return client;
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) {
    throw new Error("Upstash Redis is not configured");
  }
  client = new Redis({ url, token });
  return client;
}
