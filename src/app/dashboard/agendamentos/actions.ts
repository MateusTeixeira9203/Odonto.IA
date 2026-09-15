"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  importGoogleCalendarEvents,
} from "@/lib/calendar/google-provider";
import { inserirNotificacao } from "@/lib/notificacoes";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { validarExpediente } from '@/server/agenda/validar-expediente';
import type { MotivoForaDoExpediente } from '@/lib/agenda/expediente';

/**
 * Janela de busca dos agendamentos candidatos a conflito, em torno de uma data clínica.
 *
 * ⚠️ BUG CORRIGIDO 21/07: a janela era montada em **UTC** (`${dia}T00:00:00Z` até
 * `${dia}T23:59:59Z`). Como a clínica é UTC-3, isso na prática cobria das **21h do dia
 * anterior às 21h do dia** — ou seja, **agendamento a partir das 21h simplesmente não
 * era checado**. Falso negativo, o pior tipo: dois pacientes no mesmo horário, sem aviso
 * nenhum. E o Mateus confirmou (21/07) que "muitas vezes o dentista fica até mais tarde
 * pra concluir atendimentos" — exatamente o horário que escapava.
 *
 * A correção não tenta acertar o limite do dia: pega **de véspera a dia seguinte**. São
 * poucas dezenas de linhas por dentista, e assim nenhum raciocínio de fuso pode errar de
 * novo — inclusive o caso de uma consulta longa que começa num dia e termina no outro.
 * Quem decide o conflito é a sobreposição real de timestamps, não esta janela.
 */
function janelaDeConflito(dataHoraISO: string): { de: string; ate: string } {
  const inicio = new Date(dataHoraISO).getTime();
  const DIA = 24 * 60 * 60 * 1000;
  return {
    de:  new Date(inicio - DIA).toISOString(),
    ate: new Date(inicio + DIA).toISOString(),
  };
}

