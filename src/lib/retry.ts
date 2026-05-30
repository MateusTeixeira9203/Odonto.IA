/**
 * Operational resilience utilities.
 * Keep AI calls, external APIs, and heavy DB operations inside these wrappers.
 */

/** Exponential backoff retry: delay * (attempt + 1) */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs     = options.delayMs ?? 400;
  let lastErr: unknown;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Races fn against a timeout. Throws if fn doesn't resolve within timeoutMs.
 * Uses AbortSignal so fetch/streaming calls can honour the signal if passed.
 *
 * Usage:
 *   const data = await withTimeout(() => callExternalApi(), 5_000);
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Operação excedeu o tempo limite de ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns fallbackValue instead of throwing when fn rejects.
 * Use for non-critical enrichment (context data, AI suggestions) so the
 * main flow continues even when optional data is unavailable.
 *
 * Usage:
 *   const hint = await withFallback(() => getDexHint(), null);
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallbackValue: T,
): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallbackValue;
  }
}
