'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireClinicContext } from '@/server/auth/clinic';
import { TIPO_LABEL, type TipoRegistroOdontograma } from '@/types/odontograma';
import { idsDeInclusoesRevisadas } from '@/lib/orcamentos/revisao-inclusoes';

const contextoSchema = z.object({
  fichaId: z.string().uuid(),
  orcamentoId: z.string().uuid(),
});

const fichaSchema = z.object({ fichaId: z.string().uuid() });

export type ProcedimentoFaltante = {
  eventoId: string;
  nome: string;
  local: string;
  adicionadoEm: string;
  revisado: boolean;
};

export type DiferencasFichaOrcamento = {
  fichaId: string;
  orcamentoId: string;
  versaoOrcamento: string;
  vinculos: Array<{ eventoId: string; itemId: string | null; nome: string; local: string; retiradoEm: string | null }>;
  faltantes: ProcedimentoFaltante[];
  renomeacoesPendentes: Array<{
    alteracaoId: string;
    eventoId: string;
    itemId: string | null;
    nomeAnterior: string;
    nomeAtual: string;
  }>;
  retiradasPendentes: Array<{
    alteracaoId: string;
    eventoId: string;
    nome: string;
    retiradoEm: string;
    itemId: string | null;
  }>;
};

export type ResumoOrcamentoDaFicha = {
  fichaId: string;
  orcamentoIds: string[];
  eventoIdsFaltantes: string[];
  quantidadeProcedimentos: number;
};

type EventoDaFicha = {
  id: string;
  tipo: string;
  procedimento_nome: string | null;
  observacao: string | null;
  nivel: string;
  arcada: string | null;
  quadrante: number | null;
  dente: number | null;
  origem: string;
  status: string;
  created_at: string;
  retirado_em: string | null;
  dentista_id: string | null;
  encaminhado_para: string | null;
};

type VinculoOrcamento = {
  evento_id: string;
  orcamento_id: string;
  item_id: string | null;
  retirado_em: string | null;
};

type LogAlteracao = {
  id: string;
  entity_id: string;
  action: string;
  metadata: unknown;
  created_at: string;
};

function nomeEvento(evento: EventoDaFicha): string {
  if (evento.procedimento_nome?.trim()) return evento.procedimento_nome.trim();
  if (evento.tipo === 'outro' && evento.observacao?.trim()) return evento.observacao.trim();
  return evento.tipo in TIPO_LABEL ? TIPO_LABEL[evento.tipo as TipoRegistroOdontograma] : 'Procedimento';
}

function localEvento(evento: EventoDaFicha): string {
  if (evento.dente !== null) return `D${evento.dente}`;
  if (evento.nivel === 'arcada') return evento.arcada === 'superior' ? 'Arcada superior' : 'Arcada inferior';
  if (evento.nivel === 'quadrante' && evento.quadrante !== null) return `Quadrante ${evento.quadrante}`;
  return evento.nivel === 'boca' ? 'Boca toda' : 'Sem região';
}

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function metadataBoolean(metadata: unknown, key: string): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[key] === true;
}

