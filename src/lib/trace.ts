/**
 * Lightweight request/correlation tracing foundation.
 *
 * NOT OpenTelemetry — this is a minimal ID layer so server actions,
 * activity logs, errors and retries can be correlated in logs and
 * future observability tools without adding distributed tracing overhead.
 *
 * Usage in a server action:
 *   const trace = createTraceContext({ action: 'criarOrcamento', clinicaId });
 *   console.log(`[${trace.requestId}] starting criarOrcamento`);
 *   registrarLog(supabase, { ..., metadata: { ...metadata, traceId: trace.requestId } });
 *
 * Usage in an API route:
 *   const requestId = getRequestId(req) ?? generateRequestId();
 *   const res = NextResponse.json(...);
 *   res.headers.set('x-request-id', requestId);
 */

/** Generate a compact, collision-resistant request ID. */
export function generateRequestId(): string {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export type TraceContext = {
  /** Unique ID for this operation, usable in logs and activity metadata. */
  requestId: string;
  /** ISO timestamp when the trace was created. */
  startedAt: string;
  /** Human-readable label for the operation (e.g. 'criarOrcamento'). */
  action: string;
  /** Clinic context — helps filter logs per tenant. */
  clinicaId?: string;
};

/** Create a trace context at the start of a server action or API handler. */
export function createTraceContext(params: {
  action:     string;
  clinicaId?: string;
}): TraceContext {
  return {
    requestId: generateRequestId(),
    startedAt: new Date().toISOString(),
    action:    params.action,
    clinicaId: params.clinicaId,
  };
}

/**
 * Read the request ID from the x-request-id header if present.
 * API routes can propagate it downstream or return it for client correlation.
 */
export function getRequestId(req: { headers: { get(name: string): string | null } }): string | null {
  return req.headers.get('x-request-id');
}

/**
 * Extract a trace-safe metadata snippet from a TraceContext for
 * embedding into activity_log.metadata or error reports.
 */
export function traceMetadata(trace: TraceContext): Record<string, string> {
  const meta: Record<string, string> = {
    requestId: trace.requestId,
    action:    trace.action,
  };
  if (trace.clinicaId) meta.clinicaId = trace.clinicaId;
  return meta;
}
