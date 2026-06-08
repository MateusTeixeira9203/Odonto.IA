"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { revalidatePath } from "next/cache";

export type Tratamento = {
  id: string;
  nome: string | null;
  status: "ativo" | "concluido";
  created_at: string;
  encerrado_em: string | null;
};

/** Busca o tratamento ativo do paciente (no máximo um). */
export async function buscarTratamentoAtivo(
  pacienteId: string
): Promise<{ tratamento: Tratamento | null; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) return { tratamento: null, error: error.message };
  return { tratamento: (data as Tratamento | null) };
}

/** Busca todos os tratamentos concluídos do paciente (histórico). */
export async function buscarHistoricoTratamentos(
  pacienteId: string
): Promise<{ tratamentos: Tratamento[]; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "concluido")
    .order("encerrado_em", { ascending: false });

  if (error) return { tratamentos: [], error: error.message };
  return { tratamentos: (data as Tratamento[]) ?? [] };
}

/**
 * Cria um novo tratamento ativo e vincula as fichas selecionadas.
 * Pré-condição: não deve existir tratamento ativo para este paciente.
 */
export async function criarTratamento(
  pacienteId: string,
  nome: string | null,
  fichaIds: string[]
): Promise<{ id?: string; error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para criar tratamentos" };

  // Garante que não existe tratamento ativo
  const { data: existente } = await supabase
    .from("tratamentos")
    .select("id")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (existente) return { error: "Já existe um tratamento ativo para este paciente" };

  // Cria o tratamento
  const { data: novo, error: errInsert } = await supabase
    .from("tratamentos")
    .insert({
      clinica_id: clinicId,
      paciente_id: pacienteId,
      nome: nome?.trim() || null,
      status: "ativo",
    })
    .select("id")
    .single();

  if (errInsert || !novo) return { error: errInsert?.message ?? "Erro ao criar tratamento" };

  // Vincula fichas selecionadas
  if (fichaIds.length > 0) {
    await supabase
      .from("fichas")
      .update({ tratamento_id: (novo as { id: string }).id })
      .in("id", fichaIds)
      .eq("clinica_id", clinicId);
  }

  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return { id: (novo as { id: string }).id };
}

/** Adiciona fichas avulsas a um tratamento ativo existente. */
export async function vincularFichasAoTratamento(
  tratamentoId: string,
  fichaIds: string[],
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão" };
  if (fichaIds.length === 0) return {};

  const { error } = await supabase
    .from("fichas")
    .update({ tratamento_id: tratamentoId })
    .in("id", fichaIds)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

/** Encerra o tratamento ativo. */
export async function encerrarTratamento(
  tratamentoId: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para encerrar tratamentos" };

  const { error } = await supabase
    .from("tratamentos")
    .update({
      status: "concluido",
      encerrado_em: new Date().toISOString(),
    })
    .eq("id", tratamentoId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}