async function carregarContexto(fichaId: string, orcamentoId: string): Promise<{
  eventos: EventoDaFicha[];
  vinculos: VinculoOrcamento[];
  logs: LogAlteracao[];
  versaoOrcamento: string;
  criadoEm: string;
  itens: Array<{ id: string; descricao: string | null; created_at: string }>;
} | null> {
  const { supabase, clinicId } = await requireClinicContext();
  const { data: orcamento } = await supabase
    .from('orcamentos')
    .select('id, ficha_id, paciente_id, dentista_id, created_at, updated_at')
    .eq('id', orcamentoId)
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ id: string; ficha_id: string | null; paciente_id: string; dentista_id: string | null; created_at: string; updated_at: string }>();
  if (!orcamento?.dentista_id) return null;
  const permissao = await supabase.rpc('can_act_as_dentista', { target_dentista_id: orcamento.dentista_id });
  if (permissao.error || permissao.data !== true) return null;

  const { data: eventos, error: eventosError } = await supabase.from('odontograma_eventos')
    .select('id, tipo, procedimento_nome, observacao, nivel, arcada, quadrante, dente, origem, status, created_at, retirado_em, dentista_id, encaminhado_para')
    .eq('ficha_id', fichaId).eq('clinica_id', clinicId).eq('paciente_id', orcamento.paciente_id)
    .in('origem', ['clinica']).in('status', ['indicado', 'realizado']);
  if (eventosError) throw new Error('Não foi possível atualizar as diferenças da ficha.');
  const eventosDoResponsavel = ((eventos ?? []) as EventoDaFicha[]).filter(
    (evento) => (evento.encaminhado_para ?? evento.dentista_id) === orcamento.dentista_id,
  );
  const eventoIds = eventosDoResponsavel.map((evento) => evento.id);
  const cabecalho = { versaoOrcamento: new Date(orcamento.updated_at).toISOString(), criadoEm: orcamento.created_at };
  const { data: itens, error: itensError } = await supabase.from('orcamento_itens')
    .select('id, descricao, created_at').eq('orcamento_id', orcamentoId).eq('clinica_id', clinicId).is('retirado_em', null);
  if (itensError) throw new Error('Não foi possível conferir os itens do orçamento.');
  if (eventoIds.length === 0) return { eventos: [], vinculos: [], logs: [], ...cabecalho, itens: itens ?? [] };
  const [{ data: vinculos, error: vinculosError }, { data: logsEventos, error: logsEventosError }, { data: logsOrcamento, error: logsOrcamentoError }] = await Promise.all([
    supabase.from('orcamento_eventos')
      .select('evento_id, orcamento_id, item_id, retirado_em')
      .eq('clinica_id', clinicId).in('evento_id', eventoIds),
    supabase.from('activity_logs')
      .select('id, entity_id, action, metadata, created_at')
      .eq('clinica_id', clinicId).eq('paciente_id', orcamento.paciente_id).eq('entity_type', 'odontograma_evento')
      .in('entity_id', eventoIds)
      .in('action', ['odontograma_evento.detalhe_alterado', 'odontograma_evento.retirado'])
      .order('created_at', { ascending: false }),
    supabase.from('activity_logs')
      .select('id, entity_id, action, metadata, created_at')
      .eq('clinica_id', clinicId).eq('paciente_id', orcamento.paciente_id).eq('entity_type', 'orcamento').eq('entity_id', orcamentoId)
      .in('action', ['orcamento_evento.retirada_dispensada', 'orcamento_evento.nome_aplicado', 'orcamento_evento.nome_dispensado', 'orcamento_evento.inclusao_revisada'])
      .order('created_at', { ascending: false }),
  ]);
  if (vinculosError || logsEventosError || logsOrcamentoError) throw new Error('Não foi possível atualizar as diferenças da ficha.');
  return {
    ...cabecalho,
    itens: itens ?? [],
    eventos: eventosDoResponsavel,
    vinculos: (vinculos ?? []) as VinculoOrcamento[],
    logs: [...((logsEventos ?? []) as LogAlteracao[]), ...((logsOrcamento ?? []) as LogAlteracao[])],
  };
}

export async function getDiferencasFichaOrcamento(input: unknown): Promise<
  | { ok: true; dados: DiferencasFichaOrcamento }
  | { ok: false; error: string }
