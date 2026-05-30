import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/user";
import { LogoMark } from "@/components/dentai/Logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NeuralBackground } from "@/components/layout/NeuralBackground";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const { supabase, user } = await requireUser();

  const { data: dentista } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (dentista) {
    redirect("/dashboard");
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
