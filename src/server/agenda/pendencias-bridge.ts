import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/calendar/google-provider';
import { inserirNotificacao } from '@/lib/notificacoes';
import { getMemberContext } from '@/server/auth/member-context';
import type { MemberContextResult } from '@/server/auth/member-context';
import { requireUser } from '@/server/auth/user';
import { listarPendencias } from '@/server/pendencias/operations';
import type { PendenciaCard, PendenciaFailureCode, PendenciasBoard, PendenciasResult } from '@/server/pendencias/contracts';
import { validarExpediente } from './validar-expediente';

export type AgendarPendenciaInput = {
  clinicaIdEsperada: string;
  pendenciaId: string;
  versaoEsperada: number;
  dataHora: string;
  duracaoMinutos: number;
};

export type AgendarPendenciaBridgeResult =
  | { handled: false }
  | { handled: true; result: PendenciasResult<{ agendamentoId: string }> };

export type AgendarPendenciaBridgeDependencies = {
  getMember(input: { clinicaIdEsperada: string }): Promise<MemberContextResult>;
  listar(input: { clinicaIdEsperada: string }): Promise<PendenciasResult<PendenciasBoard>>;
  requireUser: typeof requireUser;
  effects?: AgendaEffects;
};

export type AgendaEffects = {
  createCalendarEvent: typeof createGoogleCalendarEvent;
  updateCalendarEvent: typeof updateGoogleCalendarEvent;
  notify: typeof inserirNotificacao;
};

type AgendaRow = {
  id: string;
  paciente_id: string;
  dentista_id: string;
  data_hora: string;
  duracao_minutos: number;
  observacoes: string | null;
  google_event_id: string | null;
  status: string;
};

function failure(codigo: PendenciaFailureCode, mensagem: string): AgendarPendenciaBridgeResult {
  return { handled: true, result: { ok: false, codigo, mensagem } };
}

function janelaDeConflito(dataHoraISO: string): { de: string; ate: string } {
  const inicio = new Date(dataHoraISO).getTime();
  const dia = 24 * 60 * 60 * 1000;
  return { de: new Date(inicio - dia).toISOString(), ate: new Date(inicio + dia).toISOString() };
}

export function mesmoInstante(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && leftMs === rightMs;
}

export function podeProsseguirLeituraAgenda(input: {
  agendaError: boolean;
  bloqueiosError: boolean;
  agendamentosError?: boolean;
  expedienteIndisponivel: boolean;
}): boolean {
  return !input.agendaError
    && !input.bloqueiosError
    && !input.agendamentosError
    && !input.expedienteIndisponivel;
}

export function resolverCartaoParaAgenda(
  input: AgendarPendenciaInput,
  item: PendenciaCard | undefined,
): PendenciasResult<PendenciaCard> {
  if (!item?.capabilities.podeConcluirAgendamento) {
    return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Você não tem acesso para alterar esta agenda.' };
  }
  if (item.versao !== input.versaoEsperada || item.status !== 'esperando_resposta' || !item.envioConfirmado) {
    return { ok: false, codigo: 'CONFLITO', mensagem: 'Este contato mudou. Atualize a lista antes de agendar.' };
  }
  return { ok: true, data: item };
}

/**
 * Ponte exclusiva para secretaria do piloto: R159 é revalidado pela leitura RPC antes
 * de gravar, e a mutação continua usando o client autenticado, portanto as policies
 * legadas de agenda continuam sendo a defesa final.
 */
