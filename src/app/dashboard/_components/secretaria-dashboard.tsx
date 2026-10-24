'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { primeiroNomeSaudacao } from '@/lib/dashboard/primeiro-nome-saudacao';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckCircle2, ChevronDown, XCircle, ArrowRight, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { atualizarStatusAgendamento, type StatusAgendamento } from '@/app/dashboard/agendamentos/actions';
import { AssinaturaRecepcaoModal } from '@/components/fichas/AssinaturaRecepcaoModal';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type { StatusAgendamento };

export type PendenciaItem = {
  tipo: 'orcamento_parado' | 'pagamento_vencido' | 'followup_pendente';
  prioridade: 'high' | 'medium' | 'low';
  pacienteId: string | null;
  pacienteNome: string;
  descricao: string;
  href: string;
  diasAtrasado?: number;
};

export type AgendamentoHoje = {
  id: string;
  data_hora: string;
  status: StatusAgendamento;
  observacoes: string | null;
  paciente: { id: string; nome: string } | null;
  dentista: { id: string; nome: string } | null;
};

export type DentistaItem = {
  id: string;
  nome: string;
};

export type SecretariaDashboardProps = {
  nome: string;
  agendamentos: AgendamentoHoje[];
  dentistas: DentistaItem[];
  metricas: {
    totalHoje: number;
    confirmados: number;
    aguardando: number;
    venceHoje: number;
    venceSemana: number;
  };
  pendencias: PendenciaItem[];
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StatusAgendamento, { label: string; color: string; dot: string }> = {
  scheduled: { label: 'Aguardando', color: 'bg-warning-pale text-warning-ink', dot: 'bg-warning' },
  confirmed: { label: 'Confirmado', color: 'bg-teal-pale text-teal-ink', dot: 'bg-teal' },
  checked_in: { label: 'Na recepção', color: 'bg-clinical-done-pale text-clinical-done-ink', dot: 'bg-clinical-done' },
  in_progress: { label: 'Em atendimento', color: 'bg-teal-pale text-teal-ink', dot: 'bg-teal' },
  completed: { label: 'Realizado', color: 'bg-slate-pale text-slate-ink', dot: 'bg-slate' },
  no_show: { label: 'Faltou', color: 'bg-coral-pale text-coral-ink', dot: 'bg-coral' },
  cancelled: { label: 'Cancelado', color: 'bg-slate-pale text-slate-ink', dot: 'bg-slate' },
};

// Próximos status que a secretária pode atribuir inline
const PROXIMOS_STATUS: Partial<Record<StatusAgendamento, { label: string; next: StatusAgendamento }>> = {
  scheduled:   { label: 'Confirmar',       next: 'confirmed' },
  confirmed:   { label: 'Check-in',        next: 'checked_in' },
  checked_in:  { label: 'Em atendimento',  next: 'in_progress' },
  in_progress: { label: 'Finalizar',       next: 'completed' },
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StatusAgendamento }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-[12px] font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, sub, highlight }: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 px-6 py-[18px]">
      <dt className="text-[12.5px] text-text-secondary">{label}</dt>
      <dd className={`mt-1 font-mono text-[21px] font-medium ${highlight ? 'text-teal-ink' : 'text-text-primary'}`}>{value}</dd>
      {sub && <dd className="mt-1 text-[12px] text-text-secondary">{sub}</dd>}
    </div>
  );
}

// ─── Card de agendamento ──────────────────────────────────────────────────────

const STATUSES_ASSINATURA: StatusAgendamento[] = ['checked_in', 'in_progress', 'completed'];

