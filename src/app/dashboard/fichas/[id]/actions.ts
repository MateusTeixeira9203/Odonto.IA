"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";

// Procedimento da clínica para o select do planejamento
export interface ProcedimentoClinica {
  id: string;
  nome: string;
  categoria: string;
  preco_padrao: number | null;
  duracao_minutos: number | null;
}

/**
 * Busca procedimentos ativos da clínica para o select do formulário de etapa.
 */
export async function getProcedimentosClinica(): Promise<ProcedimentoClinica[]> {
  const dentista = await getDentistaCached();
  if (!dentista) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("procedimentos")
    .select("id, nome, categoria, preco_padrao, duracao_minutos")
    .eq("clinica_id", dentista.clinica_id)
    .eq("ativo", true)
    .order("categoria", { ascending: true })
    .order("nome", { ascending: true });

  return (data ?? []) as ProcedimentoClinica[];
}

/**
 * Atualiza o procedimento_id de uma etapa do planejamento.
 * Verifica isolamento por clinica_id antes de alterar.
 */
export async function updateEtapaProcedimento(
  etapaId: string,
  procedimentoId: string | null
): Promise<{ error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) return { error: "Não autenticado" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("planejamento_etapas")
    .update({ procedimento_id: procedimentoId })
    .eq("id", etapaId)
    .eq("clinica_id", dentista.clinica_id);

  if (error) {
    console.error("Erro ao vincular procedimento à etapa:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/fichas");
  return {};
}

// Tipo interno para etapa com procedimento vinculado (join via FK procedimento_id → procedimentos)
interface EtapaComProcedimento {
  id: string;
  titulo: string;
  dentes: string[] | null;
  ordem: number;
  procedimento_id: string | null;
  procedimento: { id: string; nome: string; preco_padrao: number | null } | null;
}

/**
 * Gera orçamento automaticamente a partir do planejamento da ficha.
 * Usa os preços de procedimentos.preco_padrao para popular os itens.
 */
export async function generateBudgetFromPlanning(
  fichaId: string
): Promise<{ success: boolean; orcamentoId?: string; error?: string }> {
  // 1. Autenticação e contexto
  const dentista = await getDentistaCached();
  if (!dentista) return { success: false, error: "Não autenticado" };
  const clinicaId = dentista.clinica_id;

  const supabase = await createClient();

  // 2. Buscar planejamento da ficha (etapas ficam em planejamento_etapas via planejamento_id)
  const { data: planejamento, error: planError } = await supabase
    .from("planejamentos")
    .select("id")
    .eq("ficha_id", fichaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (planError) {
    console.error("Erro ao buscar planejamento:", planError);
    return { success: false, error: "Erro ao buscar planejamento" };
  }

  if (!planejamento) {
    return { success: false, error: "Nenhum planejamento encontrado para esta ficha" };
  }

  // 3. Buscar etapas do planejamento com preço do procedimento vinculado
  const { data: etapasRaw, error: etapasError } = await supabase
    .from("planejamento_etapas")
    .select("id, titulo, dentes, ordem, procedimento_id, procedimento:procedimentos(id, nome, preco_padrao)")
    .eq("planejamento_id", planejamento.id)
    .eq("clinica_id", clinicaId)
    .order("ordem", { ascending: true });

  if (etapasError) {
    console.error("Erro ao buscar etapas:", etapasError);
    return { success: false, error: "Erro ao buscar etapas do planejamento" };
  }

  const etapas = (etapasRaw ?? []) as unknown as EtapaComProcedimento[];

  if (etapas.length === 0) {
    return { success: false, error: "Nenhuma etapa de planejamento encontrada" };
  }

  // 4. Buscar ficha para pegar paciente_id e dentista_id
  const { data: ficha } = await supabase
    .from("fichas")
    .select("paciente_id, dentista_id")
    .eq("id", fichaId)
    .eq("clinica_id", clinicaId)
    .single();

  if (!ficha) return { success: false, error: "Ficha não encontrada" };

  // 5. Calcular total somando preco_padrao de cada procedimento (quantidade sempre 1 por etapa)
  const total = etapas.reduce((acc, etapa) => {
    const preco = etapa.procedimento?.preco_padrao ?? 0;
    return acc + preco;
  }, 0);

  // 6. Criar orçamento
  const { data: orcamento, error: orcError } = await supabase
    .from("orcamentos")
    .insert({
      clinica_id: clinicaId,
      paciente_id: ficha.paciente_id,
      dentista_id: ficha.dentista_id ?? dentista.id,
      ficha_id: fichaId,
      total,
      status: "rascunho",
      validade_dias: 30,
    })
    .select("id")
    .single();

  if (orcError || !orcamento) {
    console.error("Erro ao criar orçamento:", orcError);
    return { success: false, error: "Erro ao criar orçamento" };
  }

  // 7. Criar itens do orçamento a partir das etapas, usando preco_padrao do procedimento
  const itens = etapas.map((etapa) => {
    const preco = etapa.procedimento?.preco_padrao ?? null;
    const descricao = etapa.titulo ?? etapa.procedimento?.nome ?? "Procedimento";
    const dente =
      (etapa.dentes ?? []).length > 0
        ? [...(etapa.dentes ?? [])].sort((a, b) => Number(a) - Number(b)).join(", ")
        : null;

    return {
      clinica_id: clinicaId,
      orcamento_id: orcamento.id,
      etapa_id: etapa.id,
      procedimento_id: etapa.procedimento_id ?? null,
      descricao,
      dente,
      quantidade: 1,
      preco_unitario: preco,
      preco_total: preco,
    };
  });

  const { error: itensError } = await supabase.from("orcamento_itens").insert(itens);

  if (itensError) {
    console.error("Erro ao criar itens do orçamento:", itensError);
    // Remove o orçamento criado para não deixar órfão
    await supabase.from("orcamentos").delete().eq("id", orcamento.id);
    return { success: false, error: "Erro ao criar itens do orçamento" };
  }

  revalidatePath(`/dashboard/fichas/${fichaId}`);
  revalidatePath("/dashboard/orcamentos");

  return { success: true, orcamentoId: orcamento.id };
}
