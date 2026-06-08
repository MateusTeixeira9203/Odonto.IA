'use client';

import { motion, AnimatePresence } from 'motion/react';
import { format, isToday as isDateToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  UserCog,
  UserCheck,
  BotMessageSquare,
  CheckCircle2,
  AlertTriangle,
  PenLine,
  Stethoscope,
  CalendarOff,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { STATUS_CONFIG } from './status-config';
import type { AgendamentoRow } from '../page';
import type { AgendamentoStatus } from '@/types/database';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasAppointments: boolean;
}

interface MonthViewProps {
  // Calendar grid
  currentMonth: Date;
  calendarDays: CalendarDay[];
  selectedDate: Date;
  onDaySelect: (date: Date) => void;
  isPending: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  // Stats
  todayCount: number;
  selectedDayCount: number;
  // Appointment list
  appointments: AgendamentoRow[];
  isSecretaria: boolean;
  filtroDentistaId: string;
  dentistas: { id: string; nome: string }[];
  canEdit: boolean;
  isFiltered?: boolean;
  onAppointmentClick: (apt: AgendamentoRow) => void;
  onStatusChange: (id: string, status: string) => void;
  onNoShow: (id: string) => void;
  onCancel: (apt: AgendamentoRow) => void;
  onNewAppointment: () => void;
  onVerFicha: (pacienteId: string) => void;
  onStartConsulta: (aptId: string) => void;
  onRequestAssinatura: (pacienteId: string, nome: string, aptId: string) => void;
  assinadosIds: Set<string>;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ── Component ─────────────────────────────────────────────────────────────────

export function MonthView({
  currentMonth,
  calendarDays,
  selectedDate,
  onDaySelect,
  isPending,
  onPrevMonth,
  onNextMonth,
  todayCount,
  selectedDayCount,
  appointments,
  isSecretaria,
  filtroDentistaId,
  dentistas,
  canEdit,
  isFiltered = false,
  onAppointmentClick,
  onStatusChange,
  onNoShow,
  onCancel,
  onNewAppointment,
  onVerFicha,
  onStartConsulta,
  onRequestAssinatura,
  assinadosIds,
}: MonthViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">

      {/* ── Calendário ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="lg:col-span-1"
      >
        <div className="bg-surface rounded-3xl border border-border shadow-sm p-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl text-text-primary font-semibold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={onPrevMonth}
                disabled={isPending}
                className="p-2 hover:bg-surface-alt rounded-lg transition-colors border border-border disabled:opacity-40"
              >
                <ChevronLeft className={`w-4 h-4 text-text-secondary ${isPending ? 'animate-pulse' : ''}`} />
              </button>
              <button
                onClick={onNextMonth}
                disabled={isPending}
                className="p-2 hover:bg-surface-alt rounded-lg transition-colors border border-border disabled:opacity-40"
              >
                <ChevronRight className={`w-4 h-4 text-text-secondary ${isPending ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-bold text-text-secondary uppercase tracking-wider py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className={`grid grid-cols-7 gap-1 transition-opacity duration-300 ${isPending ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            {calendarDays.map((day, i) => {
              const isSelected = isSameDay(day.date, selectedDate);
              return (
                <div
                  key={i}
                  onClick={() => onDaySelect(day.date)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm relative cursor-pointer transition-all
                    ${!day.isCurrentMonth ? 'text-text-secondary/40' : 'text-text-primary hover:bg-surface-alt'}
                    ${day.isToday && !isSelected ? 'border-2 border-teal' : ''}
                    ${isSelected ? 'bg-teal text-white hover:bg-teal-lt font-bold shadow-md' : ''}
                  `}
                >
                  <span>{format(day.date, 'd')}</span>
                  {day.hasAppointments && day.isCurrentMonth && !isSelected && (
                    <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-teal" />
                  )}
                  {day.hasAppointments && isSelected && (
                    <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-white" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mini-resumo */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-teal/10 rounded-3xl p-4 border border-teal/20">
            <div className="text-[10px] font-bold text-teal uppercase tracking-wider mb-1">Hoje</div>
            <div className="font-mono text-2xl font-medium text-teal">{todayCount}</div>
            <div className="text-xs text-teal mt-1">Consultas</div>
          </div>
          <div className="bg-surface-alt rounded-3xl p-4 border border-border">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">
              Selecionado
            </div>
            <div className="font-mono text-2xl font-medium text-text-primary">{selectedDayCount}</div>
            <div className="text-xs text-text-secondary mt-1">Agendadas</div>
          </div>
        </div>
      </motion.div>

      {/* ── Lista do dia selecionado ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="lg:col-span-2"
      >
        <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
          {/* Header */}
          <div className="p-6 border-b border-border bg-surface-alt/40 flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold text-xl text-text-primary capitalize">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h2>
              <p className="text-sm text-text-secondary mt-1 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {selectedDayCount} agendamento
                {selectedDayCount !== 1 ? 's' : ''}
                {isSecretaria && filtroDentistaId !== 'todos' && (
                  <span className="text-teal font-semibold">
                    · Dr(a). {dentistas.find((d) => d.id === filtroDentistaId)?.nome}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Appointment list */}
          <div className="flex-1 p-6">
            <AnimatePresence mode="wait">
              {appointments.length > 0 ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative border-l-2 border-border ml-4 space-y-8 pb-4"
                >
                  {appointments.map((apt, i) => {
                    const statusCfg = STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled;
                    return (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        className="relative pl-8 group"
                      >
                        {/* Timeline dot — pulsing for in_progress */}
                        {statusCfg.dotPulse ? (
                          <span className="absolute -left-[9px] top-1 w-4 h-4 shrink-0">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusCfg.dot} opacity-50`} />
                            <span className={`relative inline-flex rounded-full w-4 h-4 border-4 border-surface shadow-sm ${statusCfg.dot}`} />
                          </span>
                        ) : (
                          <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-surface shadow-sm ${statusCfg.dot}`} />
                        )}

                        <div
                          onClick={() => onAppointmentClick(apt)}
                          className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group-hover:border-teal/30 cursor-pointer"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                              {/* Time + status select */}
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-lg font-medium text-text-primary">
                                  {format(parseISO(apt.data_hora), 'HH:mm')}
                                </span>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Select
                                    value={apt.status}
                                    onValueChange={(val) => { if (val) onStatusChange(apt.id, val); }}
                                  >
                                    <SelectTrigger
                                      className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider border-none shadow-none ${statusCfg.bg} ${statusCfg.text}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-surface border-border">
                                      <SelectItem value="scheduled">Agendado</SelectItem>
                                      <SelectItem value="confirmed">Confirmado</SelectItem>
                                      <SelectItem value="checked_in">Na Recepção</SelectItem>
                                      <SelectItem value="in_progress">Em Atendimento</SelectItem>
                                      <SelectItem value="completed">Realizado</SelectItem>
                                      <SelectItem value="cancelled">Cancelado</SelectItem>
                                      <SelectItem value="no_show">Faltou</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Patient name */}
                              <h3 className="font-semibold text-lg text-text-primary flex items-center gap-2 flex-wrap">
                                <User className="w-4 h-4 text-text-secondary" />
                                {apt.paciente?.nome ?? '—'}
                                {apt.origem === 'bot' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-700">
                                    <BotMessageSquare className="w-3 h-3" />
                                    Via Bot
                                  </span>
                                )}
                              </h3>

                              {/* Dentist — secretária only */}
                              {isSecretaria && apt.dentista && (
                                <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                                  <UserCog className="w-3 h-3" />
                                  Dr(a). {apt.dentista.nome}
                                </p>
                              )}

                              {/* Creator — when differs from dentist */}
                              {apt.criador && apt.criador.id !== apt.dentista_id && (
                                <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-teal/70" />
                                  Criado por {apt.criador.nome}
                                </p>
                              )}

                              {apt.observacoes && (
                                <p className="text-sm text-text-secondary mt-1">{apt.observacoes}</p>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div
                              className="flex gap-2 flex-wrap justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Check-in — secretária */}
                              {isSecretaria && (apt.status === 'scheduled' || apt.status === 'confirmed') && (
                                <button
                                  onClick={() => onStatusChange(apt.id, 'checked_in')}
                                  className="px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-gradient-to-r from-teal to-teal-lt rounded-lg transition-all flex items-center gap-1.5 shadow-[0_4px_12px_-4px_rgba(47,156,133,0.4)] hover:-translate-y-0.5 active:scale-[0.98]"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Chegou!
                                </button>
                              )}

                              {/* No-show — secretária */}
                              {isSecretaria && ['scheduled', 'confirmed'].includes(apt.status) && (
                                <button
                                  onClick={() => onNoShow(apt.id)}
                                  className="px-3 py-2.5 min-h-[44px] text-sm font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:border-red-800 rounded-lg transition-all flex items-center gap-1.5 active:scale-[0.98]"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                  Faltou
                                </button>
                              )}

                              {/* Cancel — secretária */}
                              {isSecretaria && !['cancelled', 'no_show', 'completed'].includes(apt.status) && (
                                <button
                                  onClick={() => onCancel(apt)}
                                  className="px-3 py-2.5 min-h-[44px] text-sm font-semibold text-text-secondary border border-border hover:bg-surface-alt rounded-lg transition-all active:scale-[0.98]"
                                >
                                  Cancelar
                                </button>
                              )}

                              {/* Assinatura — secretária */}
                              {isSecretaria &&
                                (apt.status === 'checked_in' || apt.status === 'in_progress' || apt.status === 'completed') &&
                                apt.paciente && (
                                  assinadosIds.has(apt.id) ? (
                                    <span className="px-4 py-2.5 min-h-[44px] text-sm font-semibold text-teal bg-teal/10 border border-teal/20 rounded-lg flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4" /> Assinado
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        onRequestAssinatura(apt.paciente!.id, apt.paciente!.nome, apt.id)
                                      }
                                      className="px-4 py-2.5 min-h-[44px] text-sm font-semibold text-text-secondary border border-border rounded-lg hover:bg-teal/5 hover:text-teal hover:border-teal/30 transition-all active:scale-[0.98] flex items-center gap-1.5"
                                    >
                                      <PenLine className="w-4 h-4" />
                                      Assinar
                                    </button>
                                  )
                                )}

                              {/* Iniciar consulta — dentista */}
                              {!isSecretaria &&
                                apt.paciente &&
                                !['cancelled', 'no_show', 'completed'].includes(apt.status) && (
                                  <button
                                    onClick={() => onStartConsulta(apt.id)}
                                    className="px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-gradient-to-r from-teal to-teal-lt rounded-lg transition-all flex items-center gap-1.5 shadow-[0_4px_12px_-4px_rgba(47,156,133,0.4)] hover:-translate-y-0.5 active:scale-[0.98]"
                                  >
                                    <Stethoscope className="w-4 h-4" />
                                    Iniciar consulta
                                  </button>
                                )}

                              {/* Ver ficha */}
                              <button
                                onClick={() => onVerFicha(apt.paciente?.id ?? '')}
                                className="px-4 py-2.5 min-h-[44px] text-sm font-semibold text-text-secondary border border-border rounded-lg hover:bg-surface-alt active:scale-[0.98] transition-all"
                              >
                                Ver Ficha
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full py-20 text-center"
                >
                  <div className="w-16 h-16 bg-surface-alt rounded-2xl border border-border flex items-center justify-center mb-4">
                    {isFiltered
                      ? <SlidersHorizontal className="w-7 h-7 text-text-secondary/50" />
                      : <CalendarOff className="w-7 h-7 text-text-secondary/50" />
                    }
                  </div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {isFiltered ? 'Sem consultas para este filtro' : 'Dia livre'}
                  </h3>
                  <p className="text-sm text-text-secondary max-w-xs mx-auto mt-1">
                    {isFiltered
                      ? 'Nenhuma consulta do dentista selecionado para este dia.'
                      : canEdit
                        ? 'Nenhum compromisso aqui. Clique abaixo para agendar.'
                        : 'Nenhum compromisso marcado para este dia.'}
                  </p>
                  {canEdit && !isFiltered && (
                    <Button
                      variant="outline"
                      className="mt-6 rounded-xl border-border text-text-secondary hover:bg-surface-alt"
                      onClick={onNewAppointment}
                    >
                      Agendar agora
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
