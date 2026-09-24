import Link from 'next/link';
import { AlertTriangle, CalendarClock, CircleDollarSign } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClinicFinancialData } from '@/server/financeiro/clinica';
import type { ClinicRepassesData } from '@/server/financeiro/repasses';
import { ClinicTransactionActions } from './clinic-transaction-actions';
import { ClinicRepassePanel } from './clinic-repasse-panel';

type Props = {
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
  data: ClinicFinancialData | null;
  canWrite: boolean;
  repasses: ClinicRepassesData | null;
  canManageRepasses: boolean;
  mensagem?: string;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const formatMoney = (value: number): string => money.format(value);

function trend(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const value = ((current - previous) / previous) * 100;
  return (value >= 0 ? '+' : '') + value.toFixed(1).replace('.', ',') + '%';
}

export function ClinicFinancePanel({ basePath, data, canWrite, repasses, canManageRepasses, mensagem }: Props): React.JSX.Element {
  if (!data) return <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-foreground"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" /><p>{mensagem ?? 'O financeiro da clínica está indisponível agora. Os valores não foram substituídos por zero.'}</p></div></section>;
  const previous = data.chart.at(-2);
  const receiptTrend = previous ? trend(data.recebido, previous.recebido) : null;
  const expenseTrend = previous ? trend(data.despesas, previous.despesas) : null;
  const chartMax = Math.max(1, ...data.chart.flatMap((item) => [item.recebido, item.despesas]));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Caixa confirmado, previsão, margem e desempenho da unidade.</p></div>
        <ClinicTransactionActions canWrite={canWrite} />
      </div>

      <section className="rounded-[18px] border border-teal/30 bg-teal-pale p-5 sm:p-7">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal"><CircleDollarSign className="size-4" />Caixa confirmado</p><p className="mt-3 font-mono text-4xl font-semibold text-foreground">{formatMoney(data.saldoCaixa)}</p><p className="mt-2 text-sm text-muted-foreground">Entradas confirmadas menos despesas registradas até o período.</p></div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4"><InlineMetric label="Recebido" value={formatMoney(data.recebido)} /><InlineMetric label="Despesas" value={formatMoney(data.despesas)} /><InlineMetric label="Resultado" value={formatMoney(data.resultadoOperacional)} /><InlineMetric label="Margem" value={data.margemOperacional == null ? '—' : data.margemOperacional.toFixed(1).replace('.', ',') + '%'} /></div>
        </div>
      </section>

      <section>
        <Heading eyebrow="Desempenho" title="Resultado e capacidade de investimento" description="Indicadores para acompanhar a direção do caixa sem misturar previsão com dinheiro recebido." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Resultado operacional" value={formatMoney(data.resultadoOperacional)} detail="Recebido menos despesas" tone={data.resultadoOperacional >= 0 ? 'positive' : 'negative'} />
          <Metric label="Margem operacional" value={data.margemOperacional == null ? '—' : data.margemOperacional.toFixed(1).replace('.', ',') + '%'} detail="Resultado sobre o recebido" />
          <Metric label="Fôlego de caixa" value={data.folegoCaixaMeses == null ? 'Indisponível' : data.folegoCaixaMeses.toFixed(1).replace('.', ',') + ' meses'} detail="Com base nos custos fixos" />
          <Metric label="A receber" value={formatMoney(data.aReceber)} detail={data.vencido > 0 ? formatMoney(data.vencido) + ' vencidos' : 'Sem cobranças vencidas'} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle className="font-heading text-2xl font-normal">Fluxo mensal</CardTitle><CardDescription>Recebidos e despesas com valores legíveis nos últimos seis meses.</CardDescription></CardHeader>
          <CardContent className="space-y-5">{data.chart.map((item) => <div key={item.mesISO}><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-semibold text-foreground">{item.mes}</span><span className="font-mono text-xs text-muted-foreground">{formatMoney(item.recebido)} recebidos · {formatMoney(item.despesas)} despesas</span></div><div className="space-y-1.5"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-teal" style={{ width: String(Math.max(2, (item.recebido / chartMax) * 100)) + '%' }} /></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-destructive/70" style={{ width: String(Math.max(2, (item.despesas / chartMax) * 100)) + '%' }} /></div></div></div>)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-heading text-2xl font-normal">Previsão</CardTitle><CardDescription>Valores previstos continuam fora do caixa até a confirmação.</CardDescription></CardHeader>
          <CardContent className="space-y-5"><InlineMetric label="A receber" value={formatMoney(data.aReceber)} /><InlineMetric label="Custos fixos previstos" value={data.despesasFixasPrevistas > 0 ? formatMoney(data.despesasFixasPrevistas) : 'Não configurados'} /><InlineMetric label="Tendência de recebimento" value={receiptTrend ?? 'Sem base anterior'} /><InlineMetric label="Tendência de despesas" value={expenseTrend ?? 'Sem base anterior'} /></CardContent>
        </Card>
      </section>

      <section>
        <Heading eyebrow="Equipe" title="Recebimentos por profissional" description="Produção aprovada e dinheiro que entrou são leituras separadas." />
        <Card className="mt-4 overflow-hidden"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">Profissional</th><th className="px-5 py-3 text-right font-semibold">Produção aprovada</th><th className="px-5 py-3 text-right font-semibold">Recebido vinculado</th><th className="px-5 py-3 text-right font-semibold">A receber</th></tr></thead><tbody>{data.profissionais.length === 0 ? <tr><td className="px-5 py-6 text-muted-foreground" colSpan={4}>Ainda não há produção clínica neste período.</td></tr> : data.profissionais.map((professional) => <tr className="border-t border-border" key={professional.dentistaId}><td className="px-5 py-4 font-semibold text-foreground">{professional.nome}</td><td className="px-5 py-4 text-right font-mono">{formatMoney(professional.producaoAprovada)}</td><td className="px-5 py-4 text-right font-mono text-teal">{formatMoney(professional.recebidoVinculado)}</td><td className="px-5 py-4 text-right font-mono">{formatMoney(professional.aReceber)}</td></tr>)}</tbody></table></CardContent></Card>
      </section>

      <ClinicRepassePanel data={repasses} canManage={canManageRepasses} mes={data.mes} />

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <Card><CardHeader><CardTitle className="font-heading text-2xl font-normal">Extrato da clínica</CardTitle><CardDescription>Movimentações confirmadas no período.</CardDescription></CardHeader><CardContent className="space-y-3">{data.extrato.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Sem lançamentos confirmados neste mês.</p> : data.extrato.map((item) => <div key={item.tipo + '-' + item.id} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"><div><p className="font-semibold text-foreground">{item.descricao}</p><p className="mt-1 text-xs text-muted-foreground">{item.tipo === 'despesa' ? 'Despesa' : item.tipo === 'receita_manual' ? 'Receita manual' : 'Recebimento'} · {shortDate.format(new Date(item.data + 'T12:00:00'))}</p></div><p className={item.valor < 0 ? 'font-mono text-destructive' : 'font-mono text-teal'}>{item.valor < 0 ? '− ' : '+ '}{formatMoney(Math.abs(item.valor))}</p></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="font-heading text-2xl font-normal">Custos fixos</CardTitle><CardDescription>Projeções recorrentes para o planejamento mensal.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{data.recorrencias.length === 0 ? 'Nenhum custo fixo recorrente foi configurado.' : String(data.recorrencias.filter((item) => item.ativo).length) + ' custo(s) ativo(s) somam ' + formatMoney(data.despesasFixasPrevistas) + ' por mês.'}</p>{data.podeGerirCustos ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/80" href={basePath + '/financeiro-clinica/custos'}><CalendarClock className="size-4" />Gerenciar custos fixos</Link> : <p className="text-sm text-muted-foreground">Você pode consultar os custos, mas não alterá-los.</p>}</CardContent></Card>
      </section>
    </div>
  );
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }): React.JSX.Element {
  return <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">{eyebrow}</p><h2 className="mt-1 font-heading text-2xl font-normal text-foreground sm:text-[28px]">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}
function InlineMetric({ label, value }: { label: string; value: string }): React.JSX.Element { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</p></div>; }
function Metric({ label, value, detail, tone = 'default' }: { label: string; value: string; detail: string; tone?: 'default' | 'positive' | 'negative' }): React.JSX.Element { const color = tone === 'positive' ? 'text-teal' : tone === 'negative' ? 'text-destructive' : 'text-foreground'; return <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className={'mt-3 font-mono text-xl font-semibold ' + color}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>; }