export type StatusAgendamento =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export async function criarAgendamento(dados: {
  pacienteId: string;
  dataHora: string;
  duracaoMinutos: number;
  observacoes: string | null;
  dentistaId?: string;
  /**
   * Marca por cima de um horário já ocupado do DENTISTA (decisão do Mateus 21/07: a
   * recepção precisa dessa liberdade — sobreposição acontece na clínica real). Só a UI
   * pede isso, e só depois de mostrar o conflito. Mesmo espírito do `forcarEncaixe`.
   *
   * ⚠️ NÃO cobre o conflito do PACIENTE — esse continua sem override (ver abaixo).
   */
  forcarConflitoDentista?: boolean;
  /** R-110 — confirmação independente do horário fora da grade do dentista. */
  forcarForaDoExpediente?: boolean;
  /** R-140c — retorno criado a partir de uma visita clínica já salva. */
  atendimentoOrigemId?: string;
}): Promise<{ error?: string; id?: string; conflitoDentista?: boolean; foraDoExpediente?: MotivoForaDoExpediente }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  const [{ data: dentistaPerfil }, { count: pacCount }] = await Promise.all([
    supabase.from("dentistas").select("id, nome").eq("user_id", user.id).eq("clinica_id", clinicId).maybeSingle(),
    supabase.from('pacientes').select('id', { count: 'exact', head: true }).eq('id', dados.pacienteId).eq('clinica_id', clinicId),
  ]);

  if (!dentistaPerfil) redirect("/onboarding");
  if ((pacCount ?? 0) === 0) return { error: 'Paciente não encontrado.' };

  const dentistaAlvo = dados.dentistaId ?? dentistaPerfil.id;

  if (dados.dentistaId && dados.dentistaId !== dentistaPerfil.id) {
    if (role !== 'secretaria') return { error: 'Sem permissão para marcar na agenda de outro dentista.' };
    const { count: dentCount } = await supabase
      .from('dentistas')
      .select('id', { count: 'exact', head: true })
      .eq('id', dados.dentistaId)
      .eq('clinica_id', clinicId)
      .eq('ativo', true)
      .in('role', ['admin', 'dentista']);
    if ((dentCount ?? 0) === 0) return { error: 'Dentista não encontrado.' };
  }

  // O ID chega do navegador, portanto Zod/UUID não bastam: a visita precisa ser do mesmo
  // paciente, clínica e profissional do novo retorno. Isso impede ligar uma agenda legítima
  // a um prontuário de outro contexto.
  if (dados.atendimentoOrigemId) {
    const { data: atendimento, error: atendimentoError } = await supabase
      .from('atendimentos_clinicos')
      .select('id, dentista_id')
      .eq('id', dados.atendimentoOrigemId)
      .eq('clinica_id', clinicId)
      .eq('paciente_id', dados.pacienteId)
      .maybeSingle<{ id: string; dentista_id: string }>();
    if (atendimentoError || !atendimento || atendimento.dentista_id !== dentistaAlvo) {
      return { error: 'A visita de origem deste retorno não é válida.' };
    }

    const { data: retornoExistente, error: retornoExistenteError } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('clinica_id', clinicId)
      .eq('atendimento_origem_id', dados.atendimentoOrigemId)
      .maybeSingle<{ id: string }>();
    if (retornoExistenteError) {
      console.error('[criarAgendamento:retorno]', retornoExistenteError.message);
      return { error: 'Não foi possível verificar o retorno desta visita. Tente novamente.' };
    }
    if (retornoExistente) return { error: 'Esta visita já possui um retorno. Altere-o pela Agenda.' };
  }

  const novoInicioMs = new Date(dados.dataHora).getTime();
  const novoFimMs = novoInicioMs + dados.duracaoMinutos * 60_000;
  const janela = janelaDeConflito(dados.dataHora);

  // Três checagens independentes, em paralelo:
  //  1. Agenda do DENTISTA-alvo — visível pra este client (é a dele, ou ele é secretária).
  //  2. Agenda do PACIENTE — invisível: o paciente virou da clínica (migration 099), então
  //     outro dentista pode tê-lo agendado, e a RLS da agenda continua silo estrito. Por isso
  //     RPC SECURITY DEFINER: devolve só boolean, nunca com quem nem o quê (invariante #3).
  //  3. Compromissos pessoais do DENTISTA-alvo (R-102) — mesma janela e mesmo silo da #1.
  const [expediente, { data: agendamentosNoDia }, { data: pacienteOcupado, error: conflitoErr }, { data: bloqueiosNoDia }] = await Promise.all([
    validarExpediente({
      supabase,
      clinicId,
      actorDentistaId: dentistaPerfil.id,
      actorRole: role,
      dentistaId: dentistaAlvo,
      dataHora: dados.dataHora,
      duracaoMinutos: dados.duracaoMinutos,
    }),
    supabase
      .from('agendamentos')
      .select('data_hora, duracao_minutos')
      .eq('dentista_id', dentistaAlvo)
      .eq('clinica_id', clinicId)
      .in('status', ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed'])
      .gte('data_hora', janela.de)
      .lt('data_hora', janela.ate),
    supabase.rpc('paciente_tem_conflito_agenda', {
      p_paciente_id: dados.pacienteId,
      p_inicio: dados.dataHora,
      p_duracao_min: dados.duracaoMinutos,
    }),
    supabase
      .from('agenda_bloqueios')
      .select('data_hora, duracao_minutos, titulo')
      .eq('dentista_id', dentistaAlvo)
      .eq('clinica_id', clinicId)
      .gte('data_hora', janela.de)
      .lt('data_hora', janela.ate),
  ]);

  // FALHA FECHADO. Sem isto, um erro na RPC deixa pacienteOcupado = null, o `=== true` dá
  // false, e o agendamento nasce SEM checagem nenhuma — em silêncio. Numa trava que não tem
  // override, agendar às cegas é pior do que recusar: o paciente apareceria em dois
  // consultórios no mesmo horário e ninguém saberia até ele chegar.
  if (conflitoErr) {
    console.error('[criarAgendamento] paciente_tem_conflito_agenda falhou:', conflitoErr.message);
    return { error: 'Não foi possível verificar a agenda do paciente. Tente novamente.' };
  }

  // Conflito na agenda do DENTISTA (outro agendamento OU compromisso pessoal, R-102):
  // sinaliza e deixa a UI decidir. Não é erro terminal — a recepção sobrepõe horário de
  // propósito (retorno rápido, urgência entre consultas). Devolve `conflitoDentista` pra a
  // tela oferecer "marcar mesmo assim"; só volta a barrar se o chamador NÃO pediu o override.
  let conflitoDentista = false;
  let mensagemConflitoDentista: string | undefined;
  if (!dados.forcarConflitoDentista) {
    for (const ag of agendamentosNoDia ?? []) {
      const agInicioMs = new Date(ag.data_hora).getTime();
      const agFimMs = agInicioMs + (ag.duracao_minutos ?? 30) * 60_000;
      if (agInicioMs < novoFimMs && agFimMs > novoInicioMs) {
        conflitoDentista = true;
        mensagemConflitoDentista = 'Este horário conflita com outro agendamento deste dentista.';
        break;
      }
    }
    for (const bl of conflitoDentista ? [] : bloqueiosNoDia ?? []) {
      const blInicioMs = new Date(bl.data_hora).getTime();
      const blFimMs = blInicioMs + bl.duracao_minutos * 60_000;
      if (blInicioMs < novoFimMs && blFimMs > novoInicioMs) {
        conflitoDentista = true;
        mensagemConflitoDentista = `Este horário conflita com um compromisso pessoal${bl.titulo ? ` (${bl.titulo})` : ''} deste dentista.`;
        break;
      }
    }
  }

  // ⚠️ SEM OVERRIDE, e é deliberado (mantido na liberação de 21/07): dois dentistas não
  // atendem o mesmo paciente ao mesmo tempo. O silo esconde a agenda do outro dentista —
  // furar aqui poria o paciente em dois consultórios sem ninguém enxergar até ele chegar.
  // `forcarConflitoDentista` NÃO alcança esta checagem, por construção.
  if (pacienteOcupado === true) {
    return { error: 'Este paciente já tem um horário nesse intervalo.' };
  }

  if (conflitoDentista || (expediente.fora && !dados.forcarForaDoExpediente)) {
    return {
      error: mensagemConflitoDentista ?? 'Este horário está fora do expediente do dentista.',
      ...(conflitoDentista ? { conflitoDentista: true } : {}),
      ...(expediente.fora ? { foraDoExpediente: expediente.motivo } : {}),
    };
  }

  const { data, error } = await supabase
    .from("agendamentos")
    .insert({
      clinica_id:       clinicId,
      dentista_id:      dentistaAlvo,
      paciente_id:      dados.pacienteId,
      data_hora:        dados.dataHora,
      duracao_minutos:  dados.duracaoMinutos,
      observacoes:      dados.observacoes || null,
      status:           "scheduled",
      created_by:       dentistaPerfil.id,
      ...(dados.atendimentoOrigemId && { atendimento_origem_id: dados.atendimentoOrigemId }),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Busca nome do paciente uma vez — usada no GCal e na notificação
  const { data: pacienteData } = await supabase
    .from("pacientes")
    .select("nome")
    .eq("id", dados.pacienteId)
    .maybeSingle<{ nome: string }>();

  try {
    let dentistaNome = dentistaPerfil.nome;
    if (dados.dentistaId && dados.dentistaId !== dentistaPerfil.id) {
      const { data: dentistaData } = await supabase
        .from("dentistas")
        .select("nome")
        .eq("id", dados.dentistaId)
        .maybeSingle<{ nome: string }>();
      dentistaNome = dentistaData?.nome ?? dentistaPerfil.nome;
    }

    const googleEventId = await createGoogleCalendarEvent(dentistaAlvo, {
      pacienteNome:    pacienteData?.nome ?? "Paciente",
      dentistaNome,
      dataHora:        dados.dataHora,
      duracaoMinutos:  dados.duracaoMinutos,
      observacoes:     dados.observacoes,
    });

    if (googleEventId) {
      await supabase
        .from("agendamentos")
        .update({ google_event_id: googleEventId })
        .eq("id", data.id);
    }
  } catch (err) {
    console.error("[criarAgendamento] Google Calendar sync falhou:", err);
  }

  // Notifica o dentista quando a secretaria cria um agendamento para ele
  if (role === 'secretaria' && dados.dentistaId) {
    const horaFormatada = format(parseISO(dados.dataHora), "HH:mm", { locale: ptBR });
    const dataFormatada = format(parseISO(dados.dataHora), "dd/MM", { locale: ptBR });
    const nomePaciente  = pacienteData?.nome ?? 'Paciente';

    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: dados.dentistaId,
      tipo:           'agendamento_criado',
      titulo:         `Novo agendamento — ${horaFormatada} de ${dataFormatada}`,
      mensagem:       `${nomePaciente} foi agendado pela secretaria.`,
      href:           '/dashboard/agendamentos',
    });
  }

  revalidatePath("/dashboard/agendamentos");
  return { id: data.id };
}

