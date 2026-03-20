'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  endOfDay,
  startOfDay,
  addDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Calendar,
  User,
  X,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  criarAgendamento,
  atualizarStatusAgendamento,
  atualizarAgendamento,
  type StatusAgendamento,
} from '../actions';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type Agendamento = {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  data_hora: string;
  duracao_minutos: number;
  tipo: string | null;
  status: StatusAgendamento;
  observacoes: string | null;
  created_at: string;
  paciente: { id: string; nome: string } | null;
  dentista: { id: string; nome: string } | null;
};

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StatusAgendamento, { label: string; className: string }> = {
  agendado:   { label: 'Agendado',   className: 'bg-teal/10 text-teal border border-teal/20' },
  confirmado: { label: 'Confirmado', className: 'bg-teal-pale text-teal-dark border border-teal/20' },
  aguardando: { label: 'Aguardando', className: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400' },
  realizado:  { label: 'Realizado',  className: 'bg-teal-pale text-teal-dark border border-teal/20' },
  faltou:     { label: 'Faltou',     className: 'bg-surface-alt text-text-secondary border border-border' },
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DURACOES = [15, 30, 45, 60, 90, 120];

const inputClass =
  'w-full font-sans text-sm px-3 py-2 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/40 transition-all';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  agendamentos: Agendamento[];
  pacientes: { id: string; nome: string }[];
  clinicaId: string;
}

export function AgendamentosClient({ agendamentos, pacientes }: Props): React.JSX.Element {
  const router = useRouter();
  const hoje = new Date();

  const [mesVisualizacao, setMesVisualizacao] = useState(hoje);
  const [diaSelecionado, setDiaSelecionado] = useState(hoje);
  const [dialogNovoAberto, setDialogNovoAberto] = useState(false);
  const [agendamentoEdicao, setAgendamentoEdicao] = useState<Agendamento | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [formNovo, setFormNovo] = useState({
    pacienteId: '',
    data: format(hoje, 'yyyy-MM-dd'),
    hora: '08:00',
    duracao: 30,
    tipo: '',
    observacoes: '',
  });

  const [formEdicao, setFormEdicao] = useState({
    data: '',
    hora: '',
    duracao: 30,
    tipo: '',
    observacoes: '',
    status: 'agendado' as StatusAgendamento,
  });

  // ── Calendário ──────────────────────────────────────────────────────────────
  const diasDoCalendario = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mesVisualizacao), { locale: ptBR }),
    end: endOfWeek(endOfMonth(mesVisualizacao), { locale: ptBR }),
  });

  function temAgendamento(dia: Date): boolean {
    return agendamentos.some((a) => isSameDay(new Date(a.data_hora), dia));
  }

  // ── Agendamentos do dia selecionado ─────────────────────────────────────────
  const agendamentosDia = agendamentos.filter((a) =>
    isSameDay(new Date(a.data_hora), diaSelecionado)
  );

  // Stats
  const agendamentosHoje = agendamentos.filter((a) => isToday(new Date(a.data_hora)));
  const agendamentosSemana = agendamentos.filter((a) => {
    const d = new Date(a.data_hora);
    const inicioSemana = startOfDay(hoje);
    const fimSemana = endOfDay(addDays(hoje, 6));
    return d >= inicioSemana && d <= fimSemana;
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleCriarAgendamento() {
    if (!formNovo.pacienteId) { toast.error('Selecione um paciente'); return; }
    setSalvando(true);
    const dataHora = `${formNovo.data}T${formNovo.hora}:00`;
    const result = await criarAgendamento({
      pacienteId: formNovo.pacienteId,
      dataHora,
      duracaoMinutos: formNovo.duracao,
      tipo: formNovo.tipo || null,
      observacoes: formNovo.observacoes || null,
    });
    setSalvando(false);
    if (result.error) {
      toast.error('Erro ao criar agendamento');
    } else {
      toast.success('Agendamento criado');
      setDialogNovoAberto(false);
      setFormNovo({ pacienteId: '', data: format(hoje, 'yyyy-MM-dd'), hora: '08:00', duracao: 30, tipo: '', observacoes: '' });
      router.refresh();
    }
  }

  function abrirEdicao(ag: Agendamento) {
    const d = new Date(ag.data_hora);
    setFormEdicao({
      data: format(d, 'yyyy-MM-dd'),
      hora: format(d, 'HH:mm'),
      duracao: ag.duracao_minutos,
      tipo: ag.tipo ?? '',
      observacoes: ag.observacoes ?? '',
      status: ag.status,
    });
    setAgendamentoEdicao(ag);
  }

  async function handleSalvarEdicao() {
    if (!agendamentoEdicao) return;
    setSalvando(true);
    const dataHora = `${formEdicao.data}T${formEdicao.hora}:00`;
    const result = await atualizarAgendamento(agendamentoEdicao.id, {
      dataHora,
      duracaoMinutos: formEdicao.duracao,
      tipo: formEdicao.tipo || null,
      observacoes: formEdicao.observacoes || null,
      status: formEdicao.status,
    });
    setSalvando(false);
    if (result.error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Agendamento atualizado');
      setAgendamentoEdicao(null);
      router.refresh();
    }
  }

  async function handleAtualizarStatus(id: string, status: StatusAgendamento) {
    const result = await atualizarStatusAgendamento(id, status);
    if (result.error) toast.error('Erro ao atualizar status');
    else router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8 max-w-7xl mx-auto w-full"
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-text-primary mb-1">Agendamentos</h1>
          <p className="text-text-secondary text-sm font-medium">Agenda da clínica</p>
        </div>
        <button
          type="button"
          onClick={() => setDialogNovoAberto(true)}
          className="bg-teal text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-teal-dark transition-all shadow-lg premium-shadow"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Coluna esquerda — calendário */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cards stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-teal" />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">Hoje</p>
              </div>
              <p className="font-mono text-2xl font-bold text-text-primary">{agendamentosHoje.length}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-teal" />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">Semana</p>
              </div>
              <p className="font-mono text-2xl font-bold text-text-primary">{agendamentosSemana.length}</p>
            </div>
          </div>

          {/* Calendário */}
          <div className="bg-surface rounded-2xl border border-border p-5">
            {/* Navegação do mês */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setMesVisualizacao(subMonths(mesVisualizacao, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="font-sans font-semibold text-sm text-text-primary capitalize">
                {format(mesVisualizacao, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <button
                type="button"
                onClick={() => setMesVisualizacao(addMonths(mesVisualizacao, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 mb-2">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center font-mono text-[10px] text-text-secondary py-1">{d}</div>
              ))}
            </div>

            {/* Dias */}
            <div className="grid grid-cols-7 gap-0.5">
              {diasDoCalendario.map((dia) => {
                const ativo = isSameDay(dia, diaSelecionado);
                const ehHoje = isToday(dia);
                const mesAtual = isSameMonth(dia, mesVisualizacao);
                const temAg = temAgendamento(dia);

                return (
                  <button
                    key={dia.toISOString()}
                    type="button"
                    onClick={() => setDiaSelecionado(dia)}
                    className={`relative h-9 w-full flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                      ativo
                        ? 'bg-teal text-white font-bold shadow-sm'
                        : ehHoje
                        ? 'bg-teal/10 text-teal font-semibold'
                        : mesAtual
                        ? 'text-text-primary hover:bg-surface-alt'
                        : 'text-text-muted hover:bg-surface-alt/50'
                    }`}
                  >
                    {format(dia, 'd')}
                    {temAg && !ativo && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Coluna direita — lista do dia */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sans font-semibold text-text-primary">
              {isToday(diaSelecionado) ? 'Hoje' : format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h3>
            <span className="font-mono text-xs text-text-secondary">
              {agendamentosDia.length} agendamento{agendamentosDia.length !== 1 ? 's' : ''}
            </span>
          </div>

          {agendamentosDia.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border flex flex-col items-center gap-3 py-14">
              <Calendar className="w-10 h-10 text-text-muted" />
              <div className="text-center">
                <p className="font-serif text-base text-text-primary">Sem agendamentos</p>
                <p className="font-sans text-sm text-text-secondary mt-1">
                  Nenhum agendamento para este dia
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormNovo((f) => ({ ...f, data: format(diaSelecionado, 'yyyy-MM-dd') }));
                  setDialogNovoAberto(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
              >
                <Plus className="w-4 h-4" /> Agendar para este dia
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {agendamentosDia.map((ag) => {
                const statusCfg = STATUS_CONFIG[ag.status];
                const hora = format(new Date(ag.data_hora), 'HH:mm');

                return (
                  <motion.div
                    key={ag.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="bg-surface rounded-2xl border border-border p-4 hover:border-teal/30 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Hora */}
                      <div className="w-14 shrink-0">
                        <p className="font-mono text-sm font-bold text-teal">{hora}</p>
                        <p className="font-mono text-[10px] text-text-secondary">{ag.duracao_minutos}min</p>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-sans text-sm font-semibold text-text-primary">
                              {ag.paciente?.nome ?? '—'}
                            </p>
                            {ag.tipo && (
                              <p className="font-sans text-xs text-text-secondary mt-0.5">{ag.tipo}</p>
                            )}
                            {ag.dentista && (
                              <p className="font-mono text-xs text-text-muted mt-0.5">
                                <User className="w-3 h-3 inline mr-1" />
                                {ag.dentista.nome}
                              </p>
                            )}
                          </div>

                          {/* Status inline select */}
                          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                              {statusCfg.label}
                            </span>
                            <select
                              value={ag.status}
                              onChange={(e) => void handleAtualizarStatus(ag.id, e.target.value as StatusAgendamento)}
                              className="absolute inset-0 w-full opacity-0 cursor-pointer"
                            >
                              <option value="agendado">Agendado</option>
                              <option value="confirmado">Confirmado</option>
                              <option value="aguardando">Aguardando</option>
                              <option value="cancelado">Cancelado</option>
                              <option value="realizado">Realizado</option>
                              <option value="faltou">Faltou</option>
                            </select>
                          </div>
                        </div>

                        {ag.observacoes && (
                          <p className="font-sans text-xs text-text-secondary mt-2 line-clamp-2">{ag.observacoes}</p>
                        )}

                        {/* Ações */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/pacientes/${ag.paciente?.id ?? ag.paciente_id}`)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-teal transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Ver Ficha
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEdicao(ag)}
                            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-surface-alt"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Dialog — Novo Agendamento */}
      <Dialog open={dialogNovoAberto} onOpenChange={setDialogNovoAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Novo Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Paciente</label>
              <select
                value={formNovo.pacienteId}
                onChange={(e) => setFormNovo((f) => ({ ...f, pacienteId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Selecionar paciente…</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Data</label>
                <input
                  type="date"
                  value={formNovo.data}
                  onChange={(e) => setFormNovo((f) => ({ ...f, data: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Hora</label>
                <input
                  type="time"
                  value={formNovo.hora}
                  onChange={(e) => setFormNovo((f) => ({ ...f, hora: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Duração</label>
              <select
                value={formNovo.duracao}
                onChange={(e) => setFormNovo((f) => ({ ...f, duracao: Number(e.target.value) }))}
                className={inputClass}
              >
                {DURACOES.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Tipo / Procedimento</label>
              <input
                type="text"
                value={formNovo.tipo}
                onChange={(e) => setFormNovo((f) => ({ ...f, tipo: e.target.value }))}
                placeholder="Ex: Consulta, Limpeza…"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Observações</label>
              <textarea
                value={formNovo.observacoes}
                onChange={(e) => setFormNovo((f) => ({ ...f, observacoes: e.target.value }))}
                rows={3}
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogNovoAberto(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCriarAgendamento}
              disabled={salvando || !formNovo.pacienteId}
              className="px-6 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark disabled:opacity-50 transition-colors"
            >
              {salvando ? 'Salvando…' : 'Agendar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Editar Agendamento */}
      <Dialog open={!!agendamentoEdicao} onOpenChange={(open) => { if (!open) setAgendamentoEdicao(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Editar — {agendamentoEdicao?.paciente?.nome ?? ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Data</label>
                <input type="date" value={formEdicao.data} onChange={(e) => setFormEdicao((f) => ({ ...f, data: e.target.value }))} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Hora</label>
                <input type="time" value={formEdicao.hora} onChange={(e) => setFormEdicao((f) => ({ ...f, hora: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Duração</label>
                <select value={formEdicao.duracao} onChange={(e) => setFormEdicao((f) => ({ ...f, duracao: Number(e.target.value) }))} className={inputClass}>
                  {DURACOES.map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Status</label>
                <select value={formEdicao.status} onChange={(e) => setFormEdicao((f) => ({ ...f, status: e.target.value as StatusAgendamento }))} className={inputClass}>
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="aguardando">Aguardando</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="realizado">Realizado</option>
                  <option value="faltou">Faltou</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Tipo / Procedimento</label>
              <input type="text" value={formEdicao.tipo} onChange={(e) => setFormEdicao((f) => ({ ...f, tipo: e.target.value }))} placeholder="Ex: Consulta, Limpeza…" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Observações</label>
              <textarea value={formEdicao.observacoes} onChange={(e) => setFormEdicao((f) => ({ ...f, observacoes: e.target.value }))} rows={3} className={inputClass + ' resize-none'} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setAgendamentoEdicao(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors">Cancelar</button>
            <button type="button" onClick={handleSalvarEdicao} disabled={salvando} className="px-6 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark disabled:opacity-50 transition-colors">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
