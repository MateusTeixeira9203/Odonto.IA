import { z } from 'zod';
import { chaveDedupEvento } from '@/lib/odontograma/dedup-eventos-draft';
import { adicionarProcedimentosFichaSchema } from '@/lib/odontograma/adicionar-procedimentos';
import { TIPO_LABEL, type TipoRegistroOdontograma, type OdontogramaEventoDraft } from '@/types/odontograma';
import { DENTES_FDI } from '@/lib/odonto-dictionary';
import { FACES_LOTE } from '@/lib/odontograma/lote-multidente';
import { fragmentarRelatoClinico } from '@/lib/odontograma/estado-ausencia';
import { casarProcedimentoLocal } from '@/lib/odontograma/casar-procedimento-local';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';

const origemTextoSchema = z.enum(['digitado', 'voz', 'documento', 'audio']);
const dentesValidos = new Set(Object.keys(DENTES_FDI).map(Number));
const especialidadeTabelaSchema = z.enum(['endodontia', 'implante', 'exame_periodontal']);
const idSchema = z.string().min(1);
const blocoTextoSchema = z.object({
  id: idSchema, tipo: z.literal('texto'), texto: z.string(),
  origem: origemTextoSchema, organizado: z.boolean(),
});
const blocoTabelaSchema = z.object({
  id: idSchema, tipo: z.literal('tabela'), especialidade: especialidadeTabelaSchema, eventoId: idSchema,
});
const documentoSchema = z.object({
  versao: z.literal(1),
  blocos: z.array(z.discriminatedUnion('tipo', [blocoTextoSchema, blocoTabelaSchema])),
  idsNaFicha: z.array(idSchema),
}).superRefine((doc, ctx) => {
  const ids = new Set<string>();
  const tabelas = new Set<string>();
  for (const [indice, bloco] of doc.blocos.entries()) {
    if (ids.has(bloco.id)) ctx.addIssue({ code: 'custom', path: ['blocos', indice, 'id'], message: 'ID de bloco repetido.' });
    ids.add(bloco.id);
    if (bloco.tipo === 'tabela') {
      if (tabelas.has(bloco.eventoId)) ctx.addIssue({ code: 'custom', path: ['blocos', indice, 'eventoId'], message: 'Tabela repetida para o evento.' });
      tabelas.add(bloco.eventoId);
    }
  }
});

export type OrigemTexto = z.infer<typeof origemTextoSchema>;
export const LIMITE_TEXTO_SALVAR = 5000;

export function semNovasDuplicatas(
  anteriores: readonly OdontogramaEventoDraft[], proximos: readonly OdontogramaEventoDraft[],
): { eventos: OdontogramaEventoDraft[]; descartados: OdontogramaEventoDraft[] } {
  const idsAnteriores = new Set(anteriores.map((evento) => evento.id));
  const chaves = new Set(proximos.filter((evento) => idsAnteriores.has(evento.id)).map(chaveDedupEvento));
  const eventos: OdontogramaEventoDraft[] = [];
  const descartados: OdontogramaEventoDraft[] = [];
  for (const evento of proximos) {
    const chave = chaveDedupEvento(evento);
    if (!idsAnteriores.has(evento.id) && !evento.assinaturaId && chaves.has(chave)) descartados.push(evento);
    else {
      eventos.push(evento);
      chaves.add(chave);
    }
  }
  return { eventos, descartados };
}

/** No Meu Dia, as faces criadas juntas pelo lote formam uma única linha/evento. */
export function unirFacesDaCaptura(anteriores: readonly OdontogramaEventoDraft[], proximos: readonly OdontogramaEventoDraft[]): OdontogramaEventoDraft[] {
  const idsAnteriores = new Set(anteriores.map((evento) => evento.id));
  const grupos = new Map<string, number>();
  const resultado: OdontogramaEventoDraft[] = [];
  for (const evento of proximos) {
    const captura = evento.chaveCaptura?.split(':')[0];
    if (!captura || idsAnteriores.has(evento.id) || evento.assinaturaId || evento.tipo !== 'carie_restauracao' || evento.ancora.nivel !== 'face') {
      resultado.push(evento);
      continue;
    }
    const chave = JSON.stringify({ ...evento, id: null, chaveCaptura: captura, ancora: { ...evento.ancora, faces: undefined } });
    const indice = grupos.get(chave);
    if (indice === undefined) {
      grupos.set(chave, resultado.length);
      resultado.push(evento);
    } else {
      const primeiro = resultado[indice];
      resultado[indice] = { ...primeiro, ancora: { ...primeiro.ancora, faces: [...new Set([...(primeiro.ancora.faces ?? []), ...(evento.ancora.faces ?? [])])] } };
    }
  }
  return resultado;
}

