import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifica se o usuário autenticado já tem registro em dentistas (com clinica_id).
 * TODO: adicionar clinica_id scope — atualmente não filtra por clínica ativa (bug multi-clínica).
 */
export async function hasDentistaRegistro(
  supabase: SupabaseClient
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return !error && !!data;
}
