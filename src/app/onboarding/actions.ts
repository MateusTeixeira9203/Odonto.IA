"use server";

import { requireUser } from "@/server/auth/user";
import { requireClinicContext } from "@/server/auth/clinic";
import { enviarEmailD0 } from "@/server/services/onboarding-emails";
import { completeOnboardingModalidade } from "@/server/services/onboarding-modalidade";
import { createTeamInvite } from '@/server/services/team-invites';
import type { FocoPrincipal } from "@/lib/persona";
import type { Especialidade } from "@/lib/especialidades";

export type PlanoClinica = "SOLO" | "CLINICA";

export interface IniciarOnboardingModalidadeInput {
  nome: string;
  cro: string | null;
  especialidade: Especialidade[];
  nomeConsultorio: string;
  foco: FocoPrincipal | null;
  modalidade: "colaborativa" | "gerida";
  criadorAtende: boolean;
  chaveIdempotencia: string;
  quantidadeDentistasPrevista: number;
}

const LIMITE_POR_PLANO: Record<PlanoClinica, number> = { SOLO: 1, CLINICA: 5 };

/**
 * Cria a primeira clínica com a modalidade declarada. A RPC nova mantém o fluxo
 * legado isolado e permite um proprietário que não atua clinicamente.
 */
export async function iniciarOnboardingModalidade(
  data: IniciarOnboardingModalidadeInput,
): Promise<{ success: boolean; criadorAtende?: boolean; clinicaId?: string; error?: string }> {
  const { user } = await requireUser();

  const result = await completeOnboardingModalidade({
    nomeClinica: data.nomeConsultorio,
    modalidade: data.modalidade,
    criadorAtende: data.criadorAtende,
    nomeUsuario: data.nome,
    cro: data.cro?.trim() || null,
    especialidade: data.especialidade,
    email: user.email ?? null,
    foco: data.foco,
    chaveIdempotencia: data.chaveIdempotencia,
    quantidadeDentistasPrevista: data.quantidadeDentistasPrevista,
  });

  if (!result.ok) {
    return { success: false, error: result.mensagem };
  }

  if (user.email && data.criadorAtende) {
    void enviarEmailD0({
      email: user.email,
      nomeDentista: data.nome.trim().split(" ")[0],
    });
  }

  return { success: true, criadorAtende: result.data.criadorAtende, clinicaId: result.data.clinicaId };
}

export async function criarConviteEquipeAction(input: unknown): Promise<{
  success: boolean;
  emailEnviado?: boolean;
  error?: string;
}> {
  const result = await createTeamInvite(input);
  if (!result.ok) return { success: false, error: result.mensagem };
  return { success: true, emailEnviado: result.emailEnviado };
}

/**
 * Define o plano definitivo (passo `plano`). Atualiza `clinicas.plano` e o
 * `limite_dentistas` correspondente. Trial dá acesso total de qualquer forma —
 * isto é preferência de billing, não um gate.
 */
export async function definirPlano(
  plano: PlanoClinica,
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();
  const { error } = await supabase
    .from("clinicas")
    .update({ plano, limite_dentistas: LIMITE_POR_PLANO[plano] })
    .eq("id", clinicId);
  if (error) {
    console.error("[definirPlano]", error.message);
    return { error: error.message };
  }
  return {};
}

/**
 * Marca o onboarding como concluído (fim do passo `procedimentos`).
 * O guard de `/onboarding/layout.tsx` usa este flag — não a mera existência do
 * dentista, que agora é criado no meio do fluxo.
 */
export async function marcarOnboardingCompleto(): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();
  const { error } = await supabase
    .from("clinicas")
    .update({ onboarding_completo: true })
    .eq("id", clinicId);
  if (error) {
    console.error("[marcarOnboardingCompleto]", error.message);
    return { error: error.message };
  }
  return {};
}

/**
 * Marca/limpa a pendência de configuração de procedimentos.
 * "Configurar depois" no onboarding → pendente=true (mostra alerta âmbar nas configs).
 * "Usar tabela padrão" / "Importar" → pendente=false.
 */
export async function definirProcedimentosPendente(
  pendente: boolean,
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();
  const { error } = await supabase
    .from("clinicas")
    .update({ procedimentos_pendente: pendente })
    .eq("id", clinicId);
  if (error) {
    console.error("[definirProcedimentosPendente]", error.message);
    return { error: error.message };
  }
  return {};
}
