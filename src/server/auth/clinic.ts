import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ClinicRole = "dentista" | "secretaria" | "admin";

type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type ClinicContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: AuthenticatedUser;
  clinicId: string;
  dentistaId: string;
  role: ClinicRole;
};

/**
 * Resolve o contexto autenticado de clínica a partir das fontes canônicas:
 *
 * 1. users.active_clinica_id  — qual clínica está ativa para este usuário
 * 2. clinica_usuarios          — valida membership ativa e obtém o role
 * 3. dentistas                 — fornece o ID de perfil clínico (escopo da clínica ativa)
 *
 * Nunca usa dentistas como fonte de clinicId ou role.
 * Nunca faz .maybeSingle() sem escopo explícito de clínica.
 */
export async function requireClinicContext(): Promise<ClinicContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── 1. Resolver clínica ativa ────────────────────────────────────────────────
  const { data: userRecord } = await supabase
    .from("users")
    .select("active_clinica_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) redirect("/onboarding");

  const clinicId = userRecord.active_clinica_id as string;

  // ── 2. Validar membership ativa e obter role ─────────────────────────────────
  const { data: membership } = await supabase
    .from("clinica_usuarios")
    .select("role")
    .eq("usuario_id", user.id)
    .eq("clinica_id", clinicId)
    .eq("status", "ativo")
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  // ── 3. Perfil clínico (dentistas) — escopo explícito da clínica ativa ────────
  const { data: dentista } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentista) redirect("/onboarding");

  return {
    supabase,
    user: { id: user.id, email: user.email ?? undefined },
    clinicId,
    dentistaId: dentista.id,
    role: membership.role as ClinicRole,
  };
}