// Rascunho valida forma, não as exigências de um payload pronto para salvar.
const validacaoEvento = z.object({
  id: z.string(), tipo: z.enum(Object.keys(TIPO_LABEL) as [TipoRegistroOdontograma, ...TipoRegistroOdontograma[]]),
  status: z.enum(['indicado', 'realizado']), origem: z.enum(['clinica', 'preexistente']),
  momento_planejado: z.enum(['sessao_atual', 'proxima_sessao']),
  ancora: adicionarProcedimentosFichaSchema.shape.eventos.element.shape.ancora,
  grupo_id: z.string().nullable(), papel_no_grupo: z.enum(['pilar', 'pontico']).nullable(),
  observacao: z.string(), realizado_em: z.string().nullable(),
  procedimentoId: z.string().nullable().optional(), procedimentoNome: z.string().nullable().optional(),
  encaminhadoParaId: z.string().nullable().optional(), detalhe: z.unknown().optional(),
  evidencia_status: z.enum(['execucao_explicita', 'indicacao_explicita', 'negacao', 'historico', 'ambiguo']).optional(),
  revisar_status: z.boolean().optional(),
  registrado_em: z.string().optional(), created_at: z.string().optional(),
  assinaturaId: z.string().nullable().optional(),
  fonteFluxo: z.enum(['planejado', 'novo']).optional(),
  chaveCaptura: z.string().optional(), autorDentistaId: z.string().optional(), dataIntencao: z.string().optional(),
  endo_revisao: z.object({
    origemPorCampo: z.record(z.string(), z.enum(['deterministico', 'ia', 'manual'])),
    duvidas: z.array(z.object({
      campo: z.string(), trecho: z.string(),
      motivo: z.enum(['sem_canal', 'fora_da_faixa', 'resolucao_invalida', 'conflito']),
    })),
  }).optional(),
});
// A validação não transforma o texto nem descarta os metadados do rascunho.
const eventoSchema = z.custom<OdontogramaEventoDraft>((valor) => validacaoEvento.safeParse(valor).success);
// O schema de orto existente importa componentes React; este contrato de armazenamento é só dados.
const ortoSchema = z.object({
  arcada: z.enum(['superior', 'inferior', 'ambas']),
  fio: z.string().nullable(), ativacao: z.string().nullable(),
  elastico_corrente: z.string().nullable(), elastico_intermaxilar: z.string().nullable(),
  registro_superior: z.string().nullable().optional(), registro_inferior: z.string().nullable().optional(),
  observacao_geral: z.string().nullable().optional(),
  fio_inferior: z.string().nullable().optional(), ativacao_inferior: z.string().nullable().optional(),
  elastico_corrente_inferior: z.string().nullable().optional(), elastico_intermaxilar_inferior: z.string().nullable().optional(),
});
const rascunhoSchema = z.object({
  documento: documentoSchema,
  eventosDraft: z.array(z.unknown()).transform((eventos) => eventos.flatMap((evento) => {
    const resultado = eventoSchema.safeParse(evento);
    return resultado.success ? [resultado.data] : [];
  })),
  textoVisita: z.string(),
  orto: ortoSchema.nullable(), alerta: z.string().nullable(), visitaKey: z.string().uuid(),
});
type RascunhoLegado = z.infer<typeof rascunhoSchema>;
export type IdentidadeRascunho = { clinicaId: string; dentistaId: string; pacienteId: string; agendamentoId: string };

