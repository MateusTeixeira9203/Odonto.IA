import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next");

  // Coleta os cookies que o Supabase precisa escrever durante o exchange.
  // Serão copiados para a resposta final — padrão obrigatório em Route Handlers.
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pendingCookies.push(c));
        },
      },
    }
  );

  // ── 1. TROCAR TOKEN POR SESSÃO ─────────────────────────────────────────────
  if (code) {
    // Fluxo PKCE — gerado pelo Supabase para signIn/signUp/invite via código
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[callback] exchangeCodeForSession falhou:", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  } else if (token_hash && type) {
    // Fluxo OTP — convites e magic links enviam token_hash + type
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      console.error("[callback] verifyOtp falhou:", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  } else {
    // Sem código — redirect direto ao login
    return NextResponse.redirect(`${origin}/login`);
  }

  // ── 2. OBTER USUÁRIO E DECIDIR REDIRECIONAMENTO ───────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  console.log("[callback] user id:", user?.id ?? "null");
  console.log("[callback] user metadata:", JSON.stringify(user?.user_metadata ?? {}));

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const meta = user.user_metadata as {
    role?: string;
    clinica_id?: string;
    nome?: string;
  };

  let redirectTo = `${origin}/dashboard`;

  // ── FLUXO DE CONVITE ───────────────────────────────────────────────────────
  // Verifica ANTES do `next` para evitar redirect prematuro sem criar dentista.
  if (meta.role && meta.clinica_id) {
    console.log("[callback] convite — role:", meta.role, "clinica_id:", meta.clinica_id);

    const { data: existing } = await supabase
      .from("dentistas")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const service = createServiceClient();
      const { error: insertError } = await service.from("dentistas").insert({
        user_id:    user.id,
        clinica_id: meta.clinica_id,
        nome:       meta.nome ?? user.email?.split("@")[0] ?? "Usuário",
        email:      user.email ?? null,
        role:       meta.role,
        ativo:      true,
      });

      if (insertError) {
        console.error("[callback] erro ao inserir dentista:", insertError.message);
      } else {
        console.log("[callback] dentista criado — role:", meta.role);
      }

      await service
        .from("convites")
        .delete()
        .eq("clinica_id", meta.clinica_id)
        .eq("email", user.email ?? "");
    } else {
      console.log("[callback] dentista já existe:", existing.id);
    }

    redirectTo = `${origin}/dashboard`;
  }
  // ── FLUXO COM PARÂMETRO `next` (ex: redefinição de senha) ─────────────────
  else if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirectTo = `${origin}${next}`;
  }
  // ── CONFIRMAÇÃO DE EMAIL (novo usuário sem convite) ───────────────────────
  else {
    const { data: dentista } = await supabase
      .from("dentistas")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    redirectTo = dentista ? `${origin}/dashboard` : `${origin}/email-confirmado`;
  }

  // ── 3. RETORNAR REDIRECT COM COOKIES DE SESSÃO ────────────────────────────
  // Os cookies são escritos direto na resposta de redirect para garantir que
  // a sessão seja transmitida ao browser no mesmo round-trip.
  const response = NextResponse.redirect(redirectTo);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
