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
}): Promise<{ error?: string; id?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id, nome")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const dentistaAlvo = dados.dentistaId ?? dentistaPerfil.id;

  if (dados.dentistaId && dados.dentistaId !== dentistaPerfil.id) {
    const { count: dentCount } = await supabase
      .from('dentistas')
      .select('id', { count: 'exact', head: true })
      .eq('id', dados.dentistaId)
      .eq('clinica_id', clinicId);
    if ((dentCount ?? 0) === 0) return { error: 'Dentista não encontrado.' };
  }

  const { count: pacCount } = await supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })
    .eq('id', dados.pacienteId)
    .eq('clinica_id', clinicId);
  if ((pacCount ?? 0) === 0) return { error: 'Paciente não encontrado.' };

  const novoInicioMs = new Date(dados.dataHora).getTime();
  const novoFimMs = novoInicioMs + dados.duracaoMinutos * 60_000;
  const dateOnly = dados.dataHora.split('T')[0];

  const { data: agendamentosNoDia } = await supabase
    .from('agendamentos')
    .select('data_hora, duracao_minutos')
    .eq('dentista_id', dentistaAlvo)
    .eq('clinica_id', clinicId)
    .or('status.eq.scheduled,status.eq.confirmed,status.eq.completed')
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
      clinica_id:       clinicId,
      dentista_id:      dentistaAlvo,
      paciente_id:      dados.pacienteId,
      data_hora:        dados.dataHora,
      duracao_minutos:  dados.duracaoMinutos,
      observacoes:      dados.observacoes || null,
      status:           "scheduled",
      created_by:       dentistaPerfil.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    const { data: pacienteData } = await supabase
      .from("pacientes")
      .select("nome")
      .eq("id", dados.pacienteId)
      .maybeSingle<{ nome: string }>();

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
    pacienteId?: string;
    dataHora?: string;
    duracaoMinutos?: number;
    observacoes?: string | null;
    status?: StatusAgendamento;
  }
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

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
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };

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
    .select('status')
    .eq('id', id)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ status: string }>();

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
  const { supabase, clinicId } = await requireClinicContext();

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('google_event_id, dentista_id, observacoes')
    .eq('id', id)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ google_event_id: string | null; dentista_id: string; observacoes: string | null }>();

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

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect('/onboarding');

  const dentistaAlvo = dados.dentistaId ?? dentistaPerfil.id;
  const novoStart = new Date(dados.dataHora).getTime();
  const novoEnd = novoStart + dados.duracaoMinutos * 60_000;
  const dateOnly = dados.dataHora.split('T')[0];

  const { data: existing } = await supabase
    .from('agendamentos')
    .select('data_hora, duracao_minutos')
    .eq('dentista_id', dentistaAlvo)
    .eq('clinica_id', clinicId)
    .in('status', ['scheduled', 'confirmed', 'checked_in', 'in_progress'])
    .gte('data_hora', `${dateOnly}T00:00:00.000Z`)
    .lt('data_hora', `${dateOnly}T23:59:59.999Z`);

  const temConflito = (existing ?? []).some(a => {
    const aStart = new Date(a.data_hora).getTime();
    const aEnd = aStart + (a.duracao_minutos ?? 30) * 60_000;
    return novoStart < aEnd && novoEnd > aStart;
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