const textoV2Schema = blocoTextoSchema.omit({ organizado: true });
const organizadoV2Schema = z.object({ id: idSchema, tipo: z.literal('organizado'), texto: z.string() });
const observacoesV2Schema = z.object({ id: idSchema, tipo: z.literal('observacoes') });
const procedimentoV2Schema = z.object({
  id: idSchema, tipo: z.literal('procedimento'), eventoId: idSchema, tabelaAberta: z.boolean(),
  origem: z.enum(['dex', 'odontograma', 'reconhecido']),
});
const pendenteV2Schema = z.object({
  id: idSchema, tipo: z.literal('pendente'), numeroInformado: z.string(), trecho: z.string(),
  modelo: z.object({
    tipo: validacaoEvento.shape.tipo, procedimentoNome: z.string(),
    faces: z.array(z.enum(['M', 'O', 'D', 'V', 'L'])),
    situacao: z.enum(['sessao_atual', 'proxima_sessao', 'realizado']), observacao: z.string(),
  }),
});
const blocoV2Schema = z.discriminatedUnion('tipo', [textoV2Schema, organizadoV2Schema, observacoesV2Schema, procedimentoV2Schema, pendenteV2Schema]);
const documentoV2Schema = z.object({
  versao: z.literal(2),
  blocos: z.array(blocoV2Schema),
  pontoInsercao: idSchema.nullable(),
  sequencia: z.number().int().nonnegative().optional(),
}).superRefine((doc, ctx) => {
  const ids = new Set<string>();
  const eventos = new Set<string>();
  let observacoes = 0;
  for (const [indice, bloco] of doc.blocos.entries()) {
    if (ids.has(bloco.id)) ctx.addIssue({ code: 'custom', path: ['blocos', indice], message: 'ID de bloco repetido.' });
    ids.add(bloco.id);
    if (bloco.tipo === 'observacoes') observacoes++;
    if (bloco.tipo === 'procedimento') {
      if (eventos.has(bloco.eventoId)) ctx.addIssue({ code: 'custom', path: ['blocos', indice], message: 'Evento com duas linhas.' });
      eventos.add(bloco.eventoId);
    }
  }
  if (observacoes > 1) ctx.addIssue({ code: 'custom', message: 'Mais de um bloco de observações.' });
});

export type DocumentoAtendimento = z.infer<typeof documentoV2Schema>;
export type Bloco = DocumentoAtendimento['blocos'][number];
export type BlocoTexto = z.infer<typeof textoV2Schema>;
export type BlocoOrganizado = z.infer<typeof organizadoV2Schema>;
export type BlocoObservacoes = z.infer<typeof observacoesV2Schema>;
export type BlocoProcedimento = z.infer<typeof procedimentoV2Schema>;
export type BlocoPendente = z.infer<typeof pendenteV2Schema>;
export type PosicaoTexto = 'inicio' | 'fim' | { antesDe: string } | { depoisDe: string };

function idV2(doc: DocumentoAtendimento, prefixo: Bloco['tipo']): string {
  return `${prefixo}-${sequencia(doc) + 1}`;
}

// Persiste o contador para não reaproveitar a identidade de uma linha removida.
function sequencia(doc: DocumentoAtendimento): number {
  return Math.max(doc.sequencia ?? 0, 0, ...doc.blocos.map((bloco) => Number(bloco.id.match(/-(\d+)$/)?.[1] ?? 0)));
}

function comBlocos(doc: DocumentoAtendimento, blocos: Bloco[]): DocumentoAtendimento {
  const resultado = { ...doc, blocos };
  return { ...resultado, sequencia: sequencia(resultado) };
}

function textoVazioFinal(doc: DocumentoAtendimento): DocumentoAtendimento {
  const ultimo = doc.blocos.at(-1);
  if (ultimo?.tipo === 'texto' && ultimo.texto === '') return doc;
  return comBlocos(doc, [...doc.blocos, { id: idV2(doc, 'texto'), tipo: 'texto', texto: '', origem: 'digitado' }]);
}

export function documentoVazio(): DocumentoAtendimento {
  return { versao: 2, blocos: [{ id: 'texto-1', tipo: 'texto', texto: '', origem: 'digitado' }], pontoInsercao: 'texto-1', sequencia: 1 };
}

export function inserirTextoEm(doc: DocumentoAtendimento, posicao: PosicaoTexto): { doc: DocumentoAtendimento; id: string } {
  let indice = doc.blocos.length;
  if (posicao === 'inicio') indice = 0;
  else if (typeof posicao === 'object') {
    const referencia = 'antesDe' in posicao ? posicao.antesDe : posicao.depoisDe;
    const achado = doc.blocos.findIndex((bloco) => bloco.id === referencia);
    if (achado >= 0) indice = achado + ('depoisDe' in posicao ? 1 : 0);
  }
  const id = idV2(doc, 'texto');
  const bloco: BlocoTexto = { id, tipo: 'texto', texto: '', origem: 'digitado' };
  return { doc: { ...comBlocos(doc, [...doc.blocos.slice(0, indice), bloco, ...doc.blocos.slice(indice)]), pontoInsercao: id }, id };
}

