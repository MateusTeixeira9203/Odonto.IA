"use server";

import { z } from "zod";
import { composicaoGrupoSchema, observacaoAcordoSchema } from "@/lib/orcamentos/grupos";
import { requireClinicContext } from "@/server/auth/clinic";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { inserirNotificacao } from "@/lib/notificacoes";
import { registrarLog } from "@/lib/activity-log";
import { deriveEstadoOrcamento, orcamentoAceitaPagamento, type EstadoOrcamento } from "@/lib/orcamentos/estado";
import { hojeBRT } from "@/lib/hora-brt";
import { ERRO_ORCAMENTO_SEM_APROVACAO } from "@/server/orcamentos/pagamento-guards";
import { criarDocumentoAceiteOrcamento } from '@/server/legal/documentos-aceite';
import { normalizarNomeProcedimento } from '@/lib/arcadas';

export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "boleto"
  | "outro";

export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado";

const formaPagamentoSchema = z.enum([
  'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro',
]);
const recebimentoSchema = z.object({
  orcamentoId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  valor: z.number().finite().positive().multipleOf(0.01),
  formaPagamento: formaPagamentoSchema,
  data: z.string().date(),
  dentistaId: z.string().uuid().optional(),
});
const reorganizarParcelasSchema = z.object({
  orcamentoId: z.string().uuid(),
  valorAcordado: z.number().finite().positive().multipleOf(0.01),
  parcelas: z.array(z.object({
    valor: z.number().finite().positive().multipleOf(0.01),
    dataVencimento: z.string().date(),
  })).min(0).max(24),
});
const planoAvistaSchema = z.object({
  orcamentoId: z.string().uuid(),
  valorAcordado: z.number().finite().positive().multipleOf(0.01),
  entradaValor: z.number().finite().min(0).multipleOf(0.01).optional(),
  entradaForma: formaPagamentoSchema.optional(),
});
const criarCobrancaEtapaSchema = z.object({
  orcamentoId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(100),
  desconto: z.number().finite().min(0).multipleOf(0.01),
  numeroParcelas: z.number().int().min(1).max(24),
  primeiroVencimento: z.string().date(),
  observacoes: observacaoAcordoSchema,
});
const recebimentoCobrancaSchema = z.object({
  cobrancaId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  valor: z.number().finite().positive().multipleOf(0.01),
  formaPagamento: formaPagamentoSchema,
  data: z.string().date(),
});
const cancelarCobrancaSchema = z.object({
  cobrancaId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  motivo: z.string().trim().min(1).max(500),
});

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcCall = (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;

function erroFinanceiro(message: string): string {
  if (message.includes('orcamento_sem_aprovacao')) return ERRO_ORCAMENTO_SEM_APROVACAO;
  if (message.includes('valor_acima_do_saldo')) return 'O recebimento não pode ultrapassar o saldo do orçamento.';
  if (message.includes('valor_menor_que_recebido')) return 'O valor combinado não pode ser menor que o total já recebido.';
  if (message.includes('parcelas_nao_fecham_saldo')) return 'A soma das parcelas precisa ser exatamente igual ao saldo.';
  if (message.includes('numero_parcelas_invalido')) return 'Informe entre 2 e 24 parcelas.';
  if (message.includes('forma_invalida')) return 'Selecione uma forma de pagamento válida.';
  if (message.includes('recebimento_indisponivel')) return 'Somente um recebimento confirmado pode ser corrigido ou estornado.';
  if (message.includes('previsao_indisponivel')) return 'Esta previsão não está mais disponível. Recarregue a página.';
  if (message.includes('motivo_invalido')) return 'Informe o motivo do estorno (até 500 caracteres).';
  if (message.includes('itens_invalidos')) return 'Selecione ao menos um procedimento para cobrar nesta etapa.';
  if (message.includes('item_nao_aprovado')) return 'A etapa só pode cobrar procedimentos aprovados pelo paciente.';
  if (message.includes('item_ja_cobrado')) return 'Um dos procedimentos já pertence a outra cobrança ativa.';
  if (message.includes('desconto_acima_subtotal')) return 'O desconto não pode ser maior que os procedimentos selecionados.';
  if (message.includes('desconto_invalido')) return 'Informe um desconto válido.';
  if (message.includes('cobranca_indisponivel')) return 'Esta cobrança não está mais disponível. Recarregue a página.';
  if (message.includes('cobranca_com_recebimento')) return 'Uma cobrança com recebimento não pode ser cancelada.';
  if (message.includes('sem_permissao')) return 'Você não tem permissão para alterar este orçamento.';
  return 'Não foi possível concluir a alteração financeira. Tente novamente.';
}

const FORMA_LABEL: Record<FormaPagamento, string> = {
  dinheiro: "dinheiro", pix: "PIX", cartao_credito: "cartão de crédito",
  cartao_debito: "cartão de débito", boleto: "boleto", outro: "outro",
};

const fmtReal = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Embed usado por toda action que precisa derivar o estado (R-114). Uma query, não três. */
const SELECT_ORC_PARA_ESTADO =
  'id, paciente_id, dentista_id, valor_acordado, enviado_em, ' +
  'orcamento_itens(id, preco_total, aprovado), pagamentos(valor, status), paciente:pacientes(nome)';

type OrcParaEstado = {
  id: string;
  paciente_id: string;
  dentista_id: string;
  valor_acordado: number | null;
  enviado_em: string | null;
  orcamento_itens: { id: string; preco_total: number | null; aprovado: boolean }[] | null;
  pagamentos: { valor: number; status: string }[] | null;
  paciente: { nome: string } | null;
};

const derivarDoOrc = (orc: OrcParaEstado, itensOverride?: { preco_total: number | null; aprovado: boolean }[]) =>
  deriveEstadoOrcamento({
    valorAcordado: orc.valor_acordado,
    itens: (itensOverride ?? orc.orcamento_itens ?? []).map((i) => ({
      precoTotal: i.preco_total,
      aprovado: i.aprovado,
    })),
    pagamentos: (orc.pagamentos ?? []).map((p) => ({ valor: p.valor, status: p.status })),
  });

/**
 * R-114 — avisa a recepção quando o orçamento sai de "proposto" pela primeira vez. Substitui a
 * notificação que `atualizarStatusOrcamento('aprovado')` disparava. Dispara UMA vez por
 * orçamento, na transição de zero aprovado pra algum (I11) — não uma por item marcado.
 */
async function notificarAceite(
  supabase: Awaited<ReturnType<typeof requireClinicContext>>['supabase'],
  clinicId: string,
  dentistaId: string,
  orc: OrcParaEstado,
) {
  const pacNome = orc.paciente?.nome ?? 'paciente';
  registrarLog(supabase, {
    clinicaId:  clinicId,
    actorId:    dentistaId,
    pacienteId: orc.paciente_id,
    entityType: 'orcamento',
    entityId:   orc.id,
    action:     'orcamento.aprovado',
    metadata:   { paciente_nome: pacNome },
  });
  await inserirNotificacao(supabase, {
    clinicaId:    clinicId,
    paraRole:     'secretaria',
    deDentistaId: dentistaId,
    tipo:         'briefing',
    titulo:       `Orçamento aceito — ${pacNome}`,
    mensagem:     `${pacNome} aprovou procedimentos do orçamento. Já pode receber.`,
    href:         `/dashboard/pacientes/${orc.paciente_id}`,
  });
}

/**
 * R-114 — o paciente aceitou (ou desmarcou) UM procedimento.
 * RLS: `orcamento_itens_update` já libera dono e secretária (decisão dele: os dois aprovam).
 */
export async function alternarAprovacaoItem(
  itemId: string,
  aprovado: boolean,
): Promise<{ error?: string; estado?: EstadoOrcamento; valorDevido?: number }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();

  const { data: item } = await supabase
    .from('orcamento_itens')
    .select('id, orcamento_id, aprovado')
    .eq('id', itemId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!item) return { error: 'Procedimento não encontrado.' };

  const { data: orcRaw } = await supabase
    .from('orcamentos')
    .select(SELECT_ORC_PARA_ESTADO)
    .eq('id', item.orcamento_id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  const orc = orcRaw as unknown as OrcParaEstado | null;
  if (!orc) return { error: 'Orçamento não encontrado.' };

  const antes = derivarDoOrc(orc);

  // Estado que o clique produziria — calculado ANTES de gravar, pra poder recusar.
  const itensDepois = (orc.orcamento_itens ?? []).map((i) =>
    i.id === itemId ? { ...i, aprovado } : i,
  );
  const depois = derivarDoOrc(orc, itensDepois);

  // I9 — desmarcar não pode deixar o devido abaixo do que já entrou. Não existe crédito de
  // paciente no sistema, e este item não cria um (decisão dele, 16/08).
  if (!aprovado && depois.valorDevido < depois.valorPago) {
    return {
      error: `Não dá pra remover: este orçamento já recebeu ${fmtReal(depois.valorPago)}. Estorne o pagamento antes.`,
    };
  }

  if (item.aprovado === aprovado) return { estado: antes.estado, valorDevido: antes.valorDevido };

  // Confere linhas afetadas — RLS barrada devolve sucesso com 0 linhas (R-66/R-113).
  const { data: atualizados, error } = await supabase
    .from('orcamento_itens')
    .update({ aprovado })
    .eq('id', itemId)
    .eq('clinica_id', clinicId)
    .select('id');

  if (error) return { error: error.message };
  if (!atualizados || atualizados.length === 0) {
    return { error: 'Você não tem permissão para alterar os procedimentos deste orçamento.' };
  }

  if (antes.valorAprovado === 0 && depois.valorAprovado > 0) {
    await notificarAceite(supabase, clinicId, dentistaId, orc);
  }

  revalidatePath(`/dashboard/pacientes/${orc.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { estado: depois.estado, valorDevido: depois.valorDevido };
}

/**
 * R-114 — o atalho de 1 clique (pedido dele, 16/08). O caso comum de balcão é o paciente
 * aceitar tudo; sem isto, receber passaria a exigir marcar N caixas antes — atrito novo bem
 * na frente do caixa. Um UPDATE só, nunca N chamadas de `alternarAprovacaoItem`.
 * Direção única: não existe "desmarcar tudo" (é a direção destrutiva, e bate na I9).
 */
export async function aprovarTodosItens(
  orcamentoId: string,
): Promise<{ error?: string; itensAprovados?: number; estado?: EstadoOrcamento }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();

  const { data: orcRaw } = await supabase
    .from('orcamentos')
    .select(SELECT_ORC_PARA_ESTADO)
    .eq('id', orcamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  const orc = orcRaw as unknown as OrcParaEstado | null;
  if (!orc) return { error: 'Orçamento não encontrado.' };

  const antes = derivarDoOrc(orc);
  const pendentes = (orc.orcamento_itens ?? []).filter((i) => !i.aprovado).length;

  // I10 — zero linha afetada é AMBÍGUO aqui: pode ser "já estava tudo aprovado" (sucesso) ou
  // RLS barrada (erro). Por isso a contagem de não-aprovados vem antes e decide qual é.
  if (pendentes === 0) return { itensAprovados: 0, estado: antes.estado };

  const { data: atualizados, error } = await supabase
    .from('orcamento_itens')
    .update({ aprovado: true })
    .eq('orcamento_id', orcamentoId)
    .eq('clinica_id', clinicId)
    .eq('aprovado', false)
    .select('id');

  if (error) return { error: error.message };
  if (!atualizados || atualizados.length === 0) {
    return { error: 'Você não tem permissão para alterar os procedimentos deste orçamento.' };
  }

  const depois = derivarDoOrc(
    orc,
    (orc.orcamento_itens ?? []).map((i) => ({ ...i, aprovado: true })),
  );

  if (antes.valorAprovado === 0 && depois.valorAprovado > 0) {
    await notificarAceite(supabase, clinicId, dentistaId, orc);
  }

  revalidatePath(`/dashboard/pacientes/${orc.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { itensAprovados: atualizados.length, estado: depois.estado };
}

/**
 * R-114 — marca que a proposta foi mostrada ao paciente. `enviado_em` existe desde a migration
 * 001 e nunca foi escrita por nada; é ela que passa a sustentar os alertas de "orçamento parado
 * há X dias" (hoje baseados em `updated_at`, que muda por qualquer motivo). Idempotente.
 */
export async function marcarOrcamentoEnviado(
  orcamentoId: string,
): Promise<{ error?: string }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();

  const { data: atualizados, error } = await supabase
    .from('orcamentos')
    .update({ enviado_em: new Date().toISOString() })
    .eq('id', orcamentoId)
    .eq('clinica_id', clinicId)
    .is('enviado_em', null)
    .select('id, paciente_id');

  if (error) return { error: error.message };
  if (!atualizados || atualizados.length === 0) return {}; // já estava enviado — idempotente

  registrarLog(supabase, {
    clinicaId:  clinicId,
    actorId:    dentistaId,
    pacienteId: atualizados[0].paciente_id as string | undefined,
    entityType: 'orcamento',
    entityId:   orcamentoId,
    action:     'orcamento.enviado',
    metadata:   {},
  });

  revalidatePath('/dashboard/orcamentos');
  return {};
}

/**
 * R-114 — a tela de `/dashboard/orcamentos` (secretária, layout antigo) ainda usa o
 * dropdown de status; o redesenho dela é trabalho à parte, combinado pra depois. Esta
 * função continua existindo pra não quebrar aquele fluxo AGORA, mas ganhou uma ponte:
 * "aprovado" por aqui também aprova todos os itens (mesmo efeito de `aprovarTodosItens`).
 * Sem isso, a secretária aprovaria pelo dropdown antigo, os itens ficariam com
 * `aprovado=false`, `estado` continuaria 'proposto', e o guard da I8 bloquearia
 * qualquer pagamento — quebrando o fluxo dela sob o modelo novo.
 */
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

  if (status === 'aprovado') {
    // Ponte — ver docstring. Erro aqui não desfaz o status (já gravado); loga e segue,
    // porque o dropdown antigo não tem onde mostrar um segundo erro.
    const resultado = await aprovarTodosItens(orcamentoId);
    if (resultado.error) {
      console.error('[atualizarStatusOrcamento] ponte pra aprovarTodosItens falhou:', resultado.error);
    }
  }

  if (status === 'enviado' || status === 'aprovado' || status === 'recusado') {
    const { data: orc } = await supabase
      .from('orcamentos')
      .select('paciente_id, dentista_id, total, valor_acordado, plano_forma, paciente:pacientes(nome)')
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
      href:         orc?.paciente_id ? `/dashboard/pacientes/${orc.paciente_id}` : '/dashboard/pacientes',
    });

    // R-114 — a linha de pagamento pendente automática (nascia com o total cheio ao aprovar
    // sem plano) SAIU. Era a origem de boa parte do saldo fantasma: nascia pendente e nunca
    // fechava, porque recebimento entrava como linha nova em vez de fechar essa. No modelo
    // derivado "falta receber" é `valor_devido - valor_pago` — não precisa de linha nenhuma
    // pra existir. Decisão dele, 16/08.
  }

  return {};
}

