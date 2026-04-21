import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { Plus, ArrowRight, Users, TrendingUp, Clock, Sparkles, Calendar, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isAfter, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageTransition } from '@/components/layout/page-transition';
import { DentistaDashboard, DashboardSkeleton } from './_components/dentista-dashboard';

type AgendamentoProximo = {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string | null;
  paciente: { id: string; nome: string } | null;
  dentista: { nome: string } | null;
};

type PacienteRecente = {
  id: string;
  nome: string;
  created_at: string;
  telefone: string | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard para Secretária
// ──────────────────────────────────────────────────────────────────────────────
async function SecretaryDashboard({
  clinicaId,
  nome,
}: {
  clinicaId: string;
  nome: string;
}) {
  const supabase = await createClient();
  const now = new Date();
  const nextWeek = addDays(now, 7).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

  const [
    { data: agendamentosRaw },
    { data: pacientesRaw },
    { count: orcamentosPendentes },
    { count: totalPacientes },
    { count: agendamentosSemanais },
  ] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, observacoes, paciente:pacientes(id, nome), dentista:dentistas(nome)')
      .eq('clinica_id', clinicaId)
      .gte('data_hora', now.toISOString())
      .lte('data_hora', nextWeek)
      .order('data_hora', { ascending: true })
      .limit(8),
    supabase
      .from('pacientes')
      .select('id, nome, created_at, telefone')
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('orcamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId)
      .in('status', ['rascunho', 'enviado']),
    supabase
      .from('pacientes')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId),
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId)
      .eq('status', 'confirmado')
      .gte('data_hora', weekStart)
      .lte('data_hora', weekEnd),
  ]);

  const agendamentos = (agendamentosRaw ?? []) as unknown as AgendamentoProximo[];
  const pacientes = (pacientesRaw ?? []) as PacienteRecente[];

  const hora = now.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <PageTransition>
    <div className="p-8 max-w-6xl mx-auto w-full">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-heading text-4xl text-text-primary mb-1">
            {saudacao}, {nome.split(' ')[0]}!
          </h1>
          <p className="text-text-secondary text-sm font-medium">
            Painel da Secretaria — gerencie pacientes e agendamentos.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-2.5 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
          </span>
          <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">Sistema Online</span>
        </div>
      </header>

      {/* ── Row 1: Métricas + Ação Rápida (secretária sempre vê o botão) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {/* Total Pacientes */}
        <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
            <Users className="w-20 h-20 text-text-primary" />
          </div>
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Pacientes
          </div>
          <div className="font-mono text-5xl font-medium text-text-primary tracking-tight">
            {totalPacientes ?? 0}
          </div>
          <div className="text-[10px] text-teal mt-4 font-bold uppercase tracking-wider flex items-center gap-1 bg-teal-pale w-fit px-2 py-1 rounded-md">
            <TrendingUp className="w-3 h-3" /> Total cadastrados
          </div>
        </div>

        {/* Agendamentos Confirmados Semana */}
        <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
            <Calendar className="w-20 h-20 text-text-primary" />
          </div>
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Agendamentos
          </div>
          <div className="font-mono text-5xl font-medium text-text-primary tracking-tight">
            {agendamentosSemanais ?? 0}
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
          <div className="font-mono text-5xl font-medium text-text-primary tracking-tight">
            {orcamentosPendentes ?? 0}
          </div>
          <div className={`text-[10px] mt-4 font-bold uppercase tracking-wider w-fit px-2 py-1 rounded-md ${(orcamentosPendentes ?? 0) > 0 ? 'bg-teal-pale text-teal' : 'bg-surface-alt text-text-secondary'}`}>
            {(orcamentosPendentes ?? 0) > 0 ? 'Aguardando aprovação' : 'Tudo em dia'}
          </div>
        </div>

        {/* Ação Rápida — secretária sempre vê */}
        <div className="bg-gradient-to-br from-teal to-teal-lt p-6 rounded-3xl relative overflow-hidden group text-white flex flex-col justify-between hover:-translate-y-0.5 transition-all"
          style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}>
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
      </div>

      {/* ── Row 2: Próximos agendamentos + Últimos Pacientes ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos Agendamentos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-2xl text-text-primary">Próximos Agendamentos</h2>
            <Link
              href="/dashboard/agendamentos"
              className="text-teal text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver agenda <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            {agendamentos.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-8 h-8 text-border mx-auto mb-3" />
                <p className="text-text-secondary text-sm font-medium">Nenhum agendamento nos próximos 7 dias.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {agendamentos.map((apt) => {
                  const dataHora = parseISO(apt.data_hora);
                  const isHoje = isAfter(addDays(now, 1), dataHora);
                  return (
                    <div key={apt.id} className="p-4 flex items-center justify-between hover:bg-surface-alt transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-8 rounded-full shrink-0 ${isHoje ? 'bg-teal' : 'bg-border'}`} />
                        <div>
                          <div className="font-semibold text-sm text-text-primary">
                            {apt.paciente?.nome ?? 'Paciente'}
                          </div>
                          <div className="text-xs text-text-secondary mt-0.5">
                            Dr(a). {apt.dentista?.nome ?? '—'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-text-primary font-semibold">
                          {format(dataHora, 'HH:mm')}
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isHoje ? 'text-teal font-bold' : 'text-text-secondary'}`}>
                          {format(dataHora, isHoje ? "'Hoje'" : "EEE dd/MM", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Últimos Pacientes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-2xl text-text-primary">Últimos Pacientes</h2>
            <Link
              href="/dashboard/pacientes"
              className="text-teal text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            {pacientes.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-8 h-8 text-border mx-auto mb-3" />
                <p className="text-text-secondary text-sm font-medium">Nenhum paciente cadastrado ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pacientes.map((p) => {
                  const iniciais = p.nome.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <Link
                      key={p.id}
                      href={`/dashboard/pacientes/${p.id}`}
                      className="p-4 flex items-center gap-3 hover:bg-surface-alt transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-teal flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {iniciais}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-text-primary truncate group-hover:text-teal transition-colors">{p.nome}</div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          {p.telefone ?? 'Sem telefone'}
                        </div>
                      </div>
                      <div className="text-xs text-text-secondary shrink-0 font-mono">
                        {format(parseISO(p.created_at), "dd/MM/yy")}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
    return <SecretaryDashboard clinicaId={dentista.clinica_id} nome={dentista.nome} />;
  }

  // canEdit determina se mostra 3 ou 4 cards no skeleton (sem precisar aguardar os dados)
  const canEdit = dentista.plano === 'SOLO';

  return (
    <PageTransition>
      <div className="p-8 max-w-6xl mx-auto w-full">
        {/* Header — renderizado imediatamente, sem dependência de dados */}
        <header className="flex items-center justify-between mb-10">
          <div>
            <h1 className="font-heading text-4xl text-text-primary mb-1">Visão Geral</h1>
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
