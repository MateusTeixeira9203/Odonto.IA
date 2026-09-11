import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from '@/lib/supabase/service';
import { clinicaIsentaDeCobranca } from '@/lib/billing/exemptions';
import { estadoComercialBloqueiaOperacao, resolverEstadoComercial } from '@/lib/billing/estado-comercial';
import { obterAcessoFormacaoClinica } from '@/server/services/formacao-clinica';
import { getPilotEntryMembership, isTeamWorkspaceEnabled } from './team-workspace-pilot';

export type ClinicRole = "dentista" | "secretaria" | "admin" | "protetico";

type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type ClinicContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: AuthenticatedUser;
  clinicId: string;
  dentistaId: string;
  role: ClinicRole;
};

type ClinicContextOptions = {
  /** Checkout e reconciliação precisam continuar acessíveis mesmo com operação clínica bloqueada. */
  allowBlockedBilling?: boolean;
};

async function bloquearServerActionSemPagamento(input: {
  userId: string;
  clinicId: string;
  role: ClinicRole;
  allowBlockedBilling: boolean;
}): Promise<void> {
  const requestHeaders = await headers();
  if (
    input.allowBlockedBilling
    || !requestHeaders.has('next-action')
    || process.env.STRIPE_BILLING_ENABLED !== 'true'
    || !['admin', 'dentista'].includes(input.role)
    || clinicaIsentaDeCobranca(input.clinicId)
  ) {
    return;
  }

  const db = createServiceClient();
  const [{ data: assinatura, error }, acessoFormacao] = await Promise.all([
    db.from('assinaturas_dentista').select('status')
      .eq('usuario_id', input.userId).eq('clinica_id', input.clinicId)
      .maybeSingle<{ status: string }>(),
    obterAcessoFormacaoClinica({ userId: input.userId, clinicId: input.clinicId }),
  ]);
  if (error) throw new Error('Não foi possível verificar a situação de pagamento.');
  const estado = resolverEstadoComercial({
    isento: false,
    statusAssinatura: assinatura?.status,
    formacaoAtiva: acessoFormacao.liberado,
  });
  if (estadoComercialBloqueiaOperacao(estado) && !acessoFormacao.liberado) {
    throw new Error('A operação está travada até a regularização do pagamento.');
  }
}

/**
 * Resolve o contexto autenticado de clínica a partir das fontes canônicas:
 *
 * 1. users.active_clinica_id  — qual clínica está ativa para este usuário
 * 2. clinica_usuarios + dentistas — em paralelo, pois ambos dependem só de clinicId
 *
 * Usa React.cache() para deduplicar chamadas dentro do mesmo render (layout + page).
 */
export const requireClinicContext = cache(async (options: ClinicContextOptions = {}): Promise<ClinicContext> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── 1. Resolver clínica ativa ────────────────────────────────────────────────
  const { data: userRecord } = await supabase
    .from("users")
    .select("active_clinica_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) redirect("/onboarding");

  const clinicId = userRecord.active_clinica_id as string;

  // ── 2. Membership + perfil clínico em paralelo ───────────────────────────────
  const [{ data: membership }, { data: dentista }] = await Promise.all([
    isTeamWorkspaceEnabled()
      ? getPilotEntryMembership(supabase, user.id, clinicId).then((data) => ({ data }))
      : supabase
      .from("clinica_usuarios")
      .select("role, status")
      .eq("usuario_id", user.id)
      .eq("clinica_id", clinicId)
      .maybeSingle(),
    supabase
      .from("dentistas")
      .select("id")
      .eq("user_id", user.id)
      .eq("clinica_id", clinicId)
      .maybeSingle(),
  ]);

  if (!membership) redirect("/onboarding");
  // Vínculo não clínico, inclusive suspenso, não entra no onboarding de dentista.
  // A área de equipe revalida vínculo ativo e concessão antes de mostrar qualquer dado.
  if (isTeamWorkspaceEnabled() && membership.role === 'gestor') redirect('/equipe');
  if (membership.status !== 'ativo') {
    if (membership.role === 'dentista' && (membership.status === 'pendente' || membership.status === 'suspenso')) {
      redirect('/bem-vindo-agregado');
    }
    redirect('/onboarding');
  }
  if (!dentista) redirect("/onboarding");

  await bloquearServerActionSemPagamento({
    userId: user.id,
    clinicId,
    role: membership.role as ClinicRole,
    allowBlockedBilling: options.allowBlockedBilling ?? false,
  });

  return {
    supabase,
    user: { id: user.id, email: user.email ?? undefined },
    clinicId,
    dentistaId: dentista.id,
    role: membership.role as ClinicRole,
  };
});
