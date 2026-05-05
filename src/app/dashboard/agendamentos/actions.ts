"use server";

import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  importGoogleCalendarEvents,
} from "@/lib/calendar/google-provider";

export type StatusAgendamento =
  | "agendado"
  | "confirmado"
  | "cancelado"
  | "realizado"
  | "faltou"
  | "na_recepcao"
  | "em_atendimento";

export async function criarAgendamento(dados: {
  pacienteId: string;
  dataHora: string;
  duracaoMinutos: number;
  observacoes: string | null;
  /** Preenchido pela secretária para criar agendamento em nome de outro dentista */
  dentistaId?: string;
}): Promise<{ error?: string; id?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  // Secretária pode especificar dentista_id; dentista usa o próprio ID
  const dentistaAlvo = dados.dentistaId ?? dentista.id;

  const supabase = await createClient();

  // Verificar que o dentista alvo pertence à clínica (proteção quando secretária especifica dentistaId)
  if (dados.dentistaId && dados.dentistaId !== dentista.id) {
    const { count: dentCount } = await supabase
      .from('dentistas')
      .select('id', { count: 'exact', head: true })
      .eq('id', dados.dentistaId)
      .eq('clinica_id', dentista.clinica_id);
    if ((dentCount ?? 0) === 0) return { error: 'Dentista não encontrado.' };
  }

  // Verificar que o paciente pertence à clínica antes de inserir
  const { count: pacCount } = await supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })
    .eq('id', dados.pacienteId)
    .eq('clinica_id', dentista.clinica_id);
  if ((pacCount ?? 0) === 0) return { error: 'Paciente não encontrado.' };

  // Verificar conflito de horário para o dentista alvo
  const novoInicioMs = new Date(dados.dataHora).getTime();
  const novoFimMs = novoInicioMs + dados.duracaoMinutos * 60_000;
  const dateOnly = dados.dataHora.split('T')[0];

  const { data: agendamentosNoDia } = await supabase
    .from('agendamentos')
    .select('data_hora, duracao_minutos')
    .eq('dentista_id', dentistaAlvo)
    .eq('clinica_id', dentista.clinica_id)
    .or('status.eq.agendado,status.eq.confirmado,status.eq.realizado')
    .gte('data_hora', `${dateOnly}T00:00:00.000Z`)
    .lt('data_hora', `${dateOnly}T23:59:59.999Z`);

  for (const ag of agendamentosNoDia ?? []) {
    const agInicioMs = new Date(ag.data_hora).getTime();
    const agFimMs = agInicioMs + (ag.duracao_minutos ?? 30) * 60_000;
    if (agInicioMs < novoFimMs && agFimMs > novoInicioMs) {
      return { error: 'Este horário conflita com outro agendamento existente. Escolha outro horário.' };
    }
  }

  const { data, error } = await supabase
    .from("agendamentos")
    .insert({
      clinica_id: dentista.clinica_id,
      dentista_id: dentistaAlvo,
      paciente_id: dados.pacienteId,
      data_hora: dados.dataHora,
      duracao_minutos: dados.duracaoMinutos,
      observacoes: dados.observacoes || null,
      status: "agendado",
      created_by: dentista.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Sync Google Calendar — best effort (nunca falha o agendamento)
  try {
    const { data: pacienteData } = await supabase
      .from("pacientes")
      .select("nome")
      .eq("id", dados.pacienteId)
      .maybeSingle<{ nome: string }>();

    // Se secretária criou para outro dentista, buscar nome desse dentista
    let dentistaNome = dentista.nome;
    if (dados.dentistaId && dados.dentistaId !== dentista.id) {
      const { data: dentistaData } = await supabase
        .from("dentistas")
        .select("nome")
        .eq("id", dados.dentistaId)
        .maybeSingle<{ nome: string }>();
      dentistaNome = dentistaData?.nome ?? dentista.nome;
    }

    const googleEventId = await createGoogleCalendarEvent(dentistaAlvo, {
      pacienteNome: pacienteData?.nome ?? "Paciente",
      dentistaNome,
      dataHora: dados.dataHora,
      duracaoMinutos: dados.duracaoMinutos,
      observacoes: dados.observacoes,
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

  revalidatePath("/dashboard/agendamentos");
  return { id: data.id };
}

export async function atualizarStatusAgendamento(
  id: string,
  status: StatusAgendamento
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  // Se cancelando, buscar google_event_id antes de atualizar
  let googleEventId: string | null = null;
  let dentistaId: string | null = null;
  if (status === "cancelado") {
    const { data } = await supabase
      .from("agendamentos")
      .select("google_event_id, dentista_id")
      .eq("id", id)
      .eq("clinica_id", dentista.clinica_id)
      .maybeSingle<{ google_event_id: string | null; dentista_id: string }>();
    googleEventId = data?.google_event_id ?? null;
    dentistaId = data?.dentista_id ?? null;
  }

  const { error } = await supabase
    .from("agendamentos")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id);

  if (error) return { error: error.message };

  // Deletar evento do Google Calendar ao cancelar — best effort
  if (status === "cancelado" && googleEventId && dentistaId) {
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
    pacienteId?: string;
    dataHora?: string;
    duracaoMinutos?: number;
    observacoes?: string | null;
    status?: StatusAgendamento;
  }
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamentos")
    .update({
      ...(dados.pacienteId && { paciente_id: dados.pacienteId }),
      ...(dados.dataHora && { data_hora: dados.dataHora }),
      ...(dados.duracaoMinutos && { duracao_minutos: dados.duracaoMinutos }),
      observacoes: dados.observacoes ?? null,
      ...(dados.status && { status: dados.status }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id);

  if (error) return { error: error.message };

  // Atualizar evento no Google Calendar — best effort
  try {
    const { data: agendamento } = await supabase
      .from("agendamentos")
      .select(
        "google_event_id, dentista_id, data_hora, duracao_minutos, observacoes, paciente:pacientes(nome), dentista:dentistas!agendamentos_dentista_id_fkey(nome)"
      )
      .eq("id", id)
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
        pacienteNome: agendamento.paciente?.nome ?? "Paciente",
        dentistaNome: agendamento.dentista?.nome ?? dentista.nome,
        dataHora: agendamento.data_hora,
        duracaoMinutos: agendamento.duracao_minutos,
        observacoes: agendamento.observacoes,
      });
    }
  } catch (err) {
    console.error("[atualizarAgendamento] Google Calendar sync falhou:", err);
  }

  revalidatePath("/dashboard/agendamentos");
  return {};
}

export async function deletarAgendamento(id: string): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  // Buscar google_event_id antes de deletar
  const { data: agendamento } = await supabase
    .from("agendamentos")
    .select("google_event_id, dentista_id")
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id)
    .maybeSingle<{ google_event_id: string | null; dentista_id: string }>();

  const { error } = await supabase
    .from("agendamentos")
    .delete()
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id);

  if (error) return { error: error.message };

  // Deletar evento do Google Calendar — best effort
  if (agendamento?.google_event_id) {
    try {
      await deleteGoogleCalendarEvent(
        agendamento.dentista_id,
        agendamento.google_event_id
      );
    } catch (err) {
      console.error("[deletarAgendamento] Google Calendar sync falhou:", err);
    }
  }

  revalidatePath("/dashboard/agendamentos");
  return {};
}

/**
 * Importa eventos do Google Calendar de um dentista para a tabela agendamentos.
 * Secretária pode importar para qualquer dentista da clínica.
 * Dentista só pode importar para si mesmo.
 */
export async function importarEventosGoogle(
  dentistaAlvoId: string,
): Promise<{ imported: number; skipped: number; error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const isSecretaria = dentista.role === "secretaria";

  if (!isSecretaria && dentistaAlvoId !== dentista.id) {
    return { imported: 0, skipped: 0, error: "Não autorizado" };
  }

  if (isSecretaria) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("dentistas")
      .select("id")
      .eq("id", dentistaAlvoId)
      .eq("clinica_id", dentista.clinica_id)
      .maybeSingle();
    if (!data) return { imported: 0, skipped: 0, error: "Dentista não encontrado" };
  }

  try {
    const result = await importGoogleCalendarEvents(dentistaAlvoId, dentista.clinica_id);
    revalidatePath("/dashboard/agendamentos");
    return { imported: result.imported, skipped: result.skipped };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { imported: 0, skipped: 0, error: msg };
  }
}
