// R-46a — dados do "Meu dia": rail dos atendimentos + coluna de contexto por paciente.
// Spec: plans/specs/R-46-meu-dia.md. Leitura pura — zero escrita, zero server action.

import { createClient } from '@/lib/supabase/server';
import { hojeBRT, inicioDoDiaBRT, fimDoDiaBRT } from '@/lib/hora-brt';
import { calcularIdade } from '@/lib/paciente-form-helpers';
import { nomeTratamentoDerivado } from '@/lib/ficha/nome-tratamento';
import type { AgendamentoStatus } from '@/types/database';
import type { TratamentoAberto } from '@/types/ficha';
import type {
  Arcada, QuadranteFDI, NivelAncora, FaceDental, OrigemRegistro, PapelNoGrupo,
  TipoRegistroOdontograma, OrtoManutencaoInfo, StatusRegistro, OdontogramaEventoDraft,
  AncoraClinica, MomentoPlanejado,
} from '@/types/odontograma';

/** Mesma janela do `ultimaOrto` client-side (FichasTab.tsx) — replicada aqui em lote,
 *  server-side, pros pacientes do dia de uma vez. */
const JANELA_ORTO_DIAS = 120;

export interface MeuDiaSlot {
  agendamentoId: string;
  pacienteId: string;
  pacienteNome: string;
  /** C0 — `phead` do cockpit ("34 anos"). Mesmo `calcularIdade` do cadastro; null quando o
   *  paciente não tem `data_nascimento`. */
  pacienteIdade: number | null;
  /** "HH:MM" já formatado no fuso da clínica. */
  horario: string;
  statusAgendamento: AgendamentoStatus;
  /** G3 — existe `fichas.data_atendimento = hoje` pra este paciente (mesma régua do
   *  baseline medido em 31/07: paciente_id + data_atendimento = dia do atendimento). */
  temFichaHoje: boolean;
  /** R-140b — âncora clínica finalizada DESTE agendamento. Diferente de `temFichaHoje`,
   *  não vaza o selo de uma consulta para outro encaixe do mesmo paciente no mesmo dia. */
  atendimentoRegistrado: boolean;
}

export interface MeuDiaPendencia {
  id: string;
  tipo: TipoRegistroOdontograma;
  procedimentoId: string | null;
  procedimentoNome: string | null;
  dente: number | null;
  arcada: Arcada | null;
  quadrante: QuadranteFDI | null;
  registradoEm: string;
  dentistaNome: string;
  /**
   * R-46b (D4) — os 4 campos abaixo não existiam aqui antes (só exibição precisava de
   * tipo+onde). Vêm da MESMA query já buscada pras pendências, zero query nova — faltavam
   * só no shape de saída. Servem pra "fazer hoje →" reconstruir o `AncoraClinica` completo
   * e reusar o `id` real do evento (marcar `realizado` no MESMO registro via upsert — nunca
   * criar um novo ao lado, que deixaria a pendência original aberta e fantasma).
   */
  nivel: NivelAncora;
  origem: OrigemRegistro;
  momentoPlanejado: MomentoPlanejado;
  faces: FaceDental[];
  grupoId: string | null;
  papelNoGrupo: PapelNoGrupo | null;
  observacao: string | null;
  /**
   * R-51 — `true` quando este `indicado` pertence a um `grupoId` que já tem ao menos um
   * irmão `realizado` (outra linha, mesmo grupo): o tratamento COMEÇOU e não terminou.
   *
   * Derivado a cada leitura, NUNCA persistido. É deliberado: `StatusRegistro` é
   * `'indicado' | 'realizado'` e o projeto não tem um único exhaustive check sobre ele —
   * um 3º valor no banco viraria `else` = realizado em 23 arquivos, em silêncio (pintaria
   * o dente de feito, sumiria de "A fazer", sairia do orçamento e imprimiria "Realizado"
   * no PDF que vai pro CRO). Mesmo modelo do C/P do Open Dental: agrupamento, não status.
   *
   * `false` também para todo evento sem grupo — ausência de grupo não é "em andamento".
   */
  emAndamento: boolean;
  /**
   * R-52 — autor real do registro. O núcleo clínico é compartilhado (hierarquia 3.1), então
   * a query de eventos NÃO filtra por dentista: sem este campo o cliente não tem como saber
   * o que é dele. Era essa cegueira que deixava "fazer hoje →" aparecer em pendência de
   * colega — o upsert reusa o `id` do outro, a RLS barra, e 0 linhas afetadas NÃO é erro:
   * o servidor devolvia `ok:true` e a tela dizia que gravou sem ter gravado.
   */
  dentistaId: string;
  /** R-52 — `null` = não encaminhada. Encaminhada some da lista de quem encaminhou. */
  encaminhadoParaId: string | null;
  encaminhadoParaNome: string | null;
}

