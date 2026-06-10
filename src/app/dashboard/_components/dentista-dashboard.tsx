import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import type { DentistaCache } from '@/lib/get-dentista';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { NextAppointmentHero } from '@/components/dashboard/next-appointment-hero';
import { AttentionPanel } from '@/components/dashboard/attention-panel';

// ── Tipo local para as rows brutas do Supabase ────────────────────────────────

type AtendimentoRaw = {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string | null;
  paciente: { id: string; nome: string; observacoes: string | null } | null;
};

// ── Status que encerram o atendimento ─────────────────────────────────────────

const DONE = new Set(['completed', 'no_show', 'cancelled']);

// ── Server Component principal ────────────────────────────────────────────────

export async function DentistaDashboard({ dentista }: { dentista: DentistaCache }) {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

  const [
    { count: consultasHoje },
    { count: concluidosHoje },
    { count: agendaSemana },
    { count: semConfirmacao },
    { data: orcamentosAguardandoRaw },
    { data: atendimentosHojeRaw },
  ] = await Promise.all([
    // Consultas hoje (não canceladas / no-show)
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .not('status', 'in', '(cancelled,no_show)')
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd),

    // Concluídos hoje
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .eq('status', 'completed')
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd),

    // Agenda da semana
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .not('status', 'in', '(cancelled,no_show)')
      .gte('data_hora', weekStart)
      .lte('data_hora', weekEnd),

    // Sem confirmação hoje — status 'scheduled' = aguardando qualquer ação
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .eq('status', 'scheduled')
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd),

    // Orçamentos aguardando retorno (com nome do paciente)
    supabase
      .from('orcamentos')
      .select('id, total, paciente_id, paciente:pacientes(nome)')
      .eq('clinica_id', dentista.clinica_id)
      .in('status', ['rascunho', 'enviado'])
      .order('created_at', { ascending: false })
      .limit(20),

    // Lista completa de atendimentos hoje com dados do paciente
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, observacoes, paciente:pacientes(id, nome, observacoes)')
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd)
      .not('status', 'in', '(cancelled,no_show)')
      .order('data_hora', { ascending: true }),
  ]);

  const atendimentosHoje = (atendimentosHojeRaw ?? []) as unknown as AtendimentoRaw[];

  type OrcRaw = { id: string; total: number | null; paciente_id: string; paciente: { nome: string } | null };
  const orcamentosAguardando = ((orcamentosAguardandoRaw ?? []) as unknown as OrcRaw[]).map(o => ({
    id: o.id,
    total: o.total,
    paciente_id: o.paciente_id,
    paciente_nome: o.paciente?.nome ?? 'Paciente',
  }));

  // Próximo = primeiro atendimento não encerrado
  const nextApt = atendimentosHoje.find((a) => !DONE.has(a.status)) ?? null;
  const allConcluded =
    atendimentosHoje.length > 0 && atendimentosHoje.every((a) => DONE.has(a.status));

  // Última ficha — executa apenas se houver próximo atendimento com paciente
  let ultimaFichaQueixa: string | null = null;
  if (nextApt?.paciente?.id) {
    const { data: ficha } = await supabase
      .from('fichas')
      .select('queixa_principal')
      .eq('paciente_id', nextApt.paciente.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    ultimaFichaQueixa =
      (ficha as { queixa_principal: string | null } | null)?.queixa_principal ?? null;
  }

  const heroAgendamento = nextApt
    ? {
        id: nextApt.id,
        data_hora: nextApt.data_hora,
        status: nextApt.status,
        observacoes: nextApt.observacoes,
        paciente: nextApt.paciente,
        ultimaFichaQueixa,
      }
    : null;

  return (
    <>
      <DashboardHeader
        nome={dentista.nome}
        now={now}
        atendimentos={atendimentosHoje}
      />

      <MetricsCards
        consultasHoje={consultasHoje ?? 0}
        agendaSemana={agendaSemana ?? 0}
        concluidosHoje={concluidosHoje ?? 0}
      />

      <NextAppointmentHero
        agendamento={heroAgendamento}
        now={now}
        allConcluded={allConcluded}
      />

      <AttentionPanel
        semConfirmacao={semConfirmacao ?? 0}
        orcamentosAguardando={orcamentosAguardando}
      />
    </>
  );
}

// ── Skeleton (fallback do Suspense) ───────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-8 md:mb-10 space-y-2">
        <div className="h-3 w-32 bg-surface-alt rounded" />
        <div className="h-10 w-72 bg-surface-alt rounded-xl" />
        <div className="h-4 w-96 bg-surface-alt rounded" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-3xl p-6 h-[152px] flex flex-col justify-between"
          >
            <div className="h-2.5 w-24 bg-surface-alt rounded-full" />
            <div className="h-12 w-16 bg-surface-alt rounded-xl" />
            <div className="h-6 w-32 bg-surface-alt rounded-md" />
          </div>
        ))}
      </div>

      {/* Hero */}
      <div className="mb-8 md:mb-10 bg-surface border border-border rounded-3xl p-8 md:p-10 flex items-center justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="h-3 w-32 bg-surface-alt rounded" />
          <div className="h-9 w-64 bg-surface-alt rounded-xl" />
          <div className="h-5 w-28 bg-surface-alt rounded" />
          <div className="flex gap-2">
            <div className="h-7 w-32 bg-surface-alt rounded-full" />
            <div className="h-7 w-24 bg-surface-alt rounded-full" />
          </div>
        </div>
        <div className="shrink-0">
          <div className="h-12 w-52 bg-surface-alt rounded-2xl" />
        </div>
      </div>

      {/* Atenção */}
      <div>
        <div className="h-6 w-36 bg-surface-alt rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-24 bg-surface border border-border rounded-3xl" />
          <div className="h-24 bg-surface border border-border rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
