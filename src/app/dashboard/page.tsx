import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PageTransition } from '@/components/layout/page-transition';
import { DentistaDashboard, DashboardSkeleton } from './_components/dentista-dashboard';
import { SecretariaDashboard } from './_components/secretaria-dashboard';
import type { AgendamentoHoje, DentistaItem } from './_components/secretaria-dashboard';

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard para Secretária — busca dados do dia e repassa ao client component
// ──────────────────────────────────────────────────────────────────────────────
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
      .select('id, data_hora, status, observacoes, paciente:pacientes(id, nome), dentista:dentistas!agendamentos_dentista_id_fkey(id, nome)')
      .eq('clinica_id', clinicaId)
      .gte('data_hora', startOfDay.toISOString())
      .lte('data_hora', endOfDay.toISOString())
      .neq('status', 'cancelado')
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
  const aReceber = (orcamentosRaw ?? []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const pagamentosVencendo = (pagamentosVencendoRaw ?? []) as { data_vencimento: string; valor: number }[];
  const venceHoje = pagamentosVencendo.filter(p => p.data_vencimento === todayStr).length;
  const venceSemana = pagamentosVencendo.filter(p => p.data_vencimento > todayStr).length;

  const totalHoje = agendamentos.length;
  const confirmados = agendamentos.filter(a =>
    ['confirmado', 'na_recepcao', 'em_atendimento', 'realizado'].includes(a.status)
  ).length;
  const aguardando = agendamentos.filter(a => a.status === 'agendado').length;

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

// ──────────────────────────────────────────────────────────────────────────────
// Page principal
// ──────────────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Secretária vê dashboard simplificado (sem fichas clínicas e sem financeiro)
  if (dentista.role === 'secretaria') {
    return <SecretaryDashboardServer clinicaId={dentista.clinica_id} nome={dentista.nome} />;
  }

  // canEdit determina se mostra 3 ou 4 cards no skeleton (sem precisar aguardar os dados)
  const canEdit = dentista.plano === 'SOLO';

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {/* Header — renderizado imediatamente, sem dependência de dados */}
        <header className="flex items-center justify-between mb-8 md:mb-10">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl text-text-primary mb-1">Visão Geral</h1>
            <p className="text-text-secondary text-sm font-medium">
              Monitoramento em tempo real da sua clínica.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard?tour=true"
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-teal/70 hover:text-teal transition-colors px-3 py-2 rounded-xl hover:bg-teal/5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Tour
            </Link>
            <div className="hidden sm:flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-2.5 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
              </span>
              <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">IA Operacional</span>
            </div>
          </div>
        </header>

        {/* Conteúdo com dados — entra via streaming após o header */}
        <Suspense fallback={<DashboardSkeleton canEdit={canEdit} />}>
          <DentistaDashboard dentista={dentista} />
        </Suspense>
      </div>
    </PageTransition>
  );
}