export async function atualizarStatusAgendamento(
  id: string,
  status: StatusAgendamento
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  let googleEventId: string | null = null;
  let dentistaId: string | null = null;
  if (status === "cancelled") {
    const { data } = await supabase
      .from("agendamentos")
      .select("google_event_id, dentista_id")
      .eq("id", id)
      .eq("clinica_id", clinicId)
      .maybeSingle<{ google_event_id: string | null; dentista_id: string }>();
    googleEventId = data?.google_event_id ?? null;
    dentistaId = data?.dentista_id ?? null;
  }

  const { error } = await supabase
    .from("agendamentos")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };

  if (status === "cancelled" && googleEventId && dentistaId) {
    try {
      await deleteGoogleCalendarEvent(dentistaId, googleEventId);
      await supabase
        .from("agendamentos")
        .update({ google_event_id: null })
        .eq("id", id);
    } catch (err) {
      console.error("[atualizarStatusAgendamento] Google Calendar sync falhou:", err);
    }
  }

  revalidatePath("/dashboard/agendamentos");
  return {};
}

export async function atualizarAgendamento(
  id: string,
  dados: {
    /** R161d: comparação otimista para não reabrir uma consulta alterada em outra sessão. */
    dataHoraEsperada?: string;
    statusEsperado?: 'scheduled';
    pacienteId?: string;
    dataHora?: string;
    duracaoMinutos?: number;
    observacoes?: string | null;
    status?: StatusAgendamento;
    /** Mesmo espírito do `forcarConflitoDentista` de `criarAgendamento` (R-102). */
    forcarConflitoDentista?: boolean;
    /** R-110 — confirmação independente do horário fora da grade do dentista. */
    forcarForaDoExpediente?: boolean;
  }
): Promise<{ error?: string; conflitoDentista?: boolean; foraDoExpediente?: MotivoForaDoExpediente }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  // Reagendar não pode ser a porta dos fundos da invariante do criar: com o paciente
  // aberto pra clínica (migration 099), mover um agendamento pode colidir com o de outro
  // dentista — que este client não enxerga. Só revalida quando algo que afeta o intervalo
  // muda; chamada que só mexe no status não paga a query.
  if (dados.dataHora || dados.pacienteId || dados.duracaoMinutos) {
    const { data: atual } = await supabase
      .from("agendamentos")
      .select("paciente_id, data_hora, duracao_minutos, dentista_id")
      .eq("id", id)
      .eq("clinica_id", clinicId)
      .maybeSingle<{ paciente_id: string; data_hora: string; duracao_minutos: number; dentista_id: string }>();

    if (!atual) return { error: "Agendamento não encontrado." };

    const novaDataHora = dados.dataHora ?? atual.data_hora;
    const novaDuracao = dados.duracaoMinutos ?? atual.duracao_minutos;

    const [expediente, { data: pacienteOcupado, error: conflitoErr }] = await Promise.all([
      validarExpediente({
        supabase,
        clinicId,
        actorDentistaId: dentistaId,
        actorRole: role,
        dentistaId: atual.dentista_id,
        dataHora: novaDataHora,
        duracaoMinutos: novaDuracao,
      }),
      supabase.rpc('paciente_tem_conflito_agenda', {
        p_paciente_id: dados.pacienteId ?? atual.paciente_id,
        p_inicio:      novaDataHora,
        p_duracao_min: novaDuracao,
        p_ignorar_id:  id, // não conflita consigo mesmo
      }),
    ]);

    // Falha fechado — ver criarAgendamento. Reagendar às cegas tem o mesmo estrago que
    // agendar às cegas: dois dentistas com o mesmo paciente no mesmo horário.
    if (conflitoErr) {
      console.error('[atualizarAgendamento] paciente_tem_conflito_agenda falhou:', conflitoErr.message);
      return { error: 'Não foi possível verificar a agenda do paciente. Tente novamente.' };
    }

    if (pacienteOcupado === true) {
      return { error: 'Este paciente já tem um horário nesse intervalo.' };
    }

    // Conflito com compromisso pessoal do MESMO dentista (R-102) — só quando o horário
    // muda de fato; mesmo espírito do override de criarAgendamento.
    let mensagemConflitoDentista: string | undefined;
    if (!dados.forcarConflitoDentista) {
      const janela = janelaDeConflito(novaDataHora);
      const { data: bloqueiosNoDia } = await supabase
        .from('agenda_bloqueios')
        .select('data_hora, duracao_minutos, titulo')
        .eq('dentista_id', atual.dentista_id)
        .eq('clinica_id', clinicId)
        .gte('data_hora', janela.de)
        .lt('data_hora', janela.ate);

      const novoInicioMs = new Date(novaDataHora).getTime();
      const novoFimMs = novoInicioMs + novaDuracao * 60_000;
      for (const bl of bloqueiosNoDia ?? []) {
        const blInicioMs = new Date(bl.data_hora).getTime();
        const blFimMs = blInicioMs + bl.duracao_minutos * 60_000;
        if (blInicioMs < novoFimMs && blFimMs > novoInicioMs) {
          mensagemConflitoDentista = `Este horário conflita com um compromisso pessoal${bl.titulo ? ` (${bl.titulo})` : ''} deste dentista.`;
          break;
        }
      }
    }

    if (mensagemConflitoDentista || (expediente.fora && !dados.forcarForaDoExpediente)) {
      return {
        error: mensagemConflitoDentista ?? 'Este horário está fora do expediente do dentista.',
        ...(mensagemConflitoDentista ? { conflitoDentista: true } : {}),
        ...(expediente.fora ? { foraDoExpediente: expediente.motivo } : {}),
      };
    }
  }

  let update = supabase
    .from("agendamentos")
    .update({
      ...(dados.pacienteId && { paciente_id: dados.pacienteId }),
      ...(dados.dataHora && { data_hora: dados.dataHora }),
      ...(dados.duracaoMinutos && { duracao_minutos: dados.duracaoMinutos }),
      ...(dados.observacoes !== undefined && { observacoes: dados.observacoes }),
      ...(dados.status && { status: dados.status }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinica_id", clinicId);

  if (dados.dataHoraEsperada) update = update.eq('data_hora', dados.dataHoraEsperada);
  if (dados.statusEsperado) update = update.eq('status', dados.statusEsperado);
  const { data: changed, error } = await update.select('id');
  if (error) return { error: error.message };
  if (!changed?.length) return { error: 'Este agendamento mudou ou não está acessível. Atualize a agenda antes de tentar novamente.' };

  try {
    const { data: agendamento } = await supabase
      .from("agendamentos")
      .select(
        "google_event_id, dentista_id, data_hora, duracao_minutos, observacoes, paciente:pacientes(nome), dentista:dentistas!agendamentos_dentista_id_fkey(nome)"
      )
      .eq("id", id)
      .eq("clinica_id", clinicId)
      .maybeSingle<{
        google_event_id: string | null;
        dentista_id: string;
        data_hora: string;
        duracao_minutos: number;
        observacoes: string | null;
        paciente: { nome: string } | null;
        dentista: { nome: string } | null;
      }>();

    if (agendamento?.google_event_id) {
      await updateGoogleCalendarEvent(agendamento.dentista_id, agendamento.google_event_id, {
        pacienteNome:   agendamento.paciente?.nome ?? "Paciente",
        dentistaNome:   agendamento.dentista?.nome ?? "",
        dataHora:       agendamento.data_hora,
        duracaoMinutos: agendamento.duracao_minutos,
        observacoes:    agendamento.observacoes,
      });
    }
  } catch (err) {
    console.error("[atualizarAgendamento] Google Calendar sync falhou:", err);
  }

  revalidatePath("/dashboard/agendamentos");
  return {};
}

export async function deletarAgendamento(id: string): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data: agendamento } = await supabase
    .from("agendamentos")
    .select("google_event_id, dentista_id")
    .eq("id", id)
    .eq("clinica_id", clinicId)
    .maybeSingle<{ google_event_id: string | null; dentista_id: string }>();

  const { error } = await supabase
    .from("agendamentos")
    .delete()
    .eq("id", id)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };

  if (agendamento?.google_event_id) {
    try {
      await deleteGoogleCalendarEvent(agendamento.dentista_id, agendamento.google_event_id);
    } catch (err) {
      console.error("[deletarAgendamento] Google Calendar sync falhou:", err);
    }
  }

  revalidatePath("/dashboard/agendamentos");
  return {};
}

