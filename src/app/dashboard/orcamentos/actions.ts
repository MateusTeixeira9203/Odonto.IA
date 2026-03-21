"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

/**
 * Cria um novo orçamento com seus itens para o paciente informado.
 */
export async function criarOrcamento(dados: {
  pacienteId: string;
  itens: Array<{
    procedimentoId: string | null;
    descricao: string;
    quantidade: number;
    precoUnitario: number;
  }>;
}): Promise<{ error?: string; id?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const total = dados.itens.reduce(
    (sum, item) => sum + item.quantidade * item.precoUnitario,
    0
  );

  const { data: orc, error: orcError } = await supabase
    .from("orcamentos")
    .insert({
      clinica_id: dentista.clinica_id,
      dentista_id: dentista.id,
      paciente_id: dados.pacienteId,
      status: "rascunho",
      total,
      validade_dias: 30,
    })
    .select("id")
    .single();

  if (orcError || !orc) {
    return { error: orcError?.message ?? "Erro ao criar orçamento." };
  }

  const itensInsert = dados.itens.map((item) => ({
    orcamento_id: orc.id,
    clinica_id: dentista.clinica_id,
    descricao: item.descricao,
    procedimento_id: item.procedimentoId ?? null,
    quantidade: item.quantidade,
    preco_unitario: item.precoUnitario,
    total: item.quantidade * item.precoUnitario,
  }));

  const { error: itensError } = await supabase
    .from("orcamento_itens")
    .insert(itensInsert);

  if (itensError) {
    return { error: itensError.message };
  }

  revalidatePath(`/dashboard/pacientes/${dados.pacienteId}`);
  revalidatePath("/dashboard/orcamentos");
  return { id: orc.id };
}

/**
 * Registra um novo pagamento para o orçamento informado.
 */
export async function registrarPagamento(dados: {
  orcamentoId: string;
  valor: number;
  formaPagamento: FormaPagamento;
  data: string;
}): Promise<{ error?: string; id?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pagamentos")
    .insert({
      orcamento_id: dados.orcamentoId,
      clinica_id: dentista.clinica_id,
      valor: dados.valor,
      status: "pago",
      forma_pagamento: dados.formaPagamento,
      data_pagamento: dados.data,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/orcamentos");
  return { id: data.id };
}