export function editarTexto(doc: DocumentoAtendimento, id: string, texto: string): DocumentoAtendimento {
  return { ...doc, blocos: doc.blocos.map((bloco) => bloco.id === id && bloco.tipo === 'texto' ? { ...bloco, texto } : bloco) };
}

export function apagarSeVazio(doc: DocumentoAtendimento, id: string): DocumentoAtendimento {
  const alvo = doc.blocos.find((bloco) => bloco.id === id);
  if (alvo?.tipo !== 'texto' || alvo.texto !== '') return doc;
  const resultado = textoVazioFinal(comBlocos({ ...doc, sequencia: sequencia(doc) }, doc.blocos.filter((bloco) => bloco.id !== id)));
  return { ...resultado, pontoInsercao: doc.pontoInsercao === id ? resultado.blocos.at(-1)?.id ?? null : doc.pontoInsercao };
}

export function vizinho(doc: DocumentoAtendimento, id: string, direcao: 'acima' | 'abaixo'): string | null {
  const indice = doc.blocos.findIndex((bloco) => bloco.id === id);
  return indice < 0 ? null : doc.blocos[indice + (direcao === 'acima' ? -1 : 1)]?.id ?? null;
}

export function definirPontoInsercao(doc: DocumentoAtendimento, id: string | null): DocumentoAtendimento {
  return id === null || doc.blocos.some((bloco) => bloco.id === id) ? { ...doc, pontoInsercao: id } : doc;
}

export function acrescentarTexto(doc: DocumentoAtendimento, texto: string, origem: OrigemTexto): DocumentoAtendimento {
  const foco = doc.blocos.find((bloco) => bloco.id === doc.pontoInsercao);
  if (foco?.tipo === 'texto' && (foco.origem === origem || foco.texto === '')) {
    return { ...doc, blocos: doc.blocos.map((bloco) => bloco.id === foco.id ? { ...foco, texto: foco.texto + texto, origem } : bloco) };
  }
  const insercao = inserirTextoEm(doc, foco ? { depoisDe: foco.id } : 'fim');
  return { ...insercao.doc, blocos: insercao.doc.blocos.map((bloco) => bloco.id === insercao.id && bloco.tipo === 'texto' ? { ...bloco, texto, origem } : bloco) };
}

export function sincronizarEventos(doc: DocumentoAtendimento, eventos: readonly Pick<OdontogramaEventoDraft, 'id'>[]): DocumentoAtendimento {
  const atuais = new Set(eventos.map((evento) => evento.id));
  let resultado = comBlocos({ ...doc, sequencia: sequencia(doc) }, doc.blocos.filter((bloco) => bloco.tipo !== 'procedimento' || atuais.has(bloco.eventoId)));
  const representados = new Set(resultado.blocos.flatMap((bloco) => bloco.tipo === 'procedimento' ? [bloco.eventoId] : []));
  const indiceAnterior = doc.blocos.findIndex((bloco) => bloco.id === doc.pontoInsercao);
  const focoId = doc.blocos.slice(0, indiceAnterior + 1).reverse().find((bloco) => resultado.blocos.some((atual) => atual.id === bloco.id))?.id;
  const indiceFoco = resultado.blocos.findIndex((bloco) => bloco.id === focoId);
  const foco = resultado.blocos[indiceFoco];
  const focoVazio = foco?.tipo === 'texto' && foco.texto === '';
  let posicao = indiceFoco < 0 ? 0 : indiceFoco + (focoVazio ? 0 : 1);
  let inseriu = false;
  for (const evento of eventos) {
    if (representados.has(evento.id)) continue;
    const linha: BlocoProcedimento = { id: idV2(resultado, 'procedimento'), tipo: 'procedimento', eventoId: evento.id, tabelaAberta: false, origem: 'odontograma' };
    resultado = comBlocos(resultado, [...resultado.blocos.slice(0, posicao), linha, ...resultado.blocos.slice(posicao)]);
    representados.add(evento.id);
    inseriu = true;
    posicao++;
  }
  resultado = textoVazioFinal(resultado);
  if (inseriu || !resultado.blocos.some((bloco) => bloco.id === resultado.pontoInsercao)) resultado = { ...resultado, pontoInsercao: focoVazio ? foco.id : resultado.blocos.at(-1)?.id ?? null };
  return resultado;
}

