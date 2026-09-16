import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireClinicContext } from "@/server/auth/clinic";
import { getDentistaCached } from "@/lib/get-dentista";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WelcomeModal } from "./_components/welcome-modal";
import { createServiceClient } from '@/lib/supabase/service';
import { clinicaIsentaDeCobranca } from '@/lib/billing/exemptions';
import { resolverEstadoComercial } from '@/lib/billing/estado-comercial';
import { obterAcessoFormacaoClinica } from '@/server/services/formacao-clinica';
import { obterContextoClinica } from '@/server/clinica/operations';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { getReceptionContext } from '@/server/auth/reception-context';
import { hasRecebimentosOperationalAccess } from '@/server/auth/operational-access';
import { getMemberContext } from '@/server/auth/member-context';
import { createClient } from '@/lib/supabase/server';

const ROTA_PROTETICO = "/dashboard/protetico";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get('x-pathname') ?? '/dashboard';
  const reception = await getReceptionContext();

  // A recepção sem CRO não pode atravessar requireClinicContext(): ele exige um registro em
  // dentistas e a colocaria indevidamente no onboarding. A rota liberada ainda passa por
  // sua policy/RPC própria; o shell não concede capacidades nem navegação clínica.
  if (reception.ok) {
    const operationalRecebimentos = await hasRecebimentosOperationalAccess(reception.data.clinicaId);
    if (
      pathname !== '/dashboard/agendamentos'
      && pathname !== '/dashboard/pacientes'
      && pathname !== '/dashboard/pendencias'
      && pathname !== '/dashboard/recebimentos'
    ) {
      redirect('/dashboard/agendamentos');
    }

    const supabase = await createClient();
    if (process.env.LEGAL_ACCEPTS_ENABLED === 'true') {
      const { data: aceiteTermos } = await supabase
        .from('aceites_termos')
        .select('id')
        .eq('usuario_id', reception.data.usuarioId)
        .eq('versao', '1.0-draft')
        .maybeSingle();
      if (!aceiteTermos) redirect(`/termos-de-uso?next=${encodeURIComponent(pathname)}`);
    }

    if (process.env.STRIPE_BILLING_ENABLED === 'true') {
      const billingDb = createServiceClient();
      const { data: clinicaBilling } = await billingDb.from('clinicas')
        .select('status_elegibilidade').eq('id', reception.data.clinicaId)
        .maybeSingle<{ status_elegibilidade: string }>();
      if (clinicaBilling && ['decisao_pendente', 'bloqueada'].includes(clinicaBilling.status_elegibilidade)) {
        redirect('/planos?blocked=clinic');
      }
    }

    const { data: secretaria } = await supabase
      .from('secretarias')
      .select('must_change_password')
      .eq('usuario_id', reception.data.usuarioId)
      .eq('clinica_id', reception.data.clinicaId)
      .maybeSingle<{ must_change_password: boolean }>();
    if (secretaria?.must_change_password) redirect('/primeiro-acesso');

    return (
      <DashboardShell
        nome={reception.data.nome}
        clinicaNome={reception.data.clinicaNome}
        activeClinicId={reception.data.clinicaId}
        role="secretaria"
        operationalReception
        operationalRecebimentos={operationalRecebimentos}
      >
        {children}
      </DashboardShell>
    );
  }

  // Proprietário sem perfil clínico não atravessa requireClinicContext(), que exige
  // dentista. Recebimentos continua protegido pela RPC; este shell só dá a rota para
  // quem já tem contexto de proprietário ou a leitura operacional de cobranças.
  if (pathname === '/dashboard/recebimentos') {
    const member = await getMemberContext();
    if (member.ok && member.data.perfilClinico === null) {
      const [contexto, acessoOperacional] = await Promise.all([
        obterContextoClinica({ clinicaIdEsperada: member.data.clinicaId }),
        hasRecebimentosOperationalAccess(member.data.clinicaId),
      ]);
      if (contexto.ok && (contexto.data.proprietario || acessoOperacional)) {
        if (process.env.LEGAL_ACCEPTS_ENABLED === 'true') {
          const supabase = await createClient();
          const { data: aceiteTermos, error: aceiteError } = await supabase
            .from('aceites_termos')
            .select('id')
            .eq('usuario_id', member.data.usuarioId)
            .eq('versao', '1.0-draft')
            .maybeSingle();
          if (aceiteError) throw new Error('Não foi possível verificar o aceite dos termos.');
          if (!aceiteTermos) redirect(`/termos-de-uso?next=${encodeURIComponent(pathname)}`);
        }
        return (
          <DashboardShell
            nome={member.data.email?.split('@')[0] ?? 'Membro da clínica'}
            clinicaNome={contexto.data.nome}
            activeClinicId={member.data.clinicaId}
            role={member.data.role}
            managementOnly
          >
            {children}
          </DashboardShell>
        );
      }
    }
  }

  const { clinicId, user, supabase } = await requireClinicContext();

  const dentista = await getDentistaCached();
  const consultorioPessoalEnabled = isTeamWorkspaceEnabled()
    && (dentista?.role === 'admin' || dentista?.role === 'dentista');
  const ownerContext = consultorioPessoalEnabled ? await obterContextoClinica({ clinicaIdEsperada: clinicId }) : null;

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
      const assinaturaLiberada = ['isento', 'trial', 'ativo', 'past_due'].includes(estadoComercial)
        || acessoFormacao.liberado;

      if (!assinaturaLiberada) {
        const aguardandoCheckout = statusIndividual
          && ['aguardando_formacao', 'checkout_pendente', 'cartao_pronto'].includes(statusIndividual);
        redirect(aguardandoCheckout ? '/bem-vindo-agregado' : '/planos?billing=required');
      }
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
      consultorioPessoalEnabled={consultorioPessoalEnabled}
      clinicaOwnerEnabled={ownerContext?.ok === true && ownerContext.data.proprietario}
      pendenciasEnabled={isTeamWorkspaceEnabled()}
    >
      {children}
      <WelcomeModal clinicaNome={dentista.clinica} />
    </DashboardShell>
  );
}
