"use server";

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getReceptionContext, type ReceptionContextResult } from '@/server/auth/reception-context';

const CriarPacienteEAgendamentoSchema = z.object({
  dentistaId: z.string().uuid(),
  nome: z.string().trim().min(2).max(160),
  telefone: z.string().trim().max(40).nullable(),
  dataHora: z.string().datetime({ offset: true }),
  duracaoMinutos: z.number().int().min(5).max(480),
  observacoes: z.string().trim().max(4_000).nullable(),
}).strict();

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    pacienteId: z.string().uuid(),
    agendamentoId: z.string().uuid(),
  }).strict(),
  z.object({
    ok: z.literal(false),
    code: z.enum(['NOME_INVALIDO', 'AGENDA_INVALIDA', 'SEM_ACESSO', 'CONFLITO_DENTISTA', 'FORA_EXPEDIENTE']),
  }).strict(),
]);

const CriarAgendamentoExistenteSchema = z.object({
  pacienteId: z.string().uuid(),
  dentistaId: z.string().uuid(),
  dataHora: z.string().datetime({ offset: true }),
  duracaoMinutos: z.number().int().min(5).max(480),
  observacoes: z.string().trim().max(4_000).nullable(),
}).strict();

const ExistingRpcResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), agendamentoId: z.string().uuid() }).strict(),
  z.object({
    ok: z.literal(false),
    code: z.enum(['AGENDA_INVALIDA', 'SEM_ACESSO', 'CONFLITO_DENTISTA', 'FORA_EXPEDIENTE']),
  }).strict(),
]);