/** R-38 — controle "mostrar valor por procedimento" no momento de gerar/enviar o PDF.
 *  Só apresentação: `orcamento_itens` continua gravando os valores de sempre. */
export async function atualizarMostrarValorPorItem(
  orcamentoId: string,
  mostrar: boolean
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { error } = await supabase
    .from("orcamentos")
    .update({ mostrar_valor_por_item: mostrar })
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicId);

  if (error) {
    console.error("Erro ao atualizar exibição de valores do orçamento:", error);
    return { error: 'Não foi possível atualizar. Tente novamente.' };
  }

  return {};
}

export interface ParcelaGerada {
  id: string;
  valor: number;
  data_vencimento: string;
  parcela_numero: number;
  total_parcelas: number;
}

export async function reorganizarParcelas(dados: {
  orcamentoId: string;
  valorAcordado: number;
  parcelas: { valor: number; dataVencimento: string }[];
}): Promise<{ error?: string; parcelas?: ParcelaGerada[] }> {
  const parsed = reorganizarParcelasSchema.safeParse(dados);
  if (!parsed.success) return { error: 'Revise o valor combinado e as parcelas da previsão.' };

  const { supabase, clinicId } = await requireClinicContext();
  const { data: orcamento } = await supabase
    .from('orcamentos')
    .select('paciente_id')
    .eq('id', parsed.data.orcamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();
  if (!orcamento) return { error: 'Orçamento não encontrado.' };

  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { data, error } = await rpc('reorganizar_parcelas_orcamento', {
    p_orcamento_id: parsed.data.orcamentoId,
    p_valor_acordado: parsed.data.valorAcordado,
    p_parcelas: parsed.data.parcelas.map((parcela) => ({
      valor: parcela.valor,
      data_vencimento: parcela.dataVencimento,
    })),
  });
  if (error) return { error: erroFinanceiro(error.message) };

  revalidatePath(`/dashboard/pacientes/${orcamento.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { parcelas: (data ?? []) as ParcelaGerada[] };
}

/**
 * Gera N parcelas de uma vez (todas 'pendente'), em vez do dentista/secretária
 * repetir "Registrar Pagamento" uma por uma. R-34 commit 3: a divisão em centavos,
 * as datas por mês calendário e a gravação do plano viraram RPC (`gerar_parcelas_orcamento`,
 * migration 122/123) — mesma transação, então plano e parcelas nunca ficam dessincronizados.
 * A RPC soma o que já está pago e desconta antes de dividir: chamar isto num orçamento com
 * pagamento avulso parcela o **saldo**, não o total (era o cálculo que o client fazia sozinho
 * antes — agora é o banco que soma, não dá pra confiar em saldo calculado no browser).
 * `valorAcordado` some quando não passado: mantém o que já está no orçamento (total ou o que
 * já tiver sido negociado).
 */
export async function gerarParcelas(dados: {
  orcamentoId: string;
  numeroParcelas: number;
  primeiroVencimento: string;
  valorAcordado?: number;
  entradaValor?: number;
  entradaForma?: FormaPagamento;
  parcelasForma?: FormaPagamento;
}): Promise<{ error?: string; parcelas?: ParcelaGerada[] }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  if (!Number.isInteger(dados.numeroParcelas) || dados.numeroParcelas < 2 || dados.numeroParcelas > 24) {
    return { error: "Número de parcelas deve ser entre 2 e 24." };
  }
  if (!dados.primeiroVencimento) {
    return { error: "Informe a data do primeiro vencimento." };
  }

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id, nome")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const { data: parcelas, error } = await supabase.rpc("gerar_parcelas_orcamento", {
    p_orcamento_id:        dados.orcamentoId,
    p_numero_parcelas:     dados.numeroParcelas,
    p_primeiro_vencimento: dados.primeiroVencimento,
    p_valor_acordado:      dados.valorAcordado ?? null,
    p_entrada_valor:       dados.entradaValor ?? null,
    p_entrada_forma:       dados.entradaForma ?? null,
    p_parcelas_forma:      dados.parcelasForma ?? null,
  });

  if (error) {
    if (error.message.includes("numero_parcelas_invalido")) return { error: "Número de parcelas deve ser entre 2 e 24." };
    if (error.message.includes("valor_invalido")) return { error: "Não há valor pendente para parcelar." };
    if (error.message.includes("vencimento_invalido")) return { error: "Informe a data do primeiro vencimento." };
    if (error.message.includes("plano_ja_definido")) return { error: "Este orçamento já tem forma de pagamento definida." };
    if (error.message.includes("sem_permissao")) return { error: "Orçamento não encontrado." };
    console.error("[gerarParcelas]", error.message);
    return { error: "Não foi possível gerar as parcelas. Tente novamente." };
  }

  const linhas = (parcelas ?? []) as unknown as ParcelaGerada[];

  // I5 — condicoes_pagamento nasce só aqui, a partir do que a RPC acabou de gravar.
  const partes: string[] = [];
  if (dados.entradaValor) {
    partes.push(`Entrada de ${fmtReal(dados.entradaValor)}${dados.entradaForma ? ` (${FORMA_LABEL[dados.entradaForma]})` : ""}`);
  }
  const valorPorParcela = linhas[0]?.valor ?? 0;
  partes.push(`${dados.numeroParcelas}x de ${fmtReal(valorPorParcela)}${dados.parcelasForma ? ` (${FORMA_LABEL[dados.parcelasForma]})` : ""}`);
  await supabase.from("orcamentos").update({ condicoes_pagamento: partes.join(" + ") })
    .eq("id", dados.orcamentoId).eq("clinica_id", clinicId);

  registrarLog(supabase, {
    clinicaId:  clinicId,
    actorId:    dentistaPerfil.id,
    actorNome:  dentistaPerfil.nome,
    entityType: "orcamento",
    entityId:   dados.orcamentoId,
    action:     "pagamento.parcelado",
    metadata:   { numero_parcelas: dados.numeroParcelas },
  });

  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/financeiro");
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { parcelas: linhas };
}

/**
 * Define o acordo à vista — só registra (§10.2: entrada nunca vira linha de pagamento
 * sozinha, nasce quando o dinheiro entrar). Mutuamente exclusivo com `gerarParcelas`
 * (RPC recusa se o orçamento já tem plano_forma).
 */
export async function definirPlanoAvista(dados: {
  orcamentoId: string;
  valorAcordado: number;
  entradaValor?: number;
  entradaForma?: FormaPagamento;
}): Promise<{ error?: string }> {
  const parsed = planoAvistaSchema.safeParse(dados);
  if (!parsed.success) return { error: 'Revise o valor do acordo à vista.' };

  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const { error } = await supabase.rpc("definir_plano_avista", {
    p_orcamento_id:   parsed.data.orcamentoId,
    p_valor_acordado: parsed.data.valorAcordado,
    p_entrada_valor:  parsed.data.entradaValor ?? null,
    p_entrada_forma:  parsed.data.entradaForma ?? null,
  });

  if (error) {
    if (error.message.includes("valor_invalido")) return { error: "Informe um valor válido." };
    if (error.message.includes('valor_menor_que_recebido')) return { error: "O valor combinado não pode ser menor que o já recebido." };
    if (error.message.includes("plano_ja_definido")) return { error: "Este orçamento já tem forma de pagamento definida." };
    if (error.message.includes("sem_permissao")) return { error: "Orçamento não encontrado." };
    console.error("[definirPlanoAvista]", error.message);
    return { error: "Não foi possível registrar a forma de pagamento. Tente novamente." };
  }

  const partes: string[] = [];
  if (parsed.data.entradaValor) {
    partes.push(`Entrada de ${fmtReal(parsed.data.entradaValor)}${parsed.data.entradaForma ? ` (${FORMA_LABEL[parsed.data.entradaForma]})` : ""}`);
    partes.push(`Restante à vista — ${fmtReal(parsed.data.valorAcordado - parsed.data.entradaValor)}`);
  } else {
    partes.push(`À vista — ${fmtReal(parsed.data.valorAcordado)}`);
  }
  await supabase.from("orcamentos").update({ condicoes_pagamento: partes.join(" + ") })
    .eq("id", parsed.data.orcamentoId).eq("clinica_id", clinicId);

  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/financeiro");
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return {};
}

/**
 * R-28 — fecha uma parcela pendente já existente (UPDATE), nunca insere linha nova.
 * `data` é livre (não hardcoda hoje) — é o que faltava pra fechar em data diferente de hoje
 * sem duplicar via "Registrar pagamento".
 */
export async function marcarPagamentoPago(
  pagamentoId: string,
  dados: { formaPagamento: FormaPagamento; data: string },
): Promise<{ error?: string; autoAprovado?: boolean }> {
  const parsed = z.object({
    pagamentoId: z.string().uuid(), formaPagamento: formaPagamentoSchema, data: z.string().date(),
  }).safeParse({ pagamentoId, ...dados });
  if (!parsed.success) return { error: 'Revise a data e a forma de pagamento.' };

  const { supabase } = await requireClinicContext();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { error } = await rpc('confirmar_previsao_orcamento', {
    p_pagamento_id: parsed.data.pagamentoId,
    p_forma: parsed.data.formaPagamento,
    p_data: parsed.data.data,
  });
  if (error) return { error: erroFinanceiro(error.message) };

  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return {};
}

const criarOrcamentoSchema = z.object({
  pacienteId: z.string().uuid(),
  desconto: z.number().finite().min(0).optional(),
  itens: z.array(z.object({
    procedimentoId: z.string().uuid().nullable(),
    descricao: z.string().trim().min(1).max(500),
    quantidade: z.number().int().min(1).max(99),
    precoUnitario: z.number().finite().min(0),
    eventoIds: z.array(z.string().uuid()).max(100).default([]),
    composicao: composicaoGrupoSchema.nullable().optional(),
  })).min(1).max(100),
  dentistaId: z.string().uuid().optional(),
  /** Ficha de origem do orçamento — vincula orçamento↔ficha p/ a apresentação não vazar entre tratamentos. */
  fichaId: z.string().uuid().nullable().optional(),
});

export async function criarOrcamento(dados: z.input<typeof criarOrcamentoSchema>): Promise<{ error?: string; id?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();
  const parsed = criarOrcamentoSchema.safeParse(dados);
  if (!parsed.success) {
    return { error: 'Revise os itens e os valores do orçamento antes de salvar.' };
  }
  const entrada = parsed.data;
  if (entrada.itens.some((item) => item.composicao) && (entrada.desconto ?? 0) > 0) {
    return { error: 'Ajuste o preço de cada grupo ou conceda o desconto na cobrança da etapa.' };
  }

  if (!entrada.fichaId || entrada.itens.some((item) => item.eventoIds.length === 0)) {
    return { error: 'Crie o orçamento a partir de uma ficha com procedimentos estruturados.' };
  }

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  if (dentistaPerfil.role === "secretaria") {
    if (!entrada.dentistaId) {
      return { error: "Selecione o dentista responsável pelo orçamento." };
    }
    const { data: alvo } = await supabase
      .from("dentistas")
      .select("id")
      .eq("id", entrada.dentistaId)
      .eq("clinica_id", clinicId)
      .eq("ativo", true)
      // R-94 — .neq("role","secretaria") sozinho deixaria 'protetico' virar
      // "dentista responsável" de um orçamento.
      .in("role", ["admin", "dentista"])
      .maybeSingle();
    if (!alvo) {
      return { error: "Dentista selecionado inválido." };
    }
  }

  const dentistaAlvoId = entrada.dentistaId ?? dentistaPerfil.id;
  const { data: orcamentoId, error } = await supabase.rpc(entrada.itens.some((item) => item.composicao) ? 'criar_orcamento_com_eventos_r157' : 'criar_orcamento_com_eventos', {
    p_paciente_id: entrada.pacienteId,
    p_dentista_id: dentistaAlvoId,
    p_ficha_id: entrada.fichaId ?? null,
    p_desconto: entrada.desconto ?? 0,
    p_itens: entrada.itens.map((item) => ({
      procedimento_id: item.procedimentoId,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.precoUnitario,
      evento_ids: item.eventoIds,
      composicao: item.composicao ?? null,
    })),
  });

  if (error || !orcamentoId) {
    const mensagem = error?.message ?? '';
    if (error?.code === '23505' || mensagem.includes('orcamento_evento_ja_orcado') || mensagem.includes('orcamento_evento_duplicado')) {
      return { error: 'Um dos procedimentos já entrou em outro orçamento. Recarregue a lista e tente novamente.' };
    }
    if (mensagem.includes('orcamento_evento_invalido')) {
      return { error: 'Um dos procedimentos não está mais disponível para este orçamento. Recarregue a lista.' };
    }
    if (mensagem.includes('orcamento_evento_ficha_invalido')) {
      return { error: 'Os procedimentos precisam pertencer à ficha selecionada. Reabra a ficha e tente novamente.' };
    }
    if (mensagem.includes('orcamento_procedimento_de_outro_dentista')) {
      return { error: 'O procedimento escolhido pertence a outro dentista. Recarregue o catálogo antes de continuar.' };
    }
    return { error: 'Não foi possível criar o orçamento. Nenhum item foi salvo.' };
  }

  revalidatePath(`/dashboard/pacientes/${entrada.pacienteId}`);
  revalidatePath("/dashboard/orcamentos");
  return { id: orcamentoId };
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
  if (dados.dataVencimento) {
    return { error: 'Para prever cobrança futura, use Organizar cobrança. Registrar recebimento é apenas dinheiro já recebido.' };
  }
  const parsed = recebimentoSchema.safeParse(dados);
  if (!parsed.success) return { error: 'Revise valor, data e forma de pagamento.' };

  const { supabase, clinicId, role, dentistaId: atorId } = await requireClinicContext();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { data, error } = await rpc('registrar_recebimento_orcamento', {
    p_orcamento_id: parsed.data.orcamentoId,
    p_valor: parsed.data.valor,
    p_forma: parsed.data.formaPagamento,
    p_data: parsed.data.data,
  });
  if (error) return { error: erroFinanceiro(error.message) };

  const pagamento = data as { id?: string; dentista_id?: string } | null;
  if (role === 'secretaria' && pagamento?.dentista_id && pagamento.dentista_id !== atorId) {
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('nome')
      .eq('id', parsed.data.pacienteId)
      .eq('clinica_id', clinicId)
      .maybeSingle();
    const pacienteNome = paciente?.nome ?? 'paciente';
    await inserirNotificacao(supabase, {
      clinicaId: clinicId,
      paraRole: 'dentista',
      paraDentistaId: pagamento.dentista_id,
      deDentistaId: atorId,
      tipo: 'pagamento_confirmado',
      titulo: `Pagamento recebido — ${pacienteNome}`,
      mensagem: `Secretária registrou ${fmtReal(parsed.data.valor)} (${FORMA_LABEL[parsed.data.formaPagamento]}) do paciente ${pacienteNome}.`,
      href: `/dashboard/pacientes/${parsed.data.pacienteId}`,
    });
  }
  revalidatePath(`/dashboard/pacientes/${parsed.data.pacienteId}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { id: pagamento?.id };
}

/**
 * R-145 revisão 2 — transforma somente os procedimentos escolhidos em uma cobrança real.
 * Proposta aprovada não vira dívida automaticamente; a RPC cria a previsão pendente da etapa.
 */
export async function criarCobrancaEtapa(dados: {
  orcamentoId: string;
  pacienteId: string;
  itemIds: string[];
  desconto: number;
  numeroParcelas: number;
  primeiroVencimento: string;
  observacoes?: string;
}): Promise<{ error?: string; id?: string }> {
  const parsed = criarCobrancaEtapaSchema.safeParse(dados);
  if (!parsed.success) return { error: 'Revise os procedimentos, o desconto e as parcelas da etapa.' };

  const { supabase } = await requireClinicContext();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { data, error } = await rpc('criar_cobranca_orcamento', {
    p_orcamento_id: parsed.data.orcamentoId,
    p_item_ids: parsed.data.itemIds,
    p_desconto: parsed.data.desconto,
    p_numero_parcelas: parsed.data.numeroParcelas,
    p_primeiro_vencimento: parsed.data.primeiroVencimento,
    p_observacoes: parsed.data.observacoes || null,
  });
  if (error) return { error: erroFinanceiro(error.message) };

  const cobranca = data as { id?: string } | null;
  revalidatePath(`/dashboard/pacientes/${parsed.data.pacienteId}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { id: cobranca?.id };
}

/** Registra dinheiro contra a etapa escolhida; a RPC recompõe apenas o saldo dela. */
export async function registrarRecebimentoCobranca(dados: {
  cobrancaId: string;
  pacienteId: string;
  valor: number;
  formaPagamento: FormaPagamento;
  data: string;
}): Promise<{ error?: string; id?: string }> {
  const parsed = recebimentoCobrancaSchema.safeParse(dados);
  if (!parsed.success) return { error: 'Revise valor, data e forma de pagamento.' };

  const { supabase } = await requireClinicContext();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { data, error } = await rpc('registrar_recebimento_cobranca', {
    p_cobranca_id: parsed.data.cobrancaId,
    p_valor: parsed.data.valor,
    p_forma: parsed.data.formaPagamento,
    p_data: parsed.data.data,
  });
  if (error) return { error: erroFinanceiro(error.message) };

  const pagamento = data as { id?: string } | null;
  revalidatePath(`/dashboard/pacientes/${parsed.data.pacienteId}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { id: pagamento?.id };
}

/** Cancela apenas uma etapa sem dinheiro recebido e libera seus itens para nova negociação. */
export async function cancelarCobrancaEtapa(dados: {
  cobrancaId: string;
  pacienteId: string;
  motivo: string;
}): Promise<{ error?: string }> {
  const parsed = cancelarCobrancaSchema.safeParse(dados);
  if (!parsed.success) return { error: 'Informe o motivo do cancelamento (até 500 caracteres).' };

  const { supabase } = await requireClinicContext();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { error } = await rpc('cancelar_cobranca_orcamento', {
    p_cobranca_id: parsed.data.cobrancaId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return { error: erroFinanceiro(error.message) };

  revalidatePath(`/dashboard/pacientes/${parsed.data.pacienteId}`);
  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return {};
}

export async function editarPagamento(
  pagamentoId: string,
  dados: { valor: number; formaPagamento: FormaPagamento; data: string },
): Promise<{ error?: string }> {
  const parsed = z.object({
    pagamentoId: z.string().uuid(),
    valor: z.number().finite().positive().multipleOf(0.01),
    formaPagamento: formaPagamentoSchema,
    data: z.string().date(),
  }).safeParse({ pagamentoId, ...dados });
  if (!parsed.success) return { error: 'Revise valor, data e forma de pagamento.' };

  const { supabase, clinicId } = await requireClinicContext();
  const { data: atual } = await supabase
    .from('pagamentos')
    .select('paciente_id')
    .eq('id', parsed.data.pagamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();
  if (!atual) return { error: 'Recebimento não encontrado.' };

  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { error } = await rpc('corrigir_recebimento_orcamento', {
    p_pagamento_id: parsed.data.pagamentoId,
    p_valor: parsed.data.valor,
    p_forma: parsed.data.formaPagamento,
    p_data: parsed.data.data,
  });
  if (error) return { error: erroFinanceiro(error.message) };

  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  revalidatePath(`/dashboard/pacientes/${atual.paciente_id}`);
  return {};
}

export async function excluirPagamento(
  pagamentoId: string,
): Promise<{ error?: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const { data: pagAtual } = await supabase
    .from("pagamentos")
    .select("id, paciente_id, orcamento_id, valor, forma_pagamento, dentista_id, status")
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!pagAtual) {
    return { error: "Pagamento não encontrado." };
  }

  if (pagAtual.status === 'pago') {
    return { error: 'Recebimento confirmado não pode ser excluído. Use Estornar e informe o motivo.' };
  }

  // Espelha a policy pagamentos_access (is_own_clinical_record): dono OU secretária.
  // Sem este check, um dentista sem permissão recebe DELETE bloqueado pela RLS em
  // silêncio (0 linhas, sem erro) — o código seguiria como se tivesse excluído.
  if (pagAtual.dentista_id !== dentistaId && role !== 'secretaria') {
    return { error: 'Você não tem permissão para excluir este pagamento.' };
  }

  // PostgREST pode executar o DELETE e devolver `count=null` mesmo com `count: 'exact'`.
  // Isso fazia a tela acusar erro apesar de o recebimento já ter sido removido. Selecionar o id
  // apagado é a confirmação inequívoca e também protege contra RLS silenciosa.
  const { data: deletados, error } = await supabase
    .from("pagamentos")
    .delete()
    .eq("id", pagamentoId)
    .eq("clinica_id", clinicId)
    .select("id");

  if (error || deletados?.length !== 1 || deletados[0]?.id !== pagamentoId) {
    return { error: error?.message ?? 'Não foi possível excluir este pagamento.' };
  }

  registrarLog(supabase, {
    clinicaId:   clinicId,
    actorId:     dentistaId,
    pacienteId:  pagAtual.paciente_id,
    entityType:  'orcamento',
    entityId:    pagAtual.orcamento_id,
    action:      'pagamento.excluido',
    metadata:    { valor: pagAtual.valor, forma: pagAtual.forma_pagamento },
  });

  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard/financeiro");
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  revalidatePath(`/dashboard/pacientes/${pagAtual.paciente_id}`);
  return {};
}

export async function estornarPagamento(
  pagamentoId: string,
  motivo: string,
): Promise<{ error?: string }> {
  const parsed = z.object({
    pagamentoId: z.string().uuid(),
    motivo: z.string().trim().min(1).max(500),
  }).safeParse({ pagamentoId, motivo });
  if (!parsed.success) return { error: 'Informe o motivo do estorno.' };

  const { supabase, clinicId } = await requireClinicContext();
  const { data: atual } = await supabase
    .from('pagamentos')
    .select('paciente_id')
    .eq('id', parsed.data.pagamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();
  if (!atual) return { error: 'Recebimento não encontrado.' };

  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { error } = await rpc('estornar_recebimento_orcamento', {
    p_pagamento_id: parsed.data.pagamentoId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return { error: erroFinanceiro(error.message) };

  revalidatePath('/dashboard/orcamentos');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  revalidatePath(`/dashboard/pacientes/${atual.paciente_id}`);
  return {};
}

const adicionarItensAoOrcamentoSchema = z.object({
  orcamentoId: z.string().uuid(),
  itens: z.array(z.object({
    procedimentoId: z.string().uuid().nullable(),
    descricao: z.string().trim().min(1).max(500),
    quantidade: z.number().int().min(1).max(99),
    precoUnitario: z.number().finite().min(0),
    eventoIds: z.array(z.string().uuid()).max(100).default([]),
    composicao: composicaoGrupoSchema.nullable().optional(),
  })).min(1).max(100),
});

/**
 * R-135 — inclui explicitamente procedimentos novos no orçamento que já nasceu da mesma ficha.
 * A RPC faz a validação e os vínculos na mesma transação; pagamentos/aceites nunca passam por
 * aqui. Itens acrescentados começam não aprovados por default do banco.
 */
export async function adicionarItensAoOrcamento(
  dados: z.input<typeof adicionarItensAoOrcamentoSchema>,
): Promise<{ error?: string; valorAdicionado?: number }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();
  const parsed = adicionarItensAoOrcamentoSchema.safeParse(dados);
  if (!parsed.success) return { error: 'Revise os novos procedimentos e seus valores.' };

  const entrada = parsed.data;
  const { data: orcamento } = await supabase
    .from('orcamentos')
    .select('id, paciente_id')
    .eq('id', entrada.orcamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();
  if (!orcamento) return { error: 'Orçamento não encontrado.' };

  const { data: valorAdicionado, error } = await supabase.rpc(entrada.itens.some((item) => item.composicao) ? 'adicionar_itens_orcamento_com_eventos_r157' : 'adicionar_itens_orcamento_com_eventos', {
    p_orcamento_id: entrada.orcamentoId,
    p_itens: entrada.itens.map((item) => ({
      procedimento_id: item.procedimentoId,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.precoUnitario,
      evento_ids: item.eventoIds,
      composicao: item.composicao ?? null,
    })),
  });

  if (error) {
    const mensagem = error.message ?? '';
    if (error.code === '23505' || mensagem.includes('orcamento_evento_ja_orcado') || mensagem.includes('orcamento_evento_duplicado')) {
      return { error: 'Um dos procedimentos já entrou em um orçamento. Recarregue a ficha antes de continuar.' };
    }
    if (mensagem.includes('orcamento_evento_invalido')) {
      return { error: 'Um dos procedimentos não está mais disponível para este orçamento. Recarregue a ficha.' };
    }
    if (mensagem.includes('orcamento_evento_ficha_invalido')) {
      return { error: 'Os procedimentos adicionais precisam pertencer à mesma ficha do orçamento.' };
    }
    if (mensagem.includes('orcamento_procedimento_de_outro_dentista')) {
      return { error: 'O procedimento escolhido pertence a outro dentista. Recarregue o catálogo antes de continuar.' };
    }
    if (mensagem.includes('orcamento_sem_permissao')) {
      return { error: 'Você não tem permissão para alterar este orçamento.' };
    }
    console.error('[adicionarItensAoOrcamento]', mensagem);
    return { error: 'Não foi possível adicionar os procedimentos. Nenhuma alteração foi salva.' };
  }

  registrarLog(supabase, {
    clinicaId: clinicId,
    actorId: dentistaId,
    pacienteId: orcamento.paciente_id,
    entityType: 'orcamento',
    entityId: entrada.orcamentoId,
    action: 'orcamento.editado',
    metadata: { alteracao: 'itens_adicionados', itens_count: entrada.itens.length, valor_adicionado: valorAdicionado ?? 0 },
  });

  revalidatePath(`/dashboard/pacientes/${orcamento.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  return { valorAdicionado: Number(valorAdicionado ?? 0) };
}

/**
 * Compatibilidade para chamadores antigos: toda alteração do acordo passa pela mesma RPC
 * transacional usada pelo modal. Ela cancela somente previsões futuras, nunca recebimentos.
 */
export async function editarValorAcordado(
  orcamentoId: string,
  valorAcordado: number,
): Promise<{ error?: string }> {
  const result = await reorganizarParcelas({
    orcamentoId,
    valorAcordado,
    parcelas: [],
  });
  return result.error ? { error: result.error } : {};
}

export async function editarOrcamento(
  orcamentoId: string,
  itens: Array<{
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    procedimento_id?: string | null;
  }>,
  // R-35 item 5 — sem default: os dois chamadores tinham que passar o desconto atual
  // explícito, senão editar um item apagava silenciosamente o desconto do orçamento
  // (recalculava total = subtotal). Compilador acusa qualquer chamador que esquecer.
  desconto: number
): Promise<{ error?: string }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();

  const { data: orcRow } = await supabase
    .from("orcamentos")
    .select("paciente_id")
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!orcRow) return { error: "Orçamento não encontrado." };

  // R-113 — mesma classe do R-66 (memória `project_rls_update_silencioso`). As 3 policies de
  // `orcamento_itens` são assimétricas: INSERT (`can_act_as_dentista`) e UPDATE
  // (`is_own_clinical_record`) liberam secretária, mas DELETE (`orcamento_itens_delete_own`)
  // é só-dono. RLS barrada devolve SUCESSO com 0 linhas, não erro — então o insert abaixo
  // rodava por cima dos itens que não saíram e a lista duplicava a cada save.
  // Provado em produção: 3 orçamentos da ClinDent com item repetido, o último em 15/08.
  const { data: itensAntes, error: erroItensAntes } = await supabase
    .from("orcamento_itens")
    .select("id, aprovado, composicao")
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicId);

  if (erroItensAntes) return { error: "Não foi possível conferir os itens. O orçamento foi preservado." };

  if ((itensAntes ?? []).some((item) => item.composicao != null)) {
    return { error: 'Este orçamento contém grupos com composição preservada. A edição da lista inteira não está disponível.' };
  }

  // R-114 (I5) — editarOrcamento reescreve TUDO (apaga e reinsere); item novo sempre nasce
  // aprovado=false. Se algum item já era aprovado, esta edição apagaria a aprovação do
  // paciente em silêncio — a mesma classe de perda de dado que o R-113 acima já corrigiu
  // pro caso da RLS, só que aqui a causa é a função em si, não a policy.
  if ((itensAntes ?? []).some((i) => i.aprovado)) {
    return {
      error: "Este orçamento já tem procedimento aprovado pelo paciente — editar a lista inteira apagaria essa aprovação. Ajuste os itens não aprovados um a um.",
    };
  }

  const { data: deletados, error: delError } = await supabase
    .from("orcamento_itens")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("clinica_id", clinicId)
    .select("id");

  if (delError) return { error: delError.message };

  // Havia item e nenhum saiu = RLS bloqueou. Falha honesta antes de inserir qualquer coisa.
  if ((itensAntes?.length ?? 0) > 0 && (deletados?.length ?? 0) === 0) {
    return {
      error: "Você não tem permissão para editar os itens deste orçamento — só o dentista responsável pode.",
    };
  }

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

  // R-113 — editarOrcamento era a única ação financeira que não deixava rastro; o evento
  // 'orcamento.editado' já existia em lib/events.ts e nunca tinha sido chamado. Foi por isso
  // que a duplicação da ClinDent só deu pra reconstruir pelos created_at dos itens.
  registrarLog(supabase, {
    clinicaId:  clinicId,
    actorId:    dentistaId,
    pacienteId: orcRow.paciente_id ?? undefined,
    entityType: 'orcamento',
    entityId:   orcamentoId,
    action:     'orcamento.editado',
    metadata:   { itens_count: itens.length, total, desconto },
  });

  revalidatePath("/dashboard/orcamentos");
  return {};
}

/**
 * R-34 §7.1 — o atalho de 1 clique. Fecha a PRÓXIMA PARCELA ABERTA quando existe uma
 * (delega ao UPDATE de `marcarPagamentoPago` — nunca insere linha nova por cima de parcela
 * já gerada); sem parcela, cobra o que falta do valor acordado. Nunca quita "tudo de uma vez"
 * por cima de um plano — cada clique fecha uma parcela ou o saldo, nunca mais que isso (I2).
 *
 * "Parcela aberta" = pagamento com status='pendente' deste orçamento, ordenado por
 * coalesce(data_vencimento, created_at) e depois parcela_numero — a primeira da ordem é a
 * que fecha. Um avulso pendente (sem parcela_numero, ex. o que `atualizarStatusOrcamento`
 * insere ao aprovar sem plano) entra nessa mesma ordenação e conta como "aberta".
 */
export async function registrarPagamentoRapido(dados: {
  orcamentoId: string;
  pacienteId: string;
  formaPagamento: FormaPagamento;
}): Promise<{ error?: string; id?: string; autoAprovado?: boolean }> {
  const { supabase, clinicId } = await requireClinicContext();

  // Regra 1 — lê o estado antes de decidir (hoje: zero leitura, insere às cegas).
  const { data: orcRaw } = await supabase
    .from("orcamentos")
    .select(SELECT_ORC_PARA_ESTADO)
    .eq("id", dados.orcamentoId)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  const orc = orcRaw as unknown as OrcParaEstado | null;
  if (!orc) return { error: "Orçamento não encontrado." };

  const estado = derivarDoOrc(orc);
  // R-114 — substitui o guard por `status` do R-65.
  if (!orcamentoAceitaPagamento(estado.estado)) {
    return { error: ERRO_ORCAMENTO_SEM_APROVACAO };
  }

  const { data: pagamentosOrc } = await supabase
    .from("pagamentos")
    .select("id, status, valor, data_vencimento, parcela_numero, created_at")
    .eq("orcamento_id", dados.orcamentoId)
    .eq("clinica_id", clinicId);

  const linhas = pagamentosOrc ?? [];
  const totalPago = linhas.filter((p) => p.status === "pago").reduce((s, p) => s + p.valor, 0);
  const valorDevido = estado.valorDevido; // I1 — valorAcordado ?? soma(itens aprovados)

  const abertas = linhas
    .filter((p) => p.status === "pendente")
    .sort((a, b) => {
      const da = a.data_vencimento ?? a.created_at;
      const db = b.data_vencimento ?? b.created_at;
      if (da !== db) return da < db ? -1 : 1;
      return (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0);
    });

  const hoje = hojeBRT(); // regra 7

  if (abertas.length > 0) {
    // Regra 2 — delega ao UPDATE existente: mesma auto-aprovação, mesmo log, mesma
    // notificação por dentista_id da LINHA (regra 8, já é assim em marcarPagamentoPago).
    const alvo = abertas[0];
    const resultado = await marcarPagamentoPago(alvo.id, { formaPagamento: dados.formaPagamento, data: hoje });
    return { error: resultado.error, id: alvo.id, autoAprovado: resultado.autoAprovado };
  }

  // Regras 3/4 — sem parcela aberta: cobra o que falta (tudo, se nada foi pago; o saldo, se
  // já tem parte paga). Nunca `orc.total` cru fixo — sempre o que ainda falta de verdade.
  const saldo = Math.round((valorDevido - totalPago) * 100) / 100;
  if (saldo <= 0) {
    return { error: "Este orçamento já está quitado." };
  }

  // Mesmo atalho da secretaria precisa obedecer ao saldo no instante da escrita. Delegar à
  // action canônica preserva a trava transacional e o audit log, em vez de manter um INSERT
  // paralelo que poderia ultrapassar o valor combinado em uma corrida.
  return registrarPagamento({
    orcamentoId: dados.orcamentoId,
    pacienteId: dados.pacienteId,
    valor: saldo,
    formaPagamento: dados.formaPagamento,
    data: hoje,
    dentistaId: orc.dentista_id,
  });
}

export async function excluirOrcamento(
  orcamentoId: string,
  pacienteId?: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();

  // R-66 — checa dono ANTES de tocar em qualquer linha filha. A policy orcamentos_delete_own
  // é só-dono (sem exceção pra admin/secretaria); sem este check, pagamentos/orcamento_itens
  // abaixo seriam apagados mesmo quando o DELETE final em orcamentos vai ser bloqueado pela
  // RLS — deixando o orçamento "furado" (itens/pagamentos sumidos, registro sobrevivendo).
  const { data: orcDono } = await supabase
    .from('orcamentos')
    .select('dentista_id')
    .eq('id', orcamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!orcDono) return { error: 'Orçamento não encontrado.' };
  if (orcDono.dentista_id !== dentistaId) {
    return { error: 'Você não tem permissão para excluir este orçamento — só o dentista responsável pode.' };
  }

  // Decisão de 14/08: nem pagamento recebido nem aceite assinado bloqueiam mais a exclusão.
  // Quem decide é o dentista — o sistema avisa o que vai junto (pagamento sai do financeiro,
  // assinatura de aceite é apagada) no diálogo de confirmação e para por aí. Antes disso o
  // orçamento errado ficava preso na lista pra sempre, sem caminho de saída.
  // A assinatura sai por cascade da FK (migration 143, que reverte o RESTRICT da 113).

  // Um único DELETE: as três filhas (orcamento_itens, pagamentos, assinaturas) são todas
  // ON DELETE CASCADE, então o Postgres as leva junto — atômico. Antes, os filhos eram
  // apagados um a um ANTES do pai; se o DELETE do pai falhasse depois (FK ou RLS), itens e
  // pagamentos já tinham sumido e o orçamento sobrevivia furado. Deixar o cascade fazer
  // isso é o que garante o tudo-ou-nada.
  // R-66 — `error` vem vazio quando a RLS bloqueia (policy orcamentos_delete_own é só dono):
  // 0 linhas afetadas ainda é "sucesso" pro Postgrest. `.select('id')` é a única forma de
  // saber se algo de fato saiu da tabela (mesmo padrão de outros updates otimistas do projeto).
  const { data: deletado, error } = await supabase
    .from("orcamentos")
    .delete()
    .eq("id", orcamentoId)
    .eq("clinica_id", clinicId)
    .select("id");

  if (error) return { error: error.message };
  if (!deletado || deletado.length === 0) {
    return { error: "Você não tem permissão para excluir este orçamento — só o dentista responsável pode." };
  }

  if (pacienteId) revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  revalidatePath("/dashboard/orcamentos");
  // Pagamento pago agora pode sair junto — o financeiro precisa refletir isso na hora.
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
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
  dentistaId?: string;
}): Promise<{ error?: string; id?: string; precoPadrao?: number | null }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const nome = normalizarNomeProcedimento(dados.nome);
  if (!nome) return { error: "Informe o nome do procedimento." };
  if (nome.length > 160) return { error: "O nome do procedimento está longo demais." };

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { error: "Perfil de dentista não encontrado." };

  if (dentistaPerfil.role === "secretaria") {
    if (!dados.dentistaId) {
      return { error: "Selecione o dentista responsável pelo orçamento." };
    }
    const { data: alvo } = await supabase
      .from("dentistas")
      .select("id")
      .eq("id", dados.dentistaId)
      .eq("clinica_id", clinicId)
      .eq("ativo", true)
      // R-94 — .neq("role","secretaria") sozinho deixaria 'protetico' virar
      // "dentista responsável" de um orçamento.
      .in("role", ["admin", "dentista"])
      .maybeSingle();
    if (!alvo) {
      return { error: "Dentista selecionado inválido." };
    }
  }

  const dentistaAlvoId = dados.dentistaId ?? dentistaPerfil.id;

  // R-135 — o catálogo é uma lista de nomes canônicos. Antes de inserir, reutiliza a mesma
  // entrada do dentista ignorando diferença de maiúsculas/espaços, para não criar duplicata.
  const { data: existentes, error: existentesError } = await supabase
    .from('procedimentos')
    .select('id, nome, ativo, preco_padrao')
    .eq('clinica_id', clinicId)
    .eq('dentista_id', dentistaAlvoId);
  if (existentesError) {
    return { error: 'Não foi possível consultar o catálogo de procedimentos.' };
  }
  const chaveNome = nome.toLocaleLowerCase('pt-BR');
  const existente = (existentes ?? []).find(
    (procedimento) => normalizarNomeProcedimento(procedimento.nome).toLocaleLowerCase('pt-BR') === chaveNome,
  );
  if (existente) {
    if (!existente.ativo) {
      const { error: restaurarError } = await supabase
        .from('procedimentos')
        .update({ ativo: true, preco_padrao: dados.precoPadrao })
        .eq('id', existente.id)
        .eq('clinica_id', clinicId)
        .eq('dentista_id', dentistaAlvoId);
      if (restaurarError) {
        return { error: 'Não foi possível restaurar o procedimento no catálogo.' };
      }
      revalidatePath('/dashboard/configuracoes');
    }
    return { id: existente.id, precoPadrao: existente.ativo ? existente.preco_padrao : dados.precoPadrao };
  }

  const { data, error } = await supabase
    .from("procedimentos")
    .insert({
      clinica_id:   clinicId,
      dentista_id:  dentistaAlvoId,
      nome,
      preco_padrao: dados.precoPadrao,
    })
    .select("id, preco_padrao")
    .single();

  if (error) {
    console.error("Erro ao cadastrar procedimento:", error);
    return { error: "Não foi possível cadastrar o procedimento. Tente novamente." };
  }

  revalidatePath("/dashboard/configuracoes");
  const novo = data as { id: string; preco_padrao: number | null };
  return { id: novo.id, precoPadrao: novo.preco_padrao };
}

// Não exportar o schema em si — arquivo "use server" só pode exportar funções async.
// Só o tipo derivado sai (apagado em runtime), mesmo padrão de assinarProcedimentosSchema.
const aceitarOrcamentoSchema = z.object({
  orcamentoId: z.string().uuid(),
  assinadoPor: z.string().trim().min(2).max(120),
  assinaturaDataUrl: z.string().startsWith('data:image/png;base64,'),
});
export type AceitarOrcamentoInput = z.infer<typeof aceitarOrcamentoSchema>;

/**
 * R-03c-1 — aceite assinado do orçamento (prova comercial: o paciente concordou em pagar
 * nestes termos; distinto da assinatura clínica do R-03a, que prova que o procedimento foi
 * feito). Wrapper fino da RPC aceitar_orcamento (migration 113, SECURITY DEFINER): quem pode
 * coletar é decisão travada na spec — autor do orçamento ou secretária da mesma clínica,
 * validado NO BANCO. O snapshot dos termos é montado dentro da RPC a partir do banco, nunca
 * a partir do que este wrapper envia — se o client mandasse os termos, a prova não provaria nada.
 */
export async function aceitarOrcamento(
  params: AceitarOrcamentoInput,
): Promise<{ ok: boolean; error?: string; warning?: string; documentoUrl?: string }> {
  const parsed = aceitarOrcamentoSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' };
  const { orcamentoId, assinadoPor, assinaturaDataUrl } = parsed.data;

  const context = await requireClinicContext();
  const { supabase, clinicId } = context;

  // Resolve paciente_id só pro path do storage — a RPC valida tudo de novo por dentro
  // (este read não é a autorização, é só pra montar o nome do arquivo).
  const { data: orcRef } = await supabase
    .from('orcamentos')
    .select('paciente_id')
    .eq('id', orcamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!orcRef) return { ok: false, error: 'Orçamento não encontrado.' };

  const base64 = assinaturaDataUrl.split(',')[1];
  if (!base64) return { ok: false, error: 'Assinatura inválida.' };
  const buffer = Buffer.from(base64, 'base64');
  const storagePath = `${clinicId}/${orcRef.paciente_id}/aceite_${orcamentoId}_${Date.now()}.png`;

  const { error: storageErr } = await supabase.storage
    .from('fichas')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

  if (storageErr) {
    console.error('[aceitarOrcamento] storage:', storageErr.message);
    return { ok: false, error: 'Erro ao salvar a assinatura.' };
  }

  const { error } = await supabase.rpc('aceitar_orcamento', {
    p_orcamento_id: orcamentoId,
    p_assinado_por: assinadoPor,
    p_assinatura_ref: storagePath,
  });

  if (error) {
    // PNG já subiu mas a RPC rejeitou — remove o órfão antes de devolver o erro (mesmo
    // cuidado que assinarProcedimentos já toma).
    await supabase.storage.from('fichas').remove([storagePath]);
    if (error.message.includes('sem_permissao')) {
      return { ok: false, error: 'Você não tem permissão para registrar o aceite deste orçamento.' };
    }
    if (error.message.includes('ja_aceito')) {
      return { ok: false, error: 'Este orçamento já tem aceite assinado.' };
    }
    if (error.message.includes('status_invalido')) {
      return { ok: false, error: 'Não é possível coletar aceite de um orçamento recusado.' };
    }
    if (error.message.includes('sem_responsavel')) {
      return { ok: false, error: 'Este orçamento não tem dentista responsável. Atribua um antes de coletar o aceite.' };
    }
    console.error('[aceitarOrcamento]', error.message);
    return { ok: false, error: 'Não foi possível registrar o aceite.' };
  }

  revalidatePath(`/dashboard/pacientes/${orcRef.paciente_id}`);
  revalidatePath('/dashboard/orcamentos');
  try {
    const documento = await criarDocumentoAceiteOrcamento({ context, orcamentoId });
    if (documento.ok) return { ok: true, documentoUrl: documento.signedUrl };
    console.error('[aceitarOrcamento] documento final:', documento.error);
    return { ok: true, warning: 'Aceite registrado, mas o PDF final precisa ser gerado novamente pela equipe.' };
  } catch (documentoError) {
    console.error('[aceitarOrcamento] documento final:', documentoError);
    return { ok: true, warning: 'Aceite registrado, mas o PDF final precisa ser gerado novamente pela equipe.' };
  }
}