export function relatoParaDex(doc: DocumentoAtendimento): { texto: string; modo: 'consulta' | 'exame_inicial'; idsBlocos: string[] } | null {
  const blocos = doc.blocos.filter((bloco): bloco is BlocoTexto => bloco.tipo === 'texto' && bloco.texto.trim() !== '');
  if (blocos.length === 0) return null;
  return {
    texto: blocos.map((bloco) => bloco.texto).join('\n\n'),
    modo: blocos.some((bloco) => bloco.origem === 'documento') ? 'exame_inicial' : 'consulta',
    idsBlocos: blocos.map((bloco) => bloco.id),
  };
}

export interface OrganizacaoDocumento {
  idsEnviados: readonly string[];
  textoEnviado: string;
  eventosNovosEmOrdem: readonly Pick<OdontogramaEventoDraft, 'id'>[];
  pendentes: readonly BlocoPendente[];
  /** Snapshot opcional permite conferir cada bloco separadamente em respostas tardias. */
  blocosEnviados?: readonly Pick<BlocoTexto, 'id' | 'texto'>[];
}

export function aplicarOrganizacao(doc: DocumentoAtendimento, resposta: OrganizacaoDocumento): DocumentoAtendimento {
  const enviados = new Set(resposta.idsEnviados);
  const textos = doc.blocos.filter((bloco): bloco is BlocoTexto => bloco.tipo === 'texto' && enviados.has(bloco.id));
  const todosIguais = textos.map((bloco) => bloco.texto).join('\n\n') === resposta.textoEnviado;
  const inalterados = new Set(textos.filter((bloco) => resposta.blocosEnviados
    ? resposta.blocosEnviados.some((original) => original.id === bloco.id && original.texto === bloco.texto)
    : todosIguais).map((bloco) => bloco.id));
  const indice = doc.blocos.findIndex((bloco) => bloco.tipo === 'texto' && enviados.has(bloco.id));
  let resultado = comBlocos({ ...doc, sequencia: sequencia(doc) }, doc.blocos.filter((bloco) => !inalterados.has(bloco.id)));
  let posicao = indice < 0 ? resultado.blocos.length : indice;
  function inserir(bloco: Bloco) {
    resultado = comBlocos(resultado, [...resultado.blocos.slice(0, posicao), bloco, ...resultado.blocos.slice(posicao)]);
    posicao++;
  }
  if (indice >= 0 && resposta.textoEnviado.trim() !== '') inserir({ id: idV2(resultado, 'organizado'), tipo: 'organizado', texto: resposta.textoEnviado });
  if (!resultado.blocos.some((bloco) => bloco.tipo === 'observacoes')) inserir({ id: idV2(resultado, 'observacoes'), tipo: 'observacoes' });
  const representados = new Set(resultado.blocos.flatMap((bloco) => bloco.tipo === 'procedimento' ? [bloco.eventoId] : []));
  for (const evento of resposta.eventosNovosEmOrdem) {
    if (representados.has(evento.id)) continue;
    inserir({ id: idV2(resultado, 'procedimento'), tipo: 'procedimento', eventoId: evento.id, tabelaAberta: false, origem: 'dex' });
    representados.add(evento.id);
  }
  for (const pendente of resposta.pendentes) {
    inserir({ ...pendente, id: resultado.blocos.some((bloco) => bloco.id === pendente.id) ? idV2(resultado, 'pendente') : pendente.id });
  }
  resultado = textoVazioFinal(resultado);
  return { ...resultado, pontoInsercao: resultado.blocos.at(-1)?.id ?? null };
}

export function resolverPendente(
  doc: DocumentoAtendimento, id: string, dente: number,
  criar: (modelo: BlocoPendente['modelo'], dente: number) => OdontogramaEventoDraft,
): { doc: DocumentoAtendimento; evento: OdontogramaEventoDraft | null } {
  const bloco = doc.blocos.find((bloco) => bloco.id === id);
  if (bloco?.tipo !== 'pendente' || !Number.isInteger(dente) || !dentesValidos.has(dente)) return { doc, evento: null };
  const evento = criar(structuredClone(bloco.modelo), dente);
  return {
    doc: { ...doc, blocos: doc.blocos.map((atual) => atual.id === id
      ? { id, tipo: 'procedimento', eventoId: evento.id, tabelaAberta: false, origem: 'reconhecido' } : atual) },
    evento,
  };
}

