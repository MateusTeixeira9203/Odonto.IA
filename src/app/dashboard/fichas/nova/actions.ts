"use server";

import { requirePermission } from "@/server/authorization/guards";
import { redirect } from "next/navigation";

export async function createFicha(
  pacienteId: string
): Promise<{ fichaId: string } | { error: string }> {
  const { supabase, user, clinicId } = await requirePermission('prontuarios_edit');

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id")
    .eq("id", pacienteId)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!paciente) {
    return { error: "Paciente não encontrado." };
  }

  const { data: ficha, error } = await supabase
    .from("fichas")
    .insert({
      clinica_id:       clinicId,
      paciente_id:      pacienteId,
      dentista_id:      dentistaPerfil.id,
      // Job A §7.2 — 1 linha por consistência (rota legado, sem UI de data).
      data_atendimento: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
      status:           "aberta",
    })
    .select("id")
    .single();

  if (error || !ficha) {
    console.error("Erro ao criar ficha:", error);
    return { error: error?.message ?? "Erro ao criar ficha" };
  }

  return { fichaId: ficha.id };
}