export async function importarEventosGoogle(
  dentistaAlvoId: string,
): Promise<{ imported: number; skipped: number; error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  const isSecretaria = role === "secretaria";

  if (!isSecretaria && dentistaAlvoId !== dentistaPerfil?.id) {
    return { imported: 0, skipped: 0, error: "Não autorizado" };
  }

  if (isSecretaria) {
    const { data } = await supabase
      .from("dentistas")
      .select("id")
      .eq("id", dentistaAlvoId)
      .eq("clinica_id", clinicId)
      .maybeSingle();
    if (!data) return { imported: 0, skipped: 0, error: "Dentista não encontrado" };
  }

  try {
    const result = await importGoogleCalendarEvents(dentistaAlvoId, clinicId);
    revalidatePath("/dashboard/agendamentos");
    return { imported: result.imported, skipped: result.skipped };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { imported: 0, skipped: 0, error: msg };
  }
}

// ── Check-in ──────────────────────────────────────────────────────────────────

export async function fazerCheckIn(id: string): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('status, dentista_id, data_hora, paciente:pacientes(nome)')
    .eq('id', id)
    .eq('clinica_id', clinicId)
    .maybeSingle<{
      status: string;
      dentista_id: string;
      data_hora: string;
      paciente: { nome: string } | null;
    }>();

  if (!ag) return { error: 'Agendamento não encontrado.' };
  if (!['scheduled', 'confirmed'].includes(ag.status)) {
    return { error: 'Check-in só é permitido para agendamentos pendentes ou confirmados.' };
  }

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'checked_in', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };

  // Notifica o dentista que o paciente chegou
  const horaFormatada = format(parseISO(ag.data_hora), "HH:mm", { locale: ptBR });
  await inserirNotificacao(supabase, {
    clinicaId:      clinicId,
    paraRole:       'dentista',
    paraDentistaId: ag.dentista_id,
    tipo:           'checkin_paciente',
    titulo:         `${ag.paciente?.nome ?? 'Paciente'} chegou`,
    mensagem:       `Consulta das ${horaFormatada} — paciente na recepção.`,
    href:           '/dashboard/agendamentos',
  });

  revalidatePath('/dashboard/agendamentos');
  return {};
}

