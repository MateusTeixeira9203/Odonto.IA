import { requireClinicContext } from '@/server/auth/clinic';
import { hojeBRT } from '@/lib/hora-brt';
import { derivarV2DosEventos } from '@/lib/odontograma/derivar-campos-legado';
import { statusDoTratamento } from '@/lib/ficha/status-tratamento';
import { montarRowsEventos } from '@/lib/odontograma/montar-rows-eventos';
import { finalizarAtendimentoSeAplicavel } from '@/server/patients/finalizar-atendimento';
import { salvarFicha, type OrigemFicha, type SalvarFichaResult } from '@/server/patients/salvar-ficha';
import {
  TIPO_LABEL,
  type OdontogramaEventoDraft,
  type OrtoManutencaoInfo,
  type StatusRegistro,
  type TipoRegistroOdontograma,
} from '@/types/odontograma';

/**
 * R-108b — o roteamento da visita: o que foi feito hoje cai na ficha certa sem o dentista
 * precisar navegar. Spec: `plans/specs/R-108b-roteamento-da-visita.md`.
 *
 * A regra, em uma linha: **pendência volta pra ficha onde foi planejada; só o que nasce na
 * sessão tem destino escolhível.** Mover um procedimento planejado quebraria justamente o
 * histórico que o R-108 existe pra montar.
 *
 * Módulo puro (sem `'use server'`) de propósito — quem expõe a action é
 * `app/dashboard/meu-dia/actions.ts`, e a lógica mora aqui (CLAUDE.md §Regras de código).
 */

type ClinicSupabase = Awaited<ReturnType<typeof requireClinicContext>>['supabase'];

/** Destino dos eventos NOVOS da sessão — o que o seletor controla. `null` = ficha nova.
 *  Pendência não aparece aqui de propósito: ela não tem destino a escolher (spec §2). */
export interface DestinoNovos {
  fichaId: string | null;
}

export interface RotearVisitaInput {
  pacienteId: string;
  /** Ausente somente quando o registro nasce diretamente pelo prontuário do paciente. */
  agendamentoId?: string;
  textoVisita: string;
  eventosDraft: OdontogramaEventoDraft[];
  alertaNovo?: string | null;
  ortoManutencao?: OrtoManutencaoInfo | null;
  /** R-85 — ficha que o orçamento antecipado já criou. **Vence o roteamento** (invariante §7). */
  fichaId?: string;
  finalizarAtendimento?: boolean;
  destinoNovos?: DestinoNovos;
  /** R-140a — presente apenas no novo caminho do Meu Dia; chamadas legadas mantêm o dedup diário. */
  atendimentoId?: string;
  /** R-140c — o prontuário cria ficha manual, sem inventar um agendamento de origem. */
  origemFicha?: Extract<OrigemFicha, 'modo_consulta' | 'manual'>;
}

const ERRO_FICHA_SUMIU =
  'A ficha deste tratamento não foi encontrada. Atualize a página e tente de novo.';
const ERRO_FICHA_ASSINADA =
  'Esta ficha já foi assinada e não pode mais receber procedimentos.';
const ERRO_FICHA_DE_OUTRO =
  'Não foi possível gravar: esta ficha é de outro dentista.';

// ─────────────────────────────────────────────────────────────────────────────
// Acrescentar numa ficha que já existe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acrescenta eventos e UMA evolução a uma ficha que já existe — sem tocar em nada mais dela.
 *
 * Por que não é `salvarFicha`: aquele significa *"este documento é assim"* e grava
 * incondicionalmente `data_atendimento`, `anotacoes`, `queixa_principal`, `conduta` e
 * `orto_manutencao` (salvar-ficha.ts, ramo de update), além de fechar o agendamento. Usá-lo
 * pra alcançar a ficha de 26/07 a transformaria numa ficha de hoje, com as anotações daquela
 * consulta substituídas pelo texto desta. Aqui a semântica é a oposta: *"acrescenta isto ao
 * documento"* (spec §4.2).
 *
 * Serve aos DOIS casos em que a visita alcança uma ficha pré-existente: pendência concluída
 * (volta pra casa) e procedimento novo absorvido por um tratamento aberto (o "absorver" do
 * seletor). A mecânica é idêntica — em ambos o payload é subconjunto da ficha.
 */
