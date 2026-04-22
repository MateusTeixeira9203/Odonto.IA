import Link from 'next/link';
import {
  Plus, ArrowRight, Users, TrendingUp, Clock,
  Sparkles, Calendar, CheckCircle2,
} from 'lucide-react';
import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/server';
import type { DentistaCache } from '@/lib/get-dentista';
import { AtendimentosHoje, type AtendimentoHoje } from './atendimentos-hoje';

// ── Componente assíncrono — renderizado dentro de <Suspense> no page.tsx ──────

export async function DentistaDashboard({ dentista }: { dentista: DentistaCache }) {
  const supabase = await createClient();
  const mesAtual = format(new Date(), 'yyyy-MM');
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  const [
    { count: totalPacientes },
    { count: orcamentosPendentes },
    { count: agendamentosConfirmados },
    { data: atendimentosHojeRaw },
    { data: orcamentosStatsRaw },
  ] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id),
    supabase
      .from('orcamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .in('status', ['rascunho', 'enviado']),
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('status', 'confirmado')
      .gte('data_hora', weekStart)
      .lte('data_hora', weekEnd),
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, paciente:pacientes(id, nome)')
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd)
      .not('status', 'in', '(cancelado,faltou)')
      .order('data_hora', { ascending: true }),
    supabase
      .from('orcamentos')
      .select('status')
      .eq('clinica_id', dentista.clinica_id)
      .in('status', ['aprovado', 'recusado'])
      .gte('created_at', monthStart),
  ]);

  const atendimentosHoje = (atendimentosHojeRaw ?? []) as unknown as AtendimentoHoje[];
  const canEdit = dentista.plano === 'SOLO';

  const decididos = (orcamentosStatsRaw ?? []) as { status: string }[];
  const nAprovados = decididos.filter(o => o.status === 'aprovado').length;
  const taxaFechamento = decididos.length > 0
    ? Math.round((nAprovados / decididos.length) * 100)
    : null;

  // Próximo paciente com orçamento pendente (briefing clínico)
  const nextApt = atendimentosHoje.find(
    a => !['realizado', 'cancelado', 'faltou'].includes(a.status),
  );
  let nextPacienteAlert: { nome: string; valor: number } | null = null;
  if (nextApt?.paciente) {
    const { data: budgets } = await supabase
      .from('orcamentos')
      .select('total')
      .eq('clinica_id', dentista.clinica_id)
      .eq('paciente_id', nextApt.paciente.id)
      .in('status', ['rascunho', 'enviado']);
    const soma = (budgets ?? []).reduce(
      (s, b) => s + ((b as { total: number | null }).total ?? 0), 0,
    );
    if (soma > 0) nextPacienteAlert = { nome: nextApt.paciente.nome, valor: soma };
  }

  return (
    <>
      {/* ── Row 1: Métricas ──────────────────────────────────────────────────── */}
      <div id="dex-tour-metrics" className={`grid grid-cols-2 gap-3 md:gap-4 mb-8 md:mb-10 ${canEdit ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>

        {/* Pacientes */}
        <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
            <Users className="w-20 h-20 text-text-primary" />
          </div>
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Pacientes
          </div>
          <div className="font-mono text-4xl md:text-5xl font-medium text-text-primary tracking-tight">
            {totalPacientes ?? 0}
          </div>
          <div className="text-[10px] text-teal mt-4 font-bold uppercase tracking-wider flex items-center gap-1 bg-teal-pale w-fit px-2 py-1 rounded-md">
            <TrendingUp className="w-3 h-3" /> Total cadastrados
          </div>
        </div>

        {/* Agendamentos Confirmados (Semana) */}
        <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
            <Calendar className="w-20 h-20 text-text-primary" />
          </div>
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Agendamentos
          </div>
          <div className="font-mono text-4xl md:text-5xl font-medium text-text-primary tracking-tight">
            {agendamentosConfirmados ?? 0}
          </div>
          <div className="text-[10px] text-text-secondary mt-4 font-bold uppercase tracking-wider flex items-center gap-1 bg-surface-alt w-fit px-2 py-1 rounded-md">
            <CheckCircle2 className="w-3 h-3" /> Confirmados (semana)
          </div>
        </div>

        {/* Orçamentos Pendentes */}
        <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
            <Clock className="w-20 h-20 text-text-primary" />
          </div>
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Orçamentos Pendentes
          </div>
          <div className="font-mono text-4xl md:text-5xl font-medium text-text-primary tracking-tight">
            {orcamentosPendentes ?? 0}
          </div>
          <div className={`text-[10px] mt-4 font-bold uppercase tracking-wider w-fit px-2 py-1 rounded-md ${(orcamentosPendentes ?? 0) > 0 ? 'bg-teal-pale text-teal' : 'bg-surface-alt text-text-secondary'}`}>
            {(orcamentosPendentes ?? 0) > 0 ? 'Aguardando aprovação' : 'Tudo em dia'}
          </div>
        </div>

        {/* Ação Rápida — apenas plano SOLO */}
        {canEdit && (
          <div
            className="bg-gradient-to-br from-teal to-teal-lt p-6 rounded-3xl relative overflow-hidden group text-white flex flex-col justify-between hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}
          >
            <div className="absolute -right-4 -top-4 opacity-15 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <Sparkles className="w-24 h-24 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em] mb-2">
                Ação Rápida
              </div>
              <div className="font-heading text-3xl leading-tight mb-4">
                Novo<br />Paciente
              </div>
            </div>
            <Link
              href="/dashboard/pacientes/novo"
              className="bg-white text-teal px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-teal-pale transition-all shadow-sm w-full"
            >
              <Plus className="w-4 h-4" />
              Cadastrar paciente
            </Link>
          </div>
        )}
      </div>

      {/* ── Row 2: Atendimentos de Hoje (70%) + Insights IA (30%) ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading text-2xl text-text-primary">Atendimentos de Hoje</h2>
              <p className="text-text-secondary text-xs mt-0.5 font-medium">
                {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <Link
              href="/dashboard/agendamentos"
              className="text-teal text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver agenda <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <AtendimentosHoje atendimentos={atendimentosHoje} />
        </div>

        {/* Insights da IA */}
        <div id="dex-tour-insights">
          <h2 className="font-heading text-2xl text-text-primary mb-4">Insights da IA</h2>
          <div className="space-y-4">

            {/* Briefing Clínico */}
            <div
              className="p-5 rounded-2xl text-white backdrop-blur-md"
              style={{ background: 'rgba(13,13,13,0.92)', border: '1px solid rgba(47,156,133,0.25)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-teal" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-teal font-bold">
                  Briefing Clínico
                </span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-4">
                {atendimentosHoje.length === 0
                  ? 'Nenhum atendimento hoje. Boa oportunidade para follow-up com pacientes de orçamentos pendentes.'
                  : nextPacienteAlert
                    ? <>
                        Você tem <strong className="text-white">{atendimentosHoje.length} atendimento{atendimentosHoje.length !== 1 ? 's' : ''}</strong> hoje.
                        {' '}O próximo, <strong className="text-white">{nextPacienteAlert.nome}</strong>, possui um orçamento pendente de{' '}
                        <strong className="text-teal font-mono">
                          R$ {nextPacienteAlert.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>.
                      </>
                    : <>
                        Você tem <strong className="text-white">{atendimentosHoje.length} atendimento{atendimentosHoje.length !== 1 ? 's' : ''}</strong> hoje.
                        {' '}Agenda limpa — ótimo dia para fechar orçamentos abertos.
                      </>
                }
              </p>
              <Link
                href="/dashboard/agendamentos"
                className="block w-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors border border-white/10 text-center"
              >
                Ver Agenda
              </Link>
            </div>

            {/* Taxa de Conversão */}
            {taxaFechamento !== null ? (
              <div className={`p-5 rounded-2xl border shadow-sm ${
                taxaFechamento >= 60
                  ? 'bg-teal-pale border-teal/20'
                  : taxaFechamento >= 40
                    ? 'bg-surface border-border'
                    : 'bg-coral-pale/40 border-coral/20'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={`w-4 h-4 ${taxaFechamento >= 40 ? 'text-teal' : 'text-coral'}`} />
                  <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-text-secondary">
                    Conversão
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${
                  taxaFechamento >= 60 ? 'text-teal-dark font-medium' : taxaFechamento >= 40 ? 'text-text-primary' : 'text-coral font-medium'
                }`}>
                  Taxa de fechamento este mês:{' '}
                  <span className="font-mono font-bold">{taxaFechamento}%</span>.{' '}
                  {taxaFechamento >= 60
                    ? 'Excelente desempenho!'
                    : taxaFechamento >= 40
                      ? 'Há margem de crescimento na abordagem.'
                      : 'Apresentar o plano visualmente pode aumentar esse índice.'}
                </p>
                <Link
                  href="/dashboard/orcamentos"
                  className={`mt-3 block text-xs font-semibold hover:underline ${taxaFechamento >= 40 ? 'text-teal' : 'text-coral'}`}
                >
                  Ver orçamentos →
                </Link>
              </div>
            ) : (agendamentosConfirmados !== null && agendamentosConfirmados > 0) && (
              <div className="p-5 bg-teal-pale rounded-2xl border border-teal/20 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-teal" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-teal font-bold">
                    Agenda
                  </span>
                </div>
                <p className="text-sm text-teal-dark leading-relaxed font-medium">
                  {agendamentosConfirmados} agendamento{agendamentosConfirmados !== 1 ? 's' : ''} confirmado{agendamentosConfirmados !== 1 ? 's' : ''} essa semana. Continue o bom trabalho!
                </p>
              </div>
            )}

            {/* Follow-up Pendente */}
            {(orcamentosPendentes ?? 0) > 0 && (
              <div className="p-5 bg-surface rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-text-secondary" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary font-bold">
                    Follow-up
                  </span>
                </div>
                <p className="text-sm text-text-primary leading-relaxed">
                  <strong className="text-teal font-mono">{orcamentosPendentes}</strong> orçamento{(orcamentosPendentes ?? 0) !== 1 ? 's' : ''} aguardando resposta.
                  {' '}Um contato ativo hoje pode fechar novos tratamentos.
                </p>
                <Link
                  href="/dashboard/orcamentos"
                  className="mt-2 block text-xs text-teal font-semibold hover:underline"
                >
                  Ver orçamentos →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
}

// ── Skeleton para o fallback do Suspense ──────────────────────────────────────

export function DashboardSkeleton({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="animate-pulse">
      {/* Linha 1: cards de métricas */}
      <div className={`grid grid-cols-1 gap-4 mb-10 ${canEdit ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        {Array.from({ length: canEdit ? 4 : 3 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-3xl p-6 h-[152px] flex flex-col justify-between">
            <div className="h-2.5 w-24 bg-surface-alt rounded-full" />
            <div className="h-12 w-16 bg-surface-alt rounded-xl" />
            <div className="h-6 w-32 bg-surface-alt rounded-md" />
          </div>
        ))}
      </div>

      {/* Linha 2: atendimentos + insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <div className="h-7 w-52 bg-surface-alt rounded-lg" />
              <div className="h-3 w-36 bg-surface-alt rounded" />
            </div>
          </div>
          <div className="bg-surface border border-border rounded-3xl overflow-hidden">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-1.5 h-8 rounded-full bg-surface-alt shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-surface-alt rounded" />
                  <div className="h-2.5 w-20 bg-surface-alt rounded" />
                </div>
                <div className="text-right space-y-1">
                  <div className="h-3.5 w-10 bg-surface-alt rounded ml-auto" />
                  <div className="h-2.5 w-14 bg-surface-alt rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-7 w-36 bg-surface-alt rounded-lg" />
          <div className="rounded-2xl h-40 bg-surface-alt/60" />
          <div className="bg-surface border border-border rounded-2xl h-24" />
          <div className="bg-surface border border-border rounded-2xl h-20" />
        </div>
      </div>

    </div>
  );
}
