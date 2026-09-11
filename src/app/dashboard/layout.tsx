import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireClinicContext } from "@/server/auth/clinic";
import { getDentistaCached } from "@/lib/get-dentista";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WelcomeModal } from "./_components/welcome-modal";
import { createServiceClient } from '@/lib/supabase/service';
import { clinicaIsentaDeCobranca } from '@/lib/billing/exemptions';
import { estadoComercialBloqueiaOperacao, resolverEstadoComercial } from '@/lib/billing/estado-comercial';
import { obterAcessoFormacaoClinica } from '@/server/services/formacao-clinica';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';

const ROTA_PROTETICO = "/dashboard/protetico";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { clinicId, user, supabase } = await requireClinicContext();
  const pathname = (await headers()).get('x-pathname') ?? '/dashboard';

  const dentista = await getDentistaCached();
  const consultorioPessoalEnabled = isTeamWorkspaceEnabled()
    && (dentista?.role === 'admin' || dentista?.role === 'dentista');
  let bloqueioPagamento = false;

  if (!dentista) {
    redirect("/onboarding");
  }

  if (process.env.LEGAL_ACCEPTS_ENABLED === 'true') {
    const { data: aceiteTermos } = await supabase
      .from('aceites_termos')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('versao', '1.0-draft')
      .maybeSingle();
    if (!aceiteTermos) redirect(`/termos-de-uso?next=${encodeURIComponent(pathname)}`);
  }

  if (process.env.STRIPE_BILLING_ENABLED === 'true') {
    const billingDb = createServiceClient();
    const [{ data: clinicaBilling }, { data: assinaturaIndividual }, acessoFormacao] = await Promise.all([
      billingDb.from('clinicas')
        .select('status_elegibilidade').eq('id', clinicId)
        .maybeSingle<{ status_elegibilidade: string }>(),
      (dentista.role === 'admin' || dentista.role === 'dentista')
        ? billingDb.from('assinaturas_dentista').select('status')
          .eq('usuario_id', user.id).eq('clinica_id', clinicId)
          .maybeSingle<{ status: string }>()
        : Promise.resolve({ data: null }),
      (dentista.role === 'admin' || dentista.role === 'dentista')
        ? obterAcessoFormacaoClinica({ userId: user.id, clinicId })
        : Promise.resolve({ liberado: false, expiresAt: null }),
    ]);

    if (dentista.role === 'admin' || dentista.role === 'dentista') {
      const statusIndividual = assinaturaIndividual?.status;
      const estadoComercial = resolverEstadoComercial({
        isento: clinicaIsentaDeCobranca(clinicId),
        statusAssinatura: statusIndividual,
        formacaoAtiva: acessoFormacao.liberado,
      });
      bloqueioPagamento = estadoComercialBloqueiaOperacao(estadoComercial)
        && !acessoFormacao.liberado;
    }

    if (clinicaBilling && ['decisao_pendente', 'bloqueada'].includes(clinicaBilling.status_elegibilidade)) {
      const configuracoes = '/dashboard/configuracoes';
      const arquivoClinico = '/dashboard/arquivo-clinico';
      if (dentista.role === 'admin' || dentista.role === 'dentista') {
        const rotaPermitida = pathname === configuracoes
          || pathname.startsWith(`${configuracoes}/`)
          || pathname === arquivoClinico
          || pathname.startsWith(`${arquivoClinico}/`);
        if (!rotaPermitida) {
          redirect(`${configuracoes}?aba=clinica`);
        }
      } else {
        redirect('/planos?blocked=clinic');
      }
    }
  }

  // R-94 — gate de ponto único: protético só acessa a própria agenda. A permissão do
  // projeto é deny-list sem exhaustive check (63 arquivos com gate negativo, nenhum
  // pego pelo compilador) — em vez de auditar todos, um choke point aqui garante que
  // qualquer rota (existente ou futura) fica bloqueada por padrão pra esse role.
  if (dentista.role === "protetico") {
    if (pathname !== ROTA_PROTETICO && !pathname.startsWith(`${ROTA_PROTETICO}/`)) {
      redirect(ROTA_PROTETICO);
    }
  }

  // Guard: secretária com must_change_password = true deve definir senha antes de entrar.
  if (dentista.role === "secretaria") {
    const { data: sec } = await supabase
      .from("secretarias")
      .select("must_change_password")
      .eq("usuario_id", user.id)
      .maybeSingle();
    if (sec?.must_change_password) redirect("/primeiro-acesso");
  }

  if (
    process.env.STRIPE_BILLING_ENABLED !== 'true' &&
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
      bloqueioPagamento={bloqueioPagamento}
      consultorioPessoalEnabled={consultorioPessoalEnabled}
    >
      {children}
      <WelcomeModal clinicaNome={dentista.clinica} />
    </DashboardShell>
  );
}
