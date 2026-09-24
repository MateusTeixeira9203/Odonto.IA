'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, CircleDollarSign, FileClock, UserRoundCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import type { ClinicOverviewData } from '@/server/consultorio/overview';
import type { ClinicFinancialData } from '@/server/financeiro/clinica';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type Props = {
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
  financeiro: ClinicFinancialData | null;
  overview: ClinicOverviewData | null;
  mensagem?: string;
};

export function ClinicOverviewPanel({ basePath, financeiro, overview, mensagem }: Props): React.JSX.Element {
  const [queue, setQueue] = useState<'reativacao' | 'orcamentos' | 'pagamentos' | null>(null);
  if (!financeiro || !overview) {
    return <section role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{mensagem ?? 'Os indicadores da clínica estão indisponíveis agora.'}</section>;
  }
  const conversion = overview.pacientesComOrcamento > 0
    ? Math.round((overview.pacientesComAprovacao / overview.pacientesComOrcamento) * 100)
    : 0;

  return (
    <div className="space-y-10">
      <SectionHeading eyebrow="Prioridades" title="Hoje na clínica" description="O que pede ação antes de aprofundar os números." />
      <section className="grid gap-3 lg:grid-cols-3" aria-label="Pendências da clínica">
        <AttentionCard icon={FileClock} label="Orçamentos sem retorno" value={String(overview.orcamentosSemRetorno.quantidade)} detail={money.format(overview.orcamentosSemRetorno.valor) + ' aguardando decisão'} onClick={() => setQueue('orcamentos')} />
        <AttentionCard icon={UserRoundCheck} label="Pacientes para reativar" value={String(overview.pacientesParaReativar)} detail="Follow-ups sem retorno futuro agendado" onClick={() => setQueue('reativacao')} />
        <AttentionCard icon={CalendarClock} label="Pagamentos vencidos" value={String(overview.pagamentosVencidos.quantidade)} detail={money.format(overview.pagamentosVencidos.valor) + ' em atraso'} onClick={() => setQueue('pagamentos')} />
      </section>

      <section>
        <SectionHeading eyebrow="Financeiro" title="Resultado do período" description="Caixa confirmado e valores que ainda dependem de recebimento." action={<Link href={basePath + '/financeiro-clinica'} className="inline-flex items-center gap-1 text-sm font-semibold text-teal">Abrir financeiro <ArrowRight className="size-4" /></Link>} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Recebido pela clínica" value={money.format(financeiro.recebido)} detail="Recebimentos confirmados" />
          <Metric label="A receber" value={money.format(financeiro.aReceber)} detail="Cobranças ativas" />
          <Metric label="Despesas registradas" value={money.format(financeiro.despesas)} detail="Fixas e variáveis" />
          <Metric label="Saldo de caixa" value={money.format(financeiro.saldoCaixa)} detail="Entradas confirmadas menos saídas" emphasis />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <SectionHeading eyebrow="Conversão" title="Jornada do paciente" description="Do primeiro cadastro ao retorno já marcado." />
            <div className="mt-7 grid gap-3 sm:grid-cols-4">
              <JourneyStep label="Novos pacientes" value={overview.novosPacientes} />
              <JourneyStep label="Com orçamento" value={overview.pacientesComOrcamento} />
              <JourneyStep label="Aprovados" value={overview.pacientesComAprovacao} />
              <JourneyStep label="Retorno agendado" value={overview.retornosAgendados} last />
            </div>
          </CardContent>
        </Card>
        <Card className="border-teal/25 bg-teal-pale">
          <CardContent className="p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">Leitura do gestor</p>
            <p className="mt-4 font-heading text-3xl text-foreground">{conversion}%</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">dos pacientes que receberam orçamento no período tiveram uma aprovação registrada.</p>
            <p className="mt-5 border-t border-border pt-4 text-sm text-foreground">{overview.pacientesComAprovacao - overview.retornosAgendados > 0 ? String(overview.pacientesComAprovacao - overview.retornosAgendados) + ' paciente(s) aprovado(s) ainda não têm retorno futuro agendado.' : 'Os pacientes aprovados estão com o retorno organizado.'}</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeading eyebrow="Equipe" title="Produção por profissional" description="Uma leitura rápida da produção aprovada e do recebimento vinculado." action={<Link href={basePath + '/equipe'} className="inline-flex items-center gap-1 text-sm font-semibold text-teal">Ver equipe <ArrowRight className="size-4" /></Link>} />
        <Card className="mt-4 overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">Profissional</th><th className="px-5 py-3 text-right font-semibold">Produção aprovada</th><th className="px-5 py-3 text-right font-semibold">Recebido</th><th className="px-5 py-3 text-right font-semibold">A receber</th></tr></thead>
              <tbody>{financeiro.profissionais.length === 0 ? <tr><td colSpan={4} className="px-5 py-6 text-muted-foreground">Ainda não há produção no período.</td></tr> : financeiro.profissionais.slice(0, 6).map((item) => <tr key={item.dentistaId} className="border-t border-border"><td className="px-5 py-4 font-semibold text-foreground">{item.nome}</td><td className="px-5 py-4 text-right font-mono">{money.format(item.producaoAprovada)}</td><td className="px-5 py-4 text-right font-mono text-teal">{money.format(item.recebidoVinculado)}</td><td className="px-5 py-4 text-right font-mono">{money.format(item.aReceber)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      </section>
      <QueueDialog queue={queue} onOpenChange={(open) => !open && setQueue(null)} data={overview} />
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }): React.JSX.Element {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">{eyebrow}</p><h2 className="mt-1 font-heading text-2xl font-normal text-foreground sm:text-[28px]">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

function AttentionCard({ icon: Icon, label, value, detail, onClick }: { icon: typeof CircleDollarSign; label: string; value: string; detail: string; onClick(): void }): React.JSX.Element {
  return <button type="button" onClick={onClick} className="group rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-teal/40"><div className="flex items-center justify-between"><Icon className="size-5 text-amber" /><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><p className="mt-5 text-sm font-semibold text-foreground">{label}</p><p className="mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></button>;
}

function Metric({ label, value, detail, emphasis = false }: { label: string; value: string; detail: string; emphasis?: boolean }): React.JSX.Element {
  return <div className={emphasis ? 'rounded-2xl border border-teal/30 bg-teal-pale p-5' : 'rounded-2xl border border-border bg-card p-5'}><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className={emphasis ? 'mt-3 font-mono text-2xl font-semibold text-teal' : 'mt-3 font-mono text-2xl font-semibold text-foreground'}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>;
}

function JourneyStep({ label, value, last = false }: { label: string; value: number; last?: boolean }): React.JSX.Element {
  return <div className="relative rounded-xl border border-border bg-muted/40 p-4"><p className="font-mono text-2xl font-semibold text-foreground">{value}</p><p className="mt-2 text-xs font-semibold text-muted-foreground">{label}</p>{!last && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-card p-1 text-teal sm:block" />}</div>;
}

type QueueKey = 'reativacao' | 'orcamentos' | 'pagamentos';
type QueueItem = { id: string; nome: string; telefone: string | null; detalhe: string };

function QueueDialog({ queue, onOpenChange, data }: { queue: QueueKey | null; onOpenChange(open: boolean): void; data: ClinicOverviewData }): React.JSX.Element {
  const meta = queue === 'reativacao'
    ? { title: 'Pacientes para reativar', description: 'Sem retorno futuro agendado. A mensagem é apenas preparada; o envio continua sob sua decisão.', items: data.filas.reativacao.map((item) => ({ ...item, detalhe: 'Follow-up pendente' })) }
    : queue === 'orcamentos'
      ? { title: 'Orçamentos sem retorno', description: 'Orçamentos enviados há mais de sete dias e ainda aguardando decisão.', items: data.filas.orcamentosSemRetorno.map((item) => ({ ...item, detalhe: money.format(item.valor) })) }
      : { title: 'Pagamentos vencidos', description: 'Cobranças pendentes com vencimento anterior a hoje.', items: data.filas.pagamentosVencidos.map((item) => ({ ...item, detalhe: `${money.format(item.valor)}${item.vencimento ? ` · venceu em ${new Intl.DateTimeFormat('pt-BR').format(new Date(`${item.vencimento}T12:00:00`))}` : ''}` })) };
  return <Dialog open={queue !== null} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{meta.title}</DialogTitle><DialogDescription>{meta.description}</DialogDescription></DialogHeader><div className="space-y-3">{meta.items.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhuma pendência nesta fila.</p> : meta.items.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0" key={item.id}><div><p className="font-semibold text-foreground">{item.nome}</p><p className="mt-1 text-sm text-muted-foreground">{item.detalhe}</p></div>{item.telefone ? <a className="inline-flex min-h-10 items-center rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted" href={whatsAppHref(item)} target="_blank" rel="noreferrer">Preparar WhatsApp</a> : <p className="text-sm text-muted-foreground">Sem telefone</p>}</div>)}</div></DialogContent></Dialog>;
}

function whatsAppHref(item: QueueItem): string {
  const phone = item.telefone?.replace(/\D/g, '') ?? '';
  const prefix = phone.startsWith('55') ? phone : `55${phone}`;
  const message = `Olá, ${item.nome}. Tudo bem? Gostaríamos de acompanhar seu atendimento na clínica.`;
  return `https://wa.me/${prefix}?text=${encodeURIComponent(message)}`;
}
