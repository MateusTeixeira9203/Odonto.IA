/**
 * R-02 Fase 1/2 — agrupamento e ordenação ÚNICOS de registros do odontograma (I2).
 * Antes existiam duas implementações quase idênticas dentro de FichasTab.tsx: `gruposDraft`
 * (rascunho, por índice) e `eventosParaCards` (ficha salva, EventoView) — a mesma regra
 * escrita duas vezes. Esta função substitui as duas: agrupa por `grupo_id` (ou, sem grupo,
 * MESMO dente+tipo+status — 3 eventos de face do Dex viram 1 card "Restauração LMO · dente
 * 45", feedback 21/07) e ordena abertos primeiro, dente como critério secundário (Decisão 1
 * = Opção A / Decisão 3, spec R-02 §4, 23/07).
 */
import type { AncoraClinica, MomentoPlanejado, StatusRegistro, TipoRegistroOdontograma } from '@/types/odontograma';
import { rotuloProcedimento } from '@/types/odontograma';

/** Shape mínimo que a função precisa — cada chamador adapta seu tipo real pra este (ex.:
 *  OdontogramaEventoDraft usa `grupo_id`, snake_case; aqui é sempre `grupoId`). */
export interface RegistroAgrupavel {
  id: string;
  grupoId: string | null;
  tipo: TipoRegistroOdontograma;
  procedimentoNome?: string | null;
  observacao?: string | null;
  status: StatusRegistro;
  /** Indicações de momentos diferentes são decisões clínicas diferentes. Para registros
   * sem grupo explícito, elas não podem se fundir num único card e esconder a prioridade. */
  momentoPlanejado?: MomentoPlanejado;
  ancora: AncoraClinica;
}

/** true se QUALQUER evento do grupo ainda está indicado — nunca um campo persistido (I4). */
export function grupoEstaAberto(itens: { status: StatusRegistro }[]): boolean {
  return itens.some((e) => e.status === 'indicado');
}

/** Chave de agrupamento: `grupo_id` explícito, ou (sem grupo) dente+tipo+status+momento.
 * Um grupo explícito continua indivisível: representa um único tratamento multi-dente. */
function chaveDoGrupo(item: RegistroAgrupavel): string {
  const a = item.ancora;
  const momento = item.status === 'indicado' ? item.momentoPlanejado ?? 'sessao_atual' : 'realizado';
  return item.grupoId
    ?? `m:${a.dente ?? `${a.nivel}:${a.arcada ?? a.quadrante ?? ''}`}|${item.tipo}|${item.status}|${momento}|${rotuloProcedimento(item).trim().toLocaleLowerCase('pt-BR')}`;
}

/**
 * Agrupa por procedimento e ordena abertos primeiro, dente como critério secundário.
 * Genérica sobre T pra servir tanto o rascunho quanto a ficha salva — cada chamador
 * adapta seu shape pra `RegistroAgrupavel` antes de chamar.
 */
export function agruparRegistros<T extends RegistroAgrupavel>(
  itens: T[],
): Array<{ chave: string; itens: T[]; aberto: boolean }> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const chave = chaveDoGrupo(item);
    const arr = grupos.get(chave);
    if (arr) arr.push(item); else grupos.set(chave, [item]);
  }
  return [...grupos.entries()]
    .map(([chave, grupoItens]) => ({ chave, itens: grupoItens, aberto: grupoEstaAberto(grupoItens) }))
    .sort((a, b) => {
      const d = (a.aberto ? 0 : 1) - (b.aberto ? 0 : 1);
      if (d !== 0) return d;
      return (a.itens[0].ancora.dente ?? 99) - (b.itens[0].ancora.dente ?? 99);
    });
}
