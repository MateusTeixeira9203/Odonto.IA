import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { PageTransition } from '@/components/layout/page-transition';
import { DentistaDashboard, DashboardSkeleton } from './_components/dentista-dashboard';
import { SecretariaDashboard } from './_components/secretaria-dashboard';
import type { AgendamentoHoje, DentistaItem, PendenciaItem } from './_components/secretaria-dashboard';

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

  const limiteOrcamento = new Date(now.getTime() - 5 * 86_400_000).toISOString();

  const [
    { data: agendamentosRaw },
    { data: dentistasRaw },
    { data: orcamentosRaw },
    { data: pagamentosVencendoRaw },
    { data: orcamentosParadosRaw },
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
    // Orçamentos enviados parados há > 5 dias
    supabase
      .from('orcamentos')
      .select('id, created_at, total, paciente:pacientes(id, nome)')
      .eq('clinica_id', clinicaId)
      .eq('status', 'enviado')
      .lt('created_at', limiteOrcamento)
      .order('created_at', { ascending: true })
      .limit(8),
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
    if (tipo === 'orcamento_parado') return dias > 14 ? 'medium' : 'low';
    return 'low';
  }

  for (const orc of (orcamentosParadosRaw ?? []) as unknown as Array<{ id: string; created_at: string; total: number | null; paciente: { id: string; nome: string } | null }>) {
    if (!orc.paciente) continue;
    const dias = Math.floor((now.getTime() - new Date(orc.created_at).getTime()) / 86_400_000);
    pendencias.push({
      tipo: 'orcamento_parado',
      prioridade: calcPrioridade('orcamento_parado', dias),
      pacienteId: orc.paciente.id,
      pacienteNome: orc.paciente.nome,
      descricao: `Orçamento aguardando há ${dias} dia${dias !== 1 ? 's' : ''}`,
      href: '/dashboard/orcamentos',
      diasAtrasado: dias,
    });
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

export default async function DashboardPage() {
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

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        <Suspense fallback={<DashboardSkeleton />}>
          <DentistaDashboard dentista={dentista} />
        </Suspense>
      </div>
    </PageTransition>
  );
}
