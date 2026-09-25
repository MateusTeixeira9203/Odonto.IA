'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, CircleDollarSign, FileClock, UserRoundCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import type { ClinicOverviewData } from '@/server/consultorio/overview';
import type { ClinicFinancialData } from '@/server/financeiro/clinica';
import { interpolateWhatsAppTemplate, type WhatsAppTemplates } from '@/lib/whatsapp/operational-templates';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClinicTransactionActions } from './clinic-transaction-actions';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type Props = {
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
  financeiro: ClinicFinancialData | null;
  overview: ClinicOverviewData | null;
  whatsappTemplates: WhatsAppTemplates;
  nomeClinica: string;
  operationalOnly?: boolean;
  canRegisterIncome?: boolean;
  canRegisterCost?: boolean;
  professionals?: Array<{ id: string; nome: string }>;
  mensagem?: string;
};

export function ClinicOverviewPanel({ basePath, financeiro, overview, whatsappTemplates, nomeClinica, operationalOnly = false, canRegisterIncome = false, canRegisterCost = false, professionals = [], mensagem }: Props): React.JSX.Element {
  const [queue, setQueue] = useState<'reativacao' | 'orcamentos' | 'pagamentos' | null>(null);
  if (!overview || (!operationalOnly && !financeiro)) {
    return <section role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{mensagem ?? 'Os indicadores da clínica estão indisponíveis agora.'}</section>;
  }
  // O fluxo operacional não consulta métricas financeiras. Nos demais fluxos,
  // o retorno acima garante a presença destes dados.
  const managementFinanceiro = financeiro as ClinicFinancialData;
  const conversion = overview.pacientesComOrcamento > 0
    ? Math.round((overview.pacientesComAprovacao / overview.pacientesComOrcamento) * 100)
    : 0;

  return (
    <div className="space-y-10">
      {!operationalOnly && <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">Saúde do negócio</p>
        <h2 className="mt-2 font-heading text-3xl font-normal tracking-tight text-foreground sm:text-4xl">{managementFinanceiro.movimentoLiquido >= 0 ? 'O mês gerou caixa para a clínica.' : 'O mês pede correção de caixa.'}</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">O resultado é caixa confirmado: o que entrou menos custos e repasses já pagos. Não é saldo bancário nem lucro contábil.</p>
        <div className="mt-7 grid gap-x-6 gap-y-5 border-t border-border pt-6 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Recebido" value={money.format(managementFinanceiro.recebido)} detail="confirmado" />
          <Metric label="Saídas pagas" value={money.format(managementFinanceiro.despesas)} detail="custos + repasses" />
          <Metric label="Resultado de caixa" value={money.format(managementFinanceiro.movimentoLiquido)} detail="não é lucro contábil" tone={managementFinanceiro.movimentoLiquido >= 0 ? 'positive' : 'negative'} />
          <Metric label="Margem de caixa" value={managementFinanceiro.baseDeCustosValidada && managementFinanceiro.margemOperacional != null ? `${managementFinanceiro.margemOperacional.toFixed(1).replace('.', ',')}%` : '—'} detail={managementFinanceiro.baseDeCustosValidada ? 'base validada' : 'sem base de custos'} />
        </div>
      </section>}

      <SectionHeading eyebrow="Ações do dia" title="O que precisa andar" description="Cada ação abre a lista que explica o motivo e o próximo passo." />
      <section className="grid gap-3 lg:grid-cols-3" aria-label="Pendências da clínica">
        <AttentionCard icon={FileClock} label="Orçamentos pendentes" value={String(overview.orcamentosPendentes.quantidade)} detail={money.format(overview.orcamentosPendentes.valor) + ' com acompanhamento pendente'} onClick={() => setQueue('orcamentos')} />
        <AttentionCard icon={UserRoundCheck} label="Pacientes para reativar" value={String(overview.pacientesParaReativar)} detail="Follow-ups sem retorno futuro agendado" onClick={() => setQueue('reativacao')} />
        <AttentionCard icon={CalendarClock} label="Pagamentos vencidos" value={String(overview.pagamentosVencidos.quantidade)} detail={money.format(overview.pagamentosVencidos.valor) + ' em atraso'} onClick={() => setQueue('pagamentos')} />
      </section>

      {operationalOnly && <>
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <SectionHeading eyebrow="Operação" title="Acompanhe e encaminhe" description="Abra a lista, prepare a mensagem no WhatsApp e use a agenda para registrar o próximo passo." action={<ClinicTransactionActions canRegisterIncome={canRegisterIncome} canRegisterCost={canRegisterCost} professionals={professionals} />} />
        </section>
        <QueueDialog queue={queue} onOpenChange={(open) => !open && setQueue(null)} data={overview} templates={whatsappTemplates} nomeClinica={nomeClinica} />
      </>}

      {!operationalOnly && <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
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
      </section>}

      {!operationalOnly && <section>
        <SectionHeading eyebrow="Equipe" title="Produção por profissional" description="Uma leitura rápida da produção aprovada e do recebimento vinculado." action={<Link href={basePath + '/equipe'} className="inline-flex items-center gap-1 text-sm font-semibold text-teal">Ver equipe <ArrowRight className="size-4" /></Link>} />
        <Card className="mt-4 overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">Profissional</th><th className="px-5 py-3 text-right font-semibold">Produção aprovada</th><th className="px-5 py-3 text-right font-semibold">Recebido</th><th className="px-5 py-3 text-right font-semibold">A receber</th></tr></thead>
              <tbody>{managementFinanceiro.profissionais.length === 0 ? <tr><td colSpan={4} className="px-5 py-6 text-muted-foreground">Ainda não há produção no período.</td></tr> : managementFinanceiro.profissionais.slice(0, 6).map((item) => <tr key={item.dentistaId} className="border-t border-border"><td className="px-5 py-4 font-semibold text-foreground">{item.nome}</td><td className="px-5 py-4 text-right font-mono">{money.format(item.producaoAprovada)}</td><td className="px-5 py-4 text-right font-mono text-teal">{money.format(item.recebidoVinculado)}</td><td className="px-5 py-4 text-right font-mono">{money.format(item.aReceber)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      </section>}
      {!operationalOnly && <QueueDialog queue={queue} onOpenChange={(open) => !open && setQueue(null)} data={overview} templates={whatsappTemplates} nomeClinica={nomeClinica} />}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }): React.JSX.Element {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">{eyebrow}</p><h2 className="mt-1 font-heading text-2xl font-normal text-foreground sm:text-[28px]">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

function AttentionCard({ icon: Icon, label, value, detail, onClick }: { icon: typeof CircleDollarSign; label: string; value: string; detail: string; onClick(): void }): React.JSX.Element {
  return <button type="button" onClick={onClick} className="group rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-teal/40"><div className="flex items-center justify-between"><Icon className="size-5 text-amber" /><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><p className="mt-5 text-sm font-semibold text-foreground">{label}</p><p className="mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></button>;
}

function Metric({ label, value, detail, tone = 'default' }: { label: string; value: string; detail: string; tone?: 'default' | 'positive' | 'negative' }): React.JSX.Element {
  const valueClass = tone === 'positive' ? 'text-teal' : tone === 'negative' ? 'text-destructive' : 'text-foreground';
  const cardClass = tone === 'positive' ? 'border-teal/30 bg-teal-pale' : tone === 'negative' ? 'border-destructive/30 bg-destructive/10' : 'border-border bg-card';
  return <div className={`rounded-2xl border p-5 ${cardClass}`}><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className={`mt-3 font-mono text-2xl font-semibold ${valueClass}`}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>;
}

function JourneyStep({ label, value, last = false }: { label: string; value: number; last?: boolean }): React.JSX.Element {
  return <div className="relative rounded-xl border border-border bg-muted/40 p-4"><p className="font-mono text-2xl font-semibold text-foreground">{value}</p><p className="mt-2 text-xs font-semibold text-muted-foreground">{label}</p>{!last && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-card p-1 text-teal sm:block" />}</div>;
}

type QueueKey = 'reativacao' | 'orcamentos' | 'pagamentos';
type QueueItem = { id: string; nome: string; telefone: string | null; detalhe: string };

function QueueDialog({ queue, onOpenChange, data, templates, nomeClinica }: { queue: QueueKey | null; onOpenChange(open: boolean): void; data: ClinicOverviewData; templates: WhatsAppTemplates; nomeClinica: string }): React.JSX.Element {
  const meta = queue === 'reativacao'
    ? { title: 'Pacientes para reativar', description: 'Sem retorno futuro agendado. A mensagem é apenas preparada; o envio continua sob sua decisão.', items: data.filas.reativacao.map((item) => ({ ...item, detalhe: 'Follow-up pendente' })) }
    : queue === 'orcamentos'
      ? { title: 'Orçamentos pendentes', description: 'Acompanhe a causa antes de preparar a mensagem: atendimento sem orçamento, proposta enviada ou cobrança ainda não criada.', items: [
        ...data.filas.atendimentosSemOrcamento.map((item) => ({ ...item, id: `sem-orcamento-${item.id}`, detalhe: 'Atendimento concluído sem orçamento' })),
        ...data.filas.orcamentosEnviados.map((item) => ({ ...item, id: `enviado-${item.orcamentoId}`, detalhe: `Orçamento enviado · ${money.format(item.valor)}` })),
        ...data.filas.aprovadosSemCobranca.map((item) => ({ ...item, id: `sem-cobranca-${item.orcamentoId}`, detalhe: `Aprovado sem cobrança · ${money.format(item.valor)}` })),
      ] }
      : { title: 'Pagamentos vencidos', description: 'Cobranças pendentes com vencimento anterior a hoje.', items: data.filas.pagamentosVencidos.map((item) => ({ ...item, detalhe: `${money.format(item.valor)}${item.vencimento ? ` · venceu em ${new Intl.DateTimeFormat('pt-BR').format(new Date(`${item.vencimento}T12:00:00`))}` : ''}` })) };
  const template = queue === 'reativacao' ? templates.reativacao : queue === 'pagamentos' ? templates.cobranca : templates.orcamento;
  return <Dialog open={queue !== null} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{meta.title}</DialogTitle><DialogDescription>{meta.description}</DialogDescription></DialogHeader><div className="space-y-3">{meta.items.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhuma pendência nesta fila.</p> : meta.items.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0" key={item.id}><div><p className="font-semibold text-foreground">{item.nome}</p><p className="mt-1 text-sm text-muted-foreground">{item.detalhe}</p></div>{item.telefone ? <a className="inline-flex min-h-10 items-center rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted" href={whatsAppHref(item, interpolateWhatsAppTemplate(template, item.nome, nomeClinica))} target="_blank" rel="noreferrer">Preparar WhatsApp</a> : <p className="text-sm text-muted-foreground">Sem telefone</p>}</div>)}</div></DialogContent></Dialog>;
}

function whatsAppHref(item: QueueItem, message: string): string {
  const phone = item.telefone?.replace(/\D/g, '') ?? '';
  const prefix = phone.startsWith('55') ? phone : `55${phone}`;
  return `https://wa.me/${prefix}?text=${encodeURIComponent(message)}`;
}
