"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { inserirNotificacao } from "@/lib/notificacoes";
import { registrarLog } from "@/lib/activity-log";

export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "boleto"
  | "outro";

export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado";

export async function atualizarStatusOrcamento(
  orcamentoId: string,
  status: StatusOrcamento
): Promise<{ error?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id, nome")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const updateData: Record<string, unknown> = { status };
  if (status === 'aprovado') {
    updateData.aprovado_por_id = dentistaPerfil.id;
    updateData.aprovado_em     = new Date().toISOString();
  }

  const { error } = await supabase
    .from("orcamentos")
    .update(updateData)
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicId);

  if (error) {
    console.error("Erro ao atualizar status do orçamento:", error);
    return { error: 'Não foi possível atualizar o orçamento. Tente novamente.' };
  }

  if (status === 'enviado' || status === 'aprovado' || status === 'recusado') {
    const { data: orc } = await supabase
      .from('orcamentos')
      .select('paciente_id, dentista_id, total, paciente:pacientes(nome)')
      .eq('id', orcamentoId)
      .maybeSingle();

    const pacNome   = (orc?.paciente as unknown as { nome: string } | null)?.nome ?? 'paciente';
    const actionLog = status === 'aprovado' ? 'orcamento.aprovado' as const
      : status === 'enviado' ? 'orcamento.enviado' as const
      : 'orcamento.recusado' as const;

    registrarLog(supabase, {
      clinicaId:   clinicId,
      actorId:     dentistaPerfil.id,
      actorNome:   (dentistaPerfil as { id: string; nome: string }).nome,
      pacienteId:  orc?.paciente_id as string | undefined,
      entityType:  'orcamento',
      entityId:    orcamentoId,
      action:      actionLog,
      metadata:    { paciente_nome: pacNome, status_anterior: null, status_novo: status },
    });

    if (status === 'recusado') return {};

    await inserirNotificacao(supabase, {
      clinicaId:    clinicId,
      paraRole:     'secretaria',
      deDentistaId: dentistaPerfil.id,
      tipo:         status === 'enviado' ? 'orcamento_enviado' : 'briefing',
      titulo:       status === 'enviado'
        ? `Orçamento enviado — ${pacNome}`
        : `Orçamento aprovado — ${pacNome}`,
      mensagem:     status === 'enviado'
        ? `Orçamento de ${pacNome} enviado. Acompanhe o retorno e faça o follow-up se necessário.`
        : `Orçamento de ${pacNome} foi aprovado pelo dentista.`,
      href:         '/dashboard/orcamentos',
    });

    if (status === 'aprovado' && orc && orc.total && orc.total > 0) {
      const { count } = await supabase
        .from('pagamentos')
        .select('id', { count: 'exact', head: true })
        .eq('orcamento_id', orcamentoId);

      if ((count ?? 0) === 0) {
        await supabase.from('pagamentos').insert({
          orcamento_id:    orcamentoId,
          paciente_id:     orc.paciente_id as string,
          dentista_id:     orc.dentista_id as string,
          clinica_id:      clinicId,
          valor:           orc.total as number,
          status:          'pendente',
          forma_pagamento: null,
          data_pagamento:  null,
          data_vencimento: null,
        });
      }
    }
  }

  return {};
}

export async function marcarPagamentoPago(
  pagamentoId: string,
  formaPagamento: FormaPagamento
): Promise<{ error?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const hoje = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("pagamentos")
    .update({
      status:          "pago",
      forma_pagamento: formaPagamento,
      data_pagamento:  hoje,
      marcado_por_id:  dentistaPerfil.id,
    })
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicId);

  if (error) {
    console.error("Erro ao marcar pagamento como pago:", error);
    return { error: 'Não foi possível registrar o pagamento. Tente novamente.' };
  }

  revalidatePath('/dashboard/financeiro');
  return {};
}

