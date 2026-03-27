import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    // Redireciona para rota explícita (ex: /redefinir-senha após recuperação de senha)
    // Valida que next é uma rota interna (começa com / mas não com //)
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: dentista } = await supabase
        .from("dentistas")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!dentista) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
