import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getPilotEntryMembership } from '@/lib/auth/entry-membership';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';

export type MiddlewareSession = {
  id: string;
  email?: string;
} | null;

export interface UpdateSessionResult {
  response: NextResponse;
  session: MiddlewareSession;
  managementEntry?: boolean;
}

function isInvalidRefreshToken(message: string): boolean {
  return (
    message.includes("Invalid Refresh Token") ||
    message.includes("Refresh Token Not Found")
  );
}

function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

export async function updateSession(
  request: NextRequest
): Promise<UpdateSessionResult> {
  // R-94 — propaga o pathname pro REQUEST (não pra response, que só o browser vê).
  // headers() em Server Component lê os headers do request que o Next.js processa
  // internamente; setar em response.headers não tem efeito nenhum ali. Sem isto,
  // dashboard/layout.tsx sempre lia pathname='', a condição do gate do protético
  // era sempre verdadeira, e todo load de /dashboard/protetico virava um redirect
  // pra /dashboard/protetico — loop infinito (derrubou o servidor de memória).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const sessionRequest = new NextRequest(request, { headers: requestHeaders });

  let response = NextResponse.next({
    request: sessionRequest,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { response, session: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return sessionRequest.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // O Supabase pode renovar a sessão durante getUser(). Os Server Components
        // da mesma navegação precisam enxergar os cookies novos no request, e o
        // browser precisa recebê-los no response.
        cookiesToSet.forEach(({ name, value }) =>
          sessionRequest.cookies.set(name, value)
        );

        response = NextResponse.next({
          request: sessionRequest,
        });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Uma sessão revogada pode deixar cookies antigos no navegador. Sem removê-los,
  // cada tentativa de login autentica corretamente e falha logo depois ao tentar
  // renovar o refresh token anterior.
  if (error && isInvalidRefreshToken(error.message)) {
    sessionRequest.cookies
      .getAll()
      .filter(({ name }) => isSupabaseAuthCookie(name))
      .forEach(({ name }) => {
        sessionRequest.cookies.delete(name);
        response.cookies.set(name, "", {
          path: "/",
          maxAge: 0,
        });
      });

    return { response, session: null };
  }

  const session: MiddlewareSession = user
    ? { id: user.id, email: user.email ?? undefined }
    : null;

  let managementEntry = false;
  const pathname = request.nextUrl.pathname;
  const needsEntry = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')
    || ['/login', '/cadastro', '/esqueci-senha'].includes(pathname);
  if (user && needsEntry && isTeamWorkspaceEnabled()) {
    const { data: active, error: activeError } = await supabase.from('users')
      .select('active_clinica_id').eq('id', user.id)
      .maybeSingle<{ active_clinica_id: string | null }>();
    if (activeError) throw new Error('Não foi possível validar a clínica ativa.');
    if (active?.active_clinica_id) {
      const membership = await getPilotEntryMembership(supabase, user.id, active.active_clinica_id);
      managementEntry = membership?.role === 'gestor';
    }
  }
  return { response, session, managementEntry };
}
