import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicaUsuarioRole, DentistaRole } from "@/types/database";

export interface DentistaLoginInfo {
  existe: boolean;
  role: DentistaRole | null;
}

export interface LoginEntryInfo {
  existe: boolean;
  role: ClinicaUsuarioRole | null;
  possuiPerfilClinico: boolean;
}

/**
 * Verifica se o usuário autenticado já tem registro em dentistas e devolve o role.
 * O login usa o role pra escolher o destino direto (ex.: protético vai reto pra
 * /dashboard/protetico) em vez de passar por /dashboard e pagar o redirect do gate.
 * TODO: adicionar clinica_id scope — atualmente não filtra por clínica ativa (bug multi-clínica).
 */
export async function getDentistaLoginInfo(
  supabase: SupabaseClient
): Promise<DentistaLoginInfo> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { existe: false, role: null };

  const { data, error } = await supabase
    .from("dentistas")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return { existe: false, role: null };
  return { existe: true, role: data.role as DentistaRole };
}

/** Resolve a entrada pelo membership ativo da clínica, inclusive para gestor sem CRO. */
export async function getLoginEntryInfo(supabase: SupabaseClient): Promise<LoginEntryInfo> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { existe: false, role: null, possuiPerfilClinico: false };

  const { data: userRecord, error: userError } = await supabase
    .from('users').select('active_clinica_id').eq('id', user.id).maybeSingle();
  if (userError || !userRecord?.active_clinica_id) {
    return { existe: false, role: null, possuiPerfilClinico: false };
  }

  const clinicId = userRecord.active_clinica_id;
  const { data: membership, error: membershipError } = await supabase
    .from('clinica_usuarios').select('role, status')
    .eq('usuario_id', user.id).eq('clinica_id', clinicId).eq('status', 'ativo').maybeSingle();
  if (membershipError || !membership) return { existe: false, role: null, possuiPerfilClinico: false };

  const { data: dentist, error: dentistError } = await supabase
    .from('dentistas').select('id').eq('user_id', user.id).eq('clinica_id', clinicId).eq('ativo', true).maybeSingle();
  if (dentistError) return { existe: false, role: null, possuiPerfilClinico: false };

  return {
    existe: true,
    role: membership.role as ClinicaUsuarioRole,
    possuiPerfilClinico: Boolean(dentist),
  };
}
