import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { Plus, ArrowRight, Users, TrendingUp, Clock, Sparkles, Calendar, CircleDollarSign } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isAfter, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FichaRecente = {
  id: string;
  created_at: string;
  status: 'aberta' | 'concluida';
  queixa_principal: string | null;
  paciente: { id: string; nome: string } | null;
};

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

  const [
    { data: agendamentosRaw },
    { data: pacientesRaw },
    { count: orcamentosPendentes },
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
  ]);

  const agendamentos = (agendamentosRaw ?? []) as unknown as AgendamentoProximo[];
  const pacientes = (pacientesRaw ?? []) as PacienteRecente[];

  const hora = now.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
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

      {/* Ações Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Link
          href="/dashboard/pacientes/novo"
          className="bg-gradient-to-br from-teal to-teal-lt p-6 rounded-3xl text-white flex items-center gap-4 hover:shadow-xl hover:-translate-y-0.5 transition-all group"
          style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.35)' }}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-0.5">Ação rápida</div>
            <div className="font-bold text-lg leading-tight">Novo Paciente</div>
          </div>
        </Link>

        <Link
          href="/dashboard/agendamentos"
          className="bg-surface border border-border p-6 rounded-3xl flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-pale flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <Calendar className="w-6 h-6 text-teal" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-secondary mb-0.5">Ação rápida</div>
            <div className="font-bold text-lg text-text-primary leading-tight">Novo Agendamento</div>
          </div>
        </Link>

        <Link
          href="/dashboard/orcamentos"
          className="bg-surface border border-border p-6 rounded-3xl flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-pale flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <CircleDollarSign className="w-6 h-6 text-teal" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-secondary mb-0.5">
              {(orcamentosPendentes ?? 0) > 0
                ? `${orcamentosPendentes} pendente${(orcamentosPendentes ?? 0) !== 1 ? 's' : ''}`
                : 'Em dia'}
            </div>
            <div className="font-bold text-lg text-text-primary leading-tight">Orçamentos</div>
          </div>
        </Link>
      </div>

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
  );
}

export default async function DashboardPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Secretária vê dashboard simplificado (sem fichas clínicas)
  if (dentista.role === 'secretaria') {
    return <SecretaryDashboard clinicaId={dentista.clinica_id} nome={dentista.nome} />;
  }

  const supabase = await createClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { count: totalPacientes },
    { count: orcamentosPendentes },
    { data: fichasRaw },
    { data: pagamentosRaw },
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
      .from('fichas')
      .select('id, created_at, status, queixa_principal, paciente:pacientes(id, nome)')
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('pagamentos')
      .select('valor')
      .eq('clinica_id', dentista.clinica_id)
      .eq('status', 'pago')
      .gte('created_at', startOfMonth),
  ]);

  const fichas = (fichasRaw ?? []) as unknown as FichaRecente[];
  const faturamento = (pagamentosRaw ?? []).reduce(
    (sum, p) => sum + ((p as { valor: number }).valor ?? 0),
    0
  );

  const AVATAR_COLORS = ['bg-teal', 'bg-zinc-800', 'bg-zinc-600', 'bg-zinc-700', 'bg-teal'];

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-heading text-4xl text-text-primary mb-1">Visão Geral</h1>
          <p className="text-text-secondary text-sm font-medium">
            Monitoramento em tempo real da sua clínica.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-2.5 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
          </span>
          <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">IA Operacional</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        {/* Pacientes Ativos */}
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

        {/* Faturamento */}
        <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-900 shadow-xl relative overflow-hidden hover:-translate-y-0.5 transition-all dark:bg-zinc-900/50 dark:border-white/10">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Faturamento (Mês)
          </div>
          <div className="font-mono text-4xl font-medium text-white tracking-tight">
            <span className="text-teal text-xl mr-1">R$</span>
            {faturamento.toLocaleString('pt-BR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[10px] text-zinc-500 mt-4 font-mono uppercase tracking-widest">
            Pagamentos recebidos
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
          <div className={`text-[10px] mt-4 font-bold uppercase tracking-wider w-fit px-2 py-1 rounded-md ${(orcamentosPendentes ?? 0) > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-surface-alt text-text-secondary'}`}>
            {(orcamentosPendentes ?? 0) > 0 ? 'Aguardando aprovação' : 'Tudo em dia'}
          </div>
        </div>

        {/* Quick Action */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fichas Recentes */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-2xl text-text-primary">Fichas Recentes</h2>
            <Link
              href="/dashboard/fichas"
              className="text-teal text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            {fichas.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-8 h-8 text-border mx-auto mb-3" />
                <p className="text-text-secondary text-sm font-medium">Nenhuma ficha cadastrada ainda.</p>
                <p className="text-text-secondary text-xs mt-1">Comece atendendo um paciente.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {fichas.map((ficha, i) => {
                  const paciente = ficha.paciente;
                  const nome = paciente?.nome ?? 'Paciente';
                  const iniciais = nome.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                  const cor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const data = format(new Date(ficha.created_at), "dd 'de' MMM", { locale: ptBR });

                  return (
                    <Link
                      key={ficha.id}
                      href={paciente?.id ? `/dashboard/pacientes/${paciente.id}` : '/dashboard/fichas'}
                      className="p-4 flex items-center justify-between hover:bg-surface-alt transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-full min-h-[2.5rem] rounded-full shrink-0 ${ficha.status === 'aberta' ? 'bg-teal' : 'bg-border'}`} />
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${cor}`}>
                          {iniciais}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-text-primary group-hover:text-teal transition-colors">
                            {nome}
                          </div>
                          <div className="text-xs text-text-secondary mt-0.5">
                            {ficha.queixa_principal ?? 'Sem queixa registrada'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="text-xs text-text-secondary font-mono">{data}</div>
                        <div className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md font-bold ${
                          ficha.status === 'aberta' ? 'bg-teal-pale text-teal' : 'bg-surface-alt text-text-secondary'
                        }`}>
                          {ficha.status === 'aberta' ? 'Aberta' : 'Concluída'}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Insights da IA */}
        <div>
          <h2 className="font-heading text-2xl text-text-primary mb-4">Insights da IA</h2>
          <div className="space-y-4">
            <div className="p-5 bg-zinc-950 rounded-2xl border border-zinc-900 shadow-lg text-white dark:bg-zinc-900/50 dark:border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-teal" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-teal font-bold">
                  Sugestão
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                {(orcamentosPendentes ?? 0) > 0
                  ? `Você tem ${orcamentosPendentes} orçamento${(orcamentosPendentes ?? 0) > 1 ? 's' : ''} pendente${(orcamentosPendentes ?? 0) > 1 ? 's' : ''}. Acompanhe os pacientes para fechar mais tratamentos.`
                  : 'Todos os orçamentos estão em dia. Continue o bom trabalho!'}
              </p>
              <Link
                href="/dashboard/orcamentos"
                className="block w-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors border border-white/10 text-center"
              >
                Ver Orçamentos
              </Link>
            </div>

            <div className="p-5 bg-surface rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary font-bold">
                  Resumo
                </span>
              </div>
              <p className="text-sm text-text-primary leading-relaxed">
                Sua clínica tem{' '}
                <strong className="text-teal">
                  {totalPacientes ?? 0} paciente{(totalPacientes ?? 0) !== 1 ? 's' : ''}
                </strong>{' '}
                e{' '}
                <strong className="text-teal">
                  {fichas.length} ficha{fichas.length !== 1 ? 's' : ''} recente{fichas.length !== 1 ? 's' : ''}
                </strong>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
