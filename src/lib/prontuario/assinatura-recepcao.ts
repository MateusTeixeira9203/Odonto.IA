export const NADA_A_ASSINAR = 'Nada a assinar nesta ficha.';

export type EventoParaAssinar = {
  id: string;
  dentista_id: string;
  encaminhado_para: string | null;
  status: string;
  assinatura_id: string | null;
  retirado_em: string | null;
};

export function filtrarEventosParaAssinar<T extends EventoParaAssinar>(
  eventos: T[],
  contexto: { role: string; dentistaId: string },
): T[] {
  return eventos.filter((evento) => evento.status === 'realizado'
    && evento.assinatura_id == null && evento.retirado_em == null
    && (contexto.role === 'secretaria'
      || (evento.encaminhado_para ?? evento.dentista_id) === contexto.dentistaId));
}

export function agruparPorAutor<T extends EventoParaAssinar>(eventos: T[]): T[][] {
  const grupos = new Map<string, T[]>();
  for (const evento of eventos) {
    const autor = evento.encaminhado_para ?? evento.dentista_id;
    const grupo = grupos.get(autor) ?? [];
    grupo.push(evento);
    grupos.set(autor, grupo);
  }
  return [...grupos.values()];
}

export function usarCaminhoLegado({ totalProcedimentos }: { totalProcedimentos: number }): boolean {
  return totalProcedimentos === 0;
}
