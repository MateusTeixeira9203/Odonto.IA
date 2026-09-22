import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/user";
import { LogoMark } from "@/components/dentai/Logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NeuralBackground } from "@/components/layout/NeuralBackground";
import { getMemberContext } from '@/server/auth/member-context';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const { supabase, user } = await requireUser();
  const member = await getMemberContext();
  if (member.ok && !member.data.perfilClinico) redirect('/consultorio');

  // Guard: redireciona pro dashboard só quando o onboarding está CONCLUÍDO.
  // No fluxo novo o dentista é criado no meio (pra demo rodar), então "dentista
  // existe" não significa "concluído" — a fonte de verdade é clinicas.onboarding_completo.
  const { data: u } = await supabase
    .from("users")
    .select("active_clinica_id")
    .eq("id", user.id)
    .maybeSingle();

  if (u?.active_clinica_id) {
    const { data: clinica } = await supabase
      .from("clinicas")
      .select("onboarding_completo")
      .eq("id", u.active_clinica_id)
      .maybeSingle();

    if (clinica?.onboarding_completo) {
      redirect(member.ok && member.data.perfilClinico ? "/dashboard" : "/consultorio");
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-bg">
      <NeuralBackground />

      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-surface/70 backdrop-blur-sm">
        <LogoMark />
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex flex-1 items-start justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
