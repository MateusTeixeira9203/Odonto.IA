/**
 * Safe query cap constants — performance safety for growing clinics.
 *
 * Every list query must use one of these limits (or a justified custom value).
 * No query should ever fetch an unbounded dataset: even with pagination, the
 * per-page cap prevents individual requests from becoming memory bombs.
 *
 * Usage:
 *   supabase.from('pacientes').select('*').limit(QUERY_LIMITS.PATIENTS_LIST)
 *
 * When a feature needs more data than the cap allows, implement pagination
 * using src/lib/pagination.ts instead of raising the limit.
 */

export const QUERY_LIMITS = {
  // ── Patient workspace ──────────────────────────────────────────────────────
  /** Recent clinical records shown in patient detail view */
  PATIENT_FICHAS_RECENT:    5,
  /** Quotes/estimates per patient view */
  PATIENT_ORCAMENTOS:       50,
  /** Timeline events per patient */
  PATIENT_TIMELINE:         30,

  // ── Lists / Dashboards ─────────────────────────────────────────────────────
  /** Default page size for patient list */
  PATIENTS_LIST:            25,
  /** Appointments per calendar month load */
  APPOINTMENTS_MONTH:       200,
  /** Pending appointments for reminder runs */
  APPOINTMENTS_REMINDERS:   100,
  /** Quotes list per page */
  ORCAMENTOS_LIST:          50,
  /** Financial transactions per month view */
  FINANCIAL_MONTH:          500,

  // ── Activity / Audit ───────────────────────────────────────────────────────
  /** Activity log entries per page */
  ACTIVITY_LOG_PAGE:        50,
  /** Maximum activity log entries fetched in a single export */
  ACTIVITY_LOG_EXPORT:      1_000,

  // ── AI / Context ───────────────────────────────────────────────────────────
  /** Clinical records sent to AI for context */
  AI_FICHAS_CONTEXT:        10,
  /** Recent appointments sent to AI for briefing */
  AI_AGENDAMENTOS_CONTEXT:  5,

  // ── WhatsApp / Comms ───────────────────────────────────────────────────────
  /** Patients fetched per reminder batch */
  WHATSAPP_BATCH:           50,

  // ── Command Palette / Search ───────────────────────────────────────────────
  /** Max results returned by global search */
  SEARCH_RESULTS:           20,

  // ── Export ─────────────────────────────────────────────────────────────────
  /** Maximum rows in a single CSV export without pagination */
  EXPORT_ROWS_MAX:          5_000,
} as const;

export type QueryLimitKey = keyof typeof QUERY_LIMITS;

/**
 * Clamp a user-requested limit to the allowed maximum for a given context.
 * Use at API route boundaries where the client sends a ?limit= param.
 *
 * Usage:
 *   const limit = clampLimit(req.nextUrl.searchParams.get('limit'), 'PATIENTS_LIST');
 */
export function clampLimit(
  requested: string | number | null | undefined,
  key: QueryLimitKey,
): number {
  const max = QUERY_LIMITS[key];
  const n   = typeof requested === 'number' ? requested : parseInt(String(requested ?? ''), 10);
  if (Number.isNaN(n) || n < 1) return Math.min(25, max);
  return Math.min(n, max);
}