export async function criarOrcamento(dados: {
  pacienteId: string;
  desconto?: number;
  itens: Array<{
    procedimentoId: string | null;
    descricao: string;
    quantidade: number;
    precoUnitario: number;
  }>;
  dentistaId?: string;
  /** Ficha de origem do orçamento — vincula orçamento↔ficha p/ a apresentação não vazar entre tratamentos. */
  fichaId?: string | null;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const dentistaAlvoId = dados.dentistaId ?? dentistaPerfil.id;

  const subtotal = dados.itens.reduce(
    (sum, item) => sum + item.quantidade * item.precoUnitario,
    0
  );
  const desconto = dados.desconto ?? 0;
  const total = Math.max(0, subtotal - desconto);

  const { data: orc, error: orcError } = await supabase
    .from("orcamentos")
    .insert({
      clinica_id:   clinicId,
      dentista_id:  dentistaAlvoId,
      paciente_id:  dados.pacienteId,
      ...(dados.fichaId != null && { ficha_id: dados.fichaId }),
      status:       "rascunho",
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
    orcamento_id:    orc.id,
    clinica_id:      clinicId,
    descricao:       item.descricao,
    procedimento_id: item.procedimentoId ?? null,
    quantidade:      item.quantidade,
    preco_unitario:  item.precoUnitario,
    preco_total:     item.quantidade * item.precoUnitario,
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

export async function registrarPagamento(dados: {
  orcamentoId: string;
  pacienteId: string;
  valor: number;
  formaPagamento: FormaPagamento;
  data: string;
  dataVencimento?: string;
  dentistaId?: string;
}): Promise<{ error?: string; id?: string; autoAprovado?: boolean }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const dentistaId = dados.dentistaId ?? dentistaPerfil.id;
  const hoje = new Date().toISOString().split('T')[0];
  const isAgendado = dados.dataVencimento && dados.dataVencimento > hoje;

  const { data, error } = await supabase
    .from("pagamentos")
    .insert({
      orcamento_id:    dados.orcamentoId,
      paciente_id:     dados.pacienteId,
      dentista_id:     dentistaId,
      clinica_id:      clinicId,
      valor:           dados.valor,
      status:          isAgendado ? 'pendente' : 'pago',
      forma_pagamento: isAgendado ? null : dados.formaPagamento,
      data_pagamento:  isAgendado ? null : dados.data,
      data_vencimento: dados.dataVencimento ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  let autoAprovado = false;
  const { data: orcRow } = await supabase
    .from("orcamentos")
    .select("total, status")
    .eq("id", dados.orcamentoId)
    .eq("clinica_id", clinicId)
    .single();

  if (orcRow && orcRow.status === "enviado") {
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
        .eq("clinica_id", clinicId);
      autoAprovado = true;
    }
  }

  if (role === 'secretaria' && dados.dentistaId) {
    const { data: pac } = await supabase
      .from('pacientes').select('nome').eq('id', dados.pacienteId).maybeSingle();
    const pacNome = (pac as { nome: string } | null)?.nome ?? 'paciente';
    const valorFmt = dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: dados.dentistaId,
      deDentistaId:   dentistaPerfil.id,
      tipo:           'pagamento_confirmado',
      titulo:         `Pagamento recebido — ${pacNome}`,
      mensagem:       `Secretária registrou ${valorFmt} (${dados.formaPagamento.replace(/_/g, ' ')}) do paciente ${pacNome}.`,
      href:           '/dashboard/orcamentos',
    });
  }

  registrarLog(supabase, {
    clinicaId:   clinicId,
    actorId:     dentistaPerfil.id,
    pacienteId:  dados.pacienteId,
    entityType:  'pagamento',
    entityId:    data.id,
    action:      'pagamento.registrado',
    metadata:    { valor: dados.valor, forma: dados.formaPagamento, orcamento_id: dados.orcamentoId },
  });

  revalidatePath("/dashboard/orcamentos");
  revalidatePath('/dashboard/financeiro');
  return { id: data.id, autoAprovado };
}

export async function editarPagamento(
  pagamentoId: string,
  dados: { valor: number; formaPagamento: FormaPagamento; data: string },
): Promise<{ error?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: pagAtual } = await supabase
    .from("pagamentos")
    .select("id, paciente_id")
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!pagAtual) {
    return { error: "Pagamento não encontrado." };
  }

  const { error } = await supabase
    .from("pagamentos")
    .update({
      valor:           dados.valor,
      forma_pagamento: dados.formaPagamento,
      data_pagamento:  dados.data,
    })
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicId);

  if (error) {
    return { error: error.message };
  }

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  registrarLog(supabase, {
    clinicaId:   clinicId,
    actorId:     dentistaPerfil?.id ?? null,
    pacienteId:  pagAtual.paciente_id,
    entityType:  'pagamento',
    entityId:    pagamentoId,
    action:      'pagamento.editado',
    metadata:    { valor: dados.valor, forma: dados.formaPagamento },
  });

  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/financeiro");
  return {};
}

