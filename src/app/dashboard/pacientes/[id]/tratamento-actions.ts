"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { revalidatePath } from "next/cache";

export type Tratamento = {
  id: string;
  nome: string | null;
  status: "principal" | "pendente" | "concluido";
  created_at: string;
  encerrado_em: string | null;
};

/** Busca o tratamento principal do paciente. */
export async function buscarTratamentoAtivo(
  pacienteId: string
): Promise<{ tratamento: Tratamento | null; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "principal")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return { tratamento: null, error: error.message };
  const row = (data as Tratamento[])?.[0] ?? null;
  return { tratamento: row };
}

/** Busca tratamentos em pausa do paciente. */
export async function buscarTratamentosPendentes(
  pacienteId: string
): Promise<{ tratamentos: Tratamento[]; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "pendente")
    .order("created_at", { ascending: false });

  if (error) return { tratamentos: [], error: error.message };
  return { tratamentos: (data as Tratamento[]) ?? [] };
}

/** Busca todos os tratamentos concluídos do paciente (histórico). */
export async function buscarHistoricoTratamentos(
  pacienteId: string
): Promise<{ tratamentos: Tratamento[]; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "concluido")
    .order("encerrado_em", { ascending: false });

  if (error) return { tratamentos: [], error: error.message };
  return { tratamentos: (data as Tratamento[]) ?? [] };
}

/** Torna um tratamento o principal, colocando o atual em pausa automaticamente. */
export async function tornarPrincipal(
  tratamentoId: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  if (role === "secretaria") return { error: "Sem permissão" };

  // Trocar o principal mexe em DUAS linhas: rebaixa o atual e promove o alvo. A leitura é
  // clínica (todo dentista vê), mas a escrita é do autor (migration 099) — só o dono rebaixa
  // ou promove o próprio tratamento. Se o principal atual for de OUTRO dentista, a RLS barra o
  // rebaixamento em SILÊNCIO (0 linhas, sem erro) e a promoção criaria um segundo principal.
  // Por isso validamos a autoria das duas pontas ANTES de escrever e abortamos limpo — nunca
  // deixando o paciente com dois principais.
  const { data: tratsRaw, error: errLer } = await supabase
    .from("tratamentos")
    .select("id, dentista_id, status")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId);
  if (errLer) return { error: errLer.message };

  const trats = (tratsRaw ?? []) as Array<{ id: string; dentista_id: string | null; status: string }>;

  const alvo = trats.find((t) => t.id === tratamentoId);
  if (!alvo) return { error: "Tratamento não encontrado." };
  if (alvo.dentista_id !== dentistaId) {
    return { error: "Só o dentista dono do tratamento pode torná-lo principal." };
  }

  const outrosPrincipais = trats.filter((t) => t.status === "principal" && t.id !== tratamentoId);
  if (outrosPrincipais.some((t) => t.dentista_id !== dentistaId)) {
    return { error: "O tratamento principal atual é de outro dentista — peça a ele para pausá-lo antes." };
  }

  // Todos os outros principais são meus → a troca é segura e a RLS deixa passar. Rebaixa todos
  // de uma vez (defende contra o estado corrompido de >1 principal que este bug podia criar).
  if (outrosPrincipais.length > 0) {
    const { error: errRebaixar } = await supabase
      .from("tratamentos")
      .update({ status: "pendente" })
      .in("id", outrosPrincipais.map((t) => t.id))
      .eq("clinica_id", clinicId);
    if (errRebaixar) return { error: errRebaixar.message };
  }

  // .select() confirma que a promoção pegou (autoria já checada, mas fecha contra corrida).
  const { data: promovido, error: errPromover } = await supabase
    .from("tratamentos")
    .update({ status: "principal" })
    .eq("id", tratamentoId)
    .eq("clinica_id", clinicId)
    .select("id");
  if (errPromover) return { error: errPromover.message };
  if (!promovido?.length) return { error: "Não foi possível tornar principal. Tente novamente." };

  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

