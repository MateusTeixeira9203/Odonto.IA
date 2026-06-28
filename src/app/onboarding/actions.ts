"use server";

import { requireUser } from "@/server/auth/user";
import { requireClinicContext } from "@/server/auth/clinic";
import { enviarEmailD0 } from "@/server/services/onboarding-emails";
import type { FocoPrincipal } from "@/lib/persona";

export type PlanoClinica = "SOLO" | "CLINICA";
export type Especialidade =
  | "Clínico Geral"
  | "Ortodontia"
  | "Endodontia"
  | "Implantodontia"
  | "Periodontia"
  | "Odontopediatria"
  | "Cirurgia"
  | "Outro";

export interface IniciarOnboardingInput {
  nome: string;
  cro: string;
  especialidade: Especialidade;
  /** Nome do consultório/clínica — obrigatório para todos os planos */
  nomeConsultorio: string;
  /** Persona escolhida na identidade (Workstream E). */
  foco: FocoPrincipal;
}

const LIMITE_POR_PLANO: Record<PlanoClinica, number> = { SOLO: 1, CLINICA: 5 };

// Extrai o código estruturado do erro lançado pela RPC. Formato: 'CODIGO: mensagem'.
function rpcErrorCode(message: string): string {
  return message.match(/^([A-Z_]+):/)?.[1] ?? "UNKNOWN";
}

/**
 * iniciarOnboarding — cria clínica + dentista + membership numa única transação
 * (RPC `complete_onboarding`), gravando a persona (`foco_principal`) e um plano
 * **provisório SOLO**.
 *
 * É chamado cedo no fluxo novo (logo após a identidade), pra a demo do Modo
 * Consulta poder rodar com um dentista real. O plano definitivo é escolhido no
 * passo `plano` (`definirPlano`). A conclusão é marcada no fim (`marcarOnboardingCompleto`).
 *
 * Idempotência e rollback ficam na própria RPC.
 */
export async function iniciarOnboarding(
  data: IniciarOnboardingInput,
): Promise<{ success: boolean; alreadyOnboarded?: boolean; error?: string }> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.rpc("complete_onboarding", {
    p_plano:          "SOLO", // provisório — definitivo no passo 'plano'
    p_nome_clinica:   data.nomeConsultorio.trim(),
    p_nome_usuario:   data.nome.trim(),
    p_cro:            data.cro?.trim() || null,
    p_especialidade:  data.especialidade,
    p_telefone:       null,
    p_cidade:         null,
    p_estado:         null,
    p_email:          user.email ?? null,
    p_foco_principal: data.foco,
  });

  if (error) {
    const code = rpcErrorCode(error.message);

    // Usuário já tem clínica ativa — o client redireciona pro dashboard.
    if (code === "ALREADY_ONBOARDED") {
      return { success: false, alreadyOnboarded: true };
    }

    console.error("[iniciarOnboarding] RPC error:", { code, message: error.message });
    return {
      success: false,
      error: "Erro ao criar sua conta. Tente novamente ou contate o suporte.",
    };
  }

  if (user.email) {
    void enviarEmailD0({
      email: user.email,
      nomeDentista: data.nome.trim().split(" ")[0],
    });
  }

  return { success: true };
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