type ReceptionActionDependencies = {
  reception(): Promise<ReceptionContextResult>;
  execute(input: {
    p_clinica_id: string;
    p_dentista_id: string;
    p_nome: string;
    p_telefone: string | null;
    p_data_hora: string;
    p_duracao_minutos: number;
    p_observacoes: string | null;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
  executeExisting(input: {
    p_clinica_id: string;
    p_paciente_id: string;
    p_dentista_id: string;
    p_data_hora: string;
    p_duracao_minutos: number;
    p_observacoes: string | null;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
};

async function defaultDependencies(): Promise<ReceptionActionDependencies> {
  const client = await createClient();
  return {
    reception: () => getReceptionContext(),
    execute: (input) => client.rpc('criar_paciente_e_agendamento_operacional', input),
    executeExisting: (input) => client.rpc('criar_agendamento_operacional', input),
  };
}

export type CriarPacienteEAgendamentoResult =
  | { ok: true; pacienteId: string; agendamentoId: string }
  | { ok: false; error: string };

/**
 * Entrada exclusiva da recepção sem perfil clínico. A função SQL insere paciente e
 * agendamento na mesma transação e revalida o escopo do profissional escolhido.
 */
export async function criarPacienteEAgendamentoRecepcao(
  input: unknown,
  dependencies?: ReceptionActionDependencies,
): Promise<CriarPacienteEAgendamentoResult> {
  const parsed = CriarPacienteEAgendamentoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados do paciente ou horário inválidos.' };

  try {
    const source = dependencies ?? await defaultDependencies();
    const reception = await source.reception();
    if (!reception.ok) return { ok: false, error: 'Sua sessão de recepção não tem acesso a esta clínica.' };

    const { data, error } = await source.execute({
      p_clinica_id: reception.data.clinicaId,
      p_dentista_id: parsed.data.dentistaId,
      p_nome: parsed.data.nome,
      p_telefone: parsed.data.telefone,
      p_data_hora: parsed.data.dataHora,
      p_duracao_minutos: parsed.data.duracaoMinutos,
      p_observacoes: parsed.data.observacoes,
    });
    if (error) return { ok: false, error: 'Não foi possível criar o paciente e agendamento agora.' };

    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return { ok: false, error: 'Resposta inválida ao criar o agendamento.' };
    if (result.data.ok) return result.data;

    const messages = {
      SEM_ACESSO: 'Você não tem acesso ao profissional selecionado.',
      CONFLITO_DENTISTA: 'Este horário conflita com a agenda do profissional.',
      FORA_EXPEDIENTE: 'Este horário está fora do expediente do profissional.',
      NOME_INVALIDO: 'Dados do paciente ou horário inválidos.',
      AGENDA_INVALIDA: 'Dados do paciente ou horário inválidos.',
    } as const;
    return { ok: false, error: messages[result.data.code] };
  } catch {
    return { ok: false, error: 'Não foi possível criar o paciente e agendamento agora.' };
  }
}

/** Cria agenda para paciente já autorizado, sem assumir uma identidade clínica para a recepção. */
export async function criarAgendamentoRecepcaoExistente(
  input: unknown,
  dependencies?: ReceptionActionDependencies,
): Promise<CriarPacienteEAgendamentoResult> {
  const parsed = CriarAgendamentoExistenteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados do paciente ou horário inválidos.' };

  try {
    const source = dependencies ?? await defaultDependencies();
    const reception = await source.reception();
    if (!reception.ok) return { ok: false, error: 'Sua sessão de recepção não tem acesso a esta clínica.' };
    const { data, error } = await source.executeExisting({
      p_clinica_id: reception.data.clinicaId,
      p_paciente_id: parsed.data.pacienteId,
      p_dentista_id: parsed.data.dentistaId,
      p_data_hora: parsed.data.dataHora,
      p_duracao_minutos: parsed.data.duracaoMinutos,
      p_observacoes: parsed.data.observacoes,
    });
    if (error) return { ok: false, error: 'Não foi possível criar o agendamento agora.' };
    const result = ExistingRpcResultSchema.safeParse(data);
    if (!result.success) return { ok: false, error: 'Resposta inválida ao criar o agendamento.' };
    if (result.data.ok) return { ok: true, pacienteId: parsed.data.pacienteId, agendamentoId: result.data.agendamentoId };
    const messages = {
      SEM_ACESSO: 'Você não tem acesso ao paciente ou profissional selecionado.',
      CONFLITO_DENTISTA: 'Este horário conflita com a agenda do profissional.',
      FORA_EXPEDIENTE: 'Este horário está fora do expediente do profissional.',
      AGENDA_INVALIDA: 'Dados do paciente ou horário inválidos.',
    } as const;
    return { ok: false, error: messages[result.data.code] };
  } catch {
    return { ok: false, error: 'Não foi possível criar o agendamento agora.' };
  }
}

const AgendaMutationSchema = z.object({
  agendamentoId: z.string().uuid(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
  dataHora: z.string().datetime({ offset: true }).optional(),
  duracaoMinutos: z.number().int().min(5).max(480).optional(),
  observacoes: z.string().trim().max(4_000).nullable().optional(),
}).strict();

export async function atualizarStatusAgendamentoRecepcao(input: unknown): Promise<{ error?: string }> {
  const parsed = AgendaMutationSchema.safeParse(input);
  if (!parsed.success || !parsed.data.status) return { error: 'Dados do agendamento inválidos.' };
  const reception = await getReceptionContext();
  if (!reception.ok) return { error: 'Sua sessão de recepção não tem acesso a esta clínica.' };
  const client = await createClient();
  const { data, error } = await client.rpc('atualizar_status_agendamento_operacional', {
    p_clinica_id: reception.data.clinicaId, p_agendamento_id: parsed.data.agendamentoId, p_status: parsed.data.status,
  });
  return !error && data && typeof data === 'object' && 'ok' in data && data.ok === true ? {} : { error: 'Não foi possível atualizar o agendamento.' };
}

export async function reagendarAgendamentoRecepcao(input: unknown): Promise<{ error?: string }> {
  const parsed = AgendaMutationSchema.safeParse(input);
  if (!parsed.success || !parsed.data.dataHora || !parsed.data.duracaoMinutos) return { error: 'Dados do agendamento inválidos.' };
  const reception = await getReceptionContext();
  if (!reception.ok) return { error: 'Sua sessão de recepção não tem acesso a esta clínica.' };
  const client = await createClient();
  const { data, error } = await client.rpc('reagendar_agendamento_operacional', {
    p_clinica_id: reception.data.clinicaId, p_agendamento_id: parsed.data.agendamentoId,
    p_data_hora: parsed.data.dataHora, p_duracao_minutos: parsed.data.duracaoMinutos,
    p_observacoes: parsed.data.observacoes ?? null,
  });
  return !error && data && typeof data === 'object' && 'ok' in data && data.ok === true ? {} : { error: 'Não foi possível reagendar.' };
}