> {
  const parsed = contextoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ficha ou orçamento inválido.' };
  const contexto = await carregarContexto(parsed.data.fichaId, parsed.data.orcamentoId);
  if (!contexto) return { ok: false, error: 'Orçamento da ficha não encontrado ou sem permissão.' };

  const vinculadosAtivos = new Set(contexto.vinculos.filter((v) => v.retirado_em === null).map((v) => v.evento_id));
  const vinculadosPorEvento = new Map(contexto.vinculos.map((v) => [v.evento_id, v]));
  const vinculosDoOrcamento = new Map(contexto.vinculos
    .filter((v) => v.orcamento_id === parsed.data.orcamentoId)
    .map((v) => [v.evento_id, v]));
  const dispensas = new Set(contexto.logs
    .filter((log) => log.action === 'orcamento_evento.retirada_dispensada')
    .map((log) => metadataString(log.metadata, 'alteracao_id'))
    .filter((id): id is string => id !== null));
  const resolucoesDeNome = new Set(contexto.logs
    .filter((log) => log.action === 'orcamento_evento.nome_aplicado' || log.action === 'orcamento_evento.nome_dispensado')
    .map((log) => metadataString(log.metadata, 'alteracao_id'))
    .filter((id): id is string => id !== null));
  const inclusoesRevisadas = idsDeInclusoesRevisadas(contexto.logs);

  const faltantes = contexto.eventos
    .filter((evento) => evento.retirado_em === null && !vinculadosAtivos.has(evento.id) && !vinculadosPorEvento.has(evento.id))
    .map((evento) => ({
      eventoId: evento.id,
      nome: nomeEvento(evento),
      local: localEvento(evento),
      adicionadoEm: evento.created_at,
      revisado: inclusoesRevisadas.has(evento.id),
    }));

  const ultimoNomePorEvento = new Map<string, LogAlteracao>();
  for (const log of contexto.logs) {
    if (log.action === 'odontograma_evento.detalhe_alterado' && metadataBoolean(log.metadata, 'nome_alterado') && !ultimoNomePorEvento.has(log.entity_id)) {
      ultimoNomePorEvento.set(log.entity_id, log);
    }
  }
  const renomeacoesPendentes = [...ultimoNomePorEvento.values()].flatMap((log) => {
    const vinculo = vinculosDoOrcamento.get(log.entity_id);
    const evento = contexto.eventos.find((item) => item.id === log.entity_id);
    const item = contexto.itens.find((item) => item.id === vinculo?.item_id);
    const depois = metadataString(log.metadata, 'nome_atual');
    if (!vinculo || vinculo.retirado_em || !evento || evento.retirado_em || !depois
      || nomeEvento(evento) !== depois || resolucoesDeNome.has(log.id)
      || new Date(log.created_at) < new Date(item?.created_at ?? contexto.criadoEm)
      || item?.descricao?.trim() === depois) return [];
    return [{ alteracaoId: log.id, eventoId: log.entity_id, itemId: vinculo.item_id,
      nomeAnterior: metadataString(log.metadata, 'nome_anterior') ?? item?.descricao ?? 'Nome anterior do procedimento', nomeAtual: depois }];
  });

  const retiradasPendentes = contexto.eventos.flatMap((evento) => {
    if (!evento.retirado_em) return [];
    const log = contexto.logs.find((item) => item.action === 'odontograma_evento.retirado' && item.entity_id === evento.id);
    const vinculo = vinculosDoOrcamento.get(evento.id);
    if (!vinculo || vinculo.retirado_em || (log && dispensas.has(log.id))) return [];
    return [{ alteracaoId: log?.id ?? evento.id, eventoId: evento.id, nome: nomeEvento(evento), retiradoEm: evento.retirado_em, itemId: vinculo.item_id }];
  });

  const vinculos = contexto.eventos.flatMap((evento) => {
    const vinculo = vinculosDoOrcamento.get(evento.id);
    return vinculo && !vinculo.retirado_em ? [{ eventoId: evento.id, itemId: vinculo.item_id, nome: nomeEvento(evento), local: localEvento(evento), retiradoEm: evento.retirado_em }] : [];
  });
  return { ok: true, dados: { fichaId: parsed.data.fichaId, orcamentoId: parsed.data.orcamentoId, versaoOrcamento: contexto.versaoOrcamento, vinculos, faltantes, renomeacoesPendentes, retiradasPendentes } };
}

export async function getResumoOrcamentoDaFicha(input: unknown): Promise<
  | { ok: true; dados: ResumoOrcamentoDaFicha }
  | { ok: false; error: string }
