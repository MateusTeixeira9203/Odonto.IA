import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DentistaRole } from "@/types/database";
import type { PlanoId } from "@/lib/planos";
import type { FocoPrincipal } from "@/lib/persona";

export interface DentistaCache {
  id: string;
  nome: string;
  cro: string | null;
  clinica_id: string;
  clinica: string;
  especialidade: string | null;
  role: DentistaRole;
  avatar_url: string | null;
  status_convite: "pendente" | "aceito" | null;
  /** Persona escolhida no onboarding (Workstream E). null = sem diferenciação. */
  foco_principal: FocoPrincipal | null;
  plano: PlanoId;
  status_assinatura: "trial" | "ativo" | "inativo";
  trial_ends_at: string | null;
  limite_dentistas: number;
}

/**
 * Busca o perfil clínico do usuário logado para a clínica ativa.
 *
 * Fluxo:
 * 1. Resolve users.active_clinica_id (fonte de verdade de qual clínica está ativa)
 * 2. Busca dentistas scoped a (user_id, clinica_id) — sem .maybeSingle() sem escopo
 *
 * Retorna null se: não autenticado, sem clínica ativa ou sem perfil clínico.
 * Callers são responsáveis por tratar null (ex: redirect para /onboarding).
 *
 * Usa React.cache() para deduplicar chamadas na mesma requisição.
 */
export const getDentistaCached = cache(async (): Promise<DentistaCache | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // ── 1. Resolver clínica ativa ────────────────────────────────────────────────
  const { data: userRecord } = await supabase
    .from("users")
    .select("active_clinica_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) return null;

  const clinicId = userRecord.active_clinica_id as string;

  // ── 2. Perfil clínico escopo (user_id, clinica_id) ───────────────────────────
  const { data, error } = await supabase
    .from("dentistas")
    .select(
      "id, nome, cro, clinica_id, especialidade, role, avatar_url, status_convite, foco_principal," +
        " clinicas(nome, plano, status_assinatura, trial_ends_at, limite_dentistas)",
    )
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (error || !data) return null;

  // Supabase retorna GenericStringError como possibilidade no tipo de `data` quando não há
  // schema gerado. O guard acima elimina os casos de erro/null em runtime; o cast aqui
  // elimina a ambiguidade no sistema de tipos.
  type DentistaRow = {
    id: string;
    nome: string;
    cro: string | null;
    clinica_id: string;
    especialidade: string | null;
    role: string;
    avatar_url: string | null;
    status_convite: string | null;
    foco_principal: string | null;
    clinicas: unknown;
  };

  const row = data as unknown as DentistaRow;

  type ClinicaFields = {
    nome: string;
    plano: string;
    status_assinatura: string;
    trial_ends_at: string | null;
    limite_dentistas: number;
  };

  const clinicaRef = row.clinicas;
  const clinica: ClinicaFields | null =
    Array.isArray(clinicaRef) && clinicaRef[0]
      ? (clinicaRef[0] as ClinicaFields)
      : clinicaRef && typeof clinicaRef === "object" && clinicaRef !== null && "nome" in clinicaRef
        ? (clinicaRef as ClinicaFields)
        : null;

  return {
    id: row.id,
    nome: row.nome,
    cro: row.cro,
    clinica_id: row.clinica_id,
    clinica: clinica?.nome ?? "",
    especialidade: row.especialidade,
    role: (row.role ?? "dentista") as DentistaRole,
    avatar_url: row.avatar_url,
    status_convite: row.status_convite as "pendente" | "aceito" | null,
    foco_principal: (row.foco_principal as FocoPrincipal | null) ?? null,
    plano: (clinica?.plano as PlanoId) ?? "CLINICA",
    status_assinatura:
      (clinica?.status_assinatura as "trial" | "ativo" | "inativo") ?? "trial",
    trial_ends_at: clinica?.trial_ends_at ?? null,
    limite_dentistas: clinica?.limite_dentistas ?? 5,
  };
});
