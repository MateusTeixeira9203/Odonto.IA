import { redirect } from 'next/navigation';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { requirePermission } from '@/server/authorization/guards';
import { ConfiguracoesClient } from './_components/configuracoes-client';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento, DentistaRole } from '@/types/database';
import { PageTransition } from '@/components/layout/page-transition';
import type { PlanoId } from '@/lib/planos';
import { createServiceClient } from '@/lib/supabase/service';
import { clinicaIsentaDeCobranca } from '@/lib/billing/exemptions';
import { resolverEstadoComercial } from '@/lib/billing/estado-comercial';

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { supabase, user, clinicId } = await requirePermission('configuracoes');

  const params = await searchParams;
  const catalogoNoConsultorio = isTeamWorkspaceEnabled();
  if (catalogoNoConsultorio && params.aba === 'procedimentos') {
    redirect('/dashboard/meu-consultorio/precos');
  }
  const abaInicial = params.aba ?? 'clinica';

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id, nome, cro, role, clinica:clinicas(nome)')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  const [
    { data: configRaw },
    { data: horariosRaw },
    { data: procedimentosRaw },
    { data: usuariosRaw },
    { data: convitesRaw },
    { data: clinicaRaw },
  ] = await Promise.all([
    supabase.from('configuracoes_clinica').select('*').eq('clinica_id', clinicId).maybeSingle(),
    supabase.from('horarios_disponiveis').select('*').eq('dentista_id', dentistaPerfil?.id ?? '').order('dia_semana', { ascending: true }),
    catalogoNoConsultorio
      ? Promise.resolve({ data: [] })
      : supabase.from('procedimentos').select('*').eq('clinica_id', clinicId).eq('dentista_id', dentistaPerfil?.id ?? '').order('categoria', { ascending: true }),
    supabase.from('dentistas').select('id, nome, email, role, ativo, created_at').eq('clinica_id', clinicId).order('created_at', { ascending: true }),
    supabase.from('convites').select('id, email, role, expires_at, created_at').eq('clinica_id', clinicId).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    supabase.from('clinicas').select('limite_dentistas, plano, status_assinatura, trial_ends_at, procedimentos_pendente').eq('id', clinicId).single(),
  ]);

  const clinicaData = clinicaRaw as {
    limite_dentistas: number;
    plano?: string;
    status_assinatura?: string;
    trial_ends_at?: string | null;
    procedimentos_pendente?: boolean;
  } | null;
  const procedimentosPendente = clinicaData?.procedimentos_pendente ?? false;
  const limiteDentistas = clinicaData?.limite_dentistas ?? 5;
  const planoClinica = (clinicaData?.plano ?? 'SOLO') as PlanoId;
  let statusAssinatura = clinicaData?.status_assinatura ?? 'inativo';
  let trialEndsAt = clinicaData?.trial_ends_at ?? null;
  let graceEndsAt: string | null = null;

  let formacao: { status: string; expiresAt: string | null; cartoesProntos: number } | undefined;
  let elegibilidade = { status: 'regular', prazoEquipe: null as string | null };
  if (process.env.STRIPE_BILLING_ENABLED === 'true') {
    const service = createServiceClient();
    const { data: assinaturaRaw } = await service.from('assinaturas_dentista')
      .select('status, trial_ends_at, grace_ends_at').eq('usuario_id', user.id).eq('clinica_id', clinicId)
      .maybeSingle<{ status: string; trial_ends_at: string | null; grace_ends_at: string | null }>();
    if (assinaturaRaw) {
      statusAssinatura = assinaturaRaw.status;
      trialEndsAt = assinaturaRaw.trial_ends_at;
      graceEndsAt = assinaturaRaw.grace_ends_at;
    }
    const { data: elegibilidadeRaw } = await service.from('clinicas')
      .select('status_elegibilidade, equipe_minima_ends_at').eq('id', clinicId)
      .maybeSingle<{ status_elegibilidade: string; equipe_minima_ends_at: string | null }>();
    if (elegibilidadeRaw) {
      elegibilidade = {
        status: elegibilidadeRaw.status_elegibilidade,
        prazoEquipe: elegibilidadeRaw.equipe_minima_ends_at,
      };
    }
    const { data: formacaoRaw } = await service.from('formacoes_clinica')
      .select('id, status, expires_at').eq('clinica_id', clinicId)
      .in('status', ['aguardando_equipe', 'coletando_pagamento', 'ativando', 'ativa'])
      .order('created_at', { ascending: false }).limit(1)
      .maybeSingle<{ id: string; status: string; expires_at: string | null }>();
    if (formacaoRaw) {
      const { count } = await service.from('assinaturas_dentista')
        .select('id', { count: 'exact', head: true })
        .eq('formacao_id', formacaoRaw.id).in('status', ['cartao_pronto', 'trialing', 'active']);
      formacao = { status: formacaoRaw.status, expiresAt: formacaoRaw.expires_at, cartoesProntos: count ?? 0 };
    }
  }
  const estadoComercial = resolverEstadoComercial({
    isento: clinicaIsentaDeCobranca(clinicId),
    statusAssinatura,
    formacaoAtiva: Boolean(formacao && formacao.status !== 'ativa'),
  });

  const dentistasAtivos = ((usuariosRaw ?? []) as Array<{ role: string; ativo: boolean }>).filter(
    (u) => (u.role === 'admin' || u.role === 'dentista') && u.ativo
  ).length;
  const convitesDentistasPendentes = ((convitesRaw ?? []) as Array<{ role: string }>).filter(
    (c) => c.role === 'admin' || c.role === 'dentista'
  ).length;
  const convitesRestantes = Math.max(0, limiteDentistas - dentistasAtivos - convitesDentistasPendentes);

  const meuRole = ((dentistaPerfil as unknown as { role?: DentistaRole } | null)?.role) ?? 'dentista';

  // logo_url guarda o caminho no storage (bucket privado, migration 117) — gera URL
  // assinada de curta duração na leitura, igual ao avatar em getDentistaCached().
  const config = (configRaw as ConfiguracaoClinica | null) ?? null;
  if (config?.logo_url) {
    const { data: signedData } = await supabase.storage
      .from('avatars')
      .createSignedUrl(config.logo_url, 60 * 60);
    config.logo_url = signedData?.signedUrl ?? null;
  }

  return (
    <PageTransition>
      <ConfiguracoesClient
        plano={planoClinica}
        estadoComercial={{ estado: estadoComercial, trialEndsAt, graceEndsAt }}
        formacao={formacao}
        elegibilidade={elegibilidade}
        abrirFormacaoInicial={params.criar === 'clinica'}
        procedimentosPendente={procedimentosPendente}
        catalogoNoConsultorio={catalogoNoConsultorio}
        clinicId={clinicId}
        dentista={{
          id: dentistaPerfil?.id ?? '',
          nome: (dentistaPerfil?.nome as string) ?? '',
          cro: (dentistaPerfil?.cro as string | null) ?? null,
          role: meuRole as DentistaRole,
          clinica: (dentistaPerfil?.clinica as unknown as { nome: string } | null)?.nome ?? '',
        }}
        config={config}
        horarios={(horariosRaw as HorarioDisponivel[]) ?? []}
        procedimentos={(procedimentosRaw as Procedimento[]) ?? []}
        abaInicial={abaInicial}
        // Gestão colaborativa: todo dentista ativo vê a equipe; secretária e protético não.
        equipe={meuRole === 'admin' || meuRole === 'dentista' ? {
          usuarios: (usuariosRaw as Array<{ id: string; nome: string; email: string | null; role: DentistaRole; ativo: boolean; created_at: string }>) ?? [],
          convitesPendentes: (convitesRaw as Array<{ id: string; email: string; role: DentistaRole; expires_at: string; created_at: string }>) ?? [],
          meuId: dentistaPerfil?.id ?? '',
          meuRole: meuRole as DentistaRole,
          limiteDentistas,
          convitesRestantes,
        } : undefined}
      />
    </PageTransition>
  );
}