function trechosClinicos(texto: string): string[] {
  return (texto.match(/[^.!?;\n]+[.!?;]?/g) ?? []).flatMap((frase) =>
    fragmentarRelatoClinico(frase).map((trecho) => frase.includes('?') ? `${trecho}?` : trecho));
}

function analisarTrecho(trecho: string, catalogo: MeuDiaCatalogoProcedimento[]) {
  const normalizado = trecho.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sugestoes = casarProcedimentoLocal(trecho, catalogo);
  const execucao = /\b(realizei|fiz|executei|extrai|foi feit[oa])\b/;
  const duvida = /\?|\b(talvez|avaliar|duvida|confirmar|nao)\b/.test(normalizado);
  const negado = [...normalizado.matchAll(/\b(nao|sem|evitar|descartar)\b/g)].some((negacao) => {
    const antes = normalizado.slice(0, negacao.index);
    if (execucao.test(antes) || casarProcedimentoLocal(antes, catalogo).some((sugestao) => sugestao.tipo)) return false;
    return negacao[0] !== 'sem' || /^\s*(fazer|realizar|executar|extrair)\b/.test(normalizado.slice(negacao.index + negacao[0].length));
  });
  const faces: BlocoPendente['modelo']['faces'] = [];
  const numero = trecho.search(/\b(?:dente\s*|d\s*)?\d+\b/i);
  for (const token of trecho.matchAll(/\b[modvl]+\b/gi)) {
    if (/^\s*\d/.test(trecho.slice(token.index + token[0].length))) continue;
    if (['do', 'o'].includes(token[0].toLowerCase()) && (token[0] !== token[0].toUpperCase() || token.index < numero)) continue;
    for (const letra of token[0].toUpperCase()) {
      const face = FACES_LOTE.find((face) => face === letra);
      if (face && !faces.includes(face)) faces.push(face);
    }
  }
  return { sugestoes, faces, duvida, negado, realizado: execucao.test(normalizado) && !duvida && !negado };
}

export function pendentesDeDenteInvalido(texto: string, catalogo: MeuDiaCatalogoProcedimento[] = []): BlocoPendente[] {
  const pendentes: BlocoPendente[] = [];
  for (const trecho of trechosClinicos(texto)) {
    const referencias = [...trecho.matchAll(/\b(?:dente\s+|d\s*)(\d{2})(?!\d|[.,/]\d|\s*(?:mm|cm|anos)\b)/gi)];
    const { sugestoes, faces, negado, duvida, realizado } = analisarTrecho(trecho, catalogo);
    const tipos = [...new Set(sugestoes.flatMap((sugestao) => sugestao.tipo ? [sugestao.tipo] : []))];
    if (negado || duvida || tipos.length !== 1) continue;
    const tipo = tipos[0];
    const nomes = sugestoes.flatMap((sugestao) => sugestao.catalogo ? [sugestao.catalogo.nome] : []);
    for (const referencia of referencias) {
      if (dentesValidos.has(Number(referencia[1]))) continue;
      pendentes.push({
        id: `pendente-${pendentes.length + 1}`, tipo: 'pendente', numeroInformado: referencia[1], trecho,
        modelo: { tipo, procedimentoNome: nomes.length === 1 ? nomes[0] : TIPO_LABEL[tipo], faces,
          situacao: realizado ? 'realizado' : 'sessao_atual', observacao: '' },
      });
    }
  }
  return pendentes;
}

