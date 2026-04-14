import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DentistaRole } from "@/types/database";
import type { PlanoId } from "@/lib/planos";

export interface DentistaCache {
  id: string;
  nome: string;
  clinica_id: string;
  clinica: string;
  especialidade: string | null;
  role: DentistaRole;
  avatar_url: string | null;
  status_convite: 'pendente' | 'aceito' | null;
  plano: PlanoId;
  status_assinatura: 'trial' | 'ativo' | 'inativo';
  trial_ends_at: string | null;
  limite_dentistas: number;
}

/**
 * Busca dentista + clinica_id do usuário logado.
 * Usa React cache() para deduplicar chamadas na mesma requisição.
 * Use esta função em todas as pages do dashboard como primeira query.
 */
export const getDentistaCached = cache(async (): Promise<DentistaCache | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("dentistas")
    .select("id, nome, clinica_id, especialidade, role, avatar_url, status_convite, clinicas(nome, plano, status_assinatura, trial_ends_at, limite_dentistas)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const clinicaRef = data.clinicas;
  type ClinicaFields = { nome: string; plano: string; status_assinatura: string; trial_ends_at: string | null; limite_dentistas: number };
  const clinica: ClinicaFields | null = Array.isArray(clinicaRef) && clinicaRef[0]
    ? (clinicaRef[0] as unknown as ClinicaFields)
    : clinicaRef && typeof clinicaRef === "object" && "nome" in clinicaRef
      ? (clinicaRef as unknown as ClinicaFields)
      : null;

  return {
    id: data.id,
    nome: data.nome,
    clinica_id: data.clinica_id,
    clinica: clinica?.nome ?? "",
    especialidade: data.especialidade ?? null,
    role: (data.role ?? 'dentista') as DentistaRole,
    avatar_url:      (data as unknown as { avatar_url?: string | null }).avatar_url ?? null,
    status_convite:  ((data as unknown as { status_convite?: string | null }).status_convite ?? null) as 'pendente' | 'aceito' | null,
    plano: ((clinica?.plano as PlanoId) ?? 'CLINICA'),
    status_assinatura: ((clinica?.status_assinatura as 'trial' | 'ativo' | 'inativo') ?? 'trial'),
    trial_ends_at: clinica?.trial_ends_at ?? null,
    limite_dentistas: clinica?.limite_dentistas ?? 5,
  };
});
