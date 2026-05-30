/**
 * Guards for clinic ownership verification in server actions.
 * Use these helpers to prevent cross-clinic data operations.
 *
 * Every entity that carries a clinica_id must be validated
 * through RLS + one of these helpers before mutation.
 */

/** Thrown when a record's clinic doesn't match the authenticated clinic context. */
export class ClinicOwnershipError extends Error {
  constructor(entity: string, id: string) {
    super(`Acesso negado: ${entity} ${id} não pertence a esta clínica`);
    this.name = 'ClinicOwnershipError';
  }
}

/**
 * Asserts that a fetched record belongs to the current clinic.
 * Call after fetching an entity to double-check before any mutation.
 *
 * Usage:
 *   const { data } = await supabase.from('pacientes').select('clinica_id').eq('id', id).single();
 *   assertClinicOwnership(data?.clinica_id, clinicId, 'paciente', id);
 */
export function assertClinicOwnership(
  recordClinicId: string | null | undefined,
  contextClinicId: string,
  entity: string,
  entityId: string,
): void {
  if (!recordClinicId || recordClinicId !== contextClinicId) {
    throw new ClinicOwnershipError(entity, entityId);
  }
}

/**
 * Validates that a UUID looks structurally valid (not empty, not a placeholder).
 * Does NOT guarantee database existence — only prevents trivially invalid values.
 */
export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Throws if the provided entity ID is not a valid UUID.
 * Use at server action entry points for IDs received from the client.
 */
export function requireValidId(id: unknown, label = 'ID'): asserts id is string {
  if (!isValidId(id)) {
    throw new Error(`${label} inválido: ${String(id)}`);
  }
}
