import { redirect } from "next/navigation";
import { requireClinicContext } from "@/server/auth/clinic";
import { getDentistaCached } from "@/lib/get-dentista";
import { createServiceClient } from "@/lib/supabase/service";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WelcomeModal } from "./_components/welcome-modal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, clinicId } = await requireClinicContext();

  const dentista = await getDentistaCached();

  if (!dentista) {
    redirect("/onboarding");
  }

  // Secretária com primeiro acesso pendente → forçar troca de senha
  if (dentista.role === 'secretaria') {
    const db = createServiceClient();
    const { data: sec } = await db
      .from('secretarias')
      .select('must_change_password')
      .eq('usuario_id', user.id)
      .eq('clinica_id', clinicId)
      .maybeSingle();

    if (sec?.must_change_password) {
      redirect('/primeiro-acesso');
    }
  }

  if (
    dentista.status_assinatura === "trial" &&
    dentista.trial_ends_at &&
    new Date(dentista.trial_ends_at) < new Date()
  ) {
    redirect("/planos?expired=1");
  }

  return (
    <DashboardShell
      nome={dentista.nome}
      clinicaNome={dentista.clinica}
      activeClinicId={clinicId}
      role={dentista.role}
      avatarUrl={dentista.avatar_url}
      plano={dentista.plano}
      dentistaId={dentista.id}
    >
      {children}
      <WelcomeModal clinicaNome={dentista.clinica} />
    </DashboardShell>
  );
}