/**
 * Cria um novo tratamento ativo e vincula as fichas selecionadas.
 * Pré-condição: não deve existir tratamento ativo para este paciente.
 */
export async function criarTratamento(
  pacienteId: string,
  nome: string | null,
  fichaIds: string[]
): Promise<{ id?: string; error?: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para criar tratamentos" };

  // Verifica se já existe um tratamento principal
  const { data: existente } = await supabase
    .from("tratamentos")
    .select("id")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "principal")
    .maybeSingle();

  // Se há um principal, o novo entra como 'pendente'; caso contrário, já nasce como 'principal'
  const novoStatus = existente ? "pendente" : "principal";

  // Cria o tratamento. dentista_id = dono do CONTAINER: só ele renomeia/encerra.
  // O tratamento em si é compartilhado — qualquer dentista da clínica lê e anexa
  // a própria ficha nele (migration 099, spec 2026-07-16 §3).
  const { data: novo, error: errInsert } = await supabase
    .from("tratamentos")
    .insert({
      clinica_id: clinicId,
      paciente_id: pacienteId,
      dentista_id: dentistaId,
      nome: nome?.trim() || null,
      status: novoStatus,
    })
    .select("id")
    .single();

  if (errInsert || !novo) return { error: errInsert?.message ?? "Erro ao criar tratamento" };

  // Vincula fichas selecionadas
  if (fichaIds.length > 0) {
    await supabase
      .from("fichas")
      .update({ tratamento_id: (novo as { id: string }).id })
      .in("id", fichaIds)
      .eq("clinica_id", clinicId);
  }

  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return { id: (novo as { id: string }).id };
}

/** Adiciona fichas avulsas a um tratamento ativo existente. */
export async function vincularFichasAoTratamento(
  tratamentoId: string,
  fichaIds: string[],
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão" };
  if (fichaIds.length === 0) return {};

  const { error } = await supabase
    .from("fichas")
    .update({ tratamento_id: tratamentoId })
    .in("id", fichaIds)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

export type FichaSemTratamento = {
  id: string;
  data_atendimento: string;
  queixa_principal: string | null;
  dentes_afetados: number[];
};

/** Busca fichas do paciente que ainda não estão vinculadas a nenhum tratamento. */
export async function buscarFichasSemTratamento(
  pacienteId: string
): Promise<{ fichas: FichaSemTratamento[]; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("fichas")
    .select("id, data_atendimento, queixa_principal, dentes_afetados, dentes_observacoes")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .is("tratamento_id", null)
    .order("data_atendimento", { ascending: false });

  if (error) return { fichas: [], error: error.message };

  // Exclude fichas with no tooth observations — they have no clinical data to link
  const fichas = ((data ?? []) as Array<FichaSemTratamento & { dentes_observacoes: Record<string, unknown> | null }>)
    .filter(f => f.dentes_observacoes && Object.keys(f.dentes_observacoes).length > 0)
    .map(({ dentes_observacoes: _obs, ...rest }) => rest as FichaSemTratamento);

  return { fichas };
}

/** Exclui um tratamento e libera as fichas vinculadas a ele. */
export async function excluirTratamento(
  tratamentoId: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para excluir tratamentos" };

  await supabase
    .from("fichas")
    .update({ tratamento_id: null })
    .eq("tratamento_id", tratamentoId)
    .eq("clinica_id", clinicId);

  const { error } = await supabase
    .from("tratamentos")
    .delete()
    .eq("id", tratamentoId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

/** Renomeia o tratamento. */
export async function renomearTratamento(
  tratamentoId: string,
  nome: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { error: 'Sem permissão' };
  const { error } = await supabase
    .from('tratamentos')
    .update({ nome: nome.trim() || null })
    .eq('id', tratamentoId)
    .eq('clinica_id', clinicId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

/** Encerra o tratamento ativo. */
export async function encerrarTratamento(
  tratamentoId: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para encerrar tratamentos" };

  const { error } = await supabase
    .from("tratamentos")
    .update({
      status: "concluido",
      encerrado_em: new Date().toISOString(),
    })
    .eq("id", tratamentoId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}
