/**
 * Standard return type for server actions.
 *
 * Convention across all actions:
 *   ok: true  → operation succeeded, data may be present
 *   ok: false → operation failed, erro contains the human-readable message
 *
 * Usage:
 *   export async function criarPaciente(...): Promise<ActionResult<{ id: string }>> { ... }
 *   const result = await criarPaciente(...);
 *   if (!result.ok) { showToast(result.erro); return; }
 *   router.push(`/dashboard/pacientes/${result.data.id}`);
 */
export type ActionResult<T = void> =
  | ({ ok: true }  & (T extends void ? object : { data: T }))
  | { ok: false; erro: string };

/** Helper to create a success result without data */
export function ok(): ActionResult<void> {
  return { ok: true };
}

/** Helper to create a success result with data */
export function okData<T>(data: T): ActionResult<T> {
  return { ok: true, data } as ActionResult<T>;
}

/** Helper to create a failure result */
export function fail(erro: string): ActionResult<never> {
  return { ok: false, erro };
}
