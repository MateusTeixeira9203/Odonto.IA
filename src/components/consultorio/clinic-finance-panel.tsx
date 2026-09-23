import Link from 'next/link';
import { AlertTriangle, CalendarClock, CircleDollarSign } from 'lucide-react';

import { GanhosDespesasChart } from '@/app/dashboard/_components/ganhos-despesas-chart';
import type { ChartPoint } from '@/app/dashboard/financeiro/actions';
import type { ClinicFinancialData } from '@/server/financeiro/clinica';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { ClinicHubHeader } from './clinic-hub-header';
import { MonthPicker } from './month-picker';

type ClinicFinancePanelProps = {
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
  nomeClinica: string;
  title: 'Meu Consultório' | 'Minha Clínica';
  hasPersonalFinance: boolean;
  mes: string;
  data: ClinicFinancialData | null;
  mensagem?: string;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

function formatMoney(value: number): string { return money.format(value); }

function trend(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
}

function Metric({ label, value, detail, tone = 'default' }: { label: string; value: string; detail: string; tone?: 'default' | 'positive' | 'negative' }): React.JSX.Element {
  const color = tone === 'positive' ? 'text-teal' : tone === 'negative' ? 'text-coral' : 'text-text-primary';
  return <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs font-medium text-text-secondary">{label}</p><p className={`mt-2 font-mono text-lg font-semibold ${color}`}>{value}</p><p className="mt-1 text-xs leading-5 text-text-secondary">{detail}</p></div>;
}

export function ClinicFinancePanel({ basePath, nomeClinica, title, hasPersonalFinance, mes, data, mensagem }: ClinicFinancePanelProps): React.JSX.Element {
  const chart: ChartPoint[] = data?.chart.map((point) => ({ mes: point.mes, mesISO: point.mesISO, receita: point.recebido, despesas: point.despesas })) ?? [];
  const previous = data?.chart.at(-2);
  const receiptTrend = data && previous ? trend(data.recebido, previous.recebido) : null;
  const expenseTrend = data && previous ? trend(data.despesas, previous.despesas) : null;

  return (
    <div className="space-y-8">
      <ClinicHubHeader active="clinic-finance" basePath={basePath} nomeClinica={nomeClinica} title={title} hasPersonalFinance={hasPersonalFinance} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-base text-text-secondary">Caixa confirmado, previsão e despesas da unidade.</p></div>
        <MonthPicker mes={mes} />
      </div>

      {!data ? <section role="alert" className="rounded-xl border border-coral/30 bg-coral/10 p-5 text-sm text-text-primary"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral" /><p>{mensagem ?? 'O financeiro da clínica está indisponível agora. Os valores não foram substituídos por zero.'}</p></div></section> : <>
        <section className="grid gap-3 lg:grid-cols-3">
          <Metric label="Tendência de recebimento" value={receiptTrend ?? '—'} detail={`${formatMoney(data.recebido)} recebidos · comparado ao mês anterior`} tone={receiptTrend?.startsWith('-') ? 'negative' : 'positive'} />
          <Metric label="Tendência de despesas" value={expenseTrend ?? '—'} detail={`${formatMoney(data.despesas)} lançados · comparado ao mês anterior`} tone={expenseTrend?.startsWith('-') ? 'positive' : 'negative'} />
          <Metric label="Margem operacional estimada" value={data.margemOperacional == null ? '—' : `${data.margemOperacional.toFixed(1).replace('.', ',')}%`} detail="Resultado operacional ÷ recebido confirmado" tone={data.resultadoOperacional >= 0 ? 'positive' : 'negative'} />
        </section>

        <section className="rounded-2xl border border-teal/30 bg-teal-pale p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-ink"><CircleDollarSign className="size-4" />Resultado operacional estimado</p><p className="mt-3 font-mono text-3xl font-semibold text-text-primary sm:text-4xl">{formatMoney(data.resultadoOperacional)}</p><p className="mt-2 max-w-xl text-sm text-text-secondary">Recebido confirmado menos despesas operacionais registradas.</p></div><div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4"><MetricInline label="Recebido" value={formatMoney(data.recebido)} /><MetricInline label="Despesas" value={formatMoney(data.despesas)} /><MetricInline label="Saldo de caixa" value={formatMoney(data.saldoCaixa)} /><MetricInline label="A receber" value={formatMoney(data.aReceber)} /></div></div>
        </section>

        <section><h2 className="font-heading text-2xl text-text-primary">Fluxo e previsão</h2><p className="mt-1 text-sm text-text-secondary">Recebimentos confirmados não se misturam com valores ainda previstos.</p><div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]"><Card><CardHeader><CardTitle className="font-heading text-xl">Fluxo de caixa</CardTitle><CardDescription>Entradas × saídas · últimos 6 meses</CardDescription></CardHeader><CardContent><GanhosDespesasChart data={chart} /></CardContent></Card><Card><CardHeader><CardTitle className="font-heading text-xl">Previsão e fôlego de caixa</CardTitle><CardDescription>Valores previstos não entram no caixa até serem confirmados.</CardDescription></CardHeader><CardContent className="space-y-4"><MetricInline label="A receber em cobranças ativas" value={formatMoney(data.aReceber)} /><MetricInline label="Despesas fixas previstas" value={data.despesasFixasPrevistas > 0 ? formatMoney(data.despesasFixasPrevistas) : 'Não configuradas'} /><MetricInline label="Fôlego de caixa" value={data.folegoCaixaMeses == null ? 'Indisponível' : `${data.folegoCaixaMeses.toFixed(1).replace('.', ',')} meses`} /><MetricInline label="Cobranças vencidas" value={data.vencido > 0 ? formatMoney(data.vencido) : 'Nenhuma'} /></CardContent></Card></div></section>

        <section><div className="flex items-end justify-between gap-4"><div><h2 className="font-heading text-2xl text-text-primary">Recebimentos por profissional</h2><p className="mt-1 text-sm text-text-secondary">Produção clínica e caixa da unidade são leituras diferentes.</p></div></div><Card className="mt-4"><CardContent className="overflow-x-auto pt-4"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-text-secondary"><tr><th className="pb-3 font-medium">Profissional</th><th className="pb-3 text-right font-medium">Produção aprovada</th><th className="pb-3 text-right font-medium">Recebido vinculado</th><th className="pb-3 text-right font-medium">A receber</th></tr></thead><tbody>{data.profissionais.length === 0 ? <tr><td className="border-t border-border py-5 text-text-secondary" colSpan={4}>Ainda não há produção clínica neste período.</td></tr> : data.profissionais.map((professional) => <tr className="border-t border-border" key={professional.dentistaId}><td className="py-4 font-medium text-text-primary">{professional.nome}</td><td className="py-4 text-right font-mono text-text-primary">{formatMoney(professional.producaoAprovada)}</td><td className="py-4 text-right font-mono text-teal">{formatMoney(professional.recebidoVinculado)}</td><td className="py-4 text-right font-mono text-text-primary">{formatMoney(professional.aReceber)}</td></tr>)}</tbody></table></CardContent></Card></section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]"><Card><CardHeader><CardTitle className="font-heading text-xl">Extrato da clínica</CardTitle><CardDescription>Fatos financeiros do mês, com origem e categoria.</CardDescription></CardHeader><CardContent className="space-y-3">{data.extrato.length === 0 ? <p className="py-3 text-sm text-text-secondary">Sem lançamentos confirmados neste mês.</p> : data.extrato.map((item) => <div key={`${item.tipo}-${item.id}`} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"><div><p className="font-medium text-text-primary">{item.descricao}</p><p className="mt-1 text-xs text-text-secondary">{item.tipo === 'despesa' ? 'Despesa' : item.tipo === 'receita_manual' ? 'Receita manual' : 'Recebimento'} · {shortDate.format(new Date(`${item.data}T12:00:00`))}</p></div><p className={item.valor < 0 ? 'font-mono text-coral' : 'font-mono text-teal'}>{item.valor < 0 ? '− ' : '+ '}{formatMoney(Math.abs(item.valor))}</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="font-heading text-xl">Custos fixos</CardTitle><CardDescription>Configure despesas recorrentes para a projeção mensal não depender de memória.</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-sm text-text-secondary">{data.recorrencias.length === 0 ? 'Nenhum custo fixo recorrente foi configurado.' : `${data.recorrencias.filter((item) => item.ativo).length} custo(s) ativo(s) somam ${formatMoney(data.despesasFixasPrevistas)} por mês.`}</p>{data.podeGerirCustos ? <Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80" href={`${basePath}/financeiro-clinica/custos`}><CalendarClock className="size-4" />Gerenciar custos fixos</Link> : <p className="text-sm text-text-secondary">Você pode consultar os custos fixos, mas não tem permissão para alterá-los.</p>}</CardContent></Card></section>
      </>}
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string }): React.JSX.Element { return <div><p className="text-xs text-text-secondary">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-text-primary">{value}</p></div>; }
