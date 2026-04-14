import { redirect } from "next/navigation";
import { getDentistaCached } from "@/lib/get-dentista";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WelcomeModal } from "./_components/welcome-modal";
import type { DentistaRole } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Caminho normal: dentista encontrado via RLS
  const dentista = await getDentistaCached();

  if (dentista) {
    // Verifica expiração do trial: no 8º dia redireciona para /planos
    if (
      dentista.status_assinatura === 'trial' &&
      dentista.trial_ends_at &&
      new Date(dentista.trial_ends_at) < new Date()
    ) {
      redirect('/planos?expired=1');
    }

    return (
      <DashboardShell nome={dentista.nome} clinicaNome={dentista.clinica} role={dentista.role} avatarUrl={dentista.avatar_url} plano={dentista.plano} dentistaId={dentista.id}>
        {children}
        <WelcomeModal clinicaNome={dentista.clinica} />
      </DashboardShell>
    );
  }

  // Sem dentista via RLS — verificar sessão
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fallback: busca com service role (ignora RLS) — cobre janela de propagação
  // do JWT logo após o aceite de convite, onde o RLS ainda pode não enxergar a row.
  const service = createServiceClient();
  const { data: existingDentista } = await service
    .from("dentistas")
    .select("id, nome, clinica_id, role, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingDentista) {
    const { data: clinicaData } = await service
      .from("clinicas")
      .select("nome")
      .eq("id", existingDentista.clinica_id)
      .maybeSingle();
    const clinicaNome = (clinicaData as { nome: string } | null)?.nome ?? "";

    return (
      <DashboardShell
        nome={existingDentista.nome}
        clinicaNome={clinicaNome}
        role={existingDentista.role as DentistaRole}
        avatarUrl={(existingDentista as { avatar_url?: string | null }).avatar_url ?? null}
        dentistaId={existingDentista.id}
      >
        {children}
        <WelcomeModal clinicaNome={clinicaNome} />
      </DashboardShell>
    );
  }

  // Autenticado mas sem dentista → primeiro acesso, precisa criar clínica
  redirect("/onboarding");
}
