import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { Plus, ArrowRight, Users, TrendingUp, Clock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FichaRecente = {
  id: string;
  created_at: string;
  status: 'aberta' | 'concluida';
  queixa_principal: string | null;
  paciente: { id: string; nome: string } | null;
};

export default async function DashboardPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

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
          <h1 className="font-heading text-4xl text-foreground mb-2">Visão Geral</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Monitoramento em tempo real da sua clínica.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
            Status do Sistema
          </div>
          <div className="flex items-center gap-2 justify-end mt-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/20 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal" />
            </span>
            <span className="text-xs font-semibold text-teal">IA Operacional</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        {/* Pacientes Ativos */}
        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-20 h-20 text-foreground" />
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Pacientes Ativos
          </div>
          <div className="font-mono text-5xl font-medium text-foreground tracking-tight">
            {totalPacientes ?? 0}
          </div>
          <div className="text-[10px] text-teal mt-4 font-bold uppercase tracking-wider flex items-center gap-1 bg-teal/10 w-fit px-2 py-1 rounded-md">
            <TrendingUp className="w-3 h-3" /> Total cadastrados
          </div>
        </div>

        {/* Faturamento */}
        <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-900 shadow-xl relative overflow-hidden group dark:bg-zinc-900/50 dark:border-white/10">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Faturamento (Mês)
          </div>
          <div className="font-mono text-4xl font-medium text-white tracking-tight">
            <span className="text-teal text-xl mr-1">R$</span>
            {faturamento.toLocaleString('pt-BR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[10px] text-zinc-400 mt-4 font-mono uppercase tracking-widest">
            Pagamentos recebidos
          </div>
        </div>

        {/* Orçamentos Pendentes */}
        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Clock className="w-20 h-20 text-foreground" />
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal" /> Orçamentos Pendentes
          </div>
          <div className="font-mono text-5xl font-medium text-foreground tracking-tight">
            {orcamentosPendentes ?? 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-4 font-bold uppercase tracking-wider bg-muted w-fit px-2 py-1 rounded-md">
            Aguardando aprovação
          </div>
        </div>

        {/* Quick Action */}
        <div className="bg-gradient-to-br from-teal to-teal-lt p-6 rounded-3xl shadow-xl relative overflow-hidden group text-white flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
            <Sparkles className="w-24 h-24 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em] mb-2">
              Ação Rápida
            </div>
            <div className="font-heading text-3xl leading-tight mb-4">
              Novo<br />Paciente
            </div>
          </div>
          <Link
            href="/dashboard/pacientes/novo"
            className="bg-white text-teal px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-bg transition-all shadow-sm w-full"
          >
            <Plus className="w-4 h-4" />
            Cadastrar paciente
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fichas Recentes */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-2xl text-foreground">Fichas Recentes</h2>
            <Link
              href="/dashboard/fichas"
              className="text-teal text-sm font-semibold flex items-center gap-1 hover:text-teal-lt transition-colors"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            {fichas.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">
                Nenhuma ficha cadastrada ainda.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {fichas.map((ficha, i) => {
                  const paciente = ficha.paciente;
                  const nome = paciente?.nome ?? 'Paciente';
                  const iniciais = nome
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  const cor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const data = format(new Date(ficha.created_at), "dd 'de' MMM", {
                    locale: ptBR,
                  });

                  return (
                    <Link
                      key={ficha.id}
                      href={
                        paciente?.id
                          ? `/dashboard/pacientes/${paciente.id}`
                          : '/dashboard/fichas'
                      }
                      className="p-4 flex items-center justify-between hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${cor}`}
                        >
                          {iniciais}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground group-hover:text-teal transition-colors">
                            {nome}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {ficha.queixa_principal ?? 'Sem queixa registrada'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-muted-foreground">{data}</div>
                        <div
                          className={`font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-md font-bold ${
                            ficha.status === 'aberta'
                              ? 'bg-teal/10 text-teal'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
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
          <h2 className="font-heading text-2xl text-foreground mb-5">Insights da IA</h2>
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
                className="block w-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors border border-white/10 text-center"
              >
                Ver Orçamentos
              </Link>
            </div>

            <div className="p-5 bg-card rounded-2xl border border-border/60 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-foreground" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Resumo
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
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