> {
  const parsed = fichaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ficha inválida.' };
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  const query = supabase.from('orcamentos').select('id, dentista_id')
    .eq('ficha_id', parsed.data.fichaId).eq('clinica_id', clinicId);
  if (role !== 'secretaria') query.eq('dentista_id', dentistaId);
  const { data: orcamentos, error } = await query;
  if (error) return { ok: false, error: 'Não foi possível localizar os orçamentos da ficha.' };
  const ids = (orcamentos ?? []).map((orcamento) => orcamento.id as string);
  if (ids.length === 0) return { ok: true, dados: { fichaId: parsed.data.fichaId, orcamentoIds: [], eventoIdsFaltantes: [], quantidadeProcedimentos: 0 } };
  const diferencas = await Promise.all(ids.map((orcamentoId) => getDiferencasFichaOrcamento({ fichaId: parsed.data.fichaId, orcamentoId })));
  const erros = diferencas.find((resultado) => !resultado.ok);
  if (erros && !erros.ok) return erros;
  const eventoIds = new Set(diferencas.flatMap((resultado) => resultado.ok
    ? resultado.dados.faltantes.filter((faltante) => !faltante.revisado).map((faltante) => faltante.eventoId)
    : []));
  return { ok: true, dados: { fichaId: parsed.data.fichaId, orcamentoIds: ids, eventoIdsFaltantes: [...eventoIds], quantidadeProcedimentos: eventoIds.size } };
}

const revisarInclusoesSchema = contextoSchema.extend({
  eventoIds: z.array(z.string().uuid()).min(1).max(100).refine(
    (ids) => new Set(ids).size === ids.length,
    'Não repita procedimentos na revisão.',
  ),
});

/** Registra que o dentista viu os itens e decidiu não cobrá-los neste momento. */
export async function revisarInclusoesFichaOrcamento(input: unknown): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const parsed = revisarInclusoesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Revise os procedimentos antes de continuar.' };

  const diferencas = await getDiferencasFichaOrcamento(parsed.data);
  if (!diferencas.ok) return diferencas;
  const faltantesAtuais = new Set(diferencas.dados.faltantes.map((item) => item.eventoId));
  if (parsed.data.eventoIds.some((id) => !faltantesAtuais.has(id))) {
    return { ok: false, error: 'A ficha mudou enquanto você revisava. Reabra o orçamento para conferir.' };
  }

  const { supabase, clinicId, dentistaId } = await requireClinicContext();
  const { data: orcamento } = await supabase.from('orcamentos')
    .select('paciente_id')
    .eq('id', parsed.data.orcamentoId)
    .eq('ficha_id', parsed.data.fichaId)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ paciente_id: string }>();
  if (!orcamento) return { ok: false, error: 'Orçamento da ficha não encontrado.' };

  const { error } = await supabase.from('activity_logs').insert({
    clinica_id: clinicId,
    actor_id: dentistaId,
    paciente_id: orcamento.paciente_id,
    entity_type: 'orcamento',
    entity_id: parsed.data.orcamentoId,
    action: 'orcamento_evento.inclusao_revisada',
    metadata: { ficha_id: parsed.data.fichaId, evento_ids: parsed.data.eventoIds },
  });
  if (error) return { ok: false, error: 'Não foi possível registrar a revisão. Tente novamente.' };

  revalidatePath(`/dashboard/pacientes/${orcamento.paciente_id}`);
  return { ok: true };
}

const retirarSchema = z.object({
  fichaId: z.string().uuid(),
  orcamentoId: z.string().uuid(),
  itemId: z.string().uuid(),
  eventoIds: z.array(z.string().uuid()).min(1).max(100),
  versaoEsperada: z.string().datetime(),
  confirmarAjusteFinanceiro: z.boolean().optional().default(false),
});

const retirarDaFichaSchema = z.object({ eventoId: z.string().uuid() });
const dispensarRetiradaSchema = z.object({
  fichaId: z.string().uuid(),
  orcamentoId: z.string().uuid(),
  eventoId: z.string().uuid(),
  alteracaoId: z.string().uuid(),
});
const resolverRenomeacaoSchema = z.object({
  fichaId: z.string().uuid(),
  orcamentoId: z.string().uuid(),
  eventoId: z.string().uuid(),
  itemId: z.string().uuid(),
  alteracaoId: z.string().uuid(),
  nomeAtual: z.string().trim().min(1).max(500),
  manterNomeHistorico: z.boolean(),
});
const vincularLegadoSchema = z.object({
  fichaId: z.string().uuid(),
  orcamentoId: z.string().uuid(),
  itemId: z.string().uuid(),
  eventoIds: z.array(z.string().uuid()).min(1).max(100),
});

