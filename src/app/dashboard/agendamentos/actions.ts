"use server";

import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type StatusAgendamento =
  | "agendado"
  | "confirmado"
  | "cancelado"
  | "realizado"
  | "faltou";

export async function criarAgendamento(dados: {
  pacienteId: string;
  dataHora: string;
  duracaoMinutos: number;
  observacoes: string | null;
}): Promise<{ error?: string; id?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agendamentos")
    .insert({
      clinica_id: dentista.clinica_id,
      dentista_id: dentista.id,
      paciente_id: dados.pacienteId,
      data_hora: dados.dataHora,
      duracao_minutos: dados.duracaoMinutos,
      observacoes: dados.observacoes || null,
      status: "agendado",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
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
  const { error } = await supabase
    .from("agendamentos")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id);

  if (error) return { error: error.message };
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
  revalidatePath("/dashboard/agendamentos");
  return {};
}
