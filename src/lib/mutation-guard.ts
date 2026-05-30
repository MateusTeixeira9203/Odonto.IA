/**
 * Mutation safety guards for server actions.
 *
 * Prevents the most dangerous edge cases:
 *   1. Mutating an entity that no longer exists (deleted between read and write)
 *   2. Mutating stale data (optimistic UI out of sync with DB state)
 *   3. Double-submitting create operations that should be idempotent
 *
 * Usage pattern in a server action:
 *
 *   const existing = await supabase
 *     .from('orcamentos')
 *     .select('id, updated_at, clinica_id')
 *     .eq('id', orcamentoId)
 *     .eq('clinica_id', clinicId)
 *     .maybeSingle();
 *
 *   assertEntityExists(existing.data, 'orçamento');
 *   assertNotStale(existing.data.updated_at, clientUpdatedAt, 'orçamento');
 *   // safe to mutate
 */

/** Thrown when a required entity doesn't exist in the database */
export class EntityNotFoundError extends Error {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} ${id} não encontrado` : `${entity} não encontrado`);
    this.name = 'EntityNotFoundError';
  }
}

/** Thrown when a mutation targets data that has been modified since the client loaded it */
export class StaleEntityError extends Error {
  constructor(entity: string) {
    super(
      `${entity} foi modificado por outra operação. Recarregue a página para continuar.`
    );
    this.name = 'StaleEntityError';
  }
}

/**
 * Asserts that a fetched entity exists.
 * Throws EntityNotFoundError if the record is null/undefined.
 *
 * Usage:
 *   const { data } = await supabase.from('pacientes').select('id').eq('id', id).maybeSingle();
 *   assertEntityExists(data, 'paciente', id);
 */
export function assertEntityExists<T>(
  record: T | null | undefined,
  entity: string,
  id?: string,
): asserts record is T {
  if (record == null) {
    throw new EntityNotFoundError(entity, id);
  }
}

/**
 * Asserts that the client's version of the entity matches the DB version.
 * Prevents lost-update problems in concurrent edit scenarios.
 *
 * Pass clientUpdatedAt = undefined to skip the check (e.g. when the client
 * doesn't track updated_at — the guard becomes a no-op).
 *
 * Usage:
 *   assertNotStale(dbRecord.updated_at, formData.updated_at, 'orçamento');
 */
export function assertNotStale(
  dbUpdatedAt:     string,
  clientUpdatedAt: string | null | undefined,
  entity:          string,
): void {
  if (clientUpdatedAt == null) return;
  if (new Date(dbUpdatedAt) > new Date(clientUpdatedAt)) {
    throw new StaleEntityError(entity);
  }
}

/**
 * Check if an error is a mutation guard error (safe to surface to the user).
 * Use in action catch blocks to decide between user-friendly and generic messages.
 *
 * Usage:
 *   catch (err) {
 *     if (isMutationGuardError(err)) return fail(err.message);
 *     return fail('Erro inesperado ao salvar.');
 *   }
 */
export function isMutationGuardError(err: unknown): err is EntityNotFoundError | StaleEntityError {
  return err instanceof EntityNotFoundError || err instanceof StaleEntityError;
}
