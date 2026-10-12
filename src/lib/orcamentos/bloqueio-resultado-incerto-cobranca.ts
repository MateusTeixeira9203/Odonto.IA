/**
 * Uma cobrança por etapa não tem chave idempotente. Enquanto o resultado de
 * uma tentativa é incerto, o cliente conserva o bloqueio fora do diálogo.
 */
export function bloquearCobrancaComResultadoIncerto(
  bloqueios: ReadonlySet<string>,
  cobrancaId: string,
): Set<string> {
  return new Set(bloqueios).add(cobrancaId);
}