export async function agendarPendenciaComoSecretaria(
  input: AgendarPendenciaInput,
  dependencies?: AgendarPendenciaBridgeDependencies,
): Promise<AgendarPendenciaBridgeResult> {
  const source: AgendarPendenciaBridgeDependencies = dependencies ?? {
    getMember: getMemberContext,
    listar: listarPendencias,
    requireUser,
  };
  const effects: AgendaEffects = source.effects ?? {
    createCalendarEvent: createGoogleCalendarEvent,
    updateCalendarEvent: updateGoogleCalendarEvent,
    notify: inserirNotificacao,
  };
  const member = await source.getMember({ clinicaIdEsperada: input.clinicaIdEsperada });
  if (!member.ok) return { handled: true, result: member };
  if (member.data.role !== 'secretaria') return { handled: false };

  const board = await source.listar({ clinicaIdEsperada: input.clinicaIdEsperada });
  if (!board.ok) return { handled: true, result: board };
  const card = resolverCartaoParaAgenda(input, board.data.items.find((item) => item.id === input.pendenciaId));
  if (!card.ok) return { handled: true, result: card };

  const { supabase } = await source.requireUser();
  const item = card.data;
  const janela = janelaDeConflito(input.dataHora);

  if (item.agendamentoId) {
    const { data: atual, error: agendaError } = await supabase
      .from('agendamentos')
      .select('id,paciente_id,dentista_id,data_hora,duracao_minutos,observacoes,google_event_id,status')
      .eq('id', item.agendamentoId)
      .eq('clinica_id', input.clinicaIdEsperada)
      .eq('paciente_id', item.pacienteId)
      .eq('dentista_id', item.dentistaId)
      .maybeSingle<AgendaRow>();
    if (agendaError) return failure('INDISPONIVEL', 'Não foi possível consultar o agendamento. Tente novamente.');
    if (!atual || !mesmoInstante(atual.data_hora, item.dataHora) || atual.status !== 'scheduled') {
      return failure('CONFLITO', 'O agendamento mudou. Atualize antes de continuar.');
    }

    const [expediente, { data: pacienteOcupado, error: conflitoError }, { data: bloqueios, error: bloqueiosError }, { data: agendamentos, error: agendamentosError }] = await Promise.all([
      validarExpediente({
        supabase,
        clinicId: input.clinicaIdEsperada,
        actorDentistaId: null,
        actorRole: 'secretaria',
        dentistaId: item.dentistaId,
        dataHora: input.dataHora,
        duracaoMinutos: input.duracaoMinutos,
        failClosed: true,
      }).catch(() => null),
      supabase.rpc('paciente_tem_conflito_agenda', {
        p_paciente_id: item.pacienteId,
        p_inicio: input.dataHora,
        p_duracao_min: input.duracaoMinutos,
        p_ignorar_id: atual.id,
      }),
      supabase
        .from('agenda_bloqueios')
        .select('data_hora,duracao_minutos,titulo')
        .eq('dentista_id', item.dentistaId)
        .eq('clinica_id', input.clinicaIdEsperada)
        .gte('data_hora', janela.de)
        .lt('data_hora', janela.ate),
      supabase
        .from('agendamentos')
        .select('data_hora,duracao_minutos')
        .eq('dentista_id', item.dentistaId)
        .eq('clinica_id', input.clinicaIdEsperada)
        .neq('id', atual.id)
        .in('status', ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed'])
        .gte('data_hora', janela.de)
        .lt('data_hora', janela.ate),
    ]);
    if (expediente === null) return failure('INDISPONIVEL', 'Não foi possível verificar a agenda do dentista. Tente novamente.');
    if (!podeProsseguirLeituraAgenda({
      agendaError: false,
      bloqueiosError: Boolean(bloqueiosError),
      agendamentosError: Boolean(agendamentosError),
      expedienteIndisponivel: false,
    })) return failure('INDISPONIVEL', 'Não foi possível verificar a agenda do dentista. Tente novamente.');
    if (conflitoError) return failure('INDISPONIVEL', 'Não foi possível verificar a agenda do paciente. Tente novamente.');
    if (pacienteOcupado === true) return failure('INVALIDO', 'Este paciente já tem um horário nesse intervalo.');

    const inicio = new Date(input.dataHora).getTime();
    const fim = inicio + input.duracaoMinutos * 60_000;
    const bloqueio = (bloqueios ?? []).find((itemBloqueio) => {
      const inicioBloqueio = new Date(itemBloqueio.data_hora).getTime();
      return inicioBloqueio < fim && inicioBloqueio + itemBloqueio.duracao_minutos * 60_000 > inicio;
    });
    const agendamentoConflitante = (agendamentos ?? []).some((agendamento) => {
      const inicioAgendamento = new Date(agendamento.data_hora).getTime();
      return inicioAgendamento < fim && inicioAgendamento + (agendamento.duracao_minutos ?? 30) * 60_000 > inicio;
    });
    if (agendamentoConflitante || bloqueio || expediente.fora) {
      return failure('INVALIDO', agendamentoConflitante
        ? 'Este horário conflita com outro agendamento deste dentista.'
        : bloqueio
        ? `Este horário conflita com um compromisso pessoal${bloqueio.titulo ? ` (${bloqueio.titulo})` : ''} deste dentista.`
        : 'Este horário está fora do expediente do dentista.');
    }

    const { data: updated, error: updateError } = await supabase
      .from('agendamentos')
      .update({ data_hora: input.dataHora, duracao_minutos: input.duracaoMinutos, updated_at: new Date().toISOString() })
      .eq('id', atual.id)
      .eq('clinica_id', input.clinicaIdEsperada)
      .eq('data_hora', atual.data_hora)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle<{ id: string }>();
    if (updateError) return failure('INDISPONIVEL', 'Não foi possível salvar o agendamento. Tente novamente.');
    if (!updated) return failure('CONFLITO', 'O agendamento mudou. Atualize antes de continuar.');

    if (atual.google_event_id) {
      try {
        await effects.updateCalendarEvent(item.dentistaId, atual.google_event_id, {
          pacienteNome: item.pacienteNome,
          dentistaNome: item.dentistaNome,
          dataHora: input.dataHora,
          duracaoMinutos: input.duracaoMinutos,
          observacoes: atual.observacoes,
        });
      } catch (error) {
        console.error('[agendarPendenciaComoSecretaria] Google Calendar sync falhou:', error);
      }
    }
    return { handled: true, result: { ok: true, data: { agendamentoId: updated.id } } };
  }

  const [expediente, { data: agendamentos, error: agendamentosError }, { data: pacienteOcupado, error: conflitoError }, { data: bloqueios, error: bloqueiosError }, { count: dentistaCount, error: dentistaError }] = await Promise.all([
    validarExpediente({
      supabase,
      clinicId: input.clinicaIdEsperada,
      actorDentistaId: null,
      actorRole: 'secretaria',
      dentistaId: item.dentistaId,
      dataHora: input.dataHora,
      duracaoMinutos: input.duracaoMinutos,
      failClosed: true,
    }).catch(() => null),
    supabase
      .from('agendamentos')
      .select('data_hora,duracao_minutos')
      .eq('dentista_id', item.dentistaId)
      .eq('clinica_id', input.clinicaIdEsperada)
      .in('status', ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed'])
      .gte('data_hora', janela.de)
      .lt('data_hora', janela.ate),
    supabase.rpc('paciente_tem_conflito_agenda', {
      p_paciente_id: item.pacienteId,
      p_inicio: input.dataHora,
      p_duracao_min: input.duracaoMinutos,
    }),
    supabase
      .from('agenda_bloqueios')
      .select('data_hora,duracao_minutos,titulo')
      .eq('dentista_id', item.dentistaId)
      .eq('clinica_id', input.clinicaIdEsperada)
      .gte('data_hora', janela.de)
      .lt('data_hora', janela.ate),
    supabase
      .from('dentistas')
      .select('id', { count: 'exact', head: true })
      .eq('id', item.dentistaId)
      .eq('clinica_id', input.clinicaIdEsperada)
      .eq('ativo', true)
      .in('role', ['admin', 'dentista']),
  ]);
  if (expediente === null) return failure('INDISPONIVEL', 'Não foi possível verificar a agenda do dentista. Tente novamente.');
  if (!podeProsseguirLeituraAgenda({
    agendaError: Boolean(dentistaError),
    bloqueiosError: Boolean(bloqueiosError),
    agendamentosError: Boolean(agendamentosError),
    expedienteIndisponivel: false,
  })) return failure('INDISPONIVEL', 'Não foi possível verificar a agenda do dentista. Tente novamente.');
  if ((dentistaCount ?? 0) === 0) return failure('NAO_ENCONTRADO', 'Dentista indisponível.');
  if (conflitoError) return failure('INDISPONIVEL', 'Não foi possível verificar a agenda do paciente. Tente novamente.');
  if (pacienteOcupado === true) return failure('INVALIDO', 'Este paciente já tem um horário nesse intervalo.');

  const inicio = new Date(input.dataHora).getTime();
  const fim = inicio + input.duracaoMinutos * 60_000;
  const agendamentoConflitante = (agendamentos ?? []).some((agendamento) => {
    const inicioAgendamento = new Date(agendamento.data_hora).getTime();
    return inicioAgendamento < fim && inicioAgendamento + (agendamento.duracao_minutos ?? 30) * 60_000 > inicio;
  });
  const bloqueio = !agendamentoConflitante && (bloqueios ?? []).find((itemBloqueio) => {
    const inicioBloqueio = new Date(itemBloqueio.data_hora).getTime();
    return inicioBloqueio < fim && inicioBloqueio + itemBloqueio.duracao_minutos * 60_000 > inicio;
  });
  if (agendamentoConflitante || bloqueio || expediente.fora) {
    return failure('INVALIDO', agendamentoConflitante
      ? 'Este horário conflita com outro agendamento deste dentista.'
      : bloqueio
        ? `Este horário conflita com um compromisso pessoal${bloqueio.titulo ? ` (${bloqueio.titulo})` : ''} deste dentista.`
        : 'Este horário está fora do expediente do dentista.');
  }

  const { data: created, error: insertError } = await supabase
    .from('agendamentos')
    .insert({
      clinica_id: input.clinicaIdEsperada,
      dentista_id: item.dentistaId,
      paciente_id: item.pacienteId,
      data_hora: input.dataHora,
      duracao_minutos: input.duracaoMinutos,
      observacoes: null,
      status: 'scheduled',
      // A secretária não possui perfil de dentista: nunca registrar o profissional alvo como autor.
      created_by: null,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertError) return failure('INDISPONIVEL', 'Não foi possível salvar o agendamento. Tente novamente.');

  try {
    const googleEventId = await effects.createCalendarEvent(item.dentistaId, {
      pacienteNome: item.pacienteNome,
      dentistaNome: item.dentistaNome,
      dataHora: input.dataHora,
      duracaoMinutos: input.duracaoMinutos,
      observacoes: null,
    });
    if (googleEventId) {
      await supabase.from('agendamentos').update({ google_event_id: googleEventId }).eq('id', created.id).eq('clinica_id', input.clinicaIdEsperada);
    }
  } catch (error) {
    console.error('[agendarPendenciaComoSecretaria] Google Calendar sync falhou:', error);
  }

  try {
    await effects.notify(supabase, {
      clinicaId: input.clinicaIdEsperada,
      paraRole: 'dentista',
      paraDentistaId: item.dentistaId,
      tipo: 'agendamento_criado',
      titulo: `Novo agendamento — ${format(parseISO(input.dataHora), 'HH:mm', { locale: ptBR })} de ${format(parseISO(input.dataHora), 'dd/MM', { locale: ptBR })}`,
      mensagem: `${item.pacienteNome} foi agendado pela secretaria.`,
      href: '/dashboard/agendamentos',
    });
  } catch (error) {
    console.error('[agendarPendenciaComoSecretaria] Notificação falhou após salvar a agenda:', error);
  }
  return { handled: true, result: { ok: true, data: { agendamentoId: created.id } } };
}
