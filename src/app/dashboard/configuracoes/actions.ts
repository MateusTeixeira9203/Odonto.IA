"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { requirePermission } from "@/server/authorization/guards";
import { requireRole } from "@/server/auth/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sairDaClinica } from "@/server/services/team";
import { z } from "zod";
import { normalizarNomeProcedimento } from "@/lib/arcadas";

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
  const { supabase, clinicId } = await requireRole(['admin', 'dentista']);

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

const procedimentoIdSchema = z.string().uuid();

export type AlterarVisibilidadeProcedimentoResult =
  | { ok: true; id: string; ativo: boolean }
  | { ok: false; codigo: 'ID_INVALIDO' | 'NAO_ENCONTRADO' | 'BANCO'; erro: string };

export type CriarProcedimentoResult =
  | { ok: true; id: string; restaurado: boolean }
  | { ok: false; erro: string };

async function obterDentistaDoCatalogo() {
  const { supabase, user, clinicId } = await requirePermission('configuracoes');
  const { data: dentistaPerfil, error } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (error || !dentistaPerfil) return null;
  return { supabase, clinicId, dentistaId: dentistaPerfil.id };
}

export async function atualizarProcedimento(
  id: string,
  data: ProcedimentoUpdateData
): Promise<{ error?: string }> {
  const contexto = await obterDentistaDoCatalogo();
  if (!contexto) return { error: 'Perfil de dentista não encontrado.' };

  const { error } = await contexto.supabase
    .from("procedimentos")
    .update({
      nome:            data.nome,
      preco_padrao:    data.preco_padrao,
      duracao_minutos: data.duracao_minutos,
    })
    .eq("id", id)
    .eq("clinica_id", contexto.clinicId)
    .eq('dentista_id', contexto.dentistaId);

  if (error) {
    console.error("Erro ao atualizar procedimento:", error);
    return { error: error.message };
  }

  // Configurou procedimentos → limpa a pendência (some o alerta âmbar)
  await contexto.supabase.from("clinicas").update({ procedimentos_pendente: false }).eq("id", contexto.clinicId);

  revalidatePath('/dashboard/configuracoes');
  revalidatePath('/dashboard/meu-consultorio/precos');
  return {};
}

async function alterarVisibilidadeProcedimento(
  id: string,
  ativo: boolean,
): Promise<AlterarVisibilidadeProcedimentoResult> {
  const parsed = procedimentoIdSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, codigo: 'ID_INVALIDO', erro: 'Procedimento inválido.' };
  }

  const contexto = await obterDentistaDoCatalogo();
  if (!contexto) {
    return { ok: false, codigo: 'BANCO', erro: 'Perfil de dentista não encontrado.' };
  }

  const { data, error } = await contexto.supabase
    .from('procedimentos')
    .update({ ativo })
    .eq('id', parsed.data)
    .eq('clinica_id', contexto.clinicId)
    .eq('dentista_id', contexto.dentistaId)
    .select('id, ativo')
    .maybeSingle();

  if (error) {
    console.error('[procedimentos] erro ao alterar visibilidade:', error);
    return { ok: false, codigo: 'BANCO', erro: 'Não foi possível atualizar o catálogo. Tente novamente.' };
  }
  if (!data) {
    return { ok: false, codigo: 'NAO_ENCONTRADO', erro: 'Procedimento não encontrado. Atualize a página.' };
  }

  revalidatePath('/dashboard/configuracoes');
  revalidatePath('/dashboard/meu-consultorio/precos');
  return { ok: true, id: data.id, ativo: data.ativo };
}

export async function removerProcedimentoDoCatalogo(
  id: string,
): Promise<AlterarVisibilidadeProcedimentoResult> {
  return alterarVisibilidadeProcedimento(id, false);
}

export async function restaurarProcedimentoNoCatalogo(
  id: string,
): Promise<AlterarVisibilidadeProcedimentoResult> {
  return alterarVisibilidadeProcedimento(id, true);
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
): Promise<CriarProcedimentoResult> {
  const contexto = await obterDentistaDoCatalogo();
  if (!contexto) return { ok: false, erro: 'Perfil de dentista não encontrado.' };

  const nome = normalizarNomeProcedimento(data.nome);
  if (!nome) return { ok: false, erro: 'Informe o nome do procedimento.' };

  const { data: existentes, error: existentesError } = await contexto.supabase
    .from('procedimentos')
    .select('id, nome, ativo')
    .eq('clinica_id', contexto.clinicId)
    .eq('dentista_id', contexto.dentistaId);
  if (existentesError) {
    console.error('[procedimentos] erro ao consultar catálogo:', existentesError);
    return { ok: false, erro: 'Não foi possível consultar o catálogo. Tente novamente.' };
  }

  const chaveNome = nome.toLocaleLowerCase('pt-BR');
  const existente = (existentes ?? []).find(
    (procedimento) => normalizarNomeProcedimento(procedimento.nome).toLocaleLowerCase('pt-BR') === chaveNome,
  );

  if (existente?.ativo) return { ok: false, erro: 'Já existe um procedimento com esse nome no catálogo.' };

  if (existente) {
    const { error } = await contexto.supabase
      .from('procedimentos')
      .update({ ...data, nome, ativo: true })
      .eq('id', existente.id)
      .eq('clinica_id', contexto.clinicId)
      .eq('dentista_id', contexto.dentistaId);
    if (error) {
      console.error('[procedimentos] erro ao restaurar cadastro:', error);
      return { ok: false, erro: 'Não foi possível restaurar o procedimento. Tente novamente.' };
    }
    await contexto.supabase.from('clinicas').update({ procedimentos_pendente: false }).eq('id', contexto.clinicId);
    revalidatePath('/dashboard/configuracoes');
    revalidatePath('/dashboard/meu-consultorio/precos');
    return { ok: true, id: existente.id, restaurado: true };
  }

  const { data: criado, error } = await contexto.supabase
    .from('procedimentos')
    .insert({ ...data, nome, clinica_id: contexto.clinicId, dentista_id: contexto.dentistaId, ativo: true })
    .select('id')
    .single();

  if (error || !criado) {
    console.error('[procedimentos] erro ao criar:', error);
    return { ok: false, erro: 'Não foi possível criar o procedimento. Tente novamente.' };
  }

  // Configurou procedimentos → limpa a pendência (some o alerta âmbar)
  await contexto.supabase.from('clinicas').update({ procedimentos_pendente: false }).eq('id', contexto.clinicId);
  revalidatePath('/dashboard/configuracoes');
  revalidatePath('/dashboard/meu-consultorio/precos');
  return { ok: true, id: criado.id, restaurado: false };
}

// logo_url guarda o caminho no storage (bucket privado desde a migration 117), não mais
// a URL pública — a leitura gera URL assinada em configuracoes/page.tsx.
export async function salvarLogoUrl(logoPath: string): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireRole(['admin', 'dentista']);

  const { error } = await supabase
    .from('configuracoes_clinica')
    .upsert({ clinica_id: clinicId, logo_url: logoPath }, { onConflict: 'clinica_id' });

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