/** Só o Meu Dia usa este reconhecimento por gesto; nunca é uma chamada de IA. */
export function reconhecerDocumento(texto: string, catalogo: MeuDiaCatalogoProcedimento[]) {
  const pendentes = pendentesDeDenteInvalido(texto, catalogo);
  const tiposDeBoca = new Set<TipoRegistroOdontograma>(['profilaxia', 'clareamento', 'fluor', 'exame_periodontal']);
  const sugestoes = trechosClinicos(texto).flatMap((trecho) => {
    const analise = analisarTrecho(trecho, catalogo);
    if (analise.negado || analise.duvida) return [];
    return analise.sugestoes.flatMap((sugestao) => {
      const numerosClinicos = new Set([...trecho.matchAll(/(?<![\d/])\d{2}(?![\d/,]|\s*(?:mm|cm|anos)\b)/gi)].map((numero) => Number(numero[0])));
      sugestao = { ...sugestao, dentes: sugestao.dentes.filter((dente) => numerosClinicos.has(dente)) };
      if (!sugestao.tipo || (!sugestao.dentes.length && !tiposDeBoca.has(sugestao.tipo))) return [];
      return [{ sugestao, trecho, faces: analise.faces, realizado: analise.realizado }];
    });
  });
  const avisos: string[] = [];
  for (const trecho of texto.split(/[.!?;\n]+/).map((trecho) => trecho.trim()).filter(Boolean)) {
    const tipos = new Set(casarProcedimentoLocal(trecho, catalogo).flatMap((item) => item.tipo ? [item.tipo] : []));
    if (tipos.size > 1) avisos.push(`Trecho com mais de um procedimento: confira as linhas e o texto original. “${trecho}”`);
    for (const referencia of trecho.matchAll(/\b(?:dente\s+|d\s*)(\d+)(?!\d|[.,/]\d|\s*(?:mm|cm|anos)\b)/gi)) {
      if (Object.hasOwn(DENTES_FDI, Number(referencia[1]))) continue;
      if (!pendentes.some((pendente) => pendente.numeroInformado === referencia[1] && trecho.includes(pendente.trecho))) {
        avisos.push(`Dente ${referencia[1]} não existe: confira qual dente e procedimento foram informados. “${trecho}”`);
      }
    }
  }
  return { pendentes, sugestoes, avisos: [...new Set(avisos)] };
}

export function removerPendente(doc: DocumentoAtendimento, id: string) {
  const indice = doc.blocos.findIndex((bloco) => bloco.id === id && bloco.tipo === 'pendente');
  if (indice < 0) return { doc, removido: null };
  const bloco = doc.blocos[indice] as BlocoPendente;
  const blocos = doc.blocos.filter((item) => item.id !== id);
  return { doc: { ...doc, blocos, pontoInsercao: doc.pontoInsercao === id ? blocos[Math.max(0, indice - 1)]?.id ?? null : doc.pontoInsercao }, removido: { bloco, indice } };
}

export function restaurarPendente(doc: DocumentoAtendimento, removido: { bloco: BlocoPendente; indice: number }) {
  if (doc.blocos.some((bloco) => bloco.id === removido.bloco.id)) return doc;
  return { ...doc, blocos: [...doc.blocos.slice(0, removido.indice), removido.bloco, ...doc.blocos.slice(removido.indice)] };
}

export function temConteudo(doc: DocumentoAtendimento): boolean {
  return doc.blocos.some((bloco) => bloco.tipo !== 'texto' || bloco.texto.trim() !== '');
}

export function textoNaoOrganizado(doc: DocumentoAtendimento): string {
  return relatoParaDex(doc)?.texto ?? '';
}

export function textoParaSalvar(textoVisita: string, doc: DocumentoAtendimento, incluirNaoOrganizado: boolean): { texto: string; tamanho: number; excede: boolean } {
  const pendentes = doc.blocos.filter((bloco): bloco is BlocoPendente => bloco.tipo === 'pendente')
    .map((bloco) => `${bloco.modelo.procedimentoNome} — dente ${bloco.numeroInformado} informado, sem dente válido\n${bloco.trecho}`);
  const texto = [textoVisita, ...(incluirNaoOrganizado ? [textoNaoOrganizado(doc)] : []), ...pendentes].filter((trecho) => trecho !== '').join('\n\n');
  return { texto, tamanho: texto.length, excede: texto.length > LIMITE_TEXTO_SALVAR };
}

