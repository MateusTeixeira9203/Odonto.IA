import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export interface UpdateSessionResult {
  response: NextResponse;
  session: { user: { id: string }; access_token: string } | null;
  supabase: SupabaseClient | null;
}

/**
 * Atualiza a sessão do Supabase no middleware.
 * Necessário para refresh automático de tokens expirados.
 * Retorna response, sessão e cliente para uso na proteção de rotas.
 */
export async function updateSession(
  request: NextRequest
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { response, session: null, supabase: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Valida a sessão contra o servidor (getUser faz chamada real ao Supabase,
  // ao contrário de getSession que apenas lê o cookie local).
  // Isso garante que sessões de usuários deletados sejam tratadas como inválidas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session = user
    ? ({ user: { id: user.id }, access_token: "" } as const)
    : null;

  return { response, session, supabase };
}