// ── Iniciar atendimento (dentista/admin somente) ───────────────────────────────

export async function iniciarAtendimento(id: string): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === 'secretaria') return { error: 'Sem permissão.' };

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('status')
    .eq('id', id)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ status: string }>();

  if (!ag) return { error: 'Agendamento não encontrado.' };
  if (['completed', 'cancelled', 'no_show'].includes(ag.status)) {
    return { error: 'Não é possível iniciar este atendimento.' };
  }
  if (ag.status === 'in_progress') return {};

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return {};
}

// ── Marcar no-show ────────────────────────────────────────────────────────────

export async function marcarNoShow(id: string): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'no_show', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return {};
}

// ── Cancelar com motivo ───────────────────────────────────────────────────────

export async function cancelarComMotivo(
  id: string,
  motivo: string | null,
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('google_event_id, dentista_id, data_hora, observacoes, paciente:pacientes(nome)')
    .eq('id', id)
    .eq('clinica_id', clinicId)
    .maybeSingle<{
      google_event_id: string | null;
      dentista_id: string;
      data_hora: string;
      observacoes: string | null;
      paciente: { nome: string } | null;
    }>();

  const novasObs = motivo
    ? `[Cancelado: ${motivo}]${ag?.observacoes ? `\n${ag.observacoes}` : ''}`
    : (ag?.observacoes ?? null);

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelled', observacoes: novasObs, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };

  if (ag?.google_event_id && ag.dentista_id) {
    try {
      await deleteGoogleCalendarEvent(ag.dentista_id, ag.google_event_id);
      await supabase.from('agendamentos').update({ google_event_id: null }).eq('id', id);
    } catch (err) {
      console.error('[cancelarComMotivo] GCal sync falhou:', err);
    }
  }

  // Notifica o dentista quando a secretaria cancela (dentista já sabe se cancelou ele mesmo)
  if (role === 'secretaria' && ag?.dentista_id) {
    const horaFormatada = format(parseISO(ag.data_hora), "HH:mm 'de' dd/MM", { locale: ptBR });
    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: ag.dentista_id,
      tipo:           'agendamento_cancelado',
      titulo:         `Consulta cancelada — ${ag.paciente?.nome ?? 'Paciente'}`,
      mensagem:       motivo
        ? `Consulta das ${horaFormatada} cancelada. Motivo: ${motivo}`
        : `Consulta das ${horaFormatada} foi cancelada.`,
      href:           '/dashboard/agendamentos',
    });
  }

  revalidatePath('/dashboard/agendamentos');
  return {};
}

// ── Criar encaixe (walk-in) — detecta conflito, exige override explícito ──────