function AgendamentoCard({
  agendamento,
  onStatusChange,
  assinado,
  onSolicitarAssinatura,
}: {
  agendamento: AgendamentoHoje;
  onStatusChange: (id: string, status: StatusAgendamento) => void;
  assinado?: boolean;
  onSolicitarAssinatura?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const proximo = PROXIMOS_STATUS[agendamento.status];
  const hora = format(parseISO(agendamento.data_hora), 'HH:mm');
  const podePedirAssinatura = STATUSES_ASSINATURA.includes(agendamento.status) && !!agendamento.paciente;

  return (
    <div      className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-alt max-[600px]:gap-x-2"
    >
      {/* Hora */}
      <div className="w-12 shrink-0">
        <span className="font-mono text-[15px] font-bold text-text-primary">{hora}</span>
      </div>

      {/* Info do paciente */}
      <div className="min-w-0 flex-1 max-[600px]:basis-[calc(100%-68px)]">
        <Link
          href={`/dashboard/pacientes/${agendamento.paciente?.id}`}
          className="block truncate text-[15px] font-medium text-text-primary transition-colors hover:text-teal-ink"
        >
          {agendamento.paciente?.nome ?? 'Paciente'}
        </Link>
        <p className="mt-0.5 truncate text-[12px] text-text-secondary">
          {agendamento.dentista?.nome ?? '—'}
          {agendamento.observacoes && ` · ${agendamento.observacoes}`}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 max-[600px]:w-full max-[600px]:pl-14">
      {/* Status badge */}
      <StatusBadge status={agendamento.status} />

      {/* Botão de avançar status */}
      {proximo && (
        <button
          onClick={() => onStatusChange(agendamento.id, proximo.next)}
          className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border border-border px-[13px] text-[13px] font-medium text-text-secondary transition-colors hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20"
        >
          {proximo.label}
        </button>
      )}

      {/* Solicitar assinatura */}
      {podePedirAssinatura && (
        assinado ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-teal-pale px-1.5 py-0.5 text-[12px] text-teal-ink">
            <CheckCircle2 className="w-3 h-3" /> Assinado
          </span>
        ) : (
          <button
            onClick={onSolicitarAssinatura}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] border border-border px-[13px] text-[13px] font-medium text-text-secondary transition-colors hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20"
          >
            <PenLine className="w-3.5 h-3.5" /> Assinar
          </button>
        )
      )}

      {/* Marcar faltou */}
      {(agendamento.status === 'scheduled' || agendamento.status === 'confirmed') && (
        <div className="relative shrink-0">
          <button
            aria-label="Mais ações do agendamento"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-[8px] text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>            {open && (
              <div                className="absolute right-0 top-11 z-10 min-w-[120px] rounded-[8px] border border-border bg-surface p-1"
              >
                <button
                  onClick={() => { onStatusChange(agendamento.id, 'no_show'); setOpen(false); }}
                  className="flex min-h-10 w-full items-center gap-2 rounded-[8px] px-3 text-left text-[13px] text-coral-ink transition-colors hover:bg-coral-pale"
                >
                  <XCircle className="w-3.5 h-3.5" /> Faltou
                </button>
              </div>
            )}        </div>
      )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function SecretariaDashboard({
  nome,
  agendamentos,
  dentistas,
  metricas,
  pendencias,
}: SecretariaDashboardProps) {
  const [dentistaSelecionado, setDentistaSelecionado] = useState<string>('todos');
  const [lista, setLista] = useState<AgendamentoHoje[]>(agendamentos);
  const [, startTransition] = useTransition();
  const [assinadosIds, setAssinadosIds] = useState<Set<string>>(new Set());
  const [modalAssinatura, setModalAssinatura] = useState<{
    pacienteId: string;
    pacienteNome: string;
    agendamentoId: string;
  } | null>(null);

  const now = new Date();
  const primeiroNome = primeiroNomeSaudacao(nome);
  const hora = now.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const dataFormatada = format(now, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const listaFiltrada = dentistaSelecionado === 'todos'
    ? lista
    : lista.filter(a => a.dentista?.id === dentistaSelecionado);

  const handleStatusChange = (id: string, novoStatus: StatusAgendamento) => {
    startTransition(async () => {
      const result = await atualizarStatusAgendamento(id, novoStatus);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLista(prev => prev.map(a => a.id === id ? { ...a, status: novoStatus } : a));
      toast.success(`Status atualizado: ${STATUS_CONFIG[novoStatus].label}`);
    });
  };

  return (
    <PageContainer variant="tela">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-[12.5px] uppercase tracking-wider text-text-secondary">{dataFormatada}</p>
          <h1 className="font-heading text-[32px] font-normal leading-[1.15] text-text-primary">
            {saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}!
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 max-[600px]:w-full [&>a]:inline-flex [&>a]:h-10 [&>a]:items-center [&>a]:justify-center [&>a]:gap-1.5 [&>a]:rounded-[8px] [&>a]:px-[13px] [&>a]:text-[15px] [&>a]:transition-colors max-[600px]:[&>a]:grow [&>a]:focus-visible:outline-none [&>a]:focus-visible:ring-2 [&>a]:focus-visible:ring-teal/20">
          <Link href="/dashboard/agendamentos" className="border border-teal-ink bg-teal-pale font-semibold text-teal-ink hover:opacity-90"><Calendar className="h-4 w-4" />+ Novo agendamento</Link>
          <Link href="/dashboard/pacientes/novo" className="border border-border font-medium text-text-secondary hover:bg-teal-pale hover:text-teal-ink">Novo paciente</Link>
          <Link href="/dashboard/financeiro" className="border border-border font-medium text-text-secondary hover:bg-teal-pale hover:text-teal-ink">Lançar pagamento</Link>
          <Link href="/dashboard/pacientes" className="border border-border font-medium text-text-secondary hover:bg-teal-pale hover:text-teal-ink">Pacientes</Link>
        </div>
      </header>

      <dl id="dex-tour-metrics" className="mb-6 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-surface max-[600px]:grid-cols-1 max-[600px]:divide-x-0 max-[600px]:divide-y">
        <MetricCard label="Consultas hoje" value={metricas.totalHoje} sub="agendamentos do dia" highlight />
        <MetricCard label="Confirmadas" value={metricas.confirmados} sub="confirmadas ou acima" />
        <MetricCard label="Aguardando" value={metricas.aguardando} sub="sem confirmação" />
      </dl>

      {(metricas.venceHoje > 0 || metricas.venceSemana > 0) && (
        <div className="mb-6 flex items-center justify-between gap-3 border-l-2 border-warning py-2 pl-3 max-[600px]:flex-col max-[600px]:items-start">
          <div className="min-w-0">
            <p className="mb-0.5 text-[13px] font-bold text-warning-ink">Pagamentos vencendo</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-text-secondary">
              {metricas.venceHoje > 0 && <span>{metricas.venceHoje} vence{metricas.venceHoje > 1 ? 'm' : ''} hoje</span>}
              {metricas.venceSemana > 0 && <span>{metricas.venceSemana} nos próximos 7 dias</span>}
            </div>
          </div>
          <Link href="/dashboard/pacientes" className="inline-flex min-h-10 shrink-0 items-center text-[13px] font-medium text-teal-ink hover:underline">Abrir pacientes →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-[30px] min-[1051px]:grid-cols-[minmax(0,1fr)_320px] min-[1051px]:grid-rows-[auto_1fr]">
        <section aria-label="Atenção necessária" className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface min-[1051px]:col-start-2 min-[1051px]:row-start-1">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
            <h2 className="text-[17px] font-bold text-text-primary">Atenção necessária</h2>
            {pendencias.length > 0 && <span className="rounded-[4px] bg-warning-pale px-1.5 py-0.5 font-mono text-[12px] text-warning-ink">{pendencias.length}</span>}
          </div>
          {pendencias.length > 0 ? (
            <div className="divide-y divide-border">
              {pendencias.map((p, i) => (
                <Link key={i} href={p.href} className="flex min-h-10 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-alt">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${p.prioridade === 'high' ? 'bg-coral' : p.prioridade === 'medium' ? 'bg-warning' : 'bg-slate'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-text-primary">{p.pacienteNome}</p>
                    <p className="text-[12px] text-text-secondary">{p.descricao}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4">
              <p className="text-[15px] text-text-primary">Tudo sob controle</p>
              <p className="mt-1 text-[13px] text-text-secondary">Nenhuma pendência operacional no momento.</p>
            </div>
          )}
        </section>

        <section aria-label="Agenda de hoje" className="min-w-0 rounded-[12px] border border-border bg-surface min-[1051px]:col-start-1 min-[1051px]:row-span-2 min-[1051px]:row-start-1">
          <div className="border-b border-border px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold text-text-primary">Agenda de hoje</h2>
              <Link href="/dashboard/agendamentos" className="inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-teal-ink hover:underline">Ver agenda completa <ArrowRight className="h-4 w-4" /></Link>
            </div>
            {dentistas.length > 1 && (
              <div aria-label="Filtrar agenda por dentista" className="mt-3 flex w-fit max-w-full overflow-x-auto rounded-[8px] border border-border p-1 [&>button]:h-10 [&>button]:shrink-0 [&>button]:rounded-[6px] [&>button]:px-[11px] [&>button]:text-[13px] [&>button]:transition-colors [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-teal/20">
                <button aria-pressed={dentistaSelecionado === 'todos'} onClick={() => setDentistaSelecionado('todos')} className={dentistaSelecionado === 'todos' ? 'bg-teal-pale font-semibold text-teal-ink' : 'text-text-secondary hover:bg-surface-alt'}>Todos</button>
                {dentistas.map(d => (
                  <button key={d.id} aria-pressed={dentistaSelecionado === d.id} onClick={() => setDentistaSelecionado(d.id)} className={dentistaSelecionado === d.id ? 'bg-teal-pale font-semibold text-teal-ink' : 'text-text-secondary hover:bg-surface-alt'}>{d.nome}</button>
                ))}
              </div>
            )}
          </div>
          {listaFiltrada.length === 0 ? (
            <p className="px-4 py-8 text-[15px] text-text-secondary">Nenhum agendamento para hoje</p>
          ) : (
            <div>
                {listaFiltrada.map(a => (
                  <AgendamentoCard key={a.id} agendamento={a} onStatusChange={handleStatusChange} assinado={assinadosIds.has(a.id)} onSolicitarAssinatura={() => {
                    if (a.paciente) {
                      setModalAssinatura({ pacienteId: a.paciente.id, pacienteNome: a.paciente.nome, agendamentoId: a.id });
                    }
                  }} />
                ))}
            </div>
          )}
        </section>

        {dentistas.length > 0 && (
          <section aria-label="Dentistas hoje" className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface min-[1051px]:col-start-2 min-[1051px]:row-start-2">
            <h2 className="border-b border-border px-4 py-4 text-[17px] font-bold text-text-primary">Dentistas hoje</h2>
            <div className="divide-y divide-border">
              {dentistas.map(d => {
                const count = lista.filter(a => a.dentista?.id === d.id).length;
                const naRecepcao = lista.filter(a => a.dentista?.id === d.id && a.status === 'checked_in').length;
                return (
                  <button key={d.id} aria-pressed={dentistaSelecionado === d.id} onClick={() => setDentistaSelecionado(d.id === dentistaSelecionado ? 'todos' : d.id)} className={`flex min-h-10 w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/20 ${dentistaSelecionado === d.id ? 'bg-teal-pale text-teal-ink' : 'text-text-primary hover:bg-surface-alt'}`}>
                    <span className="min-w-0 flex-1 text-[15px]">{d.nome}</span>
                    <span className="flex items-center gap-2">
                      {naRecepcao > 0 && <span className="rounded-[4px] bg-clinical-done-pale px-1.5 py-0.5 text-[12px] text-clinical-done-ink">{naRecepcao} na recepção</span>}
                      <span className="font-mono text-[13px] font-medium">{count}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {modalAssinatura && (
        <AssinaturaRecepcaoModal
          open={!!modalAssinatura}
          onOpenChange={(open) => { if (!open) setModalAssinatura(null); }}
          pacienteId={modalAssinatura.pacienteId}
          pacienteNome={modalAssinatura.pacienteNome}
          onSigned={() => {
            setAssinadosIds(prev => new Set([...prev, modalAssinatura.agendamentoId]));
          }}
        />
      )}
    </PageContainer>
  );
}
