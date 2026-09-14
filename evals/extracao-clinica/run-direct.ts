/**
 * Eval direto do Dex para congelar um baseline sem depender de sessão/autorização HTTP.
 *
 * No modo baseline ele lê prompt, schema e pós-processamento do commit BASELINE_COMMIT com
 * `git show`; no modo candidato ele lê a árvore de trabalho. Assim, a rota pode mudar durante
 * a execução sem contaminar a comparação histórica. A única chamada
 * externa é ao Gemini real, via o provider do projeto e com feature própria de observabilidade.
 * Os relatos do golden são estritamente sintéticos.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { Type, type Schema } from '@google/genai';
import { generateStructuredGemini } from '@/lib/ai/provider';
import { buildDentalContext } from '@/lib/odonto-dictionary';

const ROOT = process.cwd();
const BASELINE_COMMIT = process.env.DEX_EVAL_BASELINE_COMMIT ?? '14fde60';
const TARGET = process.env.DEX_EVAL_TARGET ?? 'baseline';
const OUT = process.env.EVAL_OUT_DIR ?? join(ROOT, 'evals/extracao-clinica/results');
const GOLDEN = join(ROOT, 'evals/extracao-clinica/golden.json');
const PACE_MS = Number.parseInt(process.env.EVAL_PACE_MS ?? '800', 10);
const CASE_LIMIT = Number.parseInt(process.env.EVAL_CASE_LIMIT ?? '', 10);
const CASE_IDS = new Set((process.env.EVAL_CASE_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean));
const PROVIDER_TIMEOUT_MS = Number.parseInt(process.env.EVAL_PROVIDER_TIMEOUT_MS ?? '', 10);
const INCLUDE_PIPELINE = process.env.EVAL_INCLUDE_PIPELINE === '1';
// Materializado uma vez, antes das chamadas: mudanças concorrentes no checkout não alteram o lote.
const DENTAL_CONTEXT = buildDentalContext();
const DENTAL_CONTEXT_SHA256 = createHash('sha256').update(DENTAL_CONTEXT).digest('hex');

type Modo = 'consulta' | 'exame_inicial';
type Evento = {
  tipo: string;
  status: string;
  evidencia_status: string;
  observacao: string;
  procedimentoNome?: string | null;
  ancora: { nivel: string; dente?: number; arcada?: string; quadrante?: number; faces?: string[] };
};
type Resposta = {
  odontograma_eventos: Evento[];
  orto_manutencao: Record<string, unknown> | null;
  procedimentos: string[];
  eventosAntesReconciliacao: Evento[];
};
type EventoEsperado = {
  tipo?: string;
  status?: string;
  evidencia_status?: string;
  dente?: number;
  nivel?: string;
  arcada?: string;
  faces?: string[];
  nomeInclui?: string[];
};
type Caso = {
  id: string;
  cat: string;
  repetir?: number;
  relato: string;
  modo?: Modo;
  esperado: { eventos?: EventoEsperado[]; proibido?: EventoEsperado[]; exato?: boolean; orto?: null | { arcada: string; camposPreenchidos?: string[]; camposDistintos?: string[] } };
};
type Golden = { casos: Caso[] };
type Resultado = {
  id: string;
  execucao: number;
  cat: string;
  ok: boolean;
  erro?: string;
  esperados: number;
  casados: number;
  faltando: EventoEsperado[];
  proibidosHit: EventoEsperado[];
  extras: number;
  extrasEventos: Array<Pick<Evento, 'tipo' | 'status' | 'evidencia_status' | 'observacao' | 'procedimentoNome' | 'ancora'>>;
  ortoOk: boolean | null;
  latenciaMs?: number;
  outputItems?: number;
  pipeline?: {
    procedimentos: string[];
    eventosAntesReconciliacao: Evento[];
    eventosDepoisReconciliacao: Evento[];
  };
};

type Parser = {
  parseEventos: (wire: unknown, modo: Modo) => Evento[];
  parseOrto: (wire: unknown) => Record<string, unknown> | null;
  isValidFDI: (numero: number) => boolean;
};
type Reconciliador = (input: { procedimentos: readonly string[]; eventos: readonly Evento[]; dentesObservacoes: Readonly<Record<string, string>>; modo: Modo }) => { eventos: Evento[] };
type Ausencias = (texto: string, eventos: readonly Evento[]) => Evento[];
type Pipeline = {
  schema: Schema;
  prompt: (texto: string, modo: Modo) => string;
  parser: Parser;
  reconciliar: Reconciliador;
  ausencias: Ausencias;
  thinkingBudget: number;
  fontesSha256: Record<string, string>;
};

function lerVersao(path: string): string {
  return execFileSync('git', ['show', `${BASELINE_COMMIT}:${path}`], { cwd: ROOT, encoding: 'utf8' });
}

function lerFonte(path: string): string {
  if (TARGET === 'baseline') return lerVersao(path);
  if (TARGET === 'candidate') return readFileSync(join(ROOT, path), 'utf8');
  throw new Error(`DEX_EVAL_TARGET inválido: ${TARGET}. Use baseline ou candidate.`);
}

function removerImports(source: string): string {
  return source.replace(/^import[\s\S]*?;\n/gm, '');
}

function compilarModulo<T>(source: string, nomes: readonly string[], deps: Record<string, unknown>): T {
  const saida = `${removerImports(source)}\nmodule.exports = { ${nomes.join(', ')} };`;
  const js = ts.transpileModule(saida, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} as T };
  const argumentos = ['module', 'exports', ...Object.keys(deps)];
  const valores = [compiledModule, compiledModule.exports, ...Object.values(deps)];
  // As fontes vêm exclusivamente de um commit local conhecido; não há entrada do golden aqui.
  new Function(...argumentos, js)(...valores);
  return compiledModule.exports;
}

function montarSchema(route: string): Schema {
  const inicio = route.indexOf('const ODONTOGRAMA_EVENTO_SCHEMA: Schema =');
  const fim = route.indexOf('// FDI estrito', inicio);
  if (inicio < 0 || fim < 0) throw new Error('Não foi possível localizar schemas do baseline.');
  const trecho = route.slice(inicio, fim).replace(/: Schema/g, '');
  return new Function('Type', `${trecho}\nreturn EVOLUCAO_SCHEMA;`)(Type) as Schema;
}

function montarPrompt(route: string): (texto: string, modo: Modo) => string {
  const inicio = route.indexOf('const prompt = `');
  const fim = route.indexOf('`;\n\n    const aiStartedAt', inicio);
  if (inicio < 0 || fim < 0) throw new Error('Não foi possível localizar prompt do baseline.');
  const literal = route.slice(route.indexOf('`', inicio), fim + 1);
  const fabricar = new Function('buildDentalContext', 'entrada', 'modo', `return ${literal};`) as (
    contexto: typeof buildDentalContext,
    entrada: { data: { texto: string } },
    modo: Modo,
  ) => string;
  return (texto, modo) => fabricar(() => DENTAL_CONTEXT, { data: { texto } }, modo);
}

function hashFonte(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function extrairThinkingBudget(route: string): number {
  const inicio = route.indexOf('generateStructuredGemini<EvolucaoWire>({');
  const fim = route.indexOf('});', inicio);
  if (inicio < 0 || fim < 0) throw new Error('Não foi possível localizar chamada Gemini do alvo.');
  const valor = route.slice(inicio, fim).match(/thinkingBudget\s*:\s*(\d+)/)?.[1];
  const budget = valor == null ? 0 : Number(valor);
  if (!Number.isInteger(budget) || budget < 0) throw new Error('thinkingBudget inválido na chamada Gemini do alvo.');
  return budget;
}

function carregarPipeline(): Pipeline {
  const route = lerFonte('src/app/api/dex/formatar-evolucao/route.ts');
  const classificarFonte = lerFonte('src/lib/dex/classificar-status.ts');
  const bitolaFonte = lerFonte('src/lib/especialidades/normalizar-bitola-orto.ts');
  const arcadasFonte = lerFonte('src/lib/arcadas.ts');
  const reconciliarFonte = lerFonte('src/lib/dex/reconciliar-procedimentos.ts');
  const ausenciasFonte = lerFonte('src/lib/odontograma/estado-ausencia.ts');
  const classificar = compilarModulo<{ classificarStatusDex: unknown }>(
    classificarFonte, ['classificarStatusDex'], {},
  ).classificarStatusDex;
  const bitola = compilarModulo<{ normalizarBitolaOrto: unknown }>(
    bitolaFonte, ['normalizarBitolaOrto'], {},
  ).normalizarBitolaOrto;
  if (typeof classificar !== 'function' || typeof bitola !== 'function') throw new Error('Helpers do baseline inválidos.');
  const parserInicio = route.indexOf('// FDI estrito');
  const parserFim = route.indexOf('export async function POST', parserInicio);
  if (parserInicio < 0 || parserFim < 0) throw new Error('Não foi possível localizar parser do baseline.');
  const parser = compilarModulo<Parser>(route.slice(parserInicio, parserFim), ['parseEventos', 'parseOrto', 'isValidFDI'], {
    classificarStatusDex: classificar,
    normalizarBitolaOrto: bitola,
  });
  const arcadas = compilarModulo<{
    ARCH_SUPERIOR: number;
    ARCH_INFERIOR: number;
    ARCH_COMPLETA: number;
    isQuadrante: (numero: number) => boolean;
  }>(
    arcadasFonte, ['ARCH_SUPERIOR', 'ARCH_INFERIOR', 'ARCH_COMPLETA', 'isQuadrante'], {},
  );
  const reconciliar = compilarModulo<{ reconciliarProcedimentosDex: Reconciliador }>(
    reconciliarFonte, ['reconciliarProcedimentosDex'], arcadas,
  ).reconciliarProcedimentosDex;
  const ausencias = compilarModulo<{ aplicarAusenciasExplicitamenteNarradas: Ausencias }>(
    ausenciasFonte, ['aplicarAusenciasExplicitamenteNarradas'], {},
  ).aplicarAusenciasExplicitamenteNarradas;
  return {
    schema: montarSchema(route), prompt: montarPrompt(route), parser, reconciliar, ausencias,
    thinkingBudget: extrairThinkingBudget(route),
    fontesSha256: {
      route: hashFonte(route), classificar: hashFonte(classificarFonte), bitola: hashFonte(bitolaFonte),
      arcadas: hashFonte(arcadasFonte), reconciliar: hashFonte(reconciliarFonte), ausencias: hashFonte(ausenciasFonte),
      provider: hashFonte(readFileSync(join(ROOT, 'src/lib/ai/provider.ts'), 'utf8')),
    },
  };
}

/** Contrato mínimo do parser R169: etapa isolada entra no título; frases nunca são inferidas. */
function validarParserFases(parser: Parser): void {
  const nomeBase = 'Prótese protocolo sobre implante';
  const eventos = parser.parseEventos([
    { tipo: 'outro', procedimento_nome: nomeBase, status: 'realizado', evidencia_status: 'execucao_explicita', nivel: 'arcada', arcada: 'inferior', faces: [], observacao: 'provisória' },
    { tipo: 'outro', procedimento_nome: nomeBase, status: 'realizado', evidencia_status: 'execucao_explicita', nivel: 'arcada', arcada: 'inferior', faces: [], observacao: 'definitiva' },
    { tipo: 'outro', procedimento_nome: nomeBase, status: 'realizado', evidencia_status: 'execucao_explicita', nivel: 'arcada', arcada: 'inferior', faces: [], observacao: 'provisória planejada após cicatrização' },
    { tipo: 'outro', procedimento_nome: nomeBase, status: 'realizado', evidencia_status: 'execucao_explicita', nivel: 'arcada', arcada: 'inferior', faces: [], observacao: 'não instalar a provisória nesta sessão' },
  ], 'consulta');
  const nomes = eventos.map((evento) => evento.procedimentoNome);
  const esperado = [`${nomeBase} provisória`, `${nomeBase} definitiva`, nomeBase, nomeBase];
  if (nomes.length !== esperado.length || nomes.some((nome, indice) => nome !== esperado[indice])) {
    throw new Error(`Parser R169 alterou uma etapa fora do contrato: ${JSON.stringify(nomes)}`);
  }
}

