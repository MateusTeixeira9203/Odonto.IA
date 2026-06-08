"use server";

import { requireUser } from "@/server/auth/user";
import { redirect } from "next/navigation";

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

export type PlanoClinica = "SOLO" | "CLINICA";

export interface OnboardingInput {
  plano: PlanoClinica;
  nome: string;
  cro: string;
  especialidade: (typeof ESPECIALIDADES)[number];
  /** Nome do consultório — obrigatório para todos os planos */
  nomeConsultorio: string;
}

// Extrai o código estruturado do erro lançado pela RPC.
// Formato: 'CODIGO: mensagem descritiva'
function rpcErrorCode(message: string): string {
  return message.match(/^([A-Z_]+):/)?.[1] ?? "UNKNOWN";
}

/**
 * completeOnboarding — cria clínica + dentista + membership em uma única transação.
 *
 * Toda a lógica transacional vive na função Postgres `complete_onboarding()`.
 * Este action apenas: autentica o usuário, monta o payload e chama a RPC.
 *
 * Se qualquer etapa falhar dentro da RPC, o Postgres reverte automaticamente
 * (rollback) — sem dados zumbis, sem estado parcial.
 */
export async function completeOnboarding(
  data: OnboardingInput,
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.rpc("complete_onboarding", {
    p_plano:         data.plano,
    p_nome_clinica:  data.nomeConsultorio.trim(),
    p_nome_usuario:  data.nome.trim(),
    p_cro:           data.cro?.trim() || null,
    p_especialidade: data.especialidade,
    p_telefone:      null,
    p_cidade:        null,
    p_estado:        null,
    p_email:         user.email ?? null,
  });

  if (error) {
    console.error("[completeOnboarding] RPC error:", {
      code:    error.code,
      message: error.message,
    });

    const code = rpcErrorCode(error.message);

    // Usuário já tem clínica ativa — redirecionar ao invés de mostrar erro
    if (code === "ALREADY_ONBOARDED") {
      redirect("/dashboard");
    }

    return {
      success: false,
      error: "Erro ao criar sua conta. Tente novamente ou contate o suporte.",
    };
  }

  return { success: true };
}
