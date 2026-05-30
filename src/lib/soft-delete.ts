/**
 * Soft delete strategy foundation.
 *
 * Critical entities (patients, records, budgets) should never be permanently
 * destroyed on first delete. This module provides the patterns to add soft
 * delete to any entity incrementally, without a big-bang migration.
 *
 * ── Migration strategy ────────────────────────────────────────────────────────
 *
 * To soft-delete an entity table (e.g. `pacientes`):
 *
 *   1. Add column:  ALTER TABLE pacientes ADD COLUMN deleted_at TIMESTAMPTZ;
 *   2. Update RLS:  Add `AND deleted_at IS NULL` to SELECT policies (or use a view).
 *   3. Swap DELETE → UPDATE: use softDeletePayload() in the server action.
 *   4. Filter active records: use activeScopeQuery() on every list query.
 *   5. Restore: UPDATE pacientes SET deleted_at = NULL WHERE id = $1.
 *
 * ── Current status ────────────────────────────────────────────────────────────
 *
 * No tables have been migrated yet — this module provides the contract.
 * Apply per-table as capacity allows; no need to do everything at once.
 *
 * Tables recommended for soft delete (priority order):
 *   1. pacientes      — most critical, never destroy patient history
 *   2. fichas         — clinical records must be auditable
 *   3. orcamentos     — financial documents require audit trail
 *   4. planejamentos  — treatment plans linked to fichas
 *   5. pagamentos     — financial integrity
 */

/** Payload to UPDATE a record to soft-deleted state */
export function softDeletePayload(): { deleted_at: string } {
  return { deleted_at: new Date().toISOString() };
}

/** Payload to restore a soft-deleted record */
export function restorePayload(): { deleted_at: null } {
  return { deleted_at: null };
}

/** Runtime check — true if the record has been soft-deleted */
export function isDeleted(record: { deleted_at?: string | null }): boolean {
  return record.deleted_at != null;
}

/**
 * Apply active-scope filter to a Supabase query builder.
 * Skips the filter if the table doesn't have deleted_at yet (noop).
 *
 * Once the table is migrated, change `hasSoftDelete` to true for that table
 * in the call site — no other changes needed.
 *
 * Usage:
 *   const query = supabase.from('pacientes').select('*').eq('clinica_id', clinicId);
 *   const filtered = applyActiveScope(query, true);   // table has soft delete
 *   const filtered = applyActiveScope(query, false);  // table not yet migrated (noop)
 */
export function applyActiveScope<Q extends { is(column: string, value: null): Q }>(
  query: Q,
  hasSoftDelete: boolean,
): Q {
  return hasSoftDelete ? query.is('deleted_at', null) : query;
}

/** Tables that currently support soft delete (update as migrations land) */
export const SOFT_DELETE_TABLES: ReadonlySet<string> = new Set([
  // Add table names here after running the migration, e.g.:
  // 'pacientes',
  // 'fichas',
]);

/** Returns true if the given table has soft delete enabled */
export function tableHasSoftDelete(table: string): boolean {
  return SOFT_DELETE_TABLES.has(table);
}
