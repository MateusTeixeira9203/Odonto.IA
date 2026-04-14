"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { limiteDentistasParaPlano } from "@/lib/planos";

const ESPECIALIDADES = [
  "Clínico Geral",
  "Ortodontia",
  "Endodontia",
  "Implantodontia",
  "Periodontia",
  "Odontopediatria",
  "Cirurgia",
  "Outro",
] as const;

export type PlanoClinica = 'SOLO' | 'BASICO' | 'CLINICA';

export interface OnboardingInput {
  plano: PlanoClinica;
  nome: string;
  cro: string;
  especialidade: (typeof ESPECIALIDADES)[number];
  nomeConsultorio?: string;
  telefone: string;
  cidade: string;
  estado: string;
}

export async function completeOnboarding(
  data: OnboardingInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Nome da clínica: plano CLINICA usa o nome informado; outros usam padrão automático
  const nomeClinica = data.plano === 'CLINICA' && data.nomeConsultorio?.trim()
    ? data.nomeConsultorio.trim()
    : `Consultório de ${data.nome.trim()}`;

  // 1. INSERT em clinicas — UUID gerado aqui para evitar SELECT após INSERT
  // (a SELECT policy de clinicas depende de dentistas, que ainda não existe)
  const clinicaId = randomUUID();
  const { error: clinicaError } = await supabase
    .from("clinicas")
    .insert({
      id:               clinicaId,
      nome:             nomeClinica,
      plano:            data.plano,
      limite_dentistas: limiteDentistasParaPlano(data.plano),
      cidade:           data.cidade || null,
      estado:           data.estado || null,
      telefone:         data.telefone || null,
    });

  if (clinicaError) {
    console.error("Erro ao criar clínica:", clinicaError);
    return { success: false, error: clinicaError.message };
  }

  // 2. INSERT em dentistas — quem cria a clínica é sempre admin
  const { error: dentistaError } = await supabase.from("dentistas").insert({
    clinica_id:   clinicaId,
    user_id:      session.user.id,
    nome:         data.nome,
    cro:          data.cro || null,
    especialidade: data.especialidade,
    telefone:     data.telefone || null,
    email:        session.user.email ?? null,
    role:         "admin",
    ativo:        true,
  });

  if (dentistaError) {
    console.error("Erro ao criar dentista:", dentistaError);
    return { success: false, error: dentistaError.message };
  }

  // 3. Copiar procedimentos padrão para a clínica nova
  const { data: procedimentosPadrao, error: padraoError } = await supabase
    .from("procedimentos_padrao")
    .select("nome, descricao, categoria, preco_sugerido, duracao_minutos")
    .eq("ativo", true);

  if (!padraoError && procedimentosPadrao && procedimentosPadrao.length > 0) {
    const procedimentosToInsert = procedimentosPadrao.map((p) => ({
      clinica_id:       clinicaId,
      nome:             p.nome,
      descricao:        p.descricao,
      categoria:        p.categoria,
      preco_padrao:     p.preco_sugerido,
      duracao_minutos:  p.duracao_minutos,
      ativo:            true,
    }));

    const { error: procError } = await supabase
      .from("procedimentos")
      .insert(procedimentosToInsert);

    if (procError) {
      console.error("Erro ao copiar procedimentos:", procError);
      // Não falha o onboarding
    }
  }

  return { success: true };
}
