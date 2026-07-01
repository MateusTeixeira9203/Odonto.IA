'use client';

import { useMemo } from 'react';
import {
  format, addDays, subDays, isToday as isDateToday, parseISO, isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle,
  X as XIcon, FileText, CalendarOff, SlidersHorizontal, ThumbsUp,
} from 'lucide-react';
import { STATUS_CONFIG } from './status-config';
import type { AgendamentoRow } from '../page';
import type { AgendamentoStatus } from '@/types/database';

const HOUR_START  = 7;
const HOUR_END    = 20;
const SLOT_HEIGHT = 72;


interface DayViewProps {
  agendamentos: AgendamentoRow[];
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onAppointmentClick: (apt: AgendamentoRow) => void;
  isSecretaria: boolean;
  onConfirm: (id: string) => void;
  onCheckIn: (id: string) => void;
  onNoShow: (id: string) => void;
  onCancel: (apt: AgendamentoRow) => void;
  onVerFicha: (pacienteId: string) => void;
  isFiltered?: boolean;
}

export function DayView({
  agendamentos,
  selectedDate,
  onDateChange,
  onAppointmentClick,
  isSecretaria,
  onConfirm,
  onCheckIn,
  onNoShow,
  onCancel,
  onVerFicha,
  isFiltered = false,
}: DayViewProps) {
  const hours       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;
  const isToday     = isDateToday(selectedDate);

  const dayApts = useMemo(() => {
    return agendamentos
      .filter(apt => isSameDay(parseISO(apt.data_hora), selectedDate))
      .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  }, [agendamentos, selectedDate]);

  function getAptStyle(apt: AgendamentoRow) {
    const d           = parseISO(apt.data_hora);
    const hourDecimal = d.getHours() + d.getMinutes() / 60;
    const top         = (hourDecimal - HOUR_START) * SLOT_HEIGHT;
    // Piso de 46px garante as 2 linhas essenciais (hora+status / nome) sem cortar — antes 40px cortava o nome em consultas curtas.
    const height      = Math.max((apt.duracao_minutos / 60) * SLOT_HEIGHT - 6, 46);
    const { bg, border, text } = (STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled).timeline;
    return { top, height, bg, border, text };
  }

  return (
    <div className="flex flex-col h-full">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-alt/40 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDateChange(subDays(selectedDate, 1))}
            className="p-1.5 hover:bg-surface rounded-lg transition-colors border border-border"
          >
            <ChevronLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <div className="text-center px-2">
            <div className={`text-base font-bold capitalize ${isToday ? 'text-teal' : 'text-text-primary'}`}>
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </div>
            {isToday && (
              <div className="text-[10px] font-semibold uppercase tracking-widest text-teal">
                Hoje
              </div>
            )}
          </div>
          <button
            onClick={() => onDateChange(addDays(selectedDate, 1))}
            className="p-1.5 hover:bg-surface rounded-lg transition-colors border border-border"
          >
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary font-medium">
            {dayApts.length} consulta{dayApts.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onDateChange(new Date())}
            className="text-xs font-semibold text-teal hover:opacity-80 transition-colors px-3 py-1.5 rounded-lg bg-teal/5 hover:bg-teal/10 flex items-center gap-1.5"
          >
            Hoje
            <kbd className="font-mono text-[10px] bg-teal/10 rounded px-1 py-0.5 leading-none text-teal/60">T</kbd>
          </button>
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          {/* Time gutter */}
          <div className="w-16 shrink-0 relative border-r border-border/40">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-3 pt-0.5"
                style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
              >
                <span className="text-[11px] font-mono text-text-secondary/50">
                  {String(h).padStart(2, '0')}h
                </span>
              </div>
            ))}
          </div>

          {/* Day column */}
          <div className="flex-1 relative">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full border-t border-border/30"
                style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px` }}
              />
            ))}

            {dayApts.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8">
                <div className="w-14 h-14 rounded-2xl bg-surface-alt border border-border flex items-center justify-center">
                  {isFiltered
                    ? <SlidersHorizontal className="w-6 h-6 text-text-secondary/50" />
                    : <CalendarOff className="w-6 h-6 text-text-secondary/50" />
                  }
                </div>
                <div className="text-center">
                  <p className="text-text-primary font-semibold text-sm">
                    {isFiltered ? 'Sem consultas para este filtro' : 'Dia livre'}
                  </p>
                  <p className="text-text-secondary text-xs mt-1 max-w-[200px]">
                    {isFiltered
                      ? 'Nenhuma consulta do dentista selecionado neste dia.'
                      : 'Nenhuma consulta agendada para este dia.'}
                  </p>
                </div>
              </div>
            )}

            {dayApts.map(apt => {
              const { top, height, bg, border, text } = getAptStyle(apt);
              const isTerminal  = ['cancelled', 'no_show', 'completed'].includes(apt.status);
              const canConfirm  = isSecretaria && apt.status === 'scheduled';
              const canCheckIn  = isSecretaria && (apt.status === 'scheduled' || apt.status === 'confirmed');
              const canNoShow   = isSecretaria && (apt.status === 'scheduled' || apt.status === 'confirmed');
              const canCancel   = isSecretaria && !isTerminal;
              const showActions = canConfirm || canCheckIn || canNoShow || canCancel || !!apt.paciente;
              const statusLabel = STATUS_CONFIG[apt.status as AgendamentoStatus]?.label ?? apt.status;

              return (
                <div
                  key={apt.id}
                  className="absolute left-2 right-2 rounded-xl overflow-hidden"
                  style={{ top: `${top}px`, height: `${height}px`, background: bg, border: `1.5px solid ${border}` }}
                >
                  <div className="flex h-full">
                    {/* Main clickable area */}
                    <button
                      onClick={() => onAppointmentClick(apt)}
                      className="flex-1 text-left px-3 py-1 flex flex-col justify-center min-w-0 hover:brightness-[0.97] transition-all"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[11px] font-bold" style={{ color: text }}>
                          {format(parseISO(apt.data_hora), 'HH:mm')}
                        </span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                          style={{ background: `${text}20`, color: text }}
                        >
                          {statusLabel}
                        </span>
                        <span className="text-[10px] font-mono ml-auto" style={{ color: text, opacity: 0.5 }}>
                          {apt.duracao_minutos}min
                        </span>
                        {apt.paciente?.observacoes && (
                          <span
                            title="Paciente com alertas clínicos"
                            className="text-[10px] font-bold text-amber-400 leading-none shrink-0"
                          >
                            ◆
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-sm truncate leading-tight" style={{ color: text }}>
                        {apt.paciente?.nome ?? '—'}
                      </p>
                      {height > 56 && apt.observacoes && (
                        <p className="text-[11px] truncate mt-0.5 opacity-70" style={{ color: text }}>
                          {apt.observacoes}
                        </p>
                      )}
                      {height > 70 && isSecretaria && apt.dentista && (
                        <p className="text-[10px] mt-0.5 opacity-55" style={{ color: text }}>
                          Dr. {apt.dentista.nome.split(' ')[0]}
                        </p>
                      )}
                    </button>

                    {/* Quick actions — right column */}
                    {showActions && (
                      <div
                        className="flex flex-col gap-1 justify-center px-1.5 shrink-0 border-l"
                        style={{ borderColor: border }}
                        onClick={e => e.stopPropagation()}
                      >
                        {canConfirm && (
                          <button
                            onClick={() => onConfirm(apt.id)}
                            title="Confirmar consulta"
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal/20 text-teal hover:bg-teal/30 transition-colors border border-teal/30"
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                        )}
                        {canCheckIn && (
                          <button
                            onClick={() => onCheckIn(apt.id)}
                            title="Check-in — paciente chegou"
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal text-white hover:opacity-80 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canNoShow && (
                          <button
                            onClick={() => onNoShow(apt.id)}
                            title="Faltou"
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => onCancel(apt)}
                            title="Cancelar"
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-alt hover:bg-surface border border-border transition-colors"
                          >
                            <XIcon className="w-3 h-3 text-text-secondary" />
                          </button>
                        )}
                        {apt.paciente && (
                          <button
                            onClick={() => onVerFicha(apt.paciente!.id)}
                            title="Ver ficha do paciente"
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-alt hover:bg-surface border border-border transition-colors"
                          >
                            <FileText className="w-3 h-3 text-text-secondary" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