const leituraDocumentoV2Schema = z.object({
  versao: z.literal(2), blocos: z.array(z.unknown()), pontoInsercao: idSchema.nullable().catch(null),
  sequencia: z.number().int().nonnegative().optional(),
}).superRefine((doc, ctx) => {
  const ids = new Set<string>();
  let observacoes = 0;
  for (const bloco of doc.blocos) {
    const dado = z.record(z.string(), z.unknown()).safeParse(bloco);
    if (!dado.success) continue;
    if (typeof dado.data.id === 'string') {
      if (ids.has(dado.data.id)) ctx.addIssue({ code: 'custom', message: 'ID de bloco repetido.' });
      ids.add(dado.data.id);
    }
    if (dado.data.tipo === 'observacoes') observacoes++;
  }
  if (observacoes > 1) ctx.addIssue({ code: 'custom', message: 'Mais de um bloco de observações.' });
}).transform((doc) => {
  const usados = new Set(doc.blocos.flatMap((bloco) => {
    const dado = z.object({ id: z.string() }).safeParse(bloco);
    return dado.success ? [dado.data.id] : [];
  }));
  const blocos = doc.blocos.flatMap((bloco): Bloco[] => {
    const valido = blocoV2Schema.safeParse(bloco);
    if (valido.success) return [valido.data];
    const recuperavel = z.object({ id: idSchema.optional(), texto: z.string() }).safeParse(bloco);
    if (!recuperavel.success) return [];
    let id = recuperavel.data.id;
    if (!id) {
      let numero = 1;
      while (usados.has(`recuperado-${numero}`)) numero++;
      id = `recuperado-${numero}`;
      usados.add(id);
    }
    return [{ id, tipo: 'texto', texto: recuperavel.data.texto, origem: 'digitado' }];
  });
  return { ...doc, blocos };
}).pipe(documentoV2Schema);
const leituraV2Schema = rascunhoSchema.omit({ documento: true }).extend({ documento: z.union([leituraDocumentoV2Schema, documentoSchema]) });
export type RascunhoAtendimento = Omit<RascunhoLegado, 'documento'> & { documento: DocumentoAtendimento };

function converterV1(rascunho: RascunhoLegado): DocumentoAtendimento {
  let doc: DocumentoAtendimento = {
    versao: 2, pontoInsercao: null,
    blocos: rascunho.documento.blocos.map((bloco): Bloco => {
      if (bloco.tipo === 'tabela') return { id: bloco.id, tipo: 'procedimento', eventoId: bloco.eventoId, tabelaAberta: true, origem: 'odontograma' };
      return bloco.organizado ? { id: bloco.id, tipo: 'organizado', texto: bloco.texto }
        : { id: bloco.id, tipo: 'texto', texto: bloco.texto, origem: bloco.origem };
    }),
  };
  if (rascunho.textoVisita || rascunho.documento.idsNaFicha.length > 0) {
    const indice = doc.blocos.findIndex((bloco) => bloco.tipo === 'organizado');
    const posicao = indice < 0 ? 0 : indice + 1;
    doc = { ...doc, blocos: [...doc.blocos.slice(0, posicao), { id: idV2(doc, 'observacoes'), tipo: 'observacoes' }, ...doc.blocos.slice(posicao)] };
  }
  const idsDex = new Set(rascunho.documento.idsNaFicha);
  const tabelas = new Set(doc.blocos.flatMap((bloco) => bloco.tipo === 'procedimento' ? [bloco.eventoId] : []));
  doc = sincronizarEventos(doc, rascunho.eventosDraft);
  return { ...doc, blocos: doc.blocos.map((bloco) => bloco.tipo === 'procedimento' && idsDex.has(bloco.eventoId) && !tabelas.has(bloco.eventoId) ? { ...bloco, origem: 'dex' } : bloco) };
}

export function lerRascunho(json: string): { ok: true; rascunho: RascunhoAtendimento } | { ok: false } {
  try {
    const dado: unknown = JSON.parse(json);
    const resultado = leituraV2Schema.safeParse(dado);
    if (!resultado.success) return { ok: false };
    const rascunho = resultado.data;
    const documento = rascunho.documento.versao === 1
      ? converterV1({ ...rascunho, documento: rascunho.documento }) : sincronizarEventos(rascunho.documento, rascunho.eventosDraft);
    return { ok: true, rascunho: { ...rascunho, documento } };
  } catch {
    return { ok: false };
  }
}

export function serializarRascunho(rascunho: RascunhoAtendimento): string {
  return JSON.stringify(rascunho);
}

export function chaveRascunho(ids: IdentidadeRascunho): string {
  return `odontoia:meu-dia:rascunho:v2:${ids.clinicaId}:${ids.dentistaId}:${ids.pacienteId}:${ids.agendamentoId}`;
}

