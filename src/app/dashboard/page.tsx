import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
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

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const todayStr = now.toISOString().split('T')[0];
  const endOfWeekDate = new Date(now);
  endOfWeekDate.setDate(endOfWeekDate.getDate() + 7);
  const endOfWeekStr = endOfWeekDate.toISOString().split('T')[0];

  const [
    { data: agendamentosRaw },
    { data: dentistasRaw },
    { data: orcamentosRaw },
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
      .neq('role', 'secretaria')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    supabase
      .from('orcamentos')
      .select('total')
      .eq('clinica_id', clinicaId)
      .in('status', ['rascunho', 'enviado']),
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
  const aReceber = (orcamentosRaw ?? []).reduce(
    (sum, o) => sum + (Number(o.total) || 0),
    0,
  );

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
      href: '/dashboard/orcamentos',
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
        metricas={{ totalHoje, confirmados, aguardando, aReceber, venceHoje, venceSemana }}
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
      <PageContainer variant="wide">
        {/* FASE 1: guia desativado — ver roadmap-3-fases A2 */}
        {/* <PrimeirosPassosCard progresso={progresso} dentistaId={dentista.id} /> */}
        {bloqueadoModoConsulta && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-4">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-text-primary mb-0.5">Período de trial encerrado</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                O Modo Consulta está disponível somente nos planos pagos. Suas fichas e histórico continuam acessíveis.
              </p>
            </div>
            <a
              href="/dashboard/configuracoes?aba=plano"
              className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-teal to-teal-lt text-white text-xs font-bold shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              Assinar agora
            </a>
          </div>
        )}
        <Suspense fallback={<DashboardSkeleton />}>
          <DentistaDashboard dentista={dentista} />
        </Suspense>
      </PageContainer>
    </PageTransition>
  );
}
