"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/authorization/guards";

export interface ProcedimentoClinica {
  id: string;
  nome: string;
  categoria: string;
  preco_padrao: number | null;
  duracao_minutos: number | null;
}

export async function getProcedimentosClinica(): Promise<ProcedimentoClinica[]> {
  const { supabase, clinicId } = await requirePermission('prontuarios_edit');

  const { data } = await supabase
    .from("procedimentos")
    .select("id, nome, categoria, preco_padrao, duracao_minutos")
    .eq("clinica_id", clinicId)
    .eq("ativo", true)
    .order("categoria", { ascending: true })
    .order("nome", { ascending: true });

  return (data ?? []) as ProcedimentoClinica[];
}

export async function updateEtapaProcedimento(
  etapaId: string,
  procedimentoId: string | null
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requirePermission('prontuarios_edit');

  const { error } = await supabase
    .from("planejamento_etapas")
    .update({ procedimento_id: procedimentoId })
    .eq("id", etapaId)
    .eq("clinica_id", clinicId);

  if (error) {
    console.error("Erro ao vincular procedimento à etapa:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/fichas");
  return {};
}

interface EtapaComProcedimento {
  id: string;
  titulo: string;
  dentes: string[] | null;
  ordem: number;
  procedimento_id: string | null;
  procedimento: { id: string; nome: string; preco_padrao: number | null } | null;
}

export async function generateBudgetFromPlanning(
  fichaId: string
): Promise<{ success: boolean; orcamentoId?: string; error?: string }> {
  const { supabase, user, clinicId } = await requirePermission('prontuarios_edit');

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  const { data: planejamento, error: planError } = await supabase
    .from("planejamentos")
    .select("id")
    .eq("ficha_id", fichaId)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (planError) {
    console.error("Erro ao buscar planejamento:", planError);
    return { success: false, error: "Erro ao buscar planejamento" };
  }

  if (!planejamento) {
    return { success: false, error: "Nenhum planejamento encontrado para esta ficha" };
  }

  const { data: etapasRaw, error: etapasError } = await supabase
    .from("planejamento_etapas")
    .select("id, titulo, dentes, ordem, procedimento_id, procedimento:procedimentos(id, nome, preco_padrao)")
    .eq("planejamento_id", planejamento.id)
    .eq("clinica_id", clinicId)
    .order("ordem", { ascending: true });

  if (etapasError) {
    console.error("Erro ao buscar etapas:", etapasError);
    return { success: false, error: "Erro ao buscar etapas do planejamento" };
  }

  const etapas = (etapasRaw ?? []) as unknown as EtapaComProcedimento[];

  if (etapas.length === 0) {
    return { success: false, error: "Nenhuma etapa de planejamento encontrada" };
  }

  const { data: ficha } = await supabase
    .from("fichas")
    .select("paciente_id, dentista_id")
    .eq("id", fichaId)
    .eq("clinica_id", clinicId)
    .single();

  if (!ficha) return { success: false, error: "Ficha não encontrada" };

  const total = etapas.reduce((acc, etapa) => {
    const preco = etapa.procedimento?.preco_padrao ?? 0;
    return acc + preco;
  }, 0);

  const { data: orcamento, error: orcError } = await supabase
    .from("orcamentos")
    .insert({
      clinica_id:    clinicId,
      paciente_id:   ficha.paciente_id,
      dentista_id:   ficha.dentista_id ?? dentistaPerfil?.id,
      ficha_id:      fichaId,
      total,
      status:        "rascunho",
      validade_dias: 30,
    })
    .select("id")
    .single();

  if (orcError || !orcamento) {
    console.error("Erro ao criar orçamento:", orcError);
    return { success: false, error: "Erro ao criar orçamento" };
  }

  const itens = etapas.map((etapa) => {
    const preco = etapa.procedimento?.preco_padrao ?? null;
    const descricao = etapa.titulo ?? etapa.procedimento?.nome ?? "Procedimento";
    const dente =
      (etapa.dentes ?? []).length > 0
        ? [...(etapa.dentes ?? [])].sort((a, b) => Number(a) - Number(b)).join(", ")
        : null;

    return {
      clinica_id:      clinicId,
      orcamento_id:    orcamento.id,
      etapa_id:        etapa.id,
      procedimento_id: etapa.procedimento_id ?? null,
      descricao,
      dente,
      quantidade:      1,
      preco_unitario:  preco,
      preco_total:     preco,
    };
  });

  const { error: itensError } = await supabase.from("orcamento_itens").insert(itens);

  if (itensError) {
    console.error("Erro ao criar itens do orçamento:", itensError);
    await supabase.from("orcamentos").delete().eq("id", orcamento.id);
    return { success: false, error: "Erro ao criar itens do orçamento" };
  }

  revalidatePath(`/dashboard/fichas/${fichaId}`);
  revalidatePath("/dashboard/orcamentos");

  return { success: true, orcamentoId: orcamento.id };
}
