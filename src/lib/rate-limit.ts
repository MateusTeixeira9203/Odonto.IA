import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Sliding window em memória — para desenvolvimento sem Redis
// ---------------------------------------------------------------------------
const memoryStore = new Map<string, number[]>();

// Limpa entradas expiradas a cada minuto para evitar vazamento de memória
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of memoryStore.entries()) {
    const fresh = times.filter((t) => now - t < 300_000); // mantém até 5 minutos
    if (fresh.length === 0) memoryStore.delete(key);
    else memoryStore.set(key, fresh);
  }
}, 60_000);

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (memoryStore.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    return {
      success: false,
      remaining: 0,
      reset: Math.min(...timestamps) + windowMs,
    };
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);
  return {
    success: true,
    remaining: limit - timestamps.length,
    reset: now + windowMs,
  };
}

// ---------------------------------------------------------------------------
// Cache de instâncias Ratelimit (evita recriar por request)
// ---------------------------------------------------------------------------
const limiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowSecs: number): Ratelimit {
  const cacheKey = `${limit}:${windowSecs}`;
  if (!limiterCache.has(cacheKey)) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    limiterCache.set(
      cacheKey,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSecs} s`),
        prefix: 'dentai',
      })
    );
  }
  return limiterCache.get(cacheKey)!;
}

// ---------------------------------------------------------------------------
// Função principal — retorna NextResponse 429 se limite atingido, ou null
// ---------------------------------------------------------------------------
export async function withRateLimit(
  req: NextRequest,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<NextResponse | null> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous';
  const key = `${endpoint}:${ip}`;

  let result: { success: boolean; remaining: number; reset: number };

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const windowSecs = Math.ceil(windowMs / 1000);
      const limiter = getUpstashLimiter(limit, windowSecs);
      const res = await limiter.limit(key);
      result = { success: res.success, remaining: res.remaining, reset: res.reset };
    } catch (err) {
      console.error('[rate-limit] Erro no Redis, usando fallback em memória:', err);
      result = memoryRateLimit(key, limit, windowMs);
    }
  } else {
    result = memoryRateLimit(key, limit, windowMs);
  }

  if (!result.success) {
    const retryAfter = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente mais tarde.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(result.reset),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  return null;
}