export interface MeuDiaEventoVisita {
  id: string;
  tipo: TipoRegistroOdontograma;
  procedimentoId: string | null;
  procedimentoNome: string | null;
  dente: number | null;
  arcada: Arcada | null;
  quadrante: QuadranteFDI | null;
  /** R-55 — sem isso, restaurações de faces diferentes no mesmo dente renderizavam
   *  linhas idênticas (`ondeLabel` nunca imprimia face). */
  faces: FaceDental[];
  observacao: string | null;
  /** R-58 — nível da âncora (dente/arcada/quadrante/boca/face). Já vinha na query pras
   *  pendências (`MeuDiaPendencia`); faltava aqui pro histórico reusar `RegistroCard`/
   *  `agruparRegistros`, que exigem `AncoraClinica` completa. */
  nivel: NivelAncora;
  /** R-58 — 'indicado' | 'realizado'. Antes esta lista só tinha realizados (§4.2 muda
   *  isso: os indicados desta ficha entram, pra sessão de anamnese sem `realizado` não
   *  renderizar vazia). */
  status: StatusRegistro;
  origem: OrigemRegistro;
  /** R-101 — ver corDoRegistro. Default 'sessao_atual'. */
  momento_planejado: MomentoPlanejado;
  /** R-58 — mesmo grupo multi-dente da ficha salva (ponte, exodontia múltipla). Sem isso
   *  `eventosParaCards`/`agruparRegistros` não têm como colapsar num card só aqui. */
  grupoId: string | null;
  /** R-58 (§2) — data clínica da execução. Quando difere da data da ficha que CONTÉM este
   *  evento na lista `eventos`, o evento foi indicado aqui e feito depois — alimenta o
   *  enquadramento duplo ("concluída em DD/MM"). */
  realizadoEm: string | null;
  /** R-58 (§2) — data da ficha ONDE este evento foi indicado (`ficha_id`). Pros itens de
   *  `feitosAqui` (indicados numa ficha diferente da que os contém), é o que alimenta o
   *  outro lado do enquadramento duplo ("indicada em DD/MM"). */
  indicadoEm: string;
  /** R-58 — data (sem hora, `date` no banco) em que o evento entrou no prontuário —
   *  `RegistroCard` usa isto (vs. `realizadoEm`) pra sinalizar retroativo. */
  registradoEm: string;
  /** R-58 — detalhe de especialidade (jsonb, migration 106). ÚNICO campo novo no SELECT.
   *  Lido sempre por safeParse — dado corrompido degrada pra "sem tabela" (spec-106 §5). */
  detalhe: unknown | null;
}

export interface MeuDiaVisita {
  fichaId: string;
  data: string;
  dentistaNome: string;
  /** R-46h — autor real da ficha (histórico é compartilhado da clínica, pode ser de outro
   *  dentista). Usado pra esconder "Gerar orçamento" fora das fichas do dentista logado. */
  dentistaId: string;
  /** R-46a (ajuste 31/07) — frase única, geralmente "Evolução" quando `queixa_principal`/
   *  `procedimentos` estão vazios. Fallback pra visitas sem `texto` nem evento (G9). */
  resumo: string;
  /** C0 — 1ª linha de `fichas.anotacoes`, ≤160 chars; vazio ou ausente vira `null`. */
  nota: string | null;
  /** Eventos do odontograma vinculados a ESTA ficha (`ficha_id`, não data — C0.1), os DOIS
   *  status (R-58 §4.2 — antes só `realizado`; sessão de anamnese sem `realizado`
   *  renderizava vazia). R-55: sem dedup por âncora — toda ocorrência real aparece. */
  eventos: MeuDiaEventoVisita[];
  /** R-58 (§0 regra 3) — nenhum evento desta ficha continua `indicado` em aberto.
   *  DERIVADO da lista, nunca persistido: `eventos.every(e => e.status === 'realizado')`
   *  (mesmo princípio de `emAndamento` do R-51 — não criar 3º status por acidente). */
  semPendencia: boolean;
  /** R-58 (§2) — eventos feitos NESTA data mas indicados numa ficha anterior (`ficha_id`
   *  aponta pra outra ficha; `realizado_em` aponta pra esta). Alimentam "o que eu fiz
   *  hoje" mesmo quando o achado original é de uma consulta passada. */
  feitosAqui: MeuDiaEventoVisita[];
  /** R-58 — texto completo de `fichas.anotacoes`, sem truncar (I7). `nota` continua sendo
   *  a 1ª linha, pro resumo fechado do bloco. */
  texto: string | null;
  /** R-60 — manutenção de aparelho é conteúdo clínico da visita, não só contexto do form. */
  ortoManutencao: OrtoManutencaoInfo | null;
  /** R-46c — true quando `fichas.origem === 'importado'` (histórico transcrito do Word,
   *  D7: zero parsing). `historico-bloco.tsx` rotula como transcrito, nunca como
   *  atendimento (I3) — e o `resumo` usa a 1ª linha do texto colado em vez de cair em
   *  'Evolução' (mesmo defeito do achado 6 do R-46c, lugar novo). */
  importado: boolean;
}

export interface MeuDiaOrto {
  valor: OrtoManutencaoInfo;
  data: string;
  dentistaNome: string;
}

export interface MeuDiaContexto {
  /** C0 — substitui `ultimaVisita`: histórico inteiro (`fichasRecentes`), não só a 1ª. */
  visitas: MeuDiaVisita[];
  pendencias: MeuDiaPendencia[];
  /**
   * R-108b — tratamentos `aberta` DESTE dentista, pro seletor "o novo vai para". Só do
   * dentista logado de propósito: a leitura de ficha é compartilhada na clínica (migration
   * 099) mas a escrita continua siloada, então oferecer a ficha de um colega como destino
   * seria oferecer uma gravação que a RLS vai recusar (spec §5, "Sem permissão").
   * Derivado dos MESMOS eventos e fichas já buscados — zero query nova.
   */
  tratamentosAbertos: TratamentoAberto[];
  /**
   * R-108b — `eventoId → nome do tratamento` de TODAS as fichas do paciente (não só as
   * abertas, e não só as deste dentista): é o rótulo "→ Reabilitação inf. direita" que a
   * pendência ganha na lista "Nesta ficha" (artefato bloco 7), e pendência pode ter nascido
   * numa ficha já concluída ou de um colega.
   */
  nomeTratamentoPorEvento: Record<string, string>;
  orto: MeuDiaOrto | null;
  /** R-46g (D9) — mesma fonte e parse do chip de alerta do hero (`next-appointment-hero.tsx`
   *  `alertas`): `pacientes.observacoes` quebrada por linha. Não é a derivação mais cara do
   *  C4 (5 fichas do `/consulta`) — é reaproveitar o que já existe, não construir de novo. */
  alertas: string[];
  /**
   * R-61 — estado persistido da boca (os dois status, todas as fichas), pra CAMADA DE
   * LEITURA do odontograma. Vem do MESMO `eventosPorPaciente` que o histórico já usa —
   * zero query nova, só para de descartar o que já foi buscado. NUNCA entra em
   * `eventosDraft` no cliente — o que `Salvar` grava é só o rascunho (I1 da spec).
   */
  boca: OdontogramaEventoDraft[];
}

