'use client';

import { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isToday as isDateToday,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_CONFIG } from './status-config';
import { calcularFaixas } from './layout-sobreposicao';
import type { AgendamentoRow } from '../page';
import type { AgendamentoStatus } from '@/types/database';

const HOUR_START  = 7;
const HOUR_END    = 20;
const SLOT_HEIGHT = 60;

interface WeekViewProps {
  agendamentos: AgendamentoRow[];
  selectedWeek: Date;
  onWeekChange: (d: Date) => void;
  onAppointmentClick: (apt: AgendamentoRow) => void;
  onDayClick: (d: Date) => void;
  isSecretaria: boolean;
}

export function WeekView({
  agendamentos,
  selectedWeek,
  onWeekChange,
  onAppointmentClick,
  onDayClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 });
  const weekEnd   = endOfWeek(selectedWeek, { weekStartsOn: 0 });
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekApts = useMemo(() => {
    return agendamentos.filter(apt => {
      const d = parseISO(apt.data_hora);
      return d >= weekStart && d <= weekEnd;
    });
  }, [agendamentos, weekStart, weekEnd]);

  const aptsByDay = useMemo(() => {
    const map: Record<string, AgendamentoRow[]> = {};
    for (const day of days) {
      const key   = format(day, 'yyyy-MM-dd');
      map[key]    = weekApts.filter(a => isSameDay(parseISO(a.data_hora), day));
    }
    return map;
  }, [weekApts, days]);

  const hours       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;

  function getAptStyle(apt: AgendamentoRow) {
    const d           = parseISO(apt.data_hora);
    const hourDecimal = d.getHours() + d.getMinutes() / 60;
    const top         = (hourDecimal - HOUR_START) * SLOT_HEIGHT;
    const height      = Math.max((apt.duracao_minutos / 60) * SLOT_HEIGHT - 4, 22);
    const { bg, border, text } = (STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled).timeline;
    return { top, height, bg, border, text };
  }

  /**
   * Layout de sobreposição — BUG CORRIGIDO 21/07: todo card usava a largura inteira da
   * coluna, então dois horários sobrepostos eram desenhados no MESMO retângulo (texto por
   * cima de texto, o de baixo inclicável). Com o "marcar mesmo assim" e com consultas
   * longas (240min), sobreposição deixou de ser exceção.
   *
   * O algoritmo mora em `layout-sobreposicao.ts`, compartilhado com a visão de Dia.
   */
  const faixasPorDia = useMemo(() => {
    const porDia = new Map<string, ReturnType<typeof calcularFaixas>>();
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      const caixas = (aptsByDay[key] ?? [])
        .map((apt) => {
          const { top, height } = getAptStyle(apt);
          return { id: apt.id, top, height };
        })
        .sort((a, b) => a.top - b.top); // `calcularFaixas` espera ordenado por topo
      porDia.set(key, calcularFaixas(caixas));
    }
    return porDia;
  }, [aptsByDay, days]);

  return (
    <div className="flex flex-col">
      {/* Week navigation header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-alt/40 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWeekChange(subWeeks(selectedWeek, 1))}
            className="p-1.5 hover:bg-surface rounded-lg transition-colors border border-border"
          >
            <ChevronLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <span className="text-sm font-semibold text-text-primary">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} –{' '}
            {format(weekEnd, "d 'de' MMM yyyy", { locale: ptBR })}
          </span>
          <button
            onClick={() => onWeekChange(addWeeks(selectedWeek, 1))}
            className="p-1.5 hover:bg-surface rounded-lg transition-colors border border-border"
          >
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
        <button
          onClick={() => onWeekChange(new Date())}
          className="text-xs font-semibold text-teal hover:opacity-80 transition-colors px-3 py-1.5 rounded-lg bg-teal/5 hover:bg-teal/10"
        >
          Hoje
        </button>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-border shrink-0 bg-surface-alt/30">
        <div className="w-14 shrink-0" />
        {days.map(day => {
          const isToday = isDateToday(day);
          const key     = format(day, 'yyyy-MM-dd');
          const count   = aptsByDay[key]?.length ?? 0;
          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className="flex-1 text-center py-2.5 cursor-pointer hover:bg-surface-alt transition-colors"
            >
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isToday ? 'text-teal' : 'text-text-secondary'}`}>
                {format(day, 'EEE', { locale: ptBR })}
              </div>
              <div className={`text-lg font-bold leading-none rounded-full w-8 h-8 flex items-center justify-center mx-auto ${
                isToday ? 'bg-teal text-white' : 'text-text-primary'
              }`}>
                {format(day, 'd')}
              </div>
              {count > 0 && (
                <div className="text-[10px] text-teal font-semibold mt-0.5">{count}x</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grade de horários — renderiza sempre por inteiro (sem scroll interno); se
          não couber na viewport, quem rola é a página, não uma caixa dentro da caixa. */}
      <div>
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          {/* Time gutter */}
          <div className="w-14 shrink-0 relative">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
                style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
              >
                <span className="text-[10px] font-mono text-text-secondary/50">
                  {String(h).padStart(2, '0')}h
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const key     = format(day, 'yyyy-MM-dd');
            const dayApts = aptsByDay[key] ?? [];
            return (
              <div key={key} className="flex-1 relative border-l border-border/60">
                {hours.map(h => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-border/30"
                    style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px` }}
                  />
                ))}
                {dayApts.map(apt => {
                  const { top, height, bg, border, text } = getAptStyle(apt);
                  // Sobrepostos dividem a coluna lado a lado; sozinho ocupa tudo.
                  const fx = faixasPorDia.get(key)?.get(apt.id);
                  const leftPct = fx?.leftPct ?? 0;
                  const larguraPct = fx?.widthPct ?? 100;
                  const faixa = fx?.faixa ?? 0;
                  const faixas = fx?.faixas ?? 1;
                  return (
                    <div
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      title={`${format(parseISO(apt.data_hora), 'HH:mm')} — ${apt.paciente?.nome ?? '—'}`}
                      className="absolute rounded-md px-1.5 py-1 cursor-pointer hover:brightness-95 active:brightness-90 transition-all overflow-hidden select-none"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${larguraPct}% - 4px)`,
                        // Sobreposto sobe no empilhamento ao passar o mouse — sem isso o
                        // card da direita cobriria a borda do vizinho e pareceria cortado.
                        zIndex: faixas > 1 ? faixa + 1 : undefined,
                        background: bg,
                        border: `1px solid ${border}`,
                      }}
                    >
                      <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: text }}>
                        {format(parseISO(apt.data_hora), 'HH:mm')} · {apt.paciente?.nome?.split(' ')[0] ?? '—'}
                      </p>
                      {height > 32 && apt.observacoes && (
                        <p className="text-[10px] truncate mt-0.5 opacity-70" style={{ color: text }}>
                          {apt.observacoes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
