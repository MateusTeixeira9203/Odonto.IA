"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { requirePermission } from "@/server/authorization/guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sairDaClinica } from "@/server/services/team";

export async function salvarPerfil(data: {
  nome: string;
  cro: string;
}): Promise<{ error?: string }> {
  const { supabase, user } = await requireClinicContext();

  const { error } = await supabase
    .from('dentistas')
    .update({ nome: data.nome.trim(), cro: data.cro.trim() || null })
    .eq('user_id', user.id);

  if (error) {
    console.error('Erro ao salvar perfil:', error);
    return { error: error.message };
  }

  return {};
}

export interface ClinicaFormData {
  nome_clinica: string;
  telefone: string;
  endereco: string;
  formas_pagamento: string[];
  aceita_convenio: boolean;
  convenios: string[];
}

export async function salvarClinica(
  data: ClinicaFormData
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requirePermission('configuracoes');

  const { error } = await supabase
    .from("configuracoes_clinica")
    .upsert(
      {
        clinica_id:       clinicId,
        nome_clinica:     data.nome_clinica,
        telefone:         data.telefone,
        endereco:         data.endereco,
        formas_pagamento: data.formas_pagamento,
        aceita_convenio:  data.aceita_convenio,
        convenios:        data.convenios,
      },
      { onConflict: "clinica_id" }
    );

  if (error) {
    console.error("Erro ao salvar configurações da clínica:", error);
    return { error: error.message };
  }

  return {};
}

export interface HorarioDia {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
  almoco_inicio: string | null;
  almoco_fim: string | null;
}

export async function salvarHorarios(
  horarios: HorarioDia[]
): Promise<{ error?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { error: 'Dentista não encontrado.' };

  const { error: deleteError } = await supabase
    .from("horarios_disponiveis")
    .delete()
    .eq("dentista_id", dentistaPerfil.id);

  if (deleteError) {
    console.error("Erro ao limpar horários:", deleteError);
    return { error: deleteError.message };
  }

  const linhas = horarios
    .filter((h) => h.ativo)
    .map((h) => ({
      clinica_id:        clinicId,
      dentista_id:       dentistaPerfil.id,
      dia_semana:        h.dia_semana,
      hora_inicio:       h.hora_inicio,
      hora_fim:          h.hora_fim,
      intervalo_minutos: h.intervalo_minutos,
      almoco_inicio:     h.almoco_inicio || null,
      almoco_fim:        h.almoco_fim || null,
      ativo:             true,
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

export interface ProcedimentoUpdateData {
  nome: string;
  preco_padrao: number;
  duracao_minutos: number;
}

export async function atualizarProcedimento(
  id: string,
  data: ProcedimentoUpdateData
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requirePermission('configuracoes');

  const { error } = await supabase
    .from("procedimentos")
    .update({
      nome:            data.nome,
      preco_padrao:    data.preco_padrao,
      duracao_minutos: data.duracao_minutos,
    })
    .eq("id", id)
    .eq("clinica_id", clinicId);

  if (error) {
    console.error("Erro ao atualizar procedimento:", error);
    return { error: error.message };
  }

  return {};
}

export async function toggleProcedimento(
  id: string,
  ativo: boolean
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requirePermission('configuracoes');

  const { error } = await supabase
    .from("procedimentos")
    .update({ ativo })
    .eq("id", id)
    .eq("clinica_id", clinicId);

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

export async function criarProcedimento(
  data: NovoProcedimentoData
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requirePermission('configuracoes');

  const { error } = await supabase
    .from("procedimentos")
    .insert({ ...data, clinica_id: clinicId, ativo: true });

  if (error) {
    console.error("Erro ao criar procedimento:", error);
    return { error: error.message };
  }

  return {};
}

export async function salvarLogoUrl(logoUrl: string): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requirePermission('configuracoes');

  const { error } = await supabase
    .from('configuracoes_clinica')
    .upsert({ clinica_id: clinicId, logo_url: logoUrl }, { onConflict: 'clinica_id' });

  if (error) return { error: error.message };
  return {};
}

export async function sairDaClinicaAction(): Promise<{ error?: string }> {
  const { user, clinicId, role } = await requireClinicContext();

  const result = await sairDaClinica({ userId: user.id, clinicId, role });

  if (!result.ok) {
    return { error: result.error };
  }

  if (result.hasOtherClinic) {
    // Tem outra clínica ativa — revalida e volta ao dashboard (clinic-switcher cuida do resto)
    revalidatePath('/dashboard');
    redirect('/dashboard');
  }

  // Sem outra clínica — vai ao onboarding para criar ou aguardar um convite
  redirect('/onboarding');
}