export interface MeuDiaCatalogoProcedimento {
  id: string;
  nome: string;
  categoria: string;
  /** R-46h — mesmo shape que `ProcedimentoClinica` (pacientes/[id]/_components/types.ts):
   *  pré-preenche o valor do item no picker de orçamento compartilhado. */
  preco_padrao: number | null;
}

/** R-52 — destino possível de um encaminhamento. */
export interface MeuDiaDestinoEncaminhar {
  id: string;
  nome: string;
}

export interface MeuDiaData {
  slots: MeuDiaSlot[];
  contextoPorPaciente: Record<string, MeuDiaContexto>;
  /** R-46b (D2) — mesma tabela e mesma ordem que Orçamentos já usa
   *  (`orcamentos-client.tsx:213-226`): privada por dentista, alfabética. Decisão dele
   *  31/07: sem frequência de uso — "muito relativo, usar o que já está no sistema". */
  catalogoProcedimentos: MeuDiaCatalogoProcedimento[];
  /** R-52 — dentistas que podem RECEBER um encaminhamento: ativos, não-secretárias, exceto
   *  eu. Mesmo filtro que `FichasTab` já usa pro `EncaminharBar`. */
  destinosEncaminhar: MeuDiaDestinoEncaminhar[];
  /** R-52 — quem sou eu. O bloco "A fazer" filtra contra isto pra mostrar só o que é meu;
   *  sem este campo o cliente teria que adivinhar autoria. */
  meuDentistaId: string;
  /** R-105a §4.1 — este DENTISTA ainda não salvou nenhuma ficha. Deriva as 3 strings e o
   *  realce da primeira fase guiada; nunca persistido (I2). Por dentista, não por clínica
   *  (I3): quem entra por convite numa clínica que já tem fichas também é primeira sessão. */
  primeiraSessao: boolean;
}

type AgendamentoRow = {
  id: string;
  data_hora: string;
  status: AgendamentoStatus;
  paciente: { id: string; nome: string; observacoes: string | null; data_nascimento: string | null } | null;
};

/** Mesmo parse do chip de alerta em `next-appointment-hero.tsx` (`alertas`) — D9. */
function parseAlertas(observacoes: string | null): string[] {
  return observacoes
    ? observacoes.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
}

/** C0 — 1ª linha de `fichas.anotacoes`; vazia ou ausente vira `null`. Sem corte de tamanho —
 *  histórico mostra só a última visita agora, então o espaço sobra pra nota inteira. */
function notaDaFicha(anotacoes: string | null): string | null {
  const primeiraLinha = anotacoes?.split('\n')[0]?.trim();
  return primeiraLinha || null;
}

/**
 * R-58 — `EventoRow` cru → `MeuDiaEventoVisita` (view-model do histórico). `indicadoEm`
 * resolve a data da ficha ONDE o evento foi indicado (`ficha_id`): pros itens de `eventos`
 * (a própria ficha que os contém) bate com a data dela mesma; pros de `feitosAqui`
 * (indicados numa OUTRA ficha), é o que sustenta "indicada em DD/MM" (§2). Fallback pro
 * `registrado_em` só no caso raro de `ficha_id` órfão — nunca deveria faltar em produção
 * (`fichasRecentesRaw` busca TODAS as fichas do paciente, sem `.limit()`).
 */
function eventoParaVisita(e: EventoRow, fichaDataPorId: Map<string, string>): MeuDiaEventoVisita {
  return {
    id: e.id, tipo: e.tipo, procedimentoId: e.procedimento_id,
    procedimentoNome: e.procedimento_nome, dente: e.dente, arcada: e.arcada, quadrante: e.quadrante,
    faces: e.faces ?? [], observacao: e.observacao, nivel: e.nivel, status: e.status,
    origem: e.origem, momento_planejado: e.momento_planejado, grupoId: e.grupo_id, realizadoEm: e.realizado_em,
    indicadoEm: (e.ficha_id ? fichaDataPorId.get(e.ficha_id) : undefined) ?? e.registrado_em,
    registradoEm: e.registrado_em, detalhe: e.detalhe,
  };
}

/**
 * R-61 — `EventoRow` cru → `OdontogramaEventoDraft`, pra camada de LEITURA do odontograma
 * (`MeuDiaContexto.boca`). Mesmo padrão de âncora que `pendenciaParaDraft`
 * (registrar-painel.tsx) já usa — **`id` é o `id` real do evento**, obrigatório: é o que
 * sustenta o dedup por id no `buildResumos` (§4.3 da spec R-61 — rascunho vence persistido
 * quando "fazer hoje →" reusa o mesmo id).
 */