export async function acrescentarEventosNaFicha(input: {
  fichaId: string;
  pacienteId: string;
  eventos: OdontogramaEventoDraft[];
  evolucao: { texto: string | null; automatica: boolean };
  atendimentoId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

  const { data: ficha } = await supabase
    .from('fichas')
    .select('id, assinado_em')
    .eq('id', input.fichaId)
    .eq('clinica_id', clinicId)
    // Guard de travessia, 2ª camada: a ficha alvo tem que ser DESTE paciente.
    .eq('paciente_id', input.pacienteId)
    .maybeSingle<{ id: string; assinado_em: string | null }>();

  if (!ficha) return { ok: false, error: ERRO_FICHA_SUMIU };
  if (ficha.assinado_em != null) return { ok: false, error: ERRO_FICHA_ASSINADA };

  // Sonda de escrita ANTES de tocar em evento. A leitura de ficha é compartilhada na clínica
  // (migration 099) mas a escrita continua siloada por dentista — sem isto, concluir pendência
  // planejada por um colega gravaria os eventos e falharia calada na ficha, deixando os dois
  // lados inconsistentes. Mesmo padrão de detecção de `salvarFicha`/`deletarFicha`: RLS barra
  // devolvendo 0 linhas, nunca erro.
  const { data: sondada } = await supabase
    .from('fichas')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.fichaId)
    .eq('clinica_id', clinicId)
    .select('id');

  if (!sondada || sondada.length === 0) {
    console.error('[acrescentarEventosNaFicha] UPDATE bloqueado (RLS?) — 0 linhas para', input.fichaId);
    return { ok: false, error: ERRO_FICHA_DE_OUTRO };
  }

  if (input.eventos.length > 0) {
    const rows = montarRowsEventos(input.eventos, {
      clinicId,
      pacienteId: input.pacienteId,
      dentistaId,
      fichaId: input.fichaId,
    });

    const { error } = await supabase.rpc('salvar_eventos_odontograma', {
      p_ficha_id:    input.fichaId,
      p_clinica_id:  clinicId,
      p_paciente_id: input.pacienteId,
      p_eventos:     rows,
      // O ponto do item (migration 142): o payload é SUBCONJUNTO da ficha. Com `true`, o
      // `delete ... id not in (payload)` da RPC levaria junto o resto do plano de tratamento.
      p_sincronizar: false,
    });

    if (error) {
      console.error('[acrescentarEventosNaFicha:eventos]', error.message);
      if (error.message.includes('ficha_assinada')) return { ok: false, error: ERRO_FICHA_ASSINADA };
      if (error.message.includes('ficha_nao_encontrada')) return { ok: false, error: ERRO_FICHA_SUMIU };
      return { ok: false, error: 'Não foi possível gravar os procedimentos nesta ficha.' };
    }

    const rederivou = await rederivarDaFicha(supabase, clinicId, input.fichaId);
    if (!rederivou) return { ok: false, error: ERRO_FICHA_DE_OUTRO };
  }

  return registrarEvolucao(supabase, {
    clinicId,
    dentistaId,
    fichaId: input.fichaId,
    texto: input.evolucao.texto,
    automatica: input.evolucao.automatica,
    atendimentoId: input.atendimentoId,
  });
}

type EventoLegadoRow = {
  tipo: TipoRegistroOdontograma;
  procedimento_nome: string | null;
  observacao: string | null;
  dente: number | null;
  status: StatusRegistro;
};

