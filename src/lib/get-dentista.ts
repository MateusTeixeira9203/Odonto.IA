import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DentistaRole } from "@/types/database";

export interface DentistaCache {
  id: string;
  nome: string;
  clinica_id: string;
  clinica: string;
  especialidade: string | null;
  role: DentistaRole;
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
    .select("id, nome, clinica_id, especialidade, role, clinicas(nome)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const clinicaRef = data.clinicas;
  const clinicaNome =
    Array.isArray(clinicaRef) && clinicaRef[0]
      ? (clinicaRef[0] as { nome: string }).nome
      : clinicaRef && typeof clinicaRef === "object" && "nome" in clinicaRef
        ? (clinicaRef as { nome: string }).nome
        : "";

  return {
    id: data.id,
    nome: data.nome,
    clinica_id: data.clinica_id,
    clinica: clinicaNome,
    especialidade: data.especialidade ?? null,
    role: (data.role ?? 'dentista') as DentistaRole,
  };
});