function eventoParaBoca(e: EventoRow): OdontogramaEventoDraft {
  const ancora: AncoraClinica = { nivel: e.nivel };
  if (e.dente != null) ancora.dente = e.dente;
  if (e.arcada != null) ancora.arcada = e.arcada;
  if (e.quadrante != null) ancora.quadrante = e.quadrante;
  if ((e.faces ?? []).length > 0) ancora.faces = e.faces ?? [];
  return {
    id: e.id, tipo: e.tipo, procedimentoId: e.procedimento_id,
    procedimentoNome: e.procedimento_nome, status: e.status, origem: e.origem,
    momento_planejado: e.momento_planejado, ancora,
    grupo_id: e.grupo_id, papel_no_grupo: e.papel_no_grupo, observacao: e.observacao ?? '',
    realizado_em: e.realizado_em, registrado_em: e.registrado_em,
    created_at: e.created_at, detalhe: e.detalhe,
  };
}

type FichaRow = {
  id: string;
  paciente_id: string;
  data_atendimento: string;
  queixa_principal: string | null;
  procedimentos: string[] | null;
  anotacoes: string | null;
  orto_manutencao: OrtoManutencaoInfo | null;
  dentista_id: string;
  dentista: { nome: string } | null;
  /** R-46c — dispara o rótulo "histórico importado" e o resumo por trecho colado. */
  origem: 'modo_consulta' | 'manual' | 'importado';
  /** R-108 — o estado do tratamento (a ficha É o tratamento, 1↔1). */
  status: 'aberta' | 'concluida';
  /** R-108 — nome do tratamento; `null` cai no derivado dos eventos (R-108 §4.3). */
  nome: string | null;
};

type EventoRow = {
  id: string;
  paciente_id: string;
  /** C0.1 — vínculo real com a visita (fichas.id). Antes disso o join era por data,
   *  que quebra com 2 fichas no mesmo dia (decisão dele 03/08: visita rápida sem abrir
   *  tratamento novo também gera ficha própria). null em eventos sem ficha (preexistente). */
  ficha_id: string | null;
  tipo: TipoRegistroOdontograma;
  procedimento_id: string | null;
  procedimento_nome: string | null;
  status: 'indicado' | 'realizado';
  origem: OrigemRegistro;
  /** R-101 — ver corDoRegistro. Default 'sessao_atual'. */
  momento_planejado: MomentoPlanejado;
  nivel: NivelAncora;
  arcada: Arcada | null;
  quadrante: QuadranteFDI | null;
  dente: number | null;
  faces: FaceDental[] | null;
  papel_no_grupo: PapelNoGrupo | null;
  grupo_id: string | null;
  observacao: string | null;
  /** R-58 — detalhe de especialidade (jsonb, migration 106). ÚNICO campo novo no SELECT
   *  desta fatia; o resto já vinha e era descartado no `.map()`. */
  detalhe: unknown | null;
  registrado_em: string;
  /** R-55 — data CLÍNICA do procedimento; único campo de data que a RPC de fechamento de
   *  pendência atualiza. Vira `MeuDiaOcorrenciaFeita.data` com fallback pra `registrado_em`. */
  realizado_em: string | null;
  created_at: string;
  dentista: { nome: string } | null;
  /** R-52 — autor bruto (o join acima só traz o nome). */
  dentista_id: string;
  encaminhado_para: string | null;
  encaminhado_dentista: { nome: string } | null;
};

/** Chave de âncora SEM status — o objetivo aqui é achar o evento mais recente por
 *  âncora (indiferente de status) pra então checar se ELE está indicado. Mesma ideia
 *  de identidade semântica que `chaveDedupEvento` usa em FichasTab.tsx, sem o status. */
function chaveAncora(e: EventoRow): string {
  return JSON.stringify([
    e.tipo, e.procedimento_id, e.procedimento_nome, e.origem, e.nivel,
    e.arcada, e.quadrante, e.dente, [...(e.faces ?? [])].sort(),
    e.papel_no_grupo,
  ]);
}

