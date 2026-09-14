/**
 * R-46d D0 — extraído de FichasTab.tsx (R-30 Parte 2 / R-47) pra ser reusado pelo campo
 * mágico do Meu dia, que precisa da mesma regra de dedup/merge sem ter formulário nenhum.
 * Behavior-preserving: mesma lógica, mesmo comportamento — só muda de casa.
 */
import type { OdontogramaEventoDraft, OdontogramaEventoInput } from '@/types/odontograma';

/** Metadados da captura por IA. Não inclui modo manual: o Dex já classifica cada evento. */
export interface ContextoMesclaIA {
  capturaId: string;
  encaminharParaId?: string | null;
}

/**
 * Chave semântica — mesmo tipo/status/origem/âncora/papel, mesmo com id diferente.
 * Entrada repetida do Dex (mesmo evento 2x na mesma leitura) recebia `crypto.randomUUID()`
 * distinto e virava duas linhas cobráveis (achado real: ficha do Renato 27/07, dente 15).
 */
export function chaveDedupEvento(ev: OdontogramaEventoInput): string {
  return JSON.stringify([
    ev.tipo, ev.status, ev.origem,
    ev.ancora.nivel, ev.ancora.arcada ?? null, ev.ancora.quadrante ?? null, ev.ancora.dente ?? null,
    [...(ev.ancora.faces ?? [])].sort(),
    ev.papel_no_grupo,
    ev.procedimentoId ?? null,
    (ev.procedimentoNome?.trim() || (ev.tipo === 'outro' ? ev.observacao : '') || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim(),
  ]);
}

/**
 * Colapsa eventos equivalentes numa lista, mantém o de menor id (determinístico, não
 * depende de ordem de chegada). Evento com `assinaturaId` nunca é candidato a descarte
 * (R-30 invariante #2) — sempre passa direto.
 */
export function dedupEventosDraft(eventos: OdontogramaEventoDraft[]): OdontogramaEventoDraft[] {
  const vencedorPorChave = new Map<string, OdontogramaEventoDraft>();
  const resultado: OdontogramaEventoDraft[] = [];

  for (const ev of eventos) {
    if (ev.assinaturaId) { resultado.push(ev); continue; }

    const chave = chaveDedupEvento(ev);
    const atual = vencedorPorChave.get(chave);
    if (!atual) {
      vencedorPorChave.set(chave, ev);
      resultado.push(ev);
    } else if (ev.id < atual.id) {
      resultado[resultado.indexOf(atual)] = ev;
      vencedorPorChave.set(chave, ev);
    }
    // senão: `ev` é duplicata com id maior — descartado.
  }

  return resultado;
}

/**
 * R-47 — funde uma extração nova da IA num draft existente sem NUNCA perder o que já está
 * lá: se a chave semântica de um evento novo já existe no draft atual, o novo é descartado
 * (reextrair é no-op, não upgrade automático). `dedupEventosDraft` só limpa duplicata DENTRO
 * da extração nova (seu propósito original — a IA emitir o mesmo evento 2x na mesma leitura).
 *
 * R-139c — contexto só identifica a captura/destino; nunca aplica `camposDoModoLancamento`.
 * O modo manual pertence exclusivamente a `criarEventosContextuais` e aos lançamentos diretos.
 *
 * Trade-off aceito e documentado (herdado do R-47): se a IA extrai o MESMO procedimento com
 * status diferente (ex.: indicado → realizado), a chave muda (status entra na chave) e os
 * dois convivem como cards visíveis — duplicata visível antes de salvar, não perda silenciosa.
 */
export function mesclarEventosSemPerda(
  draftAtual: OdontogramaEventoDraft[],
  novosDaIA: OdontogramaEventoInput[],
  realizadoEmPadrao: string,
  contexto?: ContextoMesclaIA,
): OdontogramaEventoDraft[] {
  const chavesExistentes = new Set(draftAtual.map(chaveDedupEvento));
  const novos: OdontogramaEventoDraft[] = novosDaIA.map((ev) => ({
    ...ev,
    realizado_em: ev.status === 'realizado' && ev.origem === 'clinica' ? realizadoEmPadrao : null,
    id: crypto.randomUUID(), // R-01 — id estável nasce aqui, na entrada do rascunho
    fonteFluxo: 'novo',
    encaminhadoParaId: contexto?.encaminharParaId,
    chaveCaptura: contexto
      ? `${contexto.capturaId}:${chaveDedupEvento(ev)}`
      : undefined,
  }));
  const novosSemColisao = dedupEventosDraft(novos)
    .filter((ev) => !chavesExistentes.has(chaveDedupEvento(ev)));
  return [...draftAtual, ...novosSemColisao];
}