function carregarEnvLocal(): void {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;
  for (const linha of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const valor = match[2];
    process.env[match[1]] = (valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))
      ? valor.slice(1, -1)
      : valor;
  }
}

function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function faces(valor: string[] | undefined): string {
  return (valor ?? []).slice().sort().join(',');
}

function casa(evento: Evento, spec: EventoEsperado): boolean {
  const ancora = evento.ancora ?? { nivel: '' };
  if (spec.tipo != null && evento.tipo !== spec.tipo) return false;
  if (spec.status != null && evento.status !== spec.status) return false;
  if (spec.evidencia_status != null && evento.evidencia_status !== spec.evidencia_status) return false;
  if (spec.dente != null && ancora.dente !== spec.dente) return false;
  if (spec.nivel != null && ancora.nivel !== spec.nivel) return false;
  if (spec.arcada != null && ancora.arcada !== spec.arcada) return false;
  if (spec.faces != null && faces(ancora.faces) !== faces(spec.faces)) return false;
  const nome = normalizar(evento.procedimentoNome?.trim() || evento.observacao || '');
  return spec.nomeInclui?.every((trecho) => nome.includes(normalizar(trecho))) ?? true;
}

const ORTO_CAMPOS = ['fio', 'ativacao', 'elastico_corrente', 'elastico_intermaxilar', 'fio_inferior', 'ativacao_inferior', 'elastico_corrente_inferior', 'elastico_intermaxilar_inferior'];