type PreviaRetiradaFinanceira = {
  status: 'revisar_cobranca';
  total: number;
  recebido: number;
  saldo: number;
  etapas_abertas: number;
  total_antes: number;
  total_depois: number;
  devido_antes: number;
  devido_depois: number;
  motivo: 'confirmacao_necessaria' | 'valor_abaixo_recebido';
};

/** O editor clínico chama esta ação antes de oferecer a retirada comercial. */
export async function retirarProcedimentoDaFicha(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = retirarDaFichaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Procedimento inválido.' };
  const { supabase } = await requireClinicContext();
  const { error } = await supabase.rpc('retirar_evento_ficha_orcamento', { p_evento_id: parsed.data.eventoId });
  if (error) {
    if (error.message.includes('registro_bloqueado')) return { ok: false, error: 'Este registro assinado não pode ser retirado.' };
    if (error.message.includes('sem_permissao')) return { ok: false, error: 'Você não tem permissão para retirar este procedimento.' };
    return { ok: false, error: 'Não foi possível retirar o procedimento da ficha.' };
  }
  return { ok: true };
}

export async function retirarProcedimentoDoOrcamento(input: unknown): Promise<
  | { ok: true; orcamentoId: string }
  | { ok: false; code: 'INVALIDO' | 'SEM_PERMISSAO' | 'CONFLITO'; error: string }
  | { ok: false; code: 'REVISAR_COBRANCA'; error: string; previa: PreviaRetiradaFinanceira }