export async function getMeuDiaData({
  clinicId,
  dentistaId,
  now = new Date(),
}: {
  clinicId: string;
  dentistaId: string;
  now?: Date;
}): Promise<MeuDiaData> {
  const supabase = await createClient();
  const hoje = hojeBRT(now);

  // G1 — fuso da clínica, não do servidor (dentista-dashboard.tsx usa startOfDay/endOfDay
  // do date-fns puro, que roda em UTC na Vercel; aqui usamos o padrão correto, o mesmo
  // que SecretaryDashboardServer já usa em dashboard/page.tsx).
  // R-105a §4.1 — a 2ª query entra AQUI, no mesmo Promise.all da 1ª: `primeiraSessao` precisa
  // existir antes do early return de "sem agendamento hoje" (que é justamente o estado em que
  // o dentista novo cai). `select('id').limit(1)` é seek em índice, não `count` — não varre a
  // tabela de fichas, que cresce pra sempre.
  const [
    { data: agendamentosRaw, error: agendamentosError },
    { data: fichaDoDentista },
  ] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, paciente:pacientes(id, nome, observacoes, data_nascimento)')
      .eq('clinica_id', clinicId)
      .eq('dentista_id', dentistaId)
      .gte('data_hora', inicioDoDiaBRT(now).toISOString())
      .lte('data_hora', fimDoDiaBRT(now).toISOString())
      .neq('status', 'cancelled')
      .order('data_hora', { ascending: true }),

    supabase
      .from('fichas')
      .select('id')
      .eq('clinica_id', clinicId)
      .eq('dentista_id', dentistaId)
      .limit(1),
  ]);

  // Erro aqui NÃO derruba o Meu dia: no pior caso `primeiraSessao` fica false e o dentista
  // novo vê as strings normais — degrada pro comportamento de hoje, nunca pra tela vazia.
  const primeiraSessao = (fichaDoDentista?.length ?? 0) === 0;

  // R-46g (D6) — falhar alto em vez de engolir: RLS negando ou query quebrada não pode
  // virar "nenhum atendimento hoje" (mesmo modo de falha do bug histórico de Orçamentos).
  if (agendamentosError) {
    throw new Error(`[getMeuDiaData] agendamentos: ${agendamentosError.message}`);
  }

  const agendamentos = ((agendamentosRaw ?? []) as unknown as AgendamentoRow[])
    .filter((a): a is AgendamentoRow & { paciente: NonNullable<AgendamentoRow['paciente']> } => a.paciente != null);

  if (agendamentos.length === 0) {
    // Sem agendamento hoje não há slot pra selecionar — nada usa o catálogo nem os destinos
    // de encaminhamento neste render, então não vale buscar (nenhum dos dois muda por dia).
    return {
      slots: [], contextoPorPaciente: {}, catalogoProcedimentos: [],
      destinosEncaminhar: [], meuDentistaId: dentistaId, primeiraSessao,
    };
  }

  const pacienteIds = [...new Set(agendamentos.map((a) => a.paciente.id))];

  const [
    { data: fichasHojeRaw, error: fichasHojeError },
    { data: atendimentosRaw, error: atendimentosError },
    { data: fichasRecentesRaw, error: fichasRecentesError },
    { data: eventosRaw, error: eventosError },
    { data: catalogoRaw, error: catalogoError },
    { data: destinosRaw, error: destinosError },
  ] = await Promise.all([
    supabase
      .from('fichas')
      .select('paciente_id')
      .eq('clinica_id', clinicId)
      .in('paciente_id', pacienteIds)
      .eq('data_atendimento', hoje),

    // R-140a é a fonte exata do selo do rail: uma ficha no mesmo dia pertence ao paciente,
    // mas uma âncora finalizada pertence a este agendamento. Sem esta separação, o segundo
    // encaixe herdava visualmente o “✓ registrado” da primeira consulta.
    supabase
      .from('atendimentos_clinicos')
      .select('agendamento_id')
      .eq('clinica_id', clinicId)
      .in('agendamento_id', agendamentos.map((a) => a.id))
      .eq('estado', 'finalizado'),

    // Sem .limit(): contagem de fichas por paciente é pequena em produção (máx. observado:
    // 8; a maioria tem 1) — pegar tudo e reduzir em memória é mais simples que paginar
    // por paciente, que o Postgrest não faz nativamente.
    supabase
      .from('fichas')
      // R-108b — `status` e `nome` entram nesta MESMA query (nenhuma solta, spec §4): são o
      // que o seletor "o novo vai para" precisa pra listar os tratamentos abertos.
      .select('id, paciente_id, data_atendimento, queixa_principal, procedimentos, anotacoes, orto_manutencao, origem, status, nome, dentista_id, dentista:dentistas(nome)')
      .eq('clinica_id', clinicId)
      .in('paciente_id', pacienteIds)
      .order('data_atendimento', { ascending: false })
      .order('created_at', { ascending: false }),

    // FK explícita: odontograma_eventos tem 2 FKs pra dentistas (dentista_id +
    // encaminhado_para, migration 106) — embed ambíguo sem desambiguar é o mesmo bug do R-44.
    //
    // SEM filtro de assinatura_id, de propósito (verificação adversarial 31/07 achou o
    // bug de tirar isso antes do reduce): um evento 'realizado' assinado precisa continuar
    // no páreo — senão o irmão 'indicado' mais antigo da MESMA âncora vence o reduce (a
    // chave não tem status) e reabre como pendência algo já feito e assinado.
    // assinatura_id só é setado em eventos 'realizado' (RPC assinar_procedimentos, migration
    // 111), então o filtro final `status !== 'indicado'` já garante que um vencedor assinado
    // nunca vira pendência — não precisa (e não pode) filtrar aqui.
    //
    // Tiebreaker por created_at: registrado_em é `date` (sem hora, migration 101) — indicar
    // e realizar na mesma consulta é o caso comum e empata a data. Sem 2ª chave de ordenação
    // o Postgres não garante qual linha empatada vem primeiro, e "o 1º visto é o vencedor"
    // deixa de valer.
    supabase
      .from('odontograma_eventos')
      .select(
        // grupo_id + observacao entraram no R-46b (D4) — só faltavam no shape de saída,
        // a query já buscava o resto. Ver comentário em MeuDiaPendencia. realizado_em
        // entrou no R-55 (histórico precisa da data clínica por ocorrência). detalhe
        // entrou no R-58 (tabela de especialidade no histórico) — único campo novo aqui,
        // o resto da fatia só expõe o que já vinha e era descartado no .map().
        // R-52: dentista_id (autor bruto) + encaminhado_para e o nome do destino. As DUAS FKs
        // apontam pra `dentistas`, então os dois embeds PRECISAM do `!fkey` desambiguando —
        // sem isso o Postgrest devolve 300 (é a família de bug do R-44). Mesmo par já usado
        // em FichasTab.tsx:943.
        'id, paciente_id, ficha_id, tipo, procedimento_id, procedimento_nome, status, origem, momento_planejado, nivel, arcada, quadrante, dente, faces, papel_no_grupo, grupo_id, observacao, detalhe, registrado_em, realizado_em, created_at, dentista_id, encaminhado_para, dentista:dentistas!odontograma_eventos_dentista_id_fkey(nome), encaminhado_dentista:dentistas!odontograma_eventos_encaminhado_para_fkey(nome)',
      )
      .eq('clinica_id', clinicId)
    .is('retirado_em', null)
      .in('paciente_id', pacienteIds)
      .order('registrado_em', { ascending: false })
      .order('created_at', { ascending: false }),

    // R-46b (D2) — mesma query que orcamentos-client.tsx já faz: catálogo privado do
    // dentista, alfabética, sem frequência (decisão dele, 31/07).
    supabase
      .from('procedimentos')
      .select('id, nome, categoria, preco_padrao')
      .eq('clinica_id', clinicId)
      .eq('dentista_id', dentistaId)
      .eq('ativo', true)
      .order('nome'),

    // R-52 — destinos de encaminhamento. MESMO filtro que FichasTab.tsx:1001-1008 já usa
    // pro EncaminharBar (ativo, não-secretária, exceto eu) — não é regra nova.
    supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', clinicId)
      // R-94 — .neq('role','secretaria') sozinho deixaria 'protetico' virar destino
      // de encaminhamento clínico; ele não atende paciente.
      .in('role', ['admin', 'dentista'])
      .eq('ativo', true)
      .neq('id', dentistaId)
      .order('nome', { ascending: true }),
  ]);

  if (fichasHojeError) throw new Error(`[getMeuDiaData] fichasHoje: ${fichasHojeError.message}`);
  if (atendimentosError) throw new Error(`[getMeuDiaData] atendimentos: ${atendimentosError.message}`);
  if (fichasRecentesError) throw new Error(`[getMeuDiaData] fichasRecentes: ${fichasRecentesError.message}`);
  if (eventosError) throw new Error(`[getMeuDiaData] eventos: ${eventosError.message}`);
  if (catalogoError) throw new Error(`[getMeuDiaData] catalogo: ${catalogoError.message}`);
  if (destinosError) throw new Error(`[getMeuDiaData] destinosEncaminhar: ${destinosError.message}`);

  // O contador do rodapé continua por paciente+dia: ele informa que há ficha na data, não
  // pretende identificar uma consulta específica.
  const pacientesComFichaHoje = new Set(
    ((fichasHojeRaw ?? []) as { paciente_id: string }[]).map((f) => f.paciente_id),
  );
  const agendamentosRegistrados = new Set(
    ((atendimentosRaw ?? []) as { agendamento_id: string | null }[])
      .map((atendimento) => atendimento.agendamento_id)
      .filter((agendamentoId): agendamentoId is string => agendamentoId != null),
  );

  const fichasPorPaciente = new Map<string, FichaRow[]>();
  for (const f of (fichasRecentesRaw ?? []) as unknown as FichaRow[]) {
    const arr = fichasPorPaciente.get(f.paciente_id) ?? [];
    arr.push(f);
    fichasPorPaciente.set(f.paciente_id, arr);
  }

  // G2 — "indicado sem realizado posterior": nenhuma implementação disto existia no
  // código (achado no mapeamento) — o vencedor por âncora é o de `registrado_em` mais
  // recente (a query já veio ordenada desc, então o 1º visto por chave é o vencedor).
  //
  // R-55 — este Map serve SÓ à pendência (trava emendada em R-46-cockpit.md/contrato).
  // Aplicado ao histórico ele colapsava ocorrência repetida da mesma âncora (achado real
  // em produção: profilaxia/flúor/clareamento são SEMPRE a mesma chave, pra sempre — e
  // duas fichas de datas diferentes com o mesmo procedimento perdiam uma das duas).
  //
  // R-51 — o vencedor por âncora agora serve SÓ a evento SEM `grupo_id`. Motivo medido: o
  // caminho de escrita já cria uma 2ª linha com o mesmo `grupo_id` ao continuar um trabalho
  // aberto (ToothDetailPanel "Continuar o trabalho aberto?" → `criarDenteTipo(tipo, modos,
  // grupoId)`), e o upsert da RPC é escopado por `ficha_id` — então a sessão 2 (ficha nova)
  // grava a linha `realizado` sem tocar o `indicado` da ficha 1. Com ambos na mesma âncora,
  // o vencedor (mais recente = o `realizado`) escondia o `indicado` ainda aberto: o canal
  // sumia de "A fazer" no meio do tratamento e nunca voltava pra ser fechado de verdade.
  //
  // Duas divisões ORTOGONAIS convivem nesta função, não se confundem:
  //   R-55: pendência × histórico   ·   R-51: com grupo × sem grupo
  //
  // ⚠️ Borda conhecida, medida como INEXISTENTE hoje (0 colisões em 231 eventos, 03/08):
  // se um dia um evento COM grupo dividir âncora com um SEM grupo, tirar o de grupo do mapa
  // pode fazer um `indicado` sem grupo — antes suprimido pelo vencedor — voltar a aparecer.
  // Escolha deliberada: numa dúvida entre mostrar pendência a mais e esconder pendência a
  // menos, mostrar a mais é o erro seguro (esconder é exatamente o que o R-55 corrigiu).
  const vencedorPorAncora = new Map<string, EventoRow>();
  for (const e of (eventosRaw ?? []) as unknown as EventoRow[]) {
    if (e.grupo_id != null) continue; // R-51 — grupo tem caminho próprio, abaixo
    const chave = `${e.paciente_id}::${chaveAncora(e)}`;
    if (!vencedorPorAncora.has(chave)) vencedorPorAncora.set(chave, e);
  }

  // R-51 — grupos que já têm ao menos uma sessão feita. É isto (e só isto) que "em
  // andamento" significa: existe irmão `realizado` no mesmo grupo.
  const gruposComSessaoFeita = new Set<string>();
  for (const e of (eventosRaw ?? []) as unknown as EventoRow[]) {
    if (e.grupo_id == null || e.status !== 'realizado') continue;
    gruposComSessaoFeita.add(`${e.paciente_id}::${e.grupo_id}`);
  }

  const pendenciasPorPaciente = new Map<string, MeuDiaPendencia[]>();
  function pushPendencia(e: EventoRow, emAndamento: boolean) {
    const arr = pendenciasPorPaciente.get(e.paciente_id) ?? [];
    arr.push({
      id: e.id,
      tipo: e.tipo,
      procedimentoId: e.procedimento_id,
      procedimentoNome: e.procedimento_nome,
      dente: e.dente,
      arcada: e.arcada,
      quadrante: e.quadrante,
      registradoEm: e.registrado_em,
      dentistaNome: e.dentista?.nome ?? 'Equipe',
      nivel: e.nivel,
      origem: e.origem,
      momentoPlanejado: e.momento_planejado,
      faces: e.faces ?? [],
      grupoId: e.grupo_id,
      papelNoGrupo: e.papel_no_grupo,
      observacao: e.observacao,
      emAndamento,
      dentistaId: e.dentista_id,
      encaminhadoParaId: e.encaminhado_para,
      encaminhadoParaNome: e.encaminhado_dentista?.nome ?? null,
    });
    pendenciasPorPaciente.set(e.paciente_id, arr);
  }

  // Sem grupo: comportamento idêntico ao de antes do R-51 (gate G2).
  for (const e of vencedorPorAncora.values()) {
    if (e.status !== 'indicado') continue;
    pushPendencia(e, false);
  }

  // Com grupo: todo `indicado` é pendência direta — sem resolução de vencedor. O `indicado`
  // do tratamento continua aberto enquanto o grupo não fechar, mesmo com sessões já feitas.
  for (const e of (eventosRaw ?? []) as unknown as EventoRow[]) {
    if (e.grupo_id == null || e.status !== 'indicado') continue;
    pushPendencia(e, gruposComSessaoFeita.has(`${e.paciente_id}::${e.grupo_id}`));
  }

  // R-55 — 2ª passagem, INDEPENDENTE do vencedor por âncora: histórico e acumulado
  // precisam de toda ocorrência realizada, não só a mais recente por âncora. `eventosRaw`
  // já vem ordenado `registrado_em desc, created_at desc` (query acima), então cada array
  // aqui nasce "mais recente primeiro" de graça.
  //
  // R-58 — vira `eventosPorPaciente` (os DOIS status, não só `realizado`): o histórico
  // agora também mostra o `indicado` desta ficha (§4.2). `jaFeito` abaixo filtra
  // `realizado` de novo a partir daqui — mesmo array de entrada, comportamento idêntico
  // ao de antes (G5), só a fonte comum mudou de nome.
  const eventosPorPaciente = new Map<string, EventoRow[]>();
  for (const e of (eventosRaw ?? []) as unknown as EventoRow[]) {
    const arr = eventosPorPaciente.get(e.paciente_id) ?? [];
    arr.push(e);
    eventosPorPaciente.set(e.paciente_id, arr);
  }

  const limiteOrto = new Date(now.getTime() - JANELA_ORTO_DIAS * 864e5)
    .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  // D9 — observacoes vem embutido no mesmo select de agendamentos; 1 por paciente basta
  // (não muda entre os agendamentos do dia do mesmo paciente).
  const observacoesPorPaciente = new Map(agendamentos.map((a) => [a.paciente.id, a.paciente.observacoes]));

  const contextoPorPaciente: Record<string, MeuDiaContexto> = {};
  for (const pid of pacienteIds) {
    const fichas = fichasPorPaciente.get(pid) ?? [];
    const eventosDoPaciente = eventosPorPaciente.get(pid) ?? [];
    // R-58 — lookup pra `eventoParaVisita` resolver `indicadoEm`. `fichas` já é TODAS as
    // fichas deste paciente (sem `.limit()`), então todo `ficha_id` referenciado por um
    // evento deste paciente está aqui.
    const fichaDataPorId = new Map(fichas.map((f) => [f.id, f.data_atendimento]));

    // C0.1 (03/08) — join por `ficha_id`, não por data. Decisão dele: visita rápida que só
    // avança um tratamento aberto também gera ficha própria, então 2 fichas no mesmo dia é
    // caso normal, não exceção — casar por data colava os eventos todos na 1ª e deixava a
    // 2ª vazia. `ficha_id` é o vínculo real (salvar-ficha.ts sempre grava).
    const visitas: MeuDiaVisita[] = fichas.map((f) => {
      // R-46c (D5) — importada não tem queixa/procedimentos (D7: zero parsing), então
      // sempre cairia em 'Evolução' pela regra normal (achado 6, lugar novo). `nota` fica
      // null pra não duplicar o mesmo trecho duas vezes na mesma visita.
      const importado = f.origem === 'importado';
      // R-58 (§4.2) — os DOIS status desta ficha (não só realizado — sessão de anamnese
      // sem `realizado` não pode renderizar vazia, §0 regra 1).
      const eventos = eventosDoPaciente
        .filter((e) => e.ficha_id === f.id)
        .map((e) => eventoParaVisita(e, fichaDataPorId));
      // R-58 (§2) — feitos NESTA data, indicados numa ficha de OUTRO dia. `ficha_id !== f.id`
      // sozinho não basta: 2 fichas do MESMO paciente podem cair no MESMO dia (C0.1 — "visita
      // rápida... 2 fichas no mesmo dia é caso normal"), e cada uma vira `ficha_id !== f.id`
      // pra sua irmã — sem o 2º checa (data indicada != data desta ficha), as duas fichas do
      // dia trocavam os eventos uma da outra, violando §0 regra 2 (a entrada tem que dizer o
      // que foi feito NAQUELA consulta, não na consulta irmã do mesmo dia). Achado ao vivo,
      // não em leitura de código — verificação real pegou o que a leitura não pegou.
      const feitosAqui = eventosDoPaciente
        .filter((e) => {
          if (e.realizado_em !== f.data_atendimento || e.ficha_id === f.id) return false;
          const dataIndicada = e.ficha_id ? fichaDataPorId.get(e.ficha_id) : undefined;
          return dataIndicada !== f.data_atendimento;
        })
        .map((e) => eventoParaVisita(e, fichaDataPorId));
      return {
      fichaId: f.id,
      data: f.data_atendimento,
      dentistaNome: f.dentista?.nome ?? 'Equipe',
      dentistaId: f.dentista_id,
      resumo: importado
        ? (notaDaFicha(f.anotacoes) ?? 'Histórico importado')
        : (f.queixa_principal || (f.procedimentos ?? []).slice(0, 2).join(', ') ||
          (f.orto_manutencao ? 'Manutenção ortodôntica' : 'Evolução')),
      nota: importado ? null : notaDaFicha(f.anotacoes),
      importado,
      eventos,
      // R-58 (§0 regra 3) — derivado, nunca persistido (I2). Ficha sem NENHUM evento
      // também é "sem pendência" — nada ficou aberto porque nada foi indicado.
      semPendencia: eventos.every((e) => e.status === 'realizado'),
      feitosAqui,
      texto: f.anotacoes || null,
      ortoManutencao: f.orto_manutencao,
      };
    });

    // Mesma lógica do `ultimaOrto` (FichasTab.tsx): itera desc, primeira ficha com
    // orto_manutencao decide; se ela já está fora da janela de 120 dias, não há orto ativo.
    let orto: MeuDiaOrto | null = null;
    for (const f of fichas) {
      if (!f.orto_manutencao) continue;
      if (f.data_atendimento < limiteOrto) break;
      orto = { valor: f.orto_manutencao, data: f.data_atendimento, dentistaNome: f.dentista?.nome ?? 'Equipe' };
      break;
    }

    // R-108b — uma passada só resolve as duas coisas que o roteamento precisa mostrar na tela:
    // o nome do tratamento de cada evento (rótulo "→ Reabilitação inf. direita" na pendência,
    // artefato bloco 7) e a lista de tratamentos abertos que o seletor oferece (bloco 8).
    // Fichas sem nenhum evento ficam de fora das duas: não há tratamento em curso pra absorver
    // procedimento (são fichas só-texto), e o nome derivado não teria de onde sair (R-108 §4.3
    // deriva de evento).
    const tratamentosAbertos: TratamentoAberto[] = [];
    const nomeTratamentoPorEvento: Record<string, string> = {};

    for (const f of fichas) {
      const eventosDaFicha = eventosDoPaciente.filter((e) => e.ficha_id === f.id);
      if (eventosDaFicha.length === 0) continue;

      const nome = f.nome ?? nomeTratamentoDerivado(eventosDaFicha.map(eventoParaBoca));
      for (const e of eventosDaFicha) nomeTratamentoPorEvento[e.id] = nome;

      // Só do dentista logado: a leitura de ficha é compartilhada na clínica (migration 099)
      // mas a escrita continua siloada — oferecer a ficha de um colega como destino seria
      // oferecer uma gravação que a RLS vai recusar depois (spec §5, "Sem permissão").
      if (f.status === 'aberta' && f.dentista_id === dentistaId) {
        tratamentosAbertos.push({
          fichaId: f.id,
          nome,
          dentes: [...new Set(eventosDaFicha.map((e) => e.dente).filter((d): d is number => d != null))],
          totalProcedimentos: eventosDaFicha.length,
          concluidos: eventosDaFicha.filter((e) => e.status === 'realizado').length,
        });
      }
    }

    contextoPorPaciente[pid] = {
      visitas,
      pendencias: pendenciasPorPaciente.get(pid) ?? [],
      tratamentosAbertos,
      nomeTratamentoPorEvento,
      orto,
      alertas: parseAlertas(observacoesPorPaciente.get(pid) ?? null),
      // R-61 — todos os eventos do paciente (os 2 status, exodontia/esfoliação realizada
      // inclusas: quem decide como renderizar "ausente" é o `buildResumos` do odontograma,
      // não este filtro). Mesmo array-fonte de `eventosDoPaciente`, zero query nova.
      boca: eventosDoPaciente.map(eventoParaBoca),
    };
  }

  const fmtHora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

  const slots: MeuDiaSlot[] = agendamentos.map((a) => ({
    agendamentoId: a.id,
    pacienteId: a.paciente.id,
    pacienteNome: a.paciente.nome,
    pacienteIdade: a.paciente.data_nascimento ? calcularIdade(a.paciente.data_nascimento) : null,
    horario: fmtHora.format(new Date(a.data_hora)),
    statusAgendamento: a.status,
    temFichaHoje: pacientesComFichaHoje.has(a.paciente.id),
    atendimentoRegistrado: agendamentosRegistrados.has(a.id),
  }));

  const catalogoProcedimentos: MeuDiaCatalogoProcedimento[] = (catalogoRaw ?? []) as MeuDiaCatalogoProcedimento[];
  const destinosEncaminhar: MeuDiaDestinoEncaminhar[] = (destinosRaw ?? []) as MeuDiaDestinoEncaminhar[];

  return { slots, contextoPorPaciente, catalogoProcedimentos, destinosEncaminhar, meuDentistaId: dentistaId, primeiraSessao };
}
