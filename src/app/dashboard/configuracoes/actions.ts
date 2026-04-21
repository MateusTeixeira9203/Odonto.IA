"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDentistaCached } from "@/lib/get-dentista";

// --- Clínica ---

export interface ClinicaFormData {
  nome_clinica: string;
  telefone: string;
  endereco: string;
  formas_pagamento: string[];
  aceita_convenio: boolean;
  convenios: string[];
}

/**
 * Faz upsert das configurações da clínica.
 */
export async function salvarClinica(
  data: ClinicaFormData
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const { error } = await supabase
    .from("configuracoes_clinica")
    .upsert(
      {
        clinica_id: dentista.clinica_id,
        nome_clinica: data.nome_clinica,
        telefone: data.telefone,
        endereco: data.endereco,
        formas_pagamento: data.formas_pagamento,
        aceita_convenio: data.aceita_convenio,
        convenios: data.convenios,
      },
      { onConflict: "clinica_id" }
    );

  if (error) {
    console.error("Erro ao salvar configurações da clínica:", error);
    return { error: error.message };
  }

  return {};
}

// --- Horários ---

export interface HorarioDia {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
}

/**
 * Substitui todos os horários do dentista (delete + insert).
 * Só persiste os dias marcados como ativos.
 */
export async function salvarHorarios(
  horarios: HorarioDia[]
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  // Remove todos os registros existentes do dentista
  const { error: deleteError } = await supabase
    .from("horarios_disponiveis")
    .delete()
    .eq("dentista_id", dentista.id);

  if (deleteError) {
    console.error("Erro ao limpar horários:", deleteError);
    return { error: deleteError.message };
  }

  const linhas = horarios
    .filter((h) => h.ativo)
    .map((h) => ({
      clinica_id: dentista.clinica_id,
      dentista_id: dentista.id,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      intervalo_minutos: h.intervalo_minutos,
      ativo: true,
    }));

  if (linhas.length === 0) return {};

  const { error: insertError } = await supabase
    .from("horarios_disponiveis")
    .insert(linhas);

  if (insertError) {
    console.error("Erro ao inserir horários:", insertError);
    return { error: insertError.message };
  }

  return {};
}

// --- Procedimentos da clínica ---

export interface ProcedimentoUpdateData {
  nome: string;
  preco_padrao: number;
  duracao_minutos: number;
}

/**
 * Atualiza nome, preço e duração de um procedimento da clínica.
 * Filtra por clinica_id obtido do servidor — nunca do cliente.
 */
export async function atualizarProcedimento(
  id: string,
  data: ProcedimentoUpdateData
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const { error } = await supabase
    .from("procedimentos")
    .update({
      nome: data.nome,
      preco_padrao: data.preco_padrao,
      duracao_minutos: data.duracao_minutos,
    })
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id);

  if (error) {
    console.error("Erro ao atualizar procedimento:", error);
    return { error: error.message };
  }

  return {};
}

/**
 * Ativa ou desativa um procedimento da clínica.
 * Filtra por clinica_id obtido do servidor — nunca do cliente.
 */
export async function toggleProcedimento(
  id: string,
  ativo: boolean
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const { error } = await supabase
    .from("procedimentos")
    .update({ ativo })
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id);

  if (error) {
    console.error("Erro ao togglear procedimento:", error);
    return { error: error.message };
  }

  return {};
}

export interface NovoProcedimentoData {
  nome: string;
  descricao: string;
  categoria: string;
  preco_padrao: number;
  duracao_minutos: number;
}

/**
 * Cria um novo procedimento na tabela da clínica.
 * clinica_id sempre vem do servidor via getDentistaCached().
 */
export async function criarProcedimento(
  data: NovoProcedimentoData
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const { error } = await supabase
    .from("procedimentos")
    .insert({ ...data, clinica_id: dentista.clinica_id, ativo: true });

  if (error) {
    console.error("Erro ao criar procedimento:", error);
    return { error: error.message };
  }

  return {};
}
