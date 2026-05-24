import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { PageTransition } from '@/components/layout/page-transition';
import { DentistaDashboard, DashboardSkeleton } from './_components/dentista-dashboard';
import { SecretariaDashboard } from './_components/secretaria-dashboard';
import type { AgendamentoHoje, DentistaItem } from './_components/secretaria-dashboard';

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

  return (
    <PageTransition>
      <SecretariaDashboard
        nome={nome}
        agendamentos={agendamentos}
        dentistas={dentistas}
        metricas={{ totalHoje, confirmados, aguardando, aReceber, venceHoje, venceSemana }}
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