export async function criarEncaixe(dados: {
  pacienteId: string;
  dataHora: string;
  duracaoMinutos: number;
  observacoes: string | null;
  dentistaId?: string;
  forcarEncaixe?: boolean;
}): Promise<{ error?: string; conflito?: boolean; id?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const [{ data: dentistaPerfil }, { count: pacCount }] = await Promise.all([
    supabase.from('dentistas').select('id').eq('user_id', user.id).eq('clinica_id', clinicId).maybeSingle(),
    supabase.from('pacientes').select('id', { count: 'exact', head: true }).eq('id', dados.pacienteId).eq('clinica_id', clinicId),
  ]);

  if (!dentistaPerfil) redirect('/onboarding');
  if ((pacCount ?? 0) === 0) return { error: 'Paciente não encontrado.' };

  const dentistaAlvo = dados.dentistaId ?? dentistaPerfil.id;
  const novoStart = new Date(dados.dataHora).getTime();
  const novoEnd = novoStart + dados.duracaoMinutos * 60_000;
  const janelaEncaixe = janelaDeConflito(dados.dataHora);

  const [{ data: existing }, { data: pacienteOcupado, error: conflitoErr }, { data: bloqueiosNoDia }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('data_hora, duracao_minutos')
      .eq('dentista_id', dentistaAlvo)
      .eq('clinica_id', clinicId)
      .in('status', ['scheduled', 'confirmed', 'checked_in', 'in_progress'])
      .gte('data_hora', janelaEncaixe.de)
      .lt('data_hora', janelaEncaixe.ate),
    supabase.rpc('paciente_tem_conflito_agenda', {
      p_paciente_id: dados.pacienteId,
      p_inicio: dados.dataHora,
      p_duracao_min: dados.duracaoMinutos,
    }),
    // Compromisso pessoal do dentista (R-102) conta como horário ocupado, igual outro agendamento.
    supabase
      .from('agenda_bloqueios')
      .select('data_hora, duracao_minutos')
      .eq('dentista_id', dentistaAlvo)
      .eq('clinica_id', clinicId)
      .gte('data_hora', janelaEncaixe.de)
      .lt('data_hora', janelaEncaixe.ate),
  ]);

  // Falha fechado — ver criarAgendamento. Aqui é ainda mais importante: o encaixe TEM um
  // override (`forcarEncaixe`), e o conflito de paciente é justamente o que ele NÃO pode
  // furar. Deixar a checagem sumir em silêncio transformaria o encaixe na porta dos fundos.
  if (conflitoErr) {
    console.error('[criarEncaixe] paciente_tem_conflito_agenda falhou:', conflitoErr.message);
    return { error: 'Não foi possível verificar a agenda do paciente. Tente novamente.' };
  }

  // Conflito do PACIENTE é intransponível — checado ANTES do forcarEncaixe de propósito.
  // "Encaixar" resolve agenda cheia do dentista (ele decide se dá conta); não resolve o
  // paciente estar fisicamente na cadeira de outro dentista. Sem override (spec §5.1).
  if (pacienteOcupado === true) {
    return { error: 'Este paciente já tem um horário nesse intervalo.' };
  }

  const temConflito = (existing ?? []).some(a => {
    const aStart = new Date(a.data_hora).getTime();
    const aEnd = aStart + (a.duracao_minutos ?? 30) * 60_000;
    return novoStart < aEnd && novoEnd > aStart;
  }) || (bloqueiosNoDia ?? []).some(bl => {
    const blStart = new Date(bl.data_hora).getTime();
    const blEnd = blStart + bl.duracao_minutos * 60_000;
    return novoStart < blEnd && novoEnd > blStart;
  });

  if (temConflito && !dados.forcarEncaixe) {
    return { conflito: true };
  }

  const obs = temConflito
    ? `[Encaixe — sobrepõe horário existente]${dados.observacoes ? ` | ${dados.observacoes}` : ''}`
    : (dados.observacoes ?? '[Encaixe]');

  const { data, error } = await supabase
    .from('agendamentos')
    .insert({
      clinica_id:      clinicId,
      dentista_id:     dentistaAlvo,
      paciente_id:     dados.pacienteId,
      data_hora:       dados.dataHora,
      duracao_minutos: dados.duracaoMinutos,
      observacoes:     obs,
      status:          'scheduled',
      created_by:      dentistaPerfil.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return { id: data.id };
}

// R-94 — pedido solto pro protético (sem vínculo com procedimento/orçamento, spec §2).
const criarPedidoProteticoSchema = z.object({
  pacienteId:    z.string().uuid(),
  proteticoId:   z.string().uuid(),
  observacao:    z.string().trim().min(1, "Descreva o que o protético precisa saber."),
  dataEntrega:   z.string().refine((v) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return new Date(`${v}T00:00:00`) >= hoje;
  }, "A data de entrega não pode ser no passado."),
  agendamentoId: z.string().uuid().optional(),
  dentistaId:    z.string().uuid().optional(),
});

export interface ProteticoOption {
  id: string;
  nome: string;
}

export interface PedidoProteticoRetornoInput {
  proteticoId: string;
  dataEntrega: string;
  observacao: string;
}

export type CriarRetornoResult =
  | { ok: true; agendamentoId: string; pedidoProteticoId: string | null }
  | {
      ok: false;
      etapa: 'agendamento';
      error: string;
      conflitoDentista?: boolean;
      foraDoExpediente?: MotivoForaDoExpediente;
    }
  | { ok: false; etapa: 'validacao_protetico'; error: string }
  | { ok: false; etapa: 'pedido_protetico'; error: string; agendamentoId: string };

export async function listarProteticosAtivos(): Promise<
  | { ok: true; data: ProteticoOption[] }
  | { ok: false; error: string }
> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'protetico') return { ok: false, error: 'Você não tem permissão para criar um pedido.' };

  const { data, error } = await supabase
    .from('dentistas')
    .select('id, nome')
    .eq('clinica_id', clinicId)
    .eq('role', 'protetico')
    .eq('ativo', true)
    .order('nome');

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function criarRetornoComPedido(input: {
  pacienteId: string;
  dataHora: string;
  duracaoMinutos: number;
  observacoes: string | null;
  dentistaId?: string;
  atendimentoOrigemId?: string;
  /** Seleção realizada no retorno em um dia que não possui grade configurada. */
  agendaLivre?: boolean;
  pedidoProtetico: PedidoProteticoRetornoInput | null;
}): Promise<CriarRetornoResult> {
  if (input.pedidoProtetico) {
    const pedidoValido = criarPedidoProteticoSchema.safeParse({
      pacienteId: input.pacienteId,
      dentistaId: input.dentistaId,
      ...input.pedidoProtetico,
    });
    if (!pedidoValido.success) {
      return {
        ok: false,
        etapa: 'validacao_protetico',
        error: pedidoValido.error.issues[0]?.message ?? 'Dados do pedido inválidos.',
      };
    }
  }

  let agendamento = await criarAgendamento({
    pacienteId: input.pacienteId,
    dataHora: input.dataHora,
    duracaoMinutos: input.duracaoMinutos,
    observacoes: input.observacoes,
    dentistaId: input.dentistaId,
    atendimentoOrigemId: input.atendimentoOrigemId,
  });

  // “Agenda livre” só substitui a ausência de grade daquele dia. Nunca ignora abertura,
  // almoço, fechamento ou conflito: esses continuam sendo validados por criarAgendamento.
  if (input.agendaLivre && agendamento.foraDoExpediente === 'dia_sem_grade') {
    agendamento = await criarAgendamento({
      pacienteId: input.pacienteId,
      dataHora: input.dataHora,
      duracaoMinutos: input.duracaoMinutos,
      observacoes: input.observacoes,
      dentistaId: input.dentistaId,
      atendimentoOrigemId: input.atendimentoOrigemId,
      forcarForaDoExpediente: true,
    });
  }
  if (agendamento.error || !agendamento.id) {
    return {
      ok: false,
      etapa: 'agendamento',
      error: agendamento.error ?? 'Não foi possível marcar o retorno.',
      conflitoDentista: agendamento.conflitoDentista,
      foraDoExpediente: agendamento.foraDoExpediente,
    };
  }

  if (!input.pedidoProtetico) {
    return { ok: true, agendamentoId: agendamento.id, pedidoProteticoId: null };
  }

  const pedido = await criarPedidoProtetico({
    pacienteId: input.pacienteId,
    agendamentoId: agendamento.id,
    dentistaId: input.dentistaId,
    ...input.pedidoProtetico,
  });
  if (pedido.error || !pedido.id) {
    return {
      ok: false,
      etapa: 'pedido_protetico',
      error: pedido.error ?? 'Retorno marcado, mas não foi possível enviar o pedido.',
      agendamentoId: agendamento.id,
    };
  }

  return { ok: true, agendamentoId: agendamento.id, pedidoProteticoId: pedido.id };
}

