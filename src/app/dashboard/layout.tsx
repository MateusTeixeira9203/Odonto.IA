import { redirect } from "next/navigation";
import { getDentistaCached } from "@/lib/get-dentista";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { DentistaRole } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── CAMINHO NORMAL ─────────────────────────────────────────────────────────
  const dentista = await getDentistaCached();

  if (dentista) {
    return (
      <DashboardShell nome={dentista.nome} clinicaNome={dentista.clinica} role={dentista.role}>
        {children}
      </DashboardShell>
    );
  }

  // ── SEM DENTISTA — verificar sessão ────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Não autenticado → login
  if (!user) {
    redirect("/login");
  }

  const meta = user.user_metadata as { role?: string; clinica_id?: string; nome?: string };

  // ── FALLBACK DE CONVITE ────────────────────────────────────────────────────
  // Cobre o caso em que o callback perdeu a criação do dentista.
  // Usa query direta (sem cache) para confirmar antes de redirecionar.
  if (meta.role && meta.clinica_id) {
    const service = createServiceClient();

    // Busca nome da clínica para exibir no sidebar
    const { data: clinicaData } = await service
      .from("clinicas")
      .select("nome")
      .eq("id", meta.clinica_id)
      .maybeSingle();
    const clinicaNome = (clinicaData as { nome: string } | null)?.nome ?? "";

    // Verifica se já existe (pode ter sido criado num request anterior do loop)
    const { data: existingDirect } = await service
      .from("dentistas")
      .select("id, nome, clinica_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingDirect) {
      // Cria agora
      const { error: insertError } = await service.from("dentistas").insert({
        user_id:    user.id,
        clinica_id: meta.clinica_id,
        nome:       meta.nome ?? user.email?.split("@")[0] ?? "Usuário",
        email:      user.email ?? null,
        role:       meta.role,
        ativo:      true,
      });

      if (insertError) {
        console.error("[layout] fallback insert falhou:", insertError.message);
        redirect("/login?error=setup_failed");
      }

      await service
        .from("convites")
        .delete()
        .eq("clinica_id", meta.clinica_id)
        .eq("email", user.email ?? "");

      // Confirma criação antes de renderizar
      const { data: created } = await service
        .from("dentistas")
        .select("id, nome, clinica_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!created) {
        console.error("[layout] dentista não encontrado após insert");
        redirect("/login?error=setup_failed");
      }

      return (
        <DashboardShell
          nome={created.nome}
          clinicaNome={clinicaNome}
          role={created.role as DentistaRole}
        >
          {children}
        </DashboardShell>
      );
    }

    // Dentista existia mas getDentistaCached falhou (ex: join de clinica)
    // Renderiza com os dados diretos sem precisar de redirect
    return (
      <DashboardShell
        nome={existingDirect.nome}
        clinicaNome={clinicaNome}
        role={existingDirect.role as DentistaRole}
      >
        {children}
      </DashboardShell>
    );
  }

  // Usuário autenticado mas sem dentista e sem metadados de convite → onboarding
  redirect("/onboarding");
}
