import { AlertTriangle, CalendarDays, FileCheck2, ReceiptText, WalletCards } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ManagedPersonalData } from '@/server/financeiro/repasses';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const formatMoney = (value: number): string => money.format(value);

export function ManagedPersonalFinancePanel({ data, mensagem }: { data: ManagedPersonalData | null; mensagem?: string }): React.JSX.Element {
  if (!data) return <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-foreground"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" /><p>{mensagem ?? 'O seu financeiro está indisponível agora. Os valores não foram substituídos por zero.'}</p></div></section>;

  const chartMax = Math.max(1, ...data.serieMensal.flatMap((item) => [item.entradas, item.despesas]));
  return <div className="space-y-8">
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal"><WalletCards className="size-4" />Meu resultado</p><h2 className="mt-2 font-heading text-3xl font-normal text-foreground">Seu resultado na clínica</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Produção, recebimentos e agenda do seu atendimento. Entradas e saídas pertencem ao caixa da clínica.</p></div>
    </section>

    <section className="rounded-[18px] border border-teal/30 bg-teal-pale p-5 sm:p-7">
      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal"><WalletCards className="size-4" />Seu repasse</p><p className="mt-3 font-mono text-4xl font-semibold text-foreground">{formatMoney(data.repassePago)}</p><p className="mt-2 max-w-xl text-sm text-muted-foreground">O valor só vira resultado pessoal quando a clínica confirma o pagamento do seu repasse.</p></div><div className="grid grid-cols-2 gap-x-8 gap-y-5"><Inline label="Repasse previsto" value={formatMoney(data.repassePrevisto)} /><Inline label="Horas atendidas" value={`${data.horasAtendidas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`} /><Inline label="Ocupação realizada" value={data.ocupacaoRealizada == null ? '—' : `${data.ocupacaoRealizada.toLocaleString('pt-BR')}%`} /><Inline label="Recebido vinculado" value={formatMoney(data.recebidoVinculado)} /></div></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<FileCheck2 className="size-4" />} label="Orçamentos aprovados" value={formatMoney(data.orcamentosAprovados)} detail="Aceites comerciais no período" />
      <Metric icon={<CalendarDays className="size-4" />} label="Atendimentos concluídos" value={String(data.atendimentosRealizados)} detail="Agenda marcada como concluída" />
      <Metric icon={<ReceiptText className="size-4" />} label="Recebido vinculado" value={formatMoney(data.recebidoVinculado)} detail="Entrou no caixa da clínica" />
      <Metric icon={<WalletCards className="size-4" />} label="Ticket aprovado" value={data.ticketAprovado == null ? '—' : formatMoney(data.ticketAprovado)} detail="Produção aprovada por orçamento" tone="teal" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
      <Card><CardHeader><CardTitle className="font-heading text-2xl font-normal">Recebimentos vinculados</CardTitle><CardDescription>Pagamentos confirmados dos seus pacientes nos últimos seis meses.</CardDescription></CardHeader><CardContent className="space-y-5">{data.serieMensal.map((item) => <div key={item.mesISO}><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-semibold text-foreground">{item.mes}</span><span className="font-mono text-xs text-muted-foreground">{formatMoney(item.entradas)} recebidos</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(2, (item.entradas / chartMax) * 100)}%` }} /></div></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="font-heading text-2xl font-normal">Repasses</CardTitle><CardDescription>Uma obrigação da clínica só vira entrada pessoal quando está paga.</CardDescription></CardHeader><CardContent className="space-y-4"><Inline label="Previsto" value={formatMoney(data.repassePrevisto)} /><Inline label="Pago" value={formatMoney(data.repassePago)} />{data.repasses.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum repasse neste período.</p> : data.repasses.slice(0, 4).map((repasse) => <div key={repasse.id} className="border-t border-border pt-3"><p className="font-semibold text-foreground">{repasse.origem === 'percentual' ? 'Repasse percentual' : repasse.origem === 'diaria' ? 'Diária' : 'Mensal fixo'}</p><p className="mt-1 text-sm text-muted-foreground">{formatMoney(repasse.valor)} · {repasse.status === 'pago' ? 'Pago' : repasse.status === 'previsto' ? 'Previsto' : 'Cancelado'}</p></div>)}</CardContent></Card>
    </section>
  </div>;
}

function Inline({ label, value }: { label: string; value: string }): React.JSX.Element { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</p></div>; }
function Metric({ icon, label, value, detail, tone = 'default' }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: 'default' | 'teal' }): React.JSX.Element { return <Card><CardContent className="p-5"><p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{icon}{label}</p><p className={tone === 'teal' ? 'mt-3 font-mono text-xl font-semibold text-teal' : 'mt-3 font-mono text-xl font-semibold text-foreground'}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>; }