function avaliar(caso: Caso, execucao: number, resposta: Resposta, latenciaMs: number): Resultado {
  const eventos = Array.isArray(resposta.odontograma_eventos) ? resposta.odontograma_eventos : [];
  const specs = caso.esperado.eventos;
  const faltando: EventoEsperado[] = [];
  const usados = new Set<number>();
  let casados = 0;
  let extras = 0;
  if (specs) {
    for (const spec of specs) {
      const indice = eventos.findIndex((evento, index) => !usados.has(index) && casa(evento, spec));
      if (indice < 0) faltando.push(spec);
      else { usados.add(indice); casados++; }
    }
    extras = eventos.length - usados.size;
  }
  const extrasEventos = specs
    ? eventos.filter((_evento, indice) => !usados.has(indice)).map((evento) => ({
        tipo: evento.tipo,
        status: evento.status,
        evidencia_status: evento.evidencia_status,
        procedimentoNome: evento.procedimentoNome ?? null,
        observacao: evento.observacao,
        ancora: evento.ancora,
      }))
    : [];
  const proibidosHit = (caso.esperado.proibido ?? []).filter((spec) => eventos.some((evento) => casa(evento, spec)));
  let ortoOk: boolean | null = null;
  if (caso.esperado.orto !== undefined) {
    const orto = resposta.orto_manutencao;
    if (caso.esperado.orto === null) ortoOk = orto === null;
    else if (orto) {
      const preenchidos = ORTO_CAMPOS.filter((campo) => orto[campo] != null);
      const distintos = caso.esperado.orto.camposDistintos ?? [];
      const valores = distintos.map((campo) => String(orto[campo] ?? '').trim().toLowerCase());
      ortoOk = orto.arcada === caso.esperado.orto.arcada
        && (caso.esperado.orto.camposPreenchidos ?? []).every((campo) => preenchidos.includes(campo))
        && (distintos.length === 0 || (valores.every(Boolean) && new Set(valores).size === valores.length));
    } else ortoOk = false;
  }
  const eventosOk = specs ? casados === specs.length && (specs.length !== 0 || eventos.length === 0) : true;
  const exatoOk = caso.esperado.exato ? extras === 0 : true;
  return {
    id: caso.id, execucao, cat: caso.cat,
    ok: eventosOk && exatoOk && proibidosHit.length === 0 && (ortoOk ?? true),
    esperados: specs?.length ?? 0, casados, faltando, proibidosHit, extras, extrasEventos, ortoOk, latenciaMs, outputItems: eventos.length,
    ...(INCLUDE_PIPELINE ? {
      pipeline: {
        procedimentos: resposta.procedimentos,
        eventosAntesReconciliacao: resposta.eventosAntesReconciliacao,
        eventosDepoisReconciliacao: eventos,
      },
    } : {}),
  };
}

