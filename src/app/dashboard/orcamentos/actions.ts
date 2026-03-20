"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDentistaCached } from "@/lib/get-dentista";

export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "boleto"
  | "outro";

export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado";

/**
 * Atualiza o status de um orçamento (ex: rascunho → enviado → aprovado).
 * Verifica que o orçamento pertence à clínica do dentista autenticado.
 */
export async function atualizarStatusOrcamento(
  orcamentoId: string,
  status: StatusOrcamento
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");
  const clinicaId = dentista.clinica_id;

  const supabase = await createClient();

  const { error } = await supabase
    .from("orcamentos")
    .update({ status })
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicaId);

  if (error) {
    console.error("Erro ao atualizar status do orçamento:", error);
    return { error: error.message };
  }
  return {};
}

/**
 * Marca um pagamento como pago com a forma de pagamento informada.
 * Verifica que o pagamento pertence à clínica do dentista autenticado.
 */
export async function marcarPagamentoPago(
  pagamentoId: string,
  formaPagamento: FormaPagamento
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");
  const clinicaId = dentista.clinica_id;

  const supabase = await createClient();

  const hoje = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("pagamentos")
    .update({
      status: "pago",
      forma_pagamento: formaPagamento,
      data_pagamento: hoje,
    })
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicaId);

  if (error) {
    console.error("Erro ao marcar pagamento como pago:", error);
    return { error: error.message };
  }

  return {};
}
