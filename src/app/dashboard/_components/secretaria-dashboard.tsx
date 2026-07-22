'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { PageContainer } from '@/components/layout/page-container';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Users,
  Clock,
  DollarSign,
  Plus,
  UserPlus,
  Wallet,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Stethoscope,
  XCircle,
  ArrowRight,
  PenLine,
  Bell,
  FileText,
} from 'lucide-react';
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
  scheduled:   { label: 'Aguardando',     color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',      dot: 'bg-amber-400' },
  confirmed:   { label: 'Confirmado',     color: 'bg-teal-pale text-teal border-teal/20 dark:bg-teal/10 dark:text-teal-lt',                   dot: 'bg-teal' },
  checked_in:  { label: 'Na recepção',    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',           dot: 'bg-blue-500' },
  in_progress: { label: 'Em atendimento', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400', dot: 'bg-purple-500 animate-pulse' },
  completed:   { label: 'Realizado',      color: 'bg-surface-alt text-text-secondary border-border',                                          dot: 'bg-border' },
  no_show:     { label: 'Faltou',         color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400',                dot: 'bg-red-500' },
  cancelled:   { label: 'Cancelado',      color: 'bg-surface-alt text-text-secondary border-border',                                          dot: 'bg-border' },
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
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-surface p-5 rounded-2xl border shadow-sm hover:-translate-y-0.5 transition-all relative overflow-hidden group ${highlight ? 'border-teal/30' : 'border-border'}`}>
      <div className="absolute top-0 right-0 p-3 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
        <Icon className="w-16 h-16 text-text-primary" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${highlight ? 'bg-teal/10' : 'bg-surface-alt'}`}>
          <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-teal' : 'text-text-secondary'}`} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{label}</p>
      </div>
      <p className="font-mono text-3xl font-semibold text-text-primary tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-text-secondary mt-1.5">{sub}</p>}
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-alt transition-colors"
    >
      {/* Hora */}
      <div className="w-12 text-right shrink-0">
        <span className="font-mono text-sm font-semibold text-text-primary">{hora}</span>
      </div>

      {/* Linha separadora */}
      <div className="w-px h-8 bg-border shrink-0" />

      {/* Info do paciente */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/dashboard/pacientes/${agendamento.paciente?.id}`}
          className="font-semibold text-sm text-text-primary hover:text-teal transition-colors truncate block"
        >
          {agendamento.paciente?.nome ?? 'Paciente'}
        </Link>
        <p className="text-xs text-text-secondary truncate mt-0.5">
          {agendamento.dentista?.nome ?? '—'}
          {agendamento.observacoes && ` · ${agendamento.observacoes}`}
        </p>
      </div>

      {/* Status badge */}
      <StatusBadge status={agendamento.status} />

      {/* Botão de avançar status */}
      {proximo && (
        <button
          onClick={() => onStatusChange(agendamento.id, proximo.next)}
          className="shrink-0 text-xs font-semibold text-teal hover:bg-teal/10 px-2.5 py-1.5 rounded-lg transition-colors border border-teal/20 whitespace-nowrap"
        >
          {proximo.label}
        </button>
      )}

      {/* Solicitar assinatura */}
      {podePedirAssinatura && (
        assinado ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-teal bg-teal/10 px-2.5 py-1.5 rounded-lg border border-teal/20">
            <CheckCircle2 className="w-3 h-3" /> Assinado
          </span>
        ) : (
          <button
            onClick={onSolicitarAssinatura}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:bg-teal/10 hover:text-teal px-2.5 py-1.5 rounded-lg transition-colors border border-border whitespace-nowrap"
          >
            <PenLine className="w-3.5 h-3.5" /> Assinar
          </button>
        )
      )}

      {/* Marcar faltou */}
      {(agendamento.status === 'scheduled' || agendamento.status === 'confirmed') && (
        <div className="relative shrink-0">
          <button
            onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded-lg hover:bg-surface-alt text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-8 z-10 bg-surface border border-border rounded-xl shadow-lg p-1 min-w-[120px]"
              >
                <button
                  onClick={() => { onStatusChange(agendamento.id, 'no_show'); setOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg w-full text-left transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Faltou
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
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
    <PageContainer variant="wide">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary mb-1">
            {saudacao}, {nome.split(' ')[0]}!
          </h1>
          <p className="text-text-secondary text-sm capitalize">{dataFormatada}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-2.5 shadow-sm shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
          </span>
          <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">Sistema Online</span>
        </div>
      </motion.header>

      {/* ── Métricas do dia ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8"
      >
        <MetricCard
          icon={Calendar}
          label="Consultas hoje"
          value={metricas.totalHoje}
          sub="agendamentos do dia"
          highlight
        />
        <MetricCard
          icon={CheckCircle2}
          label="Confirmadas"
          value={metricas.confirmados}
          sub="confirmadas ou acima"
        />
        <MetricCard
          icon={AlertCircle}
          label="Aguardando"
          value={metricas.aguardando}
          sub="sem confirmação"
        />
      </motion.div>

      {/* ── Alertas de vencimento ─────────────────────────────────────────── */}
      {(metricas.venceHoje > 0 || metricas.venceSemana > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-5 py-3.5">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-0.5">Pagamentos vencendo</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {metricas.venceHoje > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    {metricas.venceHoje} vence{metricas.venceHoje > 1 ? 'm' : ''} hoje
                  </span>
                )}
                {metricas.venceSemana > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {metricas.venceSemana} nos próximos 7 dias
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/dashboard/orcamentos"
              className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap"
            >
              Ver orçamentos →
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Saúde operacional (pendências ou estado positivo) ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          {pendencias.length > 0 ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-border/60">
                <div className="w-6 h-6 rounded-lg bg-surface-alt flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5 text-text-secondary" />
                </div>
                <span className="font-semibold text-sm text-text-primary">Atenção necessária</span>
                <span className="font-mono text-[10px] text-text-secondary bg-surface-alt px-2 py-0.5 rounded-full border border-border ml-auto">
                  {pendencias.length}
                </span>
              </div>
              {/* Lista com prioridade */}
              <div className="divide-y divide-border/40">
                {pendencias.map((p, i) => {
                  const Icon = p.tipo === 'pagamento_vencido'
                    ? DollarSign
                    : p.tipo === 'orcamento_parado' ? FileText : UserCheck;
                  const prioLeft = p.prioridade === 'high'
                    ? 'border-l-2 border-coral/50'
                    : p.prioridade === 'medium'
                      ? 'border-l-2 border-amber-400/50'
                      : '';
                  const dotColor = p.prioridade === 'high'
                    ? 'bg-coral/70'
                    : p.prioridade === 'medium'
                      ? 'bg-amber-400'
                      : 'bg-border';
                  return (
                    <Link
                      key={i}
                      href={p.href}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition-colors group ${prioLeft}`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-text-secondary" />
                        </div>
                        {p.prioridade !== 'low' && (
                          <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColor}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate leading-tight">
                          {p.pacienteNome}
                        </p>
                        <p className="text-xs text-text-secondary truncate">{p.descricao}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-text-secondary opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            /* Empty state premium */
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Tudo sob controle</p>
                <p className="text-xs text-text-secondary">Nenhuma pendência operacional no momento.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Grid principal ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">

        {/* Agenda do dia */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Header da agenda */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="font-heading text-2xl text-text-primary">Agenda de Hoje</h2>
            <Link
              href="/dashboard/agendamentos"
              className="text-teal text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver agenda completa <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Filtro por dentista */}
          {dentistas.length > 1 && (
            <div className="flex gap-1.5 mb-4 flex-wrap">
              <button
                onClick={() => setDentistaSelecionado('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dentistaSelecionado === 'todos'
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                Todos
              </button>
              {dentistas.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDentistaSelecionado(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dentistaSelecionado === d.id
                      ? 'bg-teal text-white shadow-sm'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {d.nome.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          {/* Lista de agendamentos */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm">
            {listaFiltrada.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-secondary">
                <Calendar className="w-10 h-10 opacity-20" />
                <p className="text-sm font-medium">Nenhum agendamento para hoje</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                <AnimatePresence initial={false}>
                  {listaFiltrada.map(a => (
                    <AgendamentoCard
                      key={a.id}
                      agendamento={a}
                      onStatusChange={handleStatusChange}
                      assinado={assinadosIds.has(a.id)}
                      onSolicitarAssinatura={() => {
                        if (a.paciente) {
                          setModalAssinatura({ pacienteId: a.paciente.id, pacienteNome: a.paciente.nome, agendamentoId: a.id });
                        }
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        {/* Ações rápidas */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          <h2 className="font-heading text-2xl text-text-primary mb-4">Ações Rápidas</h2>

          <Link
            href="/dashboard/agendamentos"
            className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-teal/40 hover:bg-teal/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 group-hover:bg-teal/20 transition-colors">
              <Calendar className="w-4 h-4 text-teal" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Novo Agendamento</p>
              <p className="text-xs text-text-secondary">Abrir agenda</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-secondary ml-auto shrink-0 group-hover:text-teal transition-colors" />
          </Link>

          <Link
            href="/dashboard/pacientes/novo"
            className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-teal/40 hover:bg-teal/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 group-hover:bg-teal/20 transition-colors">
              <UserPlus className="w-4 h-4 text-teal" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Novo Paciente</p>
              <p className="text-xs text-text-secondary">Cadastrar paciente</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-secondary ml-auto shrink-0 group-hover:text-teal transition-colors" />
          </Link>

          <Link
            href="/dashboard/financeiro"
            className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-teal/40 hover:bg-teal/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 group-hover:bg-teal/20 transition-colors">
              <Wallet className="w-4 h-4 text-teal" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Lançar Pagamento</p>
              <p className="text-xs text-text-secondary">Financeiro</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-secondary ml-auto shrink-0 group-hover:text-teal transition-colors" />
          </Link>

          <Link
            href="/dashboard/pacientes"
            className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-teal/40 hover:bg-teal/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 group-hover:bg-teal/20 transition-colors">
              <Users className="w-4 h-4 text-teal" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Pacientes</p>
              <p className="text-xs text-text-secondary">Ver todos</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-secondary ml-auto shrink-0 group-hover:text-teal transition-colors" />
          </Link>

          {/* Resumo por dentista */}
          {dentistas.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-4 mt-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-3 flex items-center gap-1.5">
                <Stethoscope className="w-3 h-3" /> Dentistas hoje
              </p>
              <div className="space-y-2">
                {dentistas.map(d => {
                  const count = lista.filter(a => a.dentista?.id === d.id).length;
                  const naRecepcao = lista.filter(a => a.dentista?.id === d.id && a.status === 'checked_in').length;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setDentistaSelecionado(d.id === dentistaSelecionado ? 'todos' : d.id)}
                      className="flex items-center justify-between w-full hover:bg-surface-alt rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                        <span className="text-xs font-medium text-text-primary truncate max-w-[100px]">
                          {d.nome.split(' ')[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {naRecepcao > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                            {naRecepcao} recep.
                          </span>
                        )}
                        <span className="font-mono text-xs font-semibold text-text-secondary">{count}</span>
                        <Plus className="w-3 h-3 text-border" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
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
