"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDentistaCached } from "@/lib/get-dentista";
import { inserirNotificacao } from "@/lib/notificacoes";

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

  if (status === 'enviado' || status === 'aprovado') {
    const { data: orc } = await supabase
      .from('orcamentos')
      .select('paciente:pacientes(nome)')
      .eq('id', orcamentoId)
      .maybeSingle();
    const pacNome = (orc?.paciente as unknown as { nome: string } | null)?.nome ?? 'paciente';
    await inserirNotificacao(supabase, {
      clinicaId:    clinicaId,
      paraRole:     'secretaria',
      deDentistaId: dentista.id,
      tipo:         status === 'enviado' ? 'orcamento_enviado' : 'briefing',
      titulo:       status === 'enviado'
        ? `Orçamento enviado — ${pacNome}`
        : `Orçamento aprovado — ${pacNome}`,
      mensagem:     status === 'enviado'
        ? `Orçamento de ${pacNome} enviado. Acompanhe o retorno e faça o follow-up se necessário.`
        : `Orçamento de ${pacNome} foi aprovado pelo dentista.`,
      href:         '/dashboard/orcamentos',
    });
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
  desconto?: number;
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

  const subtotal = dados.itens.reduce(
    (sum, item) => sum + item.quantidade * item.precoUnitario,
    0
  );
  const desconto = dados.desconto ?? 0;
  const total = Math.max(0, subtotal - desconto);

  const { data: orc, error: orcError } = await supabase
    .from("orcamentos")
    .insert({
      clinica_id: dentista.clinica_id,
      dentista_id: dentista.id,
      paciente_id: dados.pacienteId,
      status: "rascunho",
      total,
      desconto,
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
    preco_total: item.quantidade * item.precoUnitario,
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
 * Quando o total pago iguala ou supera o total do orçamento, marca automaticamente como aprovado.
 */
export async function registrarPagamento(dados: {
  orcamentoId: string;
  pacienteId: string;
  valor: number;
  formaPagamento: FormaPagamento;
  data: string;
  /** dentista_id do orçamento — necessário quando quem registra é a secretária */
  dentistaId?: string;
}): Promise<{ error?: string; id?: string; autoAprovado?: boolean }> {
  const sessao = await getDentistaCached();
  if (!sessao) redirect("/login");

  const supabase = await createClient();

  const dentistaId = dados.dentistaId ?? sessao.id;

  const { data, error } = await supabase
    .from("pagamentos")
    .insert({
      orcamento_id: dados.orcamentoId,
      paciente_id: dados.pacienteId,
      dentista_id: dentistaId,
      clinica_id: sessao.clinica_id,
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

  // Verificar se o total pago agora cobre o orçamento → auto-aprovar
  let autoAprovado = false;
  const { data: orcRow } = await supabase
    .from("orcamentos")
    .select("total, status")
    .eq("id", dados.orcamentoId)
    .eq("clinica_id", sessao.clinica_id)
    .single();

  if (orcRow && orcRow.status !== "aprovado") {
    const { data: pagamentos } = await supabase
      .from("pagamentos")
      .select("valor")
      .eq("orcamento_id", dados.orcamentoId)
      .eq("status", "pago");

    const totalPago = (pagamentos ?? []).reduce((s, p) => s + p.valor, 0);
    if (totalPago >= (orcRow.total ?? 0)) {
      await supabase
        .from("orcamentos")
        .update({ status: "aprovado" })
        .eq("id", dados.orcamentoId)
        .eq("clinica_id", sessao.clinica_id);
      autoAprovado = true;
    }
  }

  // Secretária registrando pagamento → notifica o dentista do orçamento
  if (sessao.role === 'secretaria' && dados.dentistaId) {
    const { data: pac } = await supabase
      .from('pacientes').select('nome').eq('id', dados.pacienteId).maybeSingle();
    const pacNome = (pac as { nome: string } | null)?.nome ?? 'paciente';
    const valorFmt = dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await inserirNotificacao(supabase, {
      clinicaId:    sessao.clinica_id,
      paraRole:     'admin',
      deDentistaId: dados.dentistaId,
      tipo:         'briefing',
      titulo:       `Pagamento recebido — ${pacNome}`,
      mensagem:     `Secretária registrou ${valorFmt} (${dados.formaPagamento.replace(/_/g, ' ')}) do paciente ${pacNome}.`,
      href:         '/dashboard/orcamentos',
    });
  }

  revalidatePath("/dashboard/orcamentos");
  return { id: data.id, autoAprovado };
}

/**
 * Edita os itens de um orçamento (delete + reinsert) e atualiza o total.
 */
export async function editarOrcamento(
  orcamentoId: string,
  itens: Array<{
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    procedimento_id?: string | null;
  }>,
  desconto = 0
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");
  const clinicaId = dentista.clinica_id;

  const supabase = await createClient();

  const { error: delError } = await supabase
    .from("orcamento_itens")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicaId);

  if (delError) return { error: delError.message };

  const itensInsert = itens.map((item) => ({
    orcamento_id: orcamentoId,
    clinica_id: clinicaId,
    descricao: item.descricao,
    procedimento_id: item.procedimento_id ?? null,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    preco_total: item.quantidade * item.preco_unitario,
  }));

  const { error: insError } = await supabase.from("orcamento_itens").insert(itensInsert);
  if (insError) return { error: insError.message };

  const subtotal = itens.reduce((sum, i) => sum + i.quantidade * i.preco_unitario, 0);
  const total = Math.max(0, subtotal - desconto);

  const { error: updError } = await supabase
    .from("orcamentos")
    .update({ total, desconto })
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicaId);

  if (updError) return { error: updError.message };

  revalidatePath("/dashboard/orcamentos");
  return {};
}

/**
 * Registra pagamento rápido (dinheiro ou pix) e marca o orçamento como aprovado.
 * Usada pela secretária via botões de ação rápida.
 */
export async function registrarPagamentoRapido(dados: {
  orcamentoId: string;
  pacienteId: string;
  total: number;
  formaPagamento: FormaPagamento;
  /** dentista_id do orçamento — necessário quando quem registra é a secretária */
  dentistaId?: string;
}): Promise<{ error?: string; id?: string }> {
  const sessao = await getDentistaCached();
  if (!sessao) redirect("/login");

  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  const dentistaId = dados.dentistaId ?? sessao.id;

  const { data, error } = await supabase
    .from("pagamentos")
    .insert({
      orcamento_id: dados.orcamentoId,
      paciente_id: dados.pacienteId,
      dentista_id: dentistaId,
      clinica_id: sessao.clinica_id,
      valor: dados.total,
      status: "pago",
      forma_pagamento: dados.formaPagamento,
      data_pagamento: hoje,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Marca orçamento como aprovado automaticamente
  await supabase
    .from("orcamentos")
    .update({ status: "aprovado" })
    .eq("id", dados.orcamentoId)
    .eq("clinica_id", sessao.clinica_id);

  // Secretária registrando → notifica o dentista
  if (sessao.role === 'secretaria' && dados.dentistaId) {
    const { data: pac } = await supabase
      .from('pacientes').select('nome').eq('id', dados.pacienteId).maybeSingle();
    const pacNome = (pac as { nome: string } | null)?.nome ?? 'paciente';
    const valorFmt = dados.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await inserirNotificacao(supabase, {
      clinicaId:    sessao.clinica_id,
      paraRole:     'admin',
      deDentistaId: dados.dentistaId,
      tipo:         'briefing',
      titulo:       `Pagamento recebido — ${pacNome}`,
      mensagem:     `Secretária registrou ${valorFmt} (${dados.formaPagamento.replace(/_/g, ' ')}) de ${pacNome}. Orçamento aprovado.`,
      href:         '/dashboard/orcamentos',
    });
  }

  revalidatePath("/dashboard/orcamentos");
  return { id: data.id };
}

/**
 * Exclui um orçamento junto com seus itens e pagamentos.
 */
export async function excluirOrcamento(
  orcamentoId: string,
  pacienteId?: string
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");
  const clinicaId = dentista.clinica_id;

  const supabase = await createClient();

  await supabase
    .from("pagamentos")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicaId);

  await supabase
    .from("orcamento_itens")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicaId);

  const { error } = await supabase
    .from("orcamentos")
    .delete()
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicaId);

  if (error) return { error: error.message };

  if (pacienteId) revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  revalidatePath("/dashboard/orcamentos");
  return {};
}
