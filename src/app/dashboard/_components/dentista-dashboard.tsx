import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';
import type { DentistaCache } from '@/lib/get-dentista';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { NextAppointmentHero } from '@/components/dashboard/next-appointment-hero';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import type { TipoRegistroOdontograma } from '@/types/odontograma';

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

export async function DentistaDashboard({ dentista, children }: { dentista: DentistaCache; children?: ReactNode }) {
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
    { data: encaminhadosRaw },
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

    // R-114 — "aguardando retorno" = ainda não quitado (nada declarado, tudo derivado de
    // item aprovado × pagamento). A view já calcula; só troca o filtro por `estado`.
    supabase
      .from('orcamentos_com_estado')
      .select('id, total, paciente_id, paciente:pacientes(nome)')
      .eq('clinica_id', dentista.clinica_id)
      .neq('estado', 'quitado')
      .order('created_at', { ascending: false })
      .limit(20),

    // Lista completa de atendimentos hoje com dados do paciente
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, observacoes, paciente:pacientes!agendamentos_paciente_id_fkey(id, nome, observacoes)')
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd)
      .not('status', 'in', '(cancelled,no_show)')
      .order('data_hora', { ascending: true }),

    // Encaminhados pra este dentista (R-04) — só o que ainda está indicado (some da
    // fila quando ele conclui). DentistaDashboard só renderiza pra role != secretaria
    // (dashboard/page.tsx), então nunca precisa filtrar isso aqui.
    supabase
      .from('odontograma_eventos')
      .select('id, tipo, dente, paciente_id, paciente:pacientes!odontograma_eventos_paciente_id_fkey(nome)')
      .eq('clinica_id', dentista.clinica_id)
    .is('retirado_em', null)
      .eq('encaminhado_para', dentista.id)
      .eq('status', 'indicado')
      .order('registrado_em', { ascending: true })
      .limit(10),
  ]);

  const atendimentosHoje = (atendimentosHojeRaw ?? []) as unknown as AtendimentoRaw[];

  type OrcRaw = { id: string; total: number | null; paciente_id: string; paciente: { nome: string } | null };
  const orcamentosAguardando = ((orcamentosAguardandoRaw ?? []) as unknown as OrcRaw[]).map(o => ({
    id: o.id,
    total: o.total,
    paciente_id: o.paciente_id,
    paciente_nome: o.paciente?.nome ?? 'Paciente',
  }));

  type EncaminhadoRaw = {
    id: string; tipo: TipoRegistroOdontograma; dente: number | null;
    paciente_id: string; paciente: { nome: string } | null;
  };
  const encaminhados = ((encaminhadosRaw ?? []) as unknown as EncaminhadoRaw[]).map(e => ({
    id: e.id,
    tipo: e.tipo,
    dente: e.dente,
    paciente_id: e.paciente_id,
    paciente_nome: e.paciente?.nome ?? 'Paciente',
  }));

  // Próximo = primeiro atendimento não encerrado
  const nextApt = atendimentosHoje.find((a) => !DONE.has(a.status)) ?? null;
  const allConcluded =
    atendimentosHoje.length > 0 && atendimentosHoje.every((a) => DONE.has(a.status));

  // Contexto do próximo paciente — executa apenas se houver próximo atendimento
  let ultimaFichaQueixa: string | null = null;
  let orcamentosAbertos = 0;
  let planejamentoAtivo: string | null = null;
  if (nextApt?.paciente?.id) {
    const [{ data: ficha }, { count: orcCount }, { data: planData }] = await Promise.all([
      supabase
        .from('fichas')
        .select('queixa_principal')
        .eq('paciente_id', nextApt.paciente.id)
        .order('data_atendimento', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // R-114 — mesma troca: estado != quitado no lugar do status declarado.
      supabase
        .from('orcamentos_com_estado')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('paciente_id', nextApt.paciente.id)
        .neq('estado', 'quitado'),
      supabase
        .from('tratamentos')
        .select('nome')
        .eq('clinica_id', dentista.clinica_id)
        .eq('paciente_id', nextApt.paciente.id)
        .not('status', 'in', '(concluido,cancelado)')
        .limit(1)
        .maybeSingle(),
    ]);
    ultimaFichaQueixa =
      (ficha as { queixa_principal: string | null } | null)?.queixa_principal ?? null;
    orcamentosAbertos = orcCount ?? 0;
    planejamentoAtivo = (planData as { nome: string | null } | null)?.nome ?? null;
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

      {children}

      <MetricsCards
        consultasHoje={consultasHoje ?? 0}
        agendaSemana={agendaSemana ?? 0}
        concluidosHoje={concluidosHoje ?? 0}
      />

      <NextAppointmentHero
        agendamento={heroAgendamento}
        now={now}
        allConcluded={allConcluded}
        orcamentosAbertos={orcamentosAbertos}
        planejamentoAtivo={planejamentoAtivo}
      />

      <AttentionPanel
        semConfirmacao={semConfirmacao ?? 0}
        orcamentosAguardando={orcamentosAguardando}
        encaminhados={encaminhados}
      />
    </>
  );
}

// ── Skeleton (fallback do Suspense) ───────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Carregando o Início">
      <div aria-hidden="true">
        <div className="mb-6 flex items-end justify-between gap-4 max-[600px]:flex-col max-[600px]:items-start">
          <div className="w-full min-w-0 space-y-2">
            <Skeleton className="h-[19px] w-56 max-w-full" />
            <Skeleton className="h-[37px] w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-56 max-w-full shrink-0 max-[600px]:w-full" />
        </div>
        <div className="mb-6 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-surface max-[600px]:grid-cols-1 max-[600px]:divide-x-0 max-[600px]:divide-y">
          {[0, 1, 2].map((i) => (
            <div key={i} className="min-w-0 px-6 py-[18px]">
              <Skeleton className="h-[19px] w-28 max-w-full" />
              <Skeleton className="mt-1 h-[31.5px] w-10 max-w-full" />
              <Skeleton className="mt-1 h-[18px] w-32 max-w-full" />
            </div>
          ))}
        </div>
        <div className="mb-6 space-y-3 rounded-[12px] border border-border bg-surface px-6 py-[25px]">
          <Skeleton className="h-[19px] w-40 max-w-full" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-5 w-56 max-w-full" />
          <div className="flex flex-wrap gap-2 pt-2">
            <Skeleton className="h-10 w-44 max-w-full max-[600px]:w-full" />
            <Skeleton className="h-10 w-36 max-w-full max-[600px]:w-full" />
          </div>
        </div>
        <div className="rounded-[12px] border border-border bg-surface px-6 py-[18px]">
          <Skeleton className="mb-4 h-[25.5px] w-36 max-w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