export async function excluirPagamento(
  pagamentoId: string,
): Promise<{ error?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: pagAtual } = await supabase
    .from("pagamentos")
    .select("id, paciente_id, valor, forma_pagamento")
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!pagAtual) {
    return { error: "Pagamento não encontrado." };
  }

  const { error } = await supabase
    .from("pagamentos")
    .delete()
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicId);

  if (error) {
    return { error: error.message };
  }

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  registrarLog(supabase, {
    clinicaId:   clinicId,
    actorId:     dentistaPerfil?.id ?? null,
    pacienteId:  pagAtual.paciente_id,
    entityType:  'pagamento',
    entityId:    pagamentoId,
    action:      'pagamento.excluido',
    metadata:    { valor: pagAtual.valor, forma: pagAtual.forma_pagamento },
  });

  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/financeiro");
  return {};
}

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
  const { supabase, clinicId } = await requireClinicContext();

  const { error: delError } = await supabase
    .from("orcamento_itens")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicId);

  if (delError) return { error: delError.message };

  const itensInsert = itens.map((item) => ({
    orcamento_id:    orcamentoId,
    clinica_id:      clinicId,
    descricao:       item.descricao,
    procedimento_id: item.procedimento_id ?? null,
    quantidade:      item.quantidade,
    preco_unitario:  item.preco_unitario,
    preco_total:     item.quantidade * item.preco_unitario,
  }));

  const { error: insError } = await supabase.from("orcamento_itens").insert(itensInsert);
  if (insError) return { error: insError.message };

  const subtotal = itens.reduce((sum, i) => sum + i.quantidade * i.preco_unitario, 0);
  const total = Math.max(0, subtotal - desconto);

  const { error: updError } = await supabase
    .from("orcamentos")
    .update({ total, desconto })
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicId);

  if (updError) return { error: updError.message };

  revalidatePath("/dashboard/orcamentos");
  return {};
}

export async function registrarPagamentoRapido(dados: {
  orcamentoId: string;
  pacienteId: string;
  total: number;
  formaPagamento: FormaPagamento;
  dentistaId?: string;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const dentistaId = dados.dentistaId ?? dentistaPerfil.id;
  const hoje = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("pagamentos")
    .insert({
      orcamento_id:    dados.orcamentoId,
      paciente_id:     dados.pacienteId,
      dentista_id:     dentistaId,
      clinica_id:      clinicId,
      valor:           dados.total,
      status:          "pago",
      forma_pagamento: dados.formaPagamento,
      data_pagamento:  hoje,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("orcamentos")
    .update({ status: "aprovado" })
    .eq("id", dados.orcamentoId)
    .eq("clinica_id", clinicId);

  if (role === 'secretaria' && dados.dentistaId) {
    const { data: pac } = await supabase
      .from('pacientes').select('nome').eq('id', dados.pacienteId).maybeSingle();
    const pacNome = (pac as { nome: string } | null)?.nome ?? 'paciente';
    const valorFmt = dados.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: dados.dentistaId,
      deDentistaId:   dentistaPerfil.id,
      tipo:           'pagamento_confirmado',
      titulo:         `Pagamento recebido — ${pacNome}`,
      mensagem:       `Secretária registrou ${valorFmt} (${dados.formaPagamento.replace(/_/g, ' ')}) de ${pacNome}. Orçamento aprovado.`,
      href:           '/dashboard/orcamentos',
    });
  }

  revalidatePath("/dashboard/orcamentos");
  revalidatePath('/dashboard/financeiro');
  return { id: data.id };
}

export async function excluirOrcamento(
  orcamentoId: string,
  pacienteId?: string
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  // Protege exclusão de orçamentos com pagamentos já registrados
  const { count: pagoCount } = await supabase
    .from('pagamentos')
    .select('id', { count: 'exact', head: true })
    .eq('orcamento_id', orcamentoId)
    .eq('clinica_id', clinicId)
    .eq('status', 'pago');

  if ((pagoCount ?? 0) > 0) {
    return { error: 'Este orçamento possui pagamentos registrados. Altere o status antes de excluir.' };
  }

  await supabase
    .from("pagamentos")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicId);

  await supabase
    .from("orcamento_itens")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicId);

  const { error } = await supabase
    .from("orcamentos")
    .delete()
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };

  if (pacienteId) revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  revalidatePath("/dashboard/orcamentos");
  return {};
}

/**
 * Cadastro rápido de procedimento a partir do orçamento — quando o item digitado não
 * corresponde a nada no catálogo. Qualquer dentista da clínica pode usar (não só admin;
 * ver migration 083). Catálogo é privado por dentista (migration 084) — o procedimento
 * nasce vinculado a quem criou, nunca a um id vindo do cliente. Editar/excluir o catálogo
 * completo continua em Configurações.
 */
export async function criarProcedimentoRapido(dados: {
  nome: string;
  precoPadrao: number | null;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const nome = dados.nome.trim();
  if (!nome) return { error: "Informe o nome do procedimento." };

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { error: "Perfil de dentista não encontrado." };

  const { data, error } = await supabase
    .from("procedimentos")
    .insert({
      clinica_id:   clinicId,
      dentista_id:  dentistaPerfil.id,
      nome,
      preco_padrao: dados.precoPadrao,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao cadastrar procedimento:", error);
    return { error: "Não foi possível cadastrar o procedimento. Tente novamente." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { id: (data as { id: string }).id };
}
