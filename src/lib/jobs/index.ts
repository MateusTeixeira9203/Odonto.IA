/**
 * Background job foundation — lightweight async work contract.
 *
 * Current implementation: fire-and-forget with in-process execution.
 * Ready to migrate to Inngest, Trigger.dev, or Supabase Edge Functions
 * without changing callers — just swap runJob() internals.
 *
 * Design invariant:
 *   - Jobs are ALWAYS idempotent (can be re-run safely)
 *   - Jobs receive typed input and return typed output
 *   - Jobs never throw to callers — errors are captured in JobResult
 *
 * Usage:
 *   await runJob(JOBS.SEND_WHATSAPP_REMINDER, { agendamentoId, telefone });
 *   // ^ fire-and-forget: caller gets void, job runs in background
 *
 *   // For jobs where the caller needs the result:
 *   const result = await executeJob(JOBS.GENERATE_PDF, { orcamentoId });
 *   if (!result.ok) handleError(result.error);
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type JobResult<T = void> =
  | { ok: true;  data: T;      durationMs: number }
  | { ok: false; error: string; durationMs: number };

export type JobDefinition<TInput, TOutput = void> = {
  /** Stable, dot-notation name (e.g. 'whatsapp.send_reminder') */
  name:    string;
  /** Async handler — must be idempotent */
  handler: (input: TInput) => Promise<TOutput>;
};

/**
 * Create a typed job definition.
 * Centralizing definitions prevents typos and provides discoverability.
 */
export function defineJob<TInput, TOutput = void>(
  name: string,
  handler: (input: TInput) => Promise<TOutput>,
): JobDefinition<TInput, TOutput> {
  return { name, handler };
}

/**
 * Execute a job synchronously and return the result.
 * Use when you need the outcome before continuing.
 */
export async function executeJob<TInput, TOutput>(
  job: JobDefinition<TInput, TOutput>,
  input: TInput,
): Promise<JobResult<TOutput>> {
  const start = Date.now();
  try {
    const data = await job.handler(input);
    return { ok: true, data, durationMs: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[job:${job.name}] failed:`, error);
    return { ok: false, error, durationMs: Date.now() - start };
  }
}

/**
 * Fire-and-forget job execution — caller gets void immediately.
 * Use for non-critical side effects (WhatsApp, PDF generation, reminders).
 * Errors are logged but never surface to the caller.
 */
export function runJob<TInput>(
  job: JobDefinition<TInput, unknown>,
  input: TInput,
): void {
  void executeJob(job, input).then(result => {
    if (!result.ok) {
      console.warn(`[job:${job.name}] background failure after ${result.durationMs}ms:`, result.error);
    }
  });
}

/**
 * Job catalog — add entries here as background work grows.
 * Each entry uses defineJob() above for full type safety.
 *
 * Example registrations (implement handlers as needed):
 *
 * export const JOBS = {
 *   SEND_WHATSAPP_REMINDER: defineJob<{ agendamentoId: string; telefone: string }>(
 *     'whatsapp.send_reminder',
 *     async ({ agendamentoId, telefone }) => { ... }
 *   ),
 *   GENERATE_ORCAMENTO_PDF: defineJob<{ orcamentoId: string }>(
 *     'pdf.generate_orcamento',
 *     async ({ orcamentoId }) => { ... }
 *   ),
 * } as const;
 */
export const JOBS = {} as const;
