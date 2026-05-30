import { Redis } from '@upstash/redis';

// In-memory fallback (single-instance, cleared on server restart)
const memCache = new Map<string, { value: unknown; expiresAt: number }>();

let redisInstance: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redisInstance) {
    redisInstance = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisInstance;
}

export async function getCached<T>(key: string): Promise<T | null> {
  // Check in-memory first (fastest path)
  const entry = memCache.get(key);
  if (entry) {
    if (entry.expiresAt > Date.now()) return entry.value as T;
    memCache.delete(key);
  }

  // Fall through to Redis
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get<T>(`ai-cache:${key}`);
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });

  const r = getRedis();
  if (!r) return;
  try {
    await r.set(`ai-cache:${key}`, value, { ex: ttlSeconds });
  } catch {
    // Non-critical — in-memory cache still works
  }
}
