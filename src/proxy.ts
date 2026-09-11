import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_ROUTES = ["/", "/planos"];
const AUTH_ROUTES = ["/login", "/cadastro", "/esqueci-senha"];
const ALWAYS_ALLOWED_AUTH_ROUTES = ["/redefinir-senha"];
const CANONICAL_ORIGIN = 'https://odontoia.app';
const LEGACY_HOSTS = new Set(['dentia.app.br']);
const NON_CANONICAL_HOSTS = new Set(['www.odontoia.app', ...LEGACY_HOSTS]);

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

function isAlwaysAllowedAuthRoute(pathname: string): boolean {
  return ALWAYS_ALLOWED_AUTH_ROUTES.includes(pathname);
}

function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")
    || pathname === '/equipe' || pathname.startsWith('/equipe/')
  );
}

// Cria redirect preservando todos os cookies de updateSession() (token refresh, cleanup).
// Response.redirect() descarta cookies — NextResponse.redirect() + cópia manual garante
// que o refresh do JWT e a limpeza de sessão expirada cheguem ao browser.
function createRedirectResponse(sourceResponse: NextResponse, url: URL): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  // O apex recebe o webhook Stripe sem uma cadeia de redirects. A Vercel deve servir o apex
  // diretamente; www e o host legado só chegam aqui para serem canônicos em uma única resposta.
  // Isso acontece antes de renovar token para não fazer trabalho de autenticação no host errado.
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .toLowerCase()
    .replace(/:\d+$/, '');
  if (NON_CANONICAL_HOSTS.has(host)) {
    const destination = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, CANONICAL_ORIGIN);
    return NextResponse.redirect(destination, 308);
  }

  const { response, session } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname) || isAlwaysAllowedAuthRoute(pathname)) {
    return response;
  }

  if (isAuthRoute(pathname)) {
    if (session) {
      return createRedirectResponse(response, new URL("/dashboard", request.url));
    }
    return response;
  }

  if (isProtectedRoute(pathname)) {
    if (!session) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirectTo", pathname);
      return createRedirectResponse(response, redirectUrl);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)",
  ],
};
