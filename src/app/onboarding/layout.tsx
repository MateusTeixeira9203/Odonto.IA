import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasDentistaRegistro } from "@/lib/auth";
import { LogoMark } from "@/components/dentai/Logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NeuralBackground } from "@/components/layout/NeuralBackground";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?redirectTo=/onboarding");
  }

  const temDentista = await hasDentistaRegistro(supabase);
  if (temDentista) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-bg">
      <NeuralBackground />

      {/* Barra superior */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-surface/70 backdrop-blur-sm">
        <LogoMark />
        <ThemeToggle />
      </div>

      {/* Conteúdo centralizado */}
      <div className="relative z-10 flex flex-1 items-start justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
