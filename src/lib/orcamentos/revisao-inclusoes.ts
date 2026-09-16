export type LogRevisaoInclusao = {
  action: string;
  metadata: unknown;
};

function idsDoMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const eventoIds = (metadata as Record<string, unknown>).evento_ids;
  if (!Array.isArray(eventoIds)) return [];
  return eventoIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** Um procedimento continua fora do orçamento, mas deixa de ser novidade após revisão explícita. */
export function idsDeInclusoesRevisadas(logs: LogRevisaoInclusao[]): Set<string> {
  return new Set(logs
    .filter((log) => log.action === 'orcamento_evento.inclusao_revisada')
    .flatMap((log) => idsDoMetadata(log.metadata)));
}

