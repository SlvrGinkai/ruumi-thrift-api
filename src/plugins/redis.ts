import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds = 60,
) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // ignore cache write failures; the request should still succeed
  }
}

export async function deleteCachedKey(key: string) {
  try {
    await redis.del(key);
  } catch {
    // ignore cache delete failures
  }
}