export async function criarPedidoProtetico(input: {
  pacienteId: string;
  proteticoId: string;
  observacao: string;
  dataEntrega: string;
  agendamentoId?: string;
  /** Só a secretária informa: é o mesmo dentista selecionado no agendamento. */
  dentistaId?: string;
}): Promise<{ error?: string; id?: string }> {
  const parsed = criarPedidoProteticoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const dados = parsed.data;

  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  // Espelha a RLS (pedidos_protetico_access): protético não cria pedido, só recebe.
  if (role === "protetico") {
    return { error: "Você não tem permissão para criar um pedido." };
  }

  const dentistaResponsavelId = dados.dentistaId ?? dentistaId;
  if (dados.dentistaId && dados.dentistaId !== dentistaId) {
    if (role !== "secretaria") {
      return { error: "Apenas a secretária pode escolher outro dentista responsável." };
    }
    const { count: dentistaCount } = await supabase
      .from("dentistas")
      .select("id", { count: "exact", head: true })
      .eq("id", dados.dentistaId)
      .eq("clinica_id", clinicId)
      .in("role", ["admin", "dentista"])
      .eq("ativo", true);
    if ((dentistaCount ?? 0) === 0) {
      return { error: "Dentista responsável não encontrado nesta clínica." };
    }
  }

  const { count: proteticoCount } = await supabase
    .from("dentistas")
    .select("id", { count: "exact", head: true })
    .eq("id", dados.proteticoId)
    .eq("clinica_id", clinicId)
    .eq("role", "protetico");

  if ((proteticoCount ?? 0) === 0) {
    return { error: "Protético não encontrado nesta clínica." };
  }

  const { count: pacCount } = await supabase
    .from("pacientes")
    .select("id", { count: "exact", head: true })
    .eq("id", dados.pacienteId)
    .eq("clinica_id", clinicId);

  if ((pacCount ?? 0) === 0) {
    return { error: "Paciente não encontrado." };
  }

  const { data, error } = await supabase
    .from("pedidos_protetico")
    .insert({
      clinica_id:     clinicId,
      protetico_id:   dados.proteticoId,
      dentista_id:    dentistaResponsavelId,
      paciente_id:    dados.pacienteId,
      agendamento_id: dados.agendamentoId ?? null,
      observacao:     dados.observacao,
      data_entrega:   dados.dataEntrega,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/agendamentos");
  revalidatePath("/dashboard/protetico");
  return { id: data.id };
}

// ── Compromisso pessoal (R-102) — bloqueia a própria agenda, sem paciente ────
// Tabela isolada `agenda_bloqueios` (spec §2) — nunca toca em `agendamentos`.

const compromissoPessoalSchema = z.object({
  dataHora:       z.string().min(1),
  duracaoMinutos: z.coerce.number().int().min(5).max(600),
  titulo:         z.string().trim().max(120).nullable().optional(),
  dentistaId:     z.string().uuid().optional(),
  forcarConflito: z.boolean().optional(),
});

export async function criarCompromissoPessoal(input: {
  dataHora: string;
  duracaoMinutos: number;
  titulo: string | null;
  dentistaId?: string;
  forcarConflito?: boolean;
}): Promise<{ error?: string; id?: string; conflito?: boolean }> {
  const parsed = compromissoPessoalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  const dentistaAlvo = dados.dentistaId ?? dentistaId;

  // Mesmo padrão de criarPedidoProtetico (R-94): só a secretária informa dentistaId, e
  // só é aceito se ele for admin/dentista da clínica ativa (RLS reforça isso de qualquer
  // forma no insert — esta checagem só devolve um erro legível em vez de um 0-linhas mudo).
  if (dados.dentistaId && dados.dentistaId !== dentistaId) {
    if (role !== 'secretaria') {
      return { error: "Somente a secretária pode criar um compromisso na agenda de outro dentista." };
    }
    const { count } = await supabase
      .from("dentistas")
      .select("id", { count: "exact", head: true })
      .eq("id", dados.dentistaId)
      .eq("clinica_id", clinicId)
      .eq("ativo", true)
      .in("role", ["admin", "dentista"]);
    if ((count ?? 0) === 0) return { error: "Dentista não encontrado." };
  }

  const novoInicioMs = new Date(dados.dataHora).getTime();
  const novoFimMs = novoInicioMs + dados.duracaoMinutos * 60_000;
  const janela = janelaDeConflito(dados.dataHora);

  // Conflito com consulta já marcada (sentido inverso de criarAgendamento) — aviso, com
  // override (spec §2: "aviso + marcar mesmo assim nos 2 sentidos"). Não checa contra outro
  // bloqueio — dois bloqueios sobrepostos não causam dano.
  if (!dados.forcarConflito) {
    const { data: agendamentosNoDia } = await supabase
      .from("agendamentos")
      .select("data_hora, duracao_minutos")
      .eq("dentista_id", dentistaAlvo)
      .eq("clinica_id", clinicId)
      .in("status", ["scheduled", "confirmed", "checked_in", "in_progress", "completed"])
      .gte("data_hora", janela.de)
      .lt("data_hora", janela.ate);

    for (const ag of agendamentosNoDia ?? []) {
      const agInicioMs = new Date(ag.data_hora).getTime();
      const agFimMs = agInicioMs + (ag.duracao_minutos ?? 30) * 60_000;
      if (agInicioMs < novoFimMs && agFimMs > novoInicioMs) {
        return { conflito: true };
      }
    }
  }

  const { data, error } = await supabase
    .from("agenda_bloqueios")
    .insert({
      clinica_id:      clinicId,
      dentista_id:     dentistaAlvo,
      data_hora:       dados.dataHora,
      duracao_minutos: dados.duracaoMinutos,
      titulo:          dados.titulo || null,
      criado_por:      dentistaId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/agendamentos");
  return { id: data.id };
}

export async function atualizarCompromissoPessoal(
  id: string,
  input: { dataHora?: string; duracaoMinutos?: number; titulo?: string | null; forcarConflito?: boolean },
): Promise<{ error?: string; conflito?: boolean }> {
  const { supabase, clinicId } = await requireClinicContext();

  if (input.dataHora || input.duracaoMinutos) {
    const { data: atual } = await supabase
      .from("agenda_bloqueios")
      .select("dentista_id, data_hora, duracao_minutos")
      .eq("id", id)
      .eq("clinica_id", clinicId)
      .maybeSingle<{ dentista_id: string; data_hora: string; duracao_minutos: number }>();

    if (!atual) return { error: "Compromisso não encontrado." };

    const novaDataHora = input.dataHora ?? atual.data_hora;
    const novaDuracao = input.duracaoMinutos ?? atual.duracao_minutos;

    if (!input.forcarConflito) {
      const janela = janelaDeConflito(novaDataHora);
      const { data: agendamentosNoDia } = await supabase
        .from("agendamentos")
        .select("data_hora, duracao_minutos")
        .eq("dentista_id", atual.dentista_id)
        .eq("clinica_id", clinicId)
        .in("status", ["scheduled", "confirmed", "checked_in", "in_progress", "completed"])
        .gte("data_hora", janela.de)
        .lt("data_hora", janela.ate);

      const novoInicioMs = new Date(novaDataHora).getTime();
      const novoFimMs = novoInicioMs + novaDuracao * 60_000;
      for (const ag of agendamentosNoDia ?? []) {
        const agInicioMs = new Date(ag.data_hora).getTime();
        const agFimMs = agInicioMs + (ag.duracao_minutos ?? 30) * 60_000;
        if (agInicioMs < novoFimMs && agFimMs > novoInicioMs) {
          return { conflito: true };
        }
      }
    }
  }

  // .select() confirma a linha afetada — RLS barrada (dentista alheio) devolve 0 linhas
  // SEM erro (mesma classe do R-66); sem checar, a tela mentiria sucesso.
  const { data: updated, error } = await supabase
    .from("agenda_bloqueios")
    .update({
      ...(input.dataHora && { data_hora: input.dataHora }),
      ...(input.duracaoMinutos && { duracao_minutos: input.duracaoMinutos }),
      ...(input.titulo !== undefined && { titulo: input.titulo || null }),
    })
    .eq("id", id)
    .eq("clinica_id", clinicId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated?.length) return { error: "Não foi possível editar este compromisso." };

  revalidatePath("/dashboard/agendamentos");
  return {};
}

export async function excluirCompromissoPessoal(id: string): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data: deleted, error } = await supabase
    .from("agenda_bloqueios")
    .delete()
    .eq("id", id)
    .eq("clinica_id", clinicId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted?.length) return { error: "Não foi possível excluir este compromisso." };

  revalidatePath("/dashboard/agendamentos");
  return {};
}
