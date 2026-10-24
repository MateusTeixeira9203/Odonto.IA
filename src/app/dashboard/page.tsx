import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { hojeBRT, inicioDoDiaBRT, fimDoDiaBRT } from '@/lib/hora-brt';
import { createClient } from '@/lib/supabase/server';
import { PageTransition } from '@/components/layout/page-transition';
import { PageContainer } from '@/components/layout/page-container';
import { DentistaDashboard, DashboardSkeleton } from './_components/dentista-dashboard';
import { SecretariaDashboard } from './_components/secretaria-dashboard';
import type { AgendamentoHoje, DentistaItem, PendenciaItem } from './_components/secretaria-dashboard';
// FASE 1: guia desativado — ver roadmap-3-fases A2
// import { getOnboardingProgresso } from '@/lib/onboarding-progress';
// import { PrimeirosPassosCard } from '@/components/dashboard/primeiros-passos-card';

// ── Dashboard para Secretária ─────────────────────────────────────────────────

async function SecretaryDashboardServer({
  clinicaId,
  nome,
}: {
  clinicaId: string;
  nome: string;
}) {
  const supabase = await createClient();
  const now = new Date();

  const startOfDay = inicioDoDiaBRT(now);
  const endOfDay = fimDoDiaBRT(now);

  const todayStr = hojeBRT(now);
  const endOfWeekStr = hojeBRT(new Date(startOfDay.getTime() + 7 * 86_400_000));

  const [
    { data: agendamentosRaw },
    { data: dentistasRaw },
    { data: pagamentosVencendoRaw },
    { data: pagamentosVencidosRaw },
    { data: followupsRaw },
  ] = await Promise.all([
    supabase
      .from('agendamentos')
      .select(
        'id, data_hora, status, observacoes, paciente:pacientes(id, nome), dentista:dentistas!agendamentos_dentista_id_fkey(id, nome)',
      )
      .eq('clinica_id', clinicaId)
      .gte('data_hora', startOfDay.toISOString())
      .lte('data_hora', endOfDay.toISOString())
      .neq('status', 'cancelled')
      .order('data_hora', { ascending: true })
      .limit(50),
    supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      // R-94 — .neq('role','secretaria') sozinho deixaria 'protetico' entrar aqui.
      .in('role', ['admin', 'dentista'])
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    supabase
      .from('pagamentos')
      .select('data_vencimento, valor')
      .eq('clinica_id', clinicaId)
      .eq('status', 'pendente')
      .not('data_vencimento', 'is', null)
      .gte('data_vencimento', todayStr)
      .lte('data_vencimento', endOfWeekStr),
    // Pagamentos vencidos (data_vencimento < hoje)
    supabase
      .from('pagamentos')
      .select('id, valor, data_vencimento, paciente:pacientes(id, nome)')
      .eq('clinica_id', clinicaId)
      .eq('status', 'pendente')
      .not('data_vencimento', 'is', null)
      .lt('data_vencimento', todayStr)
      .order('data_vencimento', { ascending: true })
      .limit(8),
    // Pacientes com follow-up pendente (excluindo snoozed)
    supabase
      .from('pacientes')
      .select('id, nome, followup_nota, followup_em')
      .eq('clinica_id', clinicaId)
      .eq('followup_pendente', true)
      .or(`followup_snooze_ate.is.null,followup_snooze_ate.lt.${now.toISOString()}`)
      .order('followup_em', { ascending: true })
      .limit(8),
  ]);

  const agendamentos = (agendamentosRaw ?? []) as unknown as AgendamentoHoje[];
  const dentistas = (dentistasRaw ?? []) as DentistaItem[];

  const pagamentosVencendo = (pagamentosVencendoRaw ?? []) as {
    data_vencimento: string;
    valor: number;
  }[];
  const venceHoje = pagamentosVencendo.filter(
    (p) => p.data_vencimento === todayStr,
  ).length;
  const venceSemana = pagamentosVencendo.filter(
    (p) => p.data_vencimento > todayStr,
  ).length;

  const totalHoje = agendamentos.length;
  const confirmados = agendamentos.filter((a) =>
    ['confirmed', 'checked_in', 'in_progress', 'completed'].includes(a.status),
  ).length;
  const aguardando = agendamentos.filter((a) => a.status === 'scheduled').length;

  // ── Pendências ─────────────────────────────────────────────────────────────
  const pendencias: PendenciaItem[] = [];

  function calcPrioridade(tipo: PendenciaItem['tipo'], dias = 0): PendenciaItem['prioridade'] {
    if (tipo === 'pagamento_vencido') return dias > 3 ? 'high' : 'medium';
    return 'low';
  }

  for (const pg of (pagamentosVencidosRaw ?? []) as unknown as Array<{ id: string; valor: number; data_vencimento: string; paciente: { id: string; nome: string } | null }>) {
    if (!pg.paciente) continue;
    const dias = Math.floor((now.getTime() - new Date(pg.data_vencimento).getTime()) / 86_400_000);
    const valor = Number(pg.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    pendencias.push({
      tipo: 'pagamento_vencido',
      prioridade: calcPrioridade('pagamento_vencido', dias),
      pacienteId: pg.paciente.id,
      pacienteNome: pg.paciente.nome,
      descricao: `Pagamento ${valor} vencido há ${dias} dia${dias !== 1 ? 's' : ''}`,
      href: `/dashboard/pacientes/${pg.paciente.id}?tab=orcamentos`,
      diasAtrasado: dias,
    });
  }

  for (const fp of (followupsRaw ?? []) as unknown as Array<{ id: string; nome: string; followup_nota: string | null }>) {
    pendencias.push({
      tipo: 'followup_pendente',
      prioridade: 'low',
      pacienteId: fp.id,
      pacienteNome: fp.nome,
      descricao: fp.followup_nota ?? 'Follow-up pendente',
      href: `/dashboard/pacientes/${fp.id}`,
    });
  }

  // Ordenar por prioridade desc, depois por dias desc
  const PRIO_ORDER: Record<PendenciaItem['prioridade'], number> = { high: 0, medium: 1, low: 2 };
  pendencias.sort((a, b) => {
    const diff = PRIO_ORDER[a.prioridade] - PRIO_ORDER[b.prioridade];
    if (diff !== 0) return diff;
    return (b.diasAtrasado ?? 0) - (a.diasAtrasado ?? 0);
  });

  return (
    <PageTransition>
      <SecretariaDashboard
        nome={nome}
        agendamentos={agendamentos}
        dentistas={dentistas}
        metricas={{ totalHoje, confirmados, aguardando, venceHoje, venceSemana }}
        pendencias={pendencias.slice(0, 8)}
      />
    </PageTransition>
  );
}

// ── Page principal ────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bloqueado?: string }>;
}) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  if (dentista.role === 'secretaria') {
    return (
      <SecretaryDashboardServer
        clinicaId={dentista.clinica_id}
        nome={dentista.nome}
      />
    );
  }

  const sp = await searchParams;
  const bloqueadoModoConsulta = sp.bloqueado === 'modo-consulta';
  return (
    <PageTransition>
      <PageContainer variant="tela">
        {/* FASE 1: guia desativado — ver roadmap-3-fases A2 */}
        {/* <PrimeirosPassosCard progresso={progresso} dentistaId={dentista.id} /> */}
        <Suspense fallback={<DashboardSkeleton />}>
          <DentistaDashboard dentista={dentista}>
            {bloqueadoModoConsulta && (
              <div className="mb-6 flex items-center gap-4 border-l-2 border-warning py-2 pl-3 max-[600px]:flex-col max-[600px]:items-stretch">
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-[13px] font-bold text-warning-ink">Período de trial encerrado</p>
                  <p className="text-[12px] leading-relaxed text-text-secondary">
                    O Modo Consulta está disponível somente nos planos pagos. Suas fichas e histórico continuam acessíveis.
                  </p>
                </div>
                <a
                  href="/dashboard/configuracoes?aba=plano"
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] border border-border px-[13px] text-[13px] text-text-secondary hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20"
                >
                  Assinar agora
                </a>
              </div>
            )}
          </DentistaDashboard>
        </Suspense>
      </PageContainer>
    </PageTransition>
  );
}
