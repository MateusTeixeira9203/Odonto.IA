import { combineChunks, createServerClient, isChunkLike, stringFromBase64URL } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getPilotEntryMembership } from '@/lib/auth/entry-membership';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { resolveSessionHealth, type SessionHealth } from "@/lib/auth/session-health";

export type MiddlewareSession = {
  id: string;
  email?: string;
} | null;

export interface UpdateSessionResult {
  response: NextResponse;
  session: MiddlewareSession;
  health: SessionHealth;
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
    return { response, session: null, health: "technical_failure" };
  }

  // O SDK decodifica o cookie antes de validar a sessão. Bytes corrompidos podem
  // lançar fora do fluxo de Auth e derrubar inclusive o login com HTTP 500.
  let sessionCookie: string;
  try {
    const url = new URL(supabaseUrl);
    if (!['https:', 'http:'].includes(url.protocol)) {
      return { response, session: null, health: "technical_failure" };
    }
    sessionCookie = `sb-${url.hostname.split(".")[0]}-auth-token`;
  } catch {
    return { response, session: null, health: "technical_failure" };
  }
  const storedSession = await combineChunks(sessionCookie, (name) => sessionRequest.cookies.get(name)?.value);
  if (storedSession) {
    try {
      JSON.parse(storedSession.startsWith("base64-") ? stringFromBase64URL(storedSession.slice(7)) : storedSession);
    } catch {
      const corruptedCookies = sessionRequest.cookies.getAll().filter(({ name }) => isChunkLike(name, sessionCookie));
      corruptedCookies.forEach(({ name }) => sessionRequest.cookies.delete(name));
      response = NextResponse.next({ request: sessionRequest });
      corruptedCookies.forEach(({ name }) => response.cookies.set(name, "", { path: "/", maxAge: 0 }));
      return { response, session: null, health: "expired" };
    }
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

  let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    authResult = await supabase.auth.getUser();
  } catch {
    return { response, session: null, health: "technical_failure" };
  }
  const { data: { user }, error } = authResult;

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

    return { response, session: null, health: "expired" };
  }

  const session: MiddlewareSession = user
    ? { id: user.id, email: user.email ?? undefined }
    : null;
  const health = resolveSessionHealth({ hasUser: Boolean(user), error });

  let managementEntry = false;
  const pathname = request.nextUrl.pathname;
  const needsEntry = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')
    || ['/login', '/cadastro', '/esqueci-senha'].includes(pathname);
  if (user && health === 'healthy' && needsEntry && isTeamWorkspaceEnabled()) {
    const { data: active, error: activeError } = await supabase.from('users')
      .select('active_clinica_id').eq('id', user.id)
      .maybeSingle<{ active_clinica_id: string | null }>();
    if (activeError) throw new Error('Não foi possível validar a clínica ativa.');
    if (active?.active_clinica_id) {
      const membership = await getPilotEntryMembership(supabase, user.id, active.active_clinica_id);
      managementEntry = membership?.role === 'gestor';
    }
  }
  return { response, session, health, managementEntry };
}