/**
 * Recalcula, a partir do conjunto **completo** de eventos da ficha:
 *
 * - `dentes_afetados`/`dentes_observacoes`/`procedimentos` — nunca do subconjunto que a visita
 *   de hoje tocou, que deixaria a ficha de tratamento parecendo ter só os 2 procedimentos
 *   desta sessão;
 * - `status` — **é aqui que o tratamento fecha sozinho**. Concluir a última pendência de um
 *   plano é exatamente o momento em que ele deixa de estar aberto, e este é o único caminho de
 *   escrita que passa por lá. Sem isto, a ficha ficaria `aberta` para sempre e continuaria
 *   aparecendo no seletor de destino de todas as visitas seguintes.
 */
async function rederivarDaFicha(
  supabase: ClinicSupabase,
  clinicId: string,
  fichaId: string,
): Promise<boolean> {
  const { data: todos, error } = await supabase
    .from('odontograma_eventos')
    .select('tipo, procedimento_nome, observacao, dente, status')
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null);

  if (error) {
    console.error('[rederivarDaFicha:leitura]', error.message);
    return false;
  }

  const eventos = (todos ?? []) as EventoLegadoRow[];
  const derivado = derivarV2DosEventos(
    eventos.map((r) => ({
      tipo: r.tipo,
      procedimentoNome: r.procedimento_nome,
      observacao: r.observacao,
      ancora: { dente: r.dente },
    })),
  );

  const { data: atualizada } = await supabase
    .from('fichas')
    .update({
      dentes_afetados:    derivado.dentes,
      dentes_observacoes: derivado.observacoes,
      procedimentos:      derivado.procedimentos,
      status:             statusDoTratamento(eventos),
      updated_at:         new Date().toISOString(),
    })
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .select('id');

  if (!atualizada || atualizada.length === 0) {
    console.error('[rederivarDaFicha] UPDATE bloqueado (RLS?) — 0 linhas para', fichaId);
    return false;
  }
  return true;
}

/**
 * Uma evolução por ficha tocada por visita (invariante §7). Deduplicada por
 * (ficha, dentista, dia) porque o R-85 chama o save **duas vezes** no mesmo dia — uma pra
 * criar a ficha a partir do orçamento antecipado, outra no Salvar de verdade — e a 2ª não
 * pode virar uma 2ª linha na timeline da mesma visita.
 */
