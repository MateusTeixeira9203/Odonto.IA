"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { revalidatePath } from "next/cache";

export type Tratamento = {
  id: string;
  nome: string | null;
  status: "principal" | "pendente" | "concluido";
  created_at: string;
  encerrado_em: string | null;
};

/** Busca o tratamento principal do paciente. */
export async function buscarTratamentoAtivo(
  pacienteId: string
): Promise<{ tratamento: Tratamento | null; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "principal")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return { tratamento: null, error: error.message };
  const row = (data as Tratamento[])?.[0] ?? null;
  return { tratamento: row };
}

/** Busca tratamentos em pausa do paciente. */
export async function buscarTratamentosPendentes(
  pacienteId: string
): Promise<{ tratamentos: Tratamento[]; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "pendente")
    .order("created_at", { ascending: false });

  if (error) return { tratamentos: [], error: error.message };
  return { tratamentos: (data as Tratamento[]) ?? [] };
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

/** Torna um tratamento o principal, colocando o atual em pausa automaticamente. */
export async function tornarPrincipal(
  tratamentoId: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === "secretaria") return { error: "Sem permissão" };

  // Coloca o principal atual em pausa
  await supabase
    .from("tratamentos")
    .update({ status: "pendente" })
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "principal");

  // Promove o selecionado a principal
  const { error } = await supabase
    .from("tratamentos")
    .update({ status: "principal" })
    .eq("id", tratamentoId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
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

  // Verifica se já existe um tratamento principal
  const { data: existente } = await supabase
    .from("tratamentos")
    .select("id")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "principal")
    .maybeSingle();

  // Se há um principal, o novo entra como 'pendente'; caso contrário, já nasce como 'principal'
  const novoStatus = existente ? "pendente" : "principal";

  // Cria o tratamento
  const { data: novo, error: errInsert } = await supabase
    .from("tratamentos")
    .insert({
      clinica_id: clinicId,
      paciente_id: pacienteId,
      nome: nome?.trim() || null,
      status: novoStatus,
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

export type FichaSemTratamento = {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  dentes_afetados: number[];
};

/** Busca fichas do paciente que ainda não estão vinculadas a nenhum tratamento. */
export async function buscarFichasSemTratamento(
  pacienteId: string
): Promise<{ fichas: FichaSemTratamento[]; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("fichas")
    .select("id, created_at, queixa_principal, dentes_afetados, dentes_observacoes")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .is("tratamento_id", null)
    .order("created_at", { ascending: false });

  if (error) return { fichas: [], error: error.message };

  // Exclude fichas with no tooth observations — they have no clinical data to link
  const fichas = ((data ?? []) as Array<FichaSemTratamento & { dentes_observacoes: Record<string, unknown> | null }>)
    .filter(f => f.dentes_observacoes && Object.keys(f.dentes_observacoes).length > 0)
    .map(({ dentes_observacoes: _obs, ...rest }) => rest as FichaSemTratamento);

  return { fichas };
}

/** Exclui um tratamento e libera as fichas vinculadas a ele. */
export async function excluirTratamento(
  tratamentoId: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para excluir tratamentos" };

  await supabase
    .from("fichas")
    .update({ tratamento_id: null })
    .eq("tratamento_id", tratamentoId)
    .eq("clinica_id", clinicId);

  const { error } = await supabase
    .from("tratamentos")
    .delete()
    .eq("id", tratamentoId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

/** Renomeia o tratamento. */
export async function renomearTratamento(
  tratamentoId: string,
  nome: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { error: 'Sem permissão' };
  const { error } = await supabase
    .from('tratamentos')
    .update({ nome: nome.trim() || null })
    .eq('id', tratamentoId)
    .eq('clinica_id', clinicId);
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
