import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

/**
 * Auth callback — ponto único de entrada pós-autenticação.
 *
 * Responsabilidades:
 *  1. Trocar token por sessão (code ou token_hash)
 *  2. Identificar se o usuário tem convite pendente na tabela `convites`
 *  3. Criar/vincular dentista à clínica correta — status_convite sempre 'aceito'
 *  4. Redirecionar:
 *       - Qualquer convidado    → /dashboard?welcome=true (perfil via /dashboard/perfil)
 *       - Sem convite, tem clinica_id → /dashboard
 *       - Sem convite, sem clinica_id → /onboarding
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next");

  // Supabase manda ?error= quando o redirectTo não está na lista permitida
  // ou quando o usuário cancela o consentimento OAuth
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const desc = searchParams.get("error_description") ?? oauthError;
    console.error("[callback] erro OAuth recebido:", desc);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pendingCookies.push(c));
        },
      },
    }
  );

  // ── 1. TROCAR TOKEN POR SESSÃO ─────────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[callback] exchangeCodeForSession falhou:", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      console.error("[callback] verifyOtp falhou:", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login`);
  }

  // ── 2. OBTER USUÁRIO DA SESSÃO ─────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const service = createServiceClient();

  // ── 3. IDENTIFICAÇÃO DE CONVITE ────────────────────────────────────────────
  // Busca na tabela convites pelo email — fonte de verdade independente do JWT.
  // Metadados do JWT servem de fallback caso o registro em convites não exista.
  if (user.email) {
    const { data: convite } = await service
      .from("convites")
      .select("id, role, clinica_id")
      .eq("email", user.email)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const role       = (convite?.role ?? user.user_metadata?.role) as string | undefined;
    const clinica_id = (convite?.clinica_id ?? user.user_metadata?.clinica_id) as string | undefined;

    if (role && clinica_id) {
      // Todo convidado entra diretamente com status aceito
      const status_convite = "aceito";

      // Cria o dentista apenas se ainda não existe (proteção contra dupla execução)
      const { data: existing } = await service
        .from("dentistas")
        .select("id, clinica_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await service.from("dentistas").insert({
          user_id:        user.id,
          clinica_id,
          nome:           (user.user_metadata?.nome as string | undefined)
                          ?? user.email.split("@")[0],
          email:          user.email,
          role,
          ativo:          true,
          status_convite,
        });

        if (insertError) {
          console.error("[callback] erro ao criar dentista:", insertError.message);
          // Continua mesmo com erro — o layout fará fallback via service role
        }
      }

      // Marca convite como aceito (mantém histórico em vez de deletar)
      if (convite?.id) {
        await service
          .from("convites")
          .update({ status: "aceito" })
          .eq("id", convite.id);
      }

      // Todo convidado vai direto ao dashboard — perfil é editado em /dashboard/perfil
      const response = NextResponse.redirect(`${origin}/dashboard?welcome=true`);
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }
  }

  // ── 4. OUTROS FLUXOS (reset de senha, confirmação de email, etc.) ──────────
  // Parâmetro `next` tem prioridade (ex: redefinir-senha)
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    const response = NextResponse.redirect(`${origin}${next}`);
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  }

  // Sem convite e sem next → verifica se o usuário já tem dentista
  const { data: dentista } = await supabase
    .from("dentistas")
    .select("clinica_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const redirectTo = dentista?.clinica_id
    ? `${origin}/dashboard`
    : `${origin}/onboarding`;

  const response = NextResponse.redirect(redirectTo);
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