async function registrarEvolucao(
  supabase: ClinicSupabase,
  ctx: {
    clinicId: string;
    dentistaId: string;
    fichaId: string;
    texto: string | null;
    automatica: boolean;
    atendimentoId?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = hojeBRT();
  const texto = ctx.texto?.trim() ? ctx.texto.trim() : null;

  let query = supabase
    .from('ficha_evolucoes')
    .select('id, texto, automatica')
    .eq('ficha_id', ctx.fichaId);

  if (ctx.atendimentoId) {
    query = query.eq('atendimento_id', ctx.atendimentoId);
  } else {
    query = query.eq('dentista_id', ctx.dentistaId).eq('data', data);
  }

  const { data: existente } = await query.maybeSingle<{ id: string; texto: string | null; automatica: boolean }>();

  if (existente) {
    // A MESMA ficha pode ser escrita duas vezes no mesmo dia por caminhos diferentes — uma vez
    // como ficha da sessão (relato do dentista) e outra como ficha alcançada (resumo do
    // sistema). Quem decide a flag é **o texto que fica**, nunca a passagem anterior.
    //
    // Achado no teste ponta a ponta de 13/08: a regra antiga (`existente.automatica &&
    // ctx.automatica`) fazia o resumo do sistema herdar `automatica: false` de uma evolução
    // anterior vazia — o texto "Canal 44 e Coroa total 44 concluídos em 13/08." ficava gravado
    // como se fosse relato ditado pelo dentista. Num prontuário isso é grave: inverte a
    // invariante §7 e põe palavra do sistema na boca de quem assina.
    const existenteEhRelato = existente.texto !== null && !existente.automatica;
    // Relato ditado nunca é sobrescrito por resumo automático; o contrário pode.
    const ficaComNovo = texto !== null && !(ctx.automatica && existenteEhRelato);
    const alvo = ficaComNovo
      ? { texto, automatica: ctx.automatica }
      : { texto: existente.texto, automatica: existente.automatica };

    if (alvo.texto === existente.texto && alvo.automatica === existente.automatica) {
      return { ok: true }; // nada a mudar — não gasta UPDATE nem `updated_at`
    }

    const { data: atualizada } = await supabase
      .from('ficha_evolucoes')
      .update({ ...alvo, updated_at: new Date().toISOString() })
      .eq('id', existente.id)
      .select('id');

    if (!atualizada || atualizada.length === 0) {
      console.error('[registrarEvolucao] UPDATE bloqueado (RLS?) — 0 linhas para', existente.id);
      return { ok: false, error: 'Não foi possível registrar a evolução desta visita.' };
    }
    return { ok: true };
  }

  const { error } = await supabase.from('ficha_evolucoes').insert({
    clinica_id:  ctx.clinicId,
    ficha_id:    ctx.fichaId,
    dentista_id: ctx.dentistaId,
    data,
    texto,
    automatica:  ctx.automatica,
    ...(ctx.atendimentoId && { atendimento_id: ctx.atendimentoId }),
  });

  if (error) {
    console.error('[registrarEvolucao:insert]', error.message);
    return { ok: false, error: 'Não foi possível registrar a evolução desta visita.' };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto da evolução automática
// ─────────────────────────────────────────────────────────────────────────────

function listar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

function rotulo(ev: OdontogramaEventoDraft): string {
  const nome = ev.procedimentoNome?.trim()
    || (ev.tipo === 'outro' ? ev.observacao.trim() : '')
    || TIPO_LABEL[ev.tipo];
  return ev.ancora.dente != null ? `${nome} ${ev.ancora.dente}` : nome;
}

/**
 * Texto da evolução `automatica: true` — a que nasce do sistema numa ficha que a visita
 * alcançou mas que não é a ficha desta sessão. Determinístico e factual, sem IA: é registro de
 * prontuário, e `automatica` já marca que não é relato do dentista (invariante §7).
 *
 * O relato ditado vai pra UMA ficha só (spec §2 descartou duplicar em todas e descartou fatiar
 * o texto por IA) — as demais recebem isto.
 */
function textoAutomatico(eventos: OdontogramaEventoDraft[], hoje: string): string {
  // hoje vem 'YYYY-MM-DD' (hojeBRT); no prontuário se lê 'DD/MM'.
  const data = `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`;
  const feitos = eventos.filter((e) => e.status === 'realizado').map(rotulo);
  const indicados = eventos.filter((e) => e.status !== 'realizado').map(rotulo);

  const partes: string[] = [];
  if (feitos.length > 0) {
    partes.push(`${listar(feitos)} ${feitos.length > 1 ? 'concluídos' : 'concluído'} em ${data}`);
  }
  if (indicados.length > 0) {
    partes.push(`${listar(indicados)} ${indicados.length > 1 ? 'indicados' : 'indicado'} em ${data}`);
  }
  return `${partes.join('; ')}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// O roteamento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Salva a visita do Meu dia distribuindo o que foi feito entre as fichas certas.
 *
 * Ordem deliberada: as fichas que já existem primeiro, a ficha da sessão por último e o
 * fechamento do atendimento só no fim. Se algo falhar no meio, nada de ficha nova foi criado e
 * o retry é idempotente (upsert por id, evolução deduplicada por dia).
 */
export async function rotearVisitaMeuDia(input: RotearVisitaInput): Promise<SalvarFichaResult> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

  const hoje = hojeBRT();
  const draft = input.eventosDraft;

  // ── 1. Particiona no SERVIDOR ──────────────────────────────────────────────
  // Quem já está no banco é pendência (e traz o `ficha_id` de casa); o resto nasceu hoje. O
  // cliente não consegue fazer esta conta: `OdontogramaEventoDraft` não carrega `ficha_id`.
  // Esta query também É o guard de travessia — evento de outro paciente é recusado aqui.
  const fichaDeOrigem = new Map<string, string>();
  if (draft.length > 0) {
    const { data: existentes, error } = await supabase
      .from('odontograma_eventos')
      .select('id, ficha_id, paciente_id')
      .in('id', draft.map((e) => e.id))
      .eq('clinica_id', clinicId)
    .is('retirado_em', null);

    if (error) {
      console.error('[rotearVisitaMeuDia:particao]', error.message);
      return { ok: false, error: 'Não foi possível salvar a visita. Tente novamente.' };
    }

    for (const row of (existentes ?? []) as { id: string; ficha_id: string | null; paciente_id: string }[]) {
      if (row.paciente_id !== input.pacienteId) {
        console.error('[rotearVisitaMeuDia] evento de outro paciente no draft:', row.id);
        return { ok: false, error: 'Um dos procedimentos pertence a outro paciente. Atualize a página.' };
      }
      if (row.ficha_id) fichaDeOrigem.set(row.id, row.ficha_id);
    }
  }

  // ── 2. Agrupa ──────────────────────────────────────────────────────────────
  // R-85 vence o roteamento: com a ficha do orçamento antecipado já criada, o destino está
  // decidido e o seletor nem aparece na tela (spec §5).
  const fichaDaSessao = input.fichaId ?? null;
  const destinoEscolhido = fichaDaSessao == null ? (input.destinoNovos?.fichaId ?? null) : null;

  const porFicha = new Map<string, OdontogramaEventoDraft[]>();
  const nascidosHoje: OdontogramaEventoDraft[] = [];

  for (const ev of draft) {
    const origem = fichaDeOrigem.get(ev.id);
    if (origem) {
      porFicha.set(origem, [...(porFicha.get(origem) ?? []), ev]);
    } else {
      nascidosHoje.push(ev);
    }
  }

  // "Absorver": procedimento novo entra num tratamento aberto que JÁ EXISTE. Mesma mecânica
  // aditiva da pendência — nos dois casos o payload é subconjunto da ficha, e por isso nenhum
  // dos dois pode passar por `salvarFicha`. A ficha do R-85 é a exceção: ela É da sessão.
  const absorve = destinoEscolhido !== null && nascidosHoje.length > 0;
  if (absorve) {
    porFicha.set(destinoEscolhido, [...(porFicha.get(destinoEscolhido) ?? []), ...nascidosHoje]);
  }
  /** O que sobra pra ficha da sessão — vazio quando um tratamento aberto absorveu tudo. */
  const paraSessao = absorve ? [] : nascidosHoje;

  // ── 3. Quem fica com o relato ditado ───────────────────────────────────────
  // Uma ficha só (spec §2: duplicar polui prontuário, fatiar o texto por IA foi descartado).
  // `alertaNovo`/`ortoManutencao` são conteúdo de ficha sem outro lugar pra morar: se vierem
  // preenchidos, a ficha da sessão nasce mesmo numa visita que só concluiu pendência — perder
  // alerta de alergia é pior que uma ficha a mais.
  const criaFichaDaSessao =
    paraSessao.length > 0 ||
    porFicha.size === 0 ||
    input.alertaNovo != null ||
    input.ortoManutencao != null;

  // Sem ficha da sessão, o relato fica com a ficha absorvedora; sem absorção, com a que
  // recebeu mais procedimentos hoje. As demais recebem evolução automática.
  const principal: string | null = criaFichaDaSessao
    ? null
    : absorve
      ? destinoEscolhido
      : fichaComMaisEventos(porFicha, draft);

  // ── 4. Fichas que já existem ───────────────────────────────────────────────
  for (const [fichaId, eventos] of porFicha) {
    const ehPrincipal = fichaId === principal;
    const resultado = await acrescentarEventosNaFicha({
      fichaId,
      pacienteId: input.pacienteId,
      eventos,
      evolucao: ehPrincipal
        ? { texto: input.textoVisita, automatica: false }
        : { texto: textoAutomatico(eventos, hoje), automatica: true },
      atendimentoId: input.atendimentoId,
    });
    if (!resultado.ok) return resultado;
  }

  // ── 5. A ficha da sessão ───────────────────────────────────────────────────
  if (!criaFichaDaSessao) {
    if (principal === null) {
      // Inalcançável: `criaFichaDaSessao` já é true quando `porFicha` está vazio. Fica como
      // erro legível em vez de cast, pra nunca virar `undefined` no retorno.
      console.error('[rotearVisitaMeuDia] sem ficha principal e sem ficha da sessão');
      return { ok: false, error: 'Não foi possível salvar a visita. Tente novamente.' };
    }
    await finalizarAtendimentoSeAplicavel(supabase, {
      clinicId,
      dentistaId,
      pacienteId: input.pacienteId,
      origem: input.origemFicha ?? 'modo_consulta',
      agendamentoId: input.agendamentoId,
      finalizarAtendimento: input.finalizarAtendimento,
    });
    // Nenhuma ficha criada (invariante §7). Devolve a que ficou com o relato pra que o retry
    // do odontograma, na tela, tenha em que se apoiar.
    return { ok: true, fichaId: principal };
  }

  const derivado = derivarV2DosEventos(paraSessao);
  const resultado = await salvarFicha({
    fichaId: fichaDaSessao ?? undefined,
    pacienteId: input.pacienteId,
    origem: input.origemFicha ?? 'modo_consulta',
    agendamentoId: input.agendamentoId,
    // O fechamento do atendimento é UM por visita (G12) e acontece abaixo, depois de tudo ter
    // dado certo — nunca uma vez por ficha alcançada.
    finalizarAtendimento: false,
    dataAtendimento: hoje,
    queixaPrincipal: '',
    anotacoes: input.textoVisita,
    dentesAfetados: derivado.dentes,
    dentesObservacoes: derivado.observacoes,
    procedimentos: derivado.procedimentos,
    conduta: '',
    odontogramaEventos: paraSessao,
    alertaNovo: input.alertaNovo ?? null,
    ortoManutencao: input.ortoManutencao ?? null,
  });

  if (!resultado.ok) return resultado;

  const evolucao = await registrarEvolucao(supabase, {
    clinicId,
    dentistaId,
    fichaId: resultado.fichaId,
    texto: input.textoVisita,
    automatica: false,
    atendimentoId: input.atendimentoId,
  });
  // Deliberadamente não-fatal: a ficha já existe neste ponto, e devolver erro faria o dentista
  // salvar de novo — criando uma 2ª ficha, que é bem pior que uma timeline sem a entrada de
  // hoje. Fica no log pra aparecer na auditoria.
  if (!evolucao.ok) console.error('[rotearVisitaMeuDia] evolução da ficha da sessão falhou:', resultado.fichaId);

  await finalizarAtendimentoSeAplicavel(supabase, {
    clinicId,
    dentistaId,
    pacienteId: input.pacienteId,
    origem: input.origemFicha ?? 'modo_consulta',
    agendamentoId: input.agendamentoId,
    finalizarAtendimento: input.finalizarAtendimento,
  });

  return resultado;
}

/** Empate resolvido pela ordem de aparição no draft — determinístico, nunca aleatório. */
function fichaComMaisEventos(
  porFicha: Map<string, OdontogramaEventoDraft[]>,
  draft: OdontogramaEventoDraft[],
): string {
  const primeiraAparicao = (fichaId: string) =>
    draft.findIndex((e) => (porFicha.get(fichaId) ?? []).some((p) => p.id === e.id));

  return [...porFicha.keys()].sort((a, b) => {
    const diff = (porFicha.get(b)?.length ?? 0) - (porFicha.get(a)?.length ?? 0);
    return diff !== 0 ? diff : primeiraAparicao(a) - primeiraAparicao(b);
  })[0];
}
