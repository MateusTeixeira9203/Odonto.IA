import type {
  FaceDental, OdontogramaEventoDraft, TipoRegistroOdontograma,
} from '@/types/odontograma';
import { criarEventosContextuais, type ContextoLancamento } from '@/lib/odontograma/criar-eventos-contextuais';

/**
 * R-109 — o lote multidente, extraído de `registrar-painel.tsx` (R-107d §3) pra que a ficha
 * consuma o MESMO mecanismo em vez de uma cópia. Cópia diverge; foi o que o R-107a já tinha
 * provado ao extrair `rotina-boca.ts` no sentido contrário (da ficha pro Meu dia).
 *
 * **Puras de propósito.** Cada função devolve só os eventos NOVOS; quem chama é que concatena
 * no rascunho e mexe no próprio estado de UI (desligar o Modo multidente, limpar a busca). Sem
 * isso o módulo carregaria os setters de uma tela só e não serviria pra outra — que é
 * exatamente o problema que ele existe pra resolver.
 *
 * O contexto manual é explícito e compartilhado com a ficha: o mesmo chip pode nascer como
 * realizado, indicado, próxima sessão ou pré-existente sem criar um terceiro status no banco.
 */

/** R-107d — chips oferecidos em lote (subconjunto de `TIPO_LABEL`, spec §3). Ponte fica de
 *  fora (fluxo próprio extremo→extremo); Restauração entra à parte (pede face antes, não
 *  cria direto como os outros). */
export const CHIPS_LOTE: TipoRegistroOdontograma[] = [
  'endodontia', 'coroa', 'implante', 'pino_nucleo', 'exodontia', 'fratura', 'lesao_periapical',
];

export const FACES_LOTE: FaceDental[] = ['V', 'M', 'O', 'D', 'L'];

/**
 * Chip dente-inteiro em lote: cria em todos os dentes de uma vez, sem cycle (mesma filosofia
 * do caminho digitado). Guard simples contra duplicata óbvia: pula dente que já tem esse tipo
 * com origem clínica — não impede o dentista de repetir de propósito por outro caminho, só
 * evita clique duplo criando 2 idênticos sem querer.
 */
export function eventosDoLote(
  tipo: TipoRegistroOdontograma,
  dentes: number[],
  eventosDraft: OdontogramaEventoDraft[],
  dataPadrao: string,
  contexto: ContextoLancamento,
  procedimento?: { id: string | null; nome: string | null },
): OdontogramaEventoDraft[] {
  const modo = contexto.modo;
  return criarEventosContextuais({
    tipo,
    procedimentoId: procedimento?.id ?? null,
    procedimentoNome: procedimento?.nome ?? null,
    dataPadrao,
    contexto,
    ancoras: dentes
      .filter((d) => !eventosDraft.some((e) => e.tipo === tipo && e.origem === (modo === 'preexistente' ? 'preexistente' : 'clinica') && e.ancora.dente === d))
      .map((d) => ({ nivel: 'dente', dente: d })),
  });
}

/**
 * Restauração em lote pede a face 1x (não os outros tipos): consulta em produção mostrou quase
 * metade das fichas com 4+ dentes tendo faces DIFERENTES por dente — aplicar sem perguntar
 * estaria errado na metade dos casos (R-107d §2). Face diferente por dente continua fora,
 * dente a dente.
 *
 * A identidade da intenção é comparada na entrada do draft, não por dedup global no save.
 */
export function eventosDoLoteRestauracao(
  face: FaceDental,
  dentes: number[],
  dataPadrao: string,
  contexto: ContextoLancamento,
  autorDentistaId?: string,
): OdontogramaEventoDraft[] {
  return criarEventosContextuais({
    tipo: 'carie_restauracao',
    dataPadrao,
    contexto,
    ancoras: dentes.map((d) => ({ nivel: 'face', dente: d, faces: [face] })),
  }).map((evento) => ({ ...evento, autorDentistaId, dataIntencao: dataPadrao }));
}

/** Só propostas do lote; nunca remove nem reescreve eventos já no rascunho. */
export function acrescentarRestauracoesDoLote(
  atuais: OdontogramaEventoDraft[],
  propostas: OdontogramaEventoDraft[],
): OdontogramaEventoDraft[] {
  const chaves = new Set(atuais.filter((evento) => !evento.assinaturaId).map(chaveIntencaoRestauracao).filter((chave) => chave !== null));
  const novos: OdontogramaEventoDraft[] = [];
  for (const evento of propostas) {
    const chave = chaveIntencaoRestauracao(evento);
    if (chave !== null && chaves.has(chave)) continue;
    if (chave !== null) chaves.add(chave);
    novos.push(evento);
  }
  return novos.length > 0 ? [...atuais, ...novos] : atuais;
}

function chaveIntencaoRestauracao(evento: OdontogramaEventoDraft): string | null {
  if (evento.tipo !== 'carie_restauracao' || evento.ancora.nivel !== 'face' ||
      evento.ancora.dente == null || !evento.autorDentistaId) return null;
  // Em evento realizado na clínica, a data clínica pode ser editada após criar o lote.
  // A intenção atual deve acompanhar essa edição; dataIntencao guarda só a data inicial.
  const data = evento.status === 'realizado' && evento.origem === 'clinica'
    ? evento.realizado_em
    : evento.dataIntencao ?? evento.realizado_em ?? evento.registrado_em;
  if (!data) return null;
  return JSON.stringify([
    evento.tipo, evento.ancora.dente, [...(evento.ancora.faces ?? [])].sort(),
    data, evento.status, evento.origem, evento.momento_planejado,
    evento.autorDentistaId, evento.encaminhadoParaId ?? null,
    evento.procedimentoId ?? null, evento.procedimentoNome ?? null,
    evento.grupo_id, evento.papel_no_grupo,
    evento.observacao, evento.detalhe ?? null,
  ]);
}

/**
 * "Dente ausente" em lote: mesma regra do R-107b (`exodontia` + `origem: 'preexistente'`),
 * batelada. Não colide com "Extração" por dente porque `cycleDenteTipo`/chips de dente único
 * já filtram por origem — aqui é só criação em massa, sem cycle, mesmo guard do `eventosDoLote`.
 *
 * `realizado_em: null` de propósito: ausência preexistente não tem data de execução.
 */
export function eventosDoLoteAusente(
  dentes: number[],
  eventosDraft: OdontogramaEventoDraft[],
  dataPadrao: string,
  contexto: ContextoLancamento,
): OdontogramaEventoDraft[] {
  return criarEventosContextuais({
    tipo: 'exodontia',
    dataPadrao,
    contexto: { ...contexto, modo: 'preexistente' },
    ancoras: dentes
      .filter((d) => !eventosDraft.some((e) => e.tipo === 'exodontia' && e.origem === 'preexistente' && e.ancora.dente === d))
      .map((d) => ({ nivel: 'dente', dente: d })),
  });
}

/**
 * Nada casou na busca: escape hatch do R-107b (`outro`), em lote. O termo digitado vira a
 * observação — é o que aparece no card e no que o dentista reconhece depois.
 */
export function eventosDoLoteAvulso(
  texto: string,
  dentes: number[],
  dataPadrao: string,
  contexto: ContextoLancamento,
  procedimentoId: string | null = null,
): OdontogramaEventoDraft[] {
  return criarEventosContextuais({
    tipo: 'outro',
    procedimentoId,
    procedimentoNome: texto.trim(),
    dataPadrao,
    contexto,
    observacao: texto,
    ancoras: dentes.map((d) => ({ nivel: 'dente', dente: d })),
  });
}