function percentil(valores: number[], percentil: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = valores.slice().sort((a, b) => a - b);
  return Math.round(ordenados[Math.min(ordenados.length - 1, Math.ceil((percentil / 100) * ordenados.length) - 1)] * 10) / 10;
}

function esperar(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function extrair(caso: Caso, pipeline: Pipeline): Promise<{ resposta: Resposta; latenciaMs: number }> {
  const modo = caso.modo ?? 'consulta';
  const result = await generateStructuredGemini<unknown>({
    prompt: pipeline.prompt(caso.relato, modo),
    responseSchema: pipeline.schema,
    feature: TARGET === 'candidate' ? 'dex-eval-candidate-r169' : 'dex-eval-baseline-r169',
    thinkingBudget: pipeline.thinkingBudget,
    ...(Number.isFinite(PROVIDER_TIMEOUT_MS) && PROVIDER_TIMEOUT_MS > 0 ? { timeoutMs: PROVIDER_TIMEOUT_MS } : {}),
  });
  const wire = result.data as Record<string, unknown>;
  const dentesAfetados = (Array.isArray(wire.dentes_afetados) ? wire.dentes_afetados : [])
    .map((dente) => Number(dente))
    .filter((dente) => Number.isFinite(dente) && (pipeline.parser.isValidFDI(dente) || [97, 98, 99].includes(dente)));
  const dentesObservacoes: Record<string, string> = {};
  const pares = Array.isArray(wire.dentes_observacoes) ? wire.dentes_observacoes : [];
  for (const par of pares) {
    if (!par || typeof par !== 'object') continue;
    const candidato = par as { dente?: unknown; observacao?: unknown };
    const dente = Number(candidato.dente);
    const observacao = typeof candidato.observacao === 'string' ? candidato.observacao.trim() : '';
    if (!Number.isFinite(dente) || !observacao) continue;
    const chave = String(dente);
    dentesObservacoes[chave] = dentesObservacoes[chave] ? `${dentesObservacoes[chave]}\n${observacao}` : observacao;
  }
  for (const dente of dentesAfetados) {
    if (!dentesObservacoes[String(dente)]?.trim()) dentesObservacoes[String(dente)] = 'Procedimento a confirmar';
  }
  const procedimentos = Array.isArray(wire.procedimentos)
    ? wire.procedimentos.filter((procedimento): procedimento is string => typeof procedimento === 'string')
    : [];
  const eventosAntesReconciliacao = pipeline.ausencias(caso.relato, pipeline.parser.parseEventos(wire.odontograma_eventos, modo));
  const eventos = pipeline.reconciliar({
    procedimentos,
    eventos: eventosAntesReconciliacao,
    dentesObservacoes,
    modo,
  }).eventos;
  return {
    resposta: {
      odontograma_eventos: eventos,
      orto_manutencao: pipeline.parser.parseOrto(wire.orto_manutencao),
      procedimentos,
      eventosAntesReconciliacao,
    },
    latenciaMs: result.latencyMs,
  };
}

async function main(): Promise<void> {
  carregarEnvLocal();
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada em ambiente ou .env.local.');
  const pipeline = carregarPipeline();
  if (TARGET === 'candidate') validarParserFases(pipeline.parser);
  if (process.env.EVAL_VALIDATE_PIPELINE === '1') {
    console.log(`${TARGET === 'baseline' ? `BASELINE ${BASELINE_COMMIT}` : 'CANDIDATO árvore de trabalho'}: pipeline compilada.`);
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Golden;
  const casosFiltrados = CASE_IDS.size > 0 ? golden.casos.filter((caso) => CASE_IDS.has(caso.id)) : golden.casos;
  const casosBase = Number.isFinite(CASE_LIMIT) && CASE_LIMIT > 0 ? casosFiltrados.slice(0, CASE_LIMIT) : casosFiltrados;
  if (casosBase.length === 0) throw new Error('Nenhum caso selecionado. Confira EVAL_CASE_IDS/EVAL_CASE_LIMIT.');
  const casos = casosBase.flatMap((caso) => Array.from({ length: caso.repetir ?? 1 }, (_, indice) => ({ caso, execucao: indice + 1 })));
  mkdirSync(OUT, { recursive: true });
  const identificador = TARGET === 'baseline' ? `BASELINE ${BASELINE_COMMIT}` : 'CANDIDATO árvore de trabalho';
  console.log(`${identificador} · ${casos.length} chamadas sintéticas · Gemini direto`);
  const resultados: Resultado[] = [];
  for (const { caso, execucao } of casos) {
    try {
      const { resposta, latenciaMs } = await extrair(caso, pipeline);
      const resultado = avaliar(caso, execucao, resposta, latenciaMs);
      resultados.push(resultado);
      console.log(`${resultado.ok ? 'PASS ' : 'FALHA'} [${caso.cat}] ${caso.id}${caso.repetir ? ` #${execucao}` : ''} (${resultado.casados}/${resultado.esperados}, ${latenciaMs}ms)`);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      resultados.push({ id: caso.id, execucao, cat: caso.cat, ok: false, erro: mensagem, esperados: 0, casados: 0, faltando: [], proibidosHit: [], extras: 0, extrasEventos: [], ortoOk: null });
      console.log(`ERRO  [${caso.cat}] ${caso.id}: ${mensagem}`);
    }
    if (PACE_MS > 0) await esperar(PACE_MS);
  }
  const porCategoria = Object.fromEntries([...new Set(resultados.map((resultado) => resultado.cat))].map((categoria) => {
    const grupo = resultados.filter((resultado) => resultado.cat === categoria);
    return [categoria, { ok: grupo.filter((resultado) => resultado.ok).length, total: grupo.length }];
  }));
  const latencias = resultados.flatMap((resultado) => resultado.latenciaMs == null ? [] : [resultado.latenciaMs]);
  const resumo = { target: TARGET, baselineCommit: TARGET === 'baseline' ? BASELINE_COMMIT : null, dentalContextSha256: DENTAL_CONTEXT_SHA256, fontesSha256: pipeline.fontesSha256, thinkingBudget: pipeline.thinkingBudget, providerTimeoutMs: Number.isFinite(PROVIDER_TIMEOUT_MS) && PROVIDER_TIMEOUT_MS > 0 ? PROVIDER_TIMEOUT_MS : 30_000, porCategoria, latenciaMs: { amostras: latencias.length, p50: percentil(latencias, 50), p95: percentil(latencias, 95) } };
  console.log(JSON.stringify(resumo));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(OUT, `${TARGET === 'baseline' ? `baseline-${BASELINE_COMMIT}` : 'candidato'}-${stamp}.json`);
  writeFileSync(path, JSON.stringify({ stamp, resumo, resultados }, null, 2));
  console.log(`resultado completo: ${path}`);
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : String(erro));
  process.exitCode = 1;
});