> {
  const parsed = retirarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALIDO', error: 'Revise os procedimentos selecionados.' };
  const { supabase, clinicId } = await requireClinicContext();
  const { data: orcamento } = await supabase.from('orcamentos').select('paciente_id')
    .eq('id', parsed.data.orcamentoId).eq('ficha_id', parsed.data.fichaId).eq('clinica_id', clinicId).maybeSingle<{ paciente_id: string }>();
  if (!orcamento) return { ok: false, code: 'SEM_PERMISSAO', error: 'Orçamento da ficha não encontrado.' };
  const { data, error } = await supabase.rpc('retirar_itens_orcamento_da_ficha', {
    p_orcamento_id: parsed.data.orcamentoId,
    p_item_id: parsed.data.itemId,
    p_evento_ids: parsed.data.eventoIds,
    p_versao_esperada: parsed.data.versaoEsperada,
    p_confirmar_ajuste_financeiro: parsed.data.confirmarAjusteFinanceiro,
  });
  if (error) {
    if (error.message.includes('revisar_cobranca')) return { ok: false, code: 'CONFLITO', error: 'Selecione todos os procedimentos ligados a este item antes de retirar.' };
    if (error.message.includes('conflito')) return { ok: false, code: 'CONFLITO', error: 'O orçamento mudou enquanto você revisava. Recarregue antes de continuar.' };
    if (error.message.includes('sem_permissao')) return { ok: false, code: 'SEM_PERMISSAO', error: 'Você não tem permissão para retirar este item.' };
    return { ok: false, code: 'INVALIDO', error: 'Não foi possível retirar o procedimento. Nenhuma alteração foi salva.' };
  }
  if (isPreviaRetiradaFinanceira(data)) {
    return {
      ok: false,
      code: 'REVISAR_COBRANCA',
      error: data.motivo === 'valor_abaixo_recebido'
        ? 'O valor ativo ficaria abaixo do já recebido. Corrija o acordo, a cobrança ou o recebimento antes de retirar.'
        : 'Este item afeta cobranças ou recebimentos. Revise a etapa e confirme a retirada.',
      previa: data,
    };
  }
  if (!isRetiradaConcluida(data)) return { ok: false, code: 'INVALIDO', error: 'Não foi possível confirmar a retirada. Nenhuma alteração foi salva.' };
  revalidatePath(`/dashboard/pacientes/${orcamento.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  return { ok: true, orcamentoId: parsed.data.orcamentoId };
}

/** Mantém o vínculo comercial apenas para esta retirada clínica e deixa um rastro auditável. */
export async function dispensarRetiradaDoOrcamento(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = dispensarRetiradaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados da retirada inválidos.' };
  const { supabase, clinicId } = await requireClinicContext();
  const { data: orcamento } = await supabase.from('orcamentos').select('paciente_id')
    .eq('id', parsed.data.orcamentoId).eq('ficha_id', parsed.data.fichaId).eq('clinica_id', clinicId)
    .maybeSingle<{ paciente_id: string }>();
  if (!orcamento) return { ok: false, error: 'Orçamento da ficha não encontrado.' };
  const { error } = await supabase.rpc('dispensar_retirada_orcamento', {
    p_orcamento_id: parsed.data.orcamentoId,
    p_evento_id: parsed.data.eventoId,
    p_alteracao_id: parsed.data.alteracaoId,
  });
  if (error) return { ok: false, error: 'Não foi possível manter este procedimento no orçamento.' };
  revalidatePath(`/dashboard/pacientes/${orcamento.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  return { ok: true };
}

/** Aplica o nome atual só quando o item representa um único evento; grupos exigem revisão manual. */
export async function resolverRenomeacaoDoOrcamento(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = resolverRenomeacaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados da alteração inválidos.' };
  const { supabase, clinicId } = await requireClinicContext();
  const { data: orcamento } = await supabase.from('orcamentos').select('paciente_id')
    .eq('id', parsed.data.orcamentoId).eq('ficha_id', parsed.data.fichaId).eq('clinica_id', clinicId)
    .maybeSingle<{ paciente_id: string }>();
  if (!orcamento) return { ok: false, error: 'Orçamento da ficha não encontrado.' };
  const { error } = await supabase.rpc('resolver_renomeacao_item_orcamento', {
    p_orcamento_id: parsed.data.orcamentoId,
    p_evento_id: parsed.data.eventoId,
    p_item_id: parsed.data.itemId,
    p_alteracao_id: parsed.data.alteracaoId,
    p_nome_atual: parsed.data.nomeAtual,
    p_manter_nome_historico: parsed.data.manterNomeHistorico,
  });
  if (error) {
    if (error.message.includes('item_agrupado')) return { ok: false, error: 'Este item reúne mais de um procedimento. Revise-o manualmente antes de alterar o nome.' };
    return { ok: false, error: 'Não foi possível registrar a decisão sobre o nome.' };
  }
  revalidatePath(`/dashboard/pacientes/${orcamento.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  return { ok: true };
}

/** Persiste a escolha humana para vínculos anteriores ao campo `item_id`, sem heurística por nome. */
export async function vincularEventosLegadosAoItem(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = vincularLegadoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Selecione o item e os procedimentos a relacionar.' };
  const { supabase, clinicId } = await requireClinicContext();
  const { data: orcamento } = await supabase.from('orcamentos').select('paciente_id')
    .eq('id', parsed.data.orcamentoId).eq('ficha_id', parsed.data.fichaId).eq('clinica_id', clinicId)
    .maybeSingle<{ paciente_id: string }>();
  if (!orcamento) return { ok: false, error: 'Orçamento da ficha não encontrado.' };
  const { error } = await supabase.rpc('vincular_eventos_legados_item_orcamento', {
    p_orcamento_id: parsed.data.orcamentoId,
    p_item_id: parsed.data.itemId,
    p_evento_ids: parsed.data.eventoIds,
  });
  if (error) return { ok: false, error: 'O vínculo mudou enquanto você revisava. Recarregue e confirme novamente.' };
  revalidatePath(`/dashboard/pacientes/${orcamento.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  return { ok: true };
}

function isPreviaRetiradaFinanceira(value: unknown): value is PreviaRetiradaFinanceira {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.status === 'revisar_cobranca'
    && typeof record.total === 'number'
    && typeof record.recebido === 'number'
    && typeof record.saldo === 'number'
    && typeof record.etapas_abertas === 'number'
    && typeof record.total_antes === 'number' && typeof record.total_depois === 'number'
    && typeof record.devido_antes === 'number' && typeof record.devido_depois === 'number'
    && (record.motivo === 'confirmacao_necessaria' || record.motivo === 'valor_abaixo_recebido');
}

function isRetiradaConcluida(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && (value as Record<string, unknown>).status === 'ok';
}
