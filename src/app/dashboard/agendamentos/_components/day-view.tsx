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
import { calcularFaixas } from './layout-sobreposicao';
import { corDoDentista, type DentistaAgenda } from './cor-dentista';
import type { AgendamentoRow } from '../page';
import type { AgendamentoStatus } from '@/types/database';

const HOUR_START  = 7;
const HOUR_END    = 20;
// Escala vertical maior (era 72): dá respiro pra consultas de 30min não se
// espremerem, e é o "maior" que a secretária pediu pra enxergar/clicar melhor.
const SLOT_HEIGHT = 96;
// Piso de altura por card — garante hora+status / nome / ações sem corte.
const MIN_APT_HEIGHT = 52;

// Camada de clique (spec R-13 §3.5) — UM elemento por coluna, hora calculada pela posição
// do clique. A primeira versão pré-renderizava um <button> por bloco de 15min (52 por
// coluna); com várias colunas de dentista isso multiplicava rápido e pesava o DOM sem
// necessidade — a posição do clique já dá a hora sozinha.
const MIN_POR_SLOT = 15;
function horaDoClique(offsetY: number): string {
  const hourDecimal = HOUR_START + offsetY / SLOT_HEIGHT;
  const totalMin = Math.max(0, Math.floor(hourDecimal * 60));
  const arredondado = totalMin - (totalMin % MIN_POR_SLOT);
  const h = Math.min(HOUR_END - 1, Math.floor(arredondado / 60));
  const m = arredondado % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
  /** Mapa dentistaId → slot de cor. Vazio = sem faixa (dentista vendo a própria agenda). */
  slotPorDentista: Record<string, number>;
  /** Colunas a renderizar. Length <= 1 → comportamento atual, coluna única. */
  colunas: DentistaAgenda[];
  /** `dentistaId` vem preenchido quando o clique caiu numa coluna com dono conhecido. */
  onSlotVazioClick: (data: Date, hora: string, dentistaId?: string) => void;
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
  slotPorDentista,
  colunas,
  onSlotVazioClick,
}: DayViewProps) {
  const hours       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;
  const isToday     = isDateToday(selectedDate);

  const dayApts = useMemo(() => {
    return agendamentos
      .filter(apt => isSameDay(parseISO(apt.data_hora), selectedDate))
      .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  }, [agendamentos, selectedDate]);

  // Multi-coluna só quando há MAIS DE UM dentista pra separar (spec §3.3). Com 0 ou 1,
  // a coluna é uma só — comportamento idêntico ao de antes desta fatia — e `dentistaId`
  // ainda viaja pro clique quando dá pra saber de quem é (filtro num dentista específico).
  const multiColuna = colunas.length > 1;
  const colunasRender = useMemo(() => {
    if (multiColuna) {
      return colunas.map((c) => ({
        dentistaId: c.id as string | undefined,
        nome: c.nome as string | undefined,
        apts: dayApts.filter((a) => a.dentista_id === c.id),
      }));
    }
    return [{
      dentistaId: colunas[0]?.id as string | undefined,
      nome: undefined as string | undefined,
      apts: dayApts,
    }];
  }, [multiColuna, colunas, dayApts]);

  // Layout com colunas internas: agendamentos cujas CAIXAS se sobrepõem visualmente (não só
  // no tempo — o piso de altura infla consultas curtas) vão lado a lado, em vez de
  // empilhados um sobre o outro. Calculado POR COLUNA — dois dentistas nunca disputam faixa.
  const layoutsPorColuna = useMemo(() => {
    return colunasRender.map(({ apts }) => {
      const boxes = apts.map(apt => {
        const d           = parseISO(apt.data_hora);
        const hourDecimal = d.getHours() + d.getMinutes() / 60;
        const top         = (hourDecimal - HOUR_START) * SLOT_HEIGHT;
        const height      = Math.max((apt.duracao_minutos / 60) * SLOT_HEIGHT - 6, MIN_APT_HEIGHT);
        return { id: apt.id, top, bottom: top + height, height };
      });
      const faixas = calcularFaixas(boxes);
      const layout = new Map<string, { top: number; height: number; leftPct: number; widthPct: number }>();
      for (const b of boxes) {
        const f = faixas.get(b.id);
        layout.set(b.id, {
          top: b.top,
          height: b.height,
          leftPct: f?.leftPct ?? 0,
          widthPct: f?.widthPct ?? 100,
        });
      }
      return layout;
    });
  }, [colunasRender]);

  function getAptColors(apt: AgendamentoRow) {
    return (STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled).timeline;
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

      {/* Time grid — overflow nas duas direções: várias colunas de dentista podem exceder
          a largura da tela (assunção da spec: acima de 8, rola na horizontal). */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          {/* Time gutter */}
          <div className="w-16 shrink-0 relative border-r border-border/40 sticky left-0 bg-surface z-10">
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

          {/* Uma coluna por dentista quando multi-coluna; senão, a coluna única de sempre. */}
          {colunasRender.map((coluna, colIdx) => {
            const layout = layoutsPorColuna[colIdx];
            const key = coluna.dentistaId ?? 'unica';
            return (
              <div key={key} className={`flex-1 relative border-l border-border/60 ${multiColuna ? 'min-w-[160px]' : ''}`}>
                {multiColuna && (
                  <div className="sticky top-0 z-10 bg-surface-alt/90 backdrop-blur-sm border-b border-border px-3 py-2 flex items-center gap-2">
                    {coluna.dentistaId && slotPorDentista[coluna.dentistaId] !== undefined && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: corDoDentista(slotPorDentista[coluna.dentistaId]) }}
                      />
                    )}
                    <span className="text-xs font-bold text-text-primary truncate">{coluna.nome}</span>
                    <span className="text-[10px] text-text-secondary font-mono ml-auto shrink-0">{coluna.apts.length}x</span>
                  </div>
                )}

                <div className="relative" style={{ height: `${totalHeight}px` }}>
                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-border/30"
                      style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px` }}
                    />
                  ))}

                  {/* Camada de clique — um elemento cobrindo a coluna inteira; a hora sai da
                      posição Y do clique, arredondada pra baixo em blocos de 15min. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSlotVazioClick(selectedDate, horaDoClique(e.clientY - rect.top), coluna.dentistaId);
                    }}
                    title={`Clique pra agendar${coluna.nome ? ` — ${coluna.nome}` : ''}`}
                    className="absolute inset-0 w-full"
                    style={{ height: `${totalHeight}px` }}
                  />

                  {coluna.apts.length === 0 && !multiColuna && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 pointer-events-none">
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
                            : 'Clique num horário pra agendar.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {coluna.apts.map(apt => {
                    const lay = layout.get(apt.id);
                    if (!lay) return null;
                    const { top, height, leftPct, widthPct } = lay;
                    const { bg, border, text } = getAptColors(apt);
                    const corSlot = slotPorDentista[apt.dentista_id];
                    // G4 exige a faixa MESMO em multi-coluna: "Todos" com >1 dentista é
                    // exatamente o caso do gate. Vazio só quando não há slot pra este
                    // dentista (dentista logado vendo a própria agenda).
                    const temCorDentista = corSlot !== undefined;
                    const isTerminal  = ['cancelled', 'no_show', 'completed'].includes(apt.status);
                    const canConfirm  = isSecretaria && apt.status === 'scheduled';
                    const canCheckIn  = isSecretaria && (apt.status === 'scheduled' || apt.status === 'confirmed');
                    const canNoShow   = isSecretaria && (apt.status === 'scheduled' || apt.status === 'confirmed');
                    const canCancel   = isSecretaria && !isTerminal;
                    const statusLabel = STATUS_CONFIG[apt.status as AgendamentoStatus]?.label ?? apt.status;

                    // Card largo (coluna única) mostra botões COM RÓTULO — claros pra quem não é
                    // da tecnologia. Card estreito (agendamentos sobrepostos, ou coluna de
                    // dentista) volta pro ícone, e o clique abre o modal de detalhe.
                    const isWide = widthPct > 65 && !multiColuna;
                    const actions = [
                      {
                        key: 'confirm', show: canConfirm, onClick: () => onConfirm(apt.id),
                        label: 'Confirmar', title: 'Confirmar consulta', Icon: ThumbsUp,
                        labeledCls: 'bg-teal/15 text-teal border border-teal/30 hover:bg-teal/25',
                        iconCls: 'bg-teal/20 text-teal border border-teal/30 hover:bg-teal/30',
                      },
                      {
                        key: 'checkin', show: canCheckIn, onClick: () => onCheckIn(apt.id),
                        label: 'Chegou', title: 'Paciente chegou (check-in)', Icon: CheckCircle2,
                        labeledCls: 'bg-teal text-white border border-teal hover:bg-teal-lt',
                        iconCls: 'bg-teal text-white hover:opacity-80',
                      },
                      {
                        key: 'noshow', show: canNoShow, onClick: () => onNoShow(apt.id),
                        label: 'Faltou', title: 'Paciente faltou', Icon: AlertTriangle,
                        labeledCls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20',
                        iconCls: 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30',
                      },
                      {
                        key: 'cancel', show: canCancel, onClick: () => onCancel(apt),
                        label: 'Cancelar', title: 'Cancelar consulta', Icon: XIcon,
                        labeledCls: 'bg-surface-alt text-text-secondary border border-border hover:text-text-primary',
                        iconCls: 'bg-surface-alt text-text-secondary border border-border hover:bg-surface',
                      },
                      {
                        key: 'ficha', show: !!apt.paciente, onClick: () => { if (apt.paciente) onVerFicha(apt.paciente.id); },
                        label: 'Ficha', title: 'Ver ficha do paciente', Icon: FileText,
                        labeledCls: 'bg-surface-alt text-text-secondary border border-border hover:text-text-primary',
                        iconCls: 'bg-surface-alt text-text-secondary border border-border hover:bg-surface',
                      },
                    ].filter(a => a.show);

                    return (
                      <div
                        key={apt.id}
                        className="absolute rounded-xl overflow-hidden"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPct}% + 6px)`,
                          width: `calc(${widthPct}% - 10px)`,
                          background: bg,
                          border: `1.5px solid ${border}`,
                          // Cor de dentista (spec §3.2, gate G4) — faixa na borda esquerda em
                          // TODO card com dono conhecido, inclusive em multi-coluna.
                          ...(temCorDentista
                            ? { borderLeftWidth: '4px', borderLeftColor: corDoDentista(corSlot) }
                            : {}),
                        }}
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
                            {height > 70 && isSecretaria && !multiColuna && apt.dentista && (
                              <p className="text-[10px] mt-0.5 opacity-55" style={{ color: text }}>
                                Dr. {apt.dentista.nome.split(' ')[0]}
                              </p>
                            )}
                          </button>

                          {/* Ações rápidas — botões rotulados (card largo) ou ícones (estreito) */}
                          {actions.length > 0 && (
                            <div
                              className={`flex gap-1.5 justify-center px-2 shrink-0 border-l ${isWide ? 'flex-row items-center' : 'flex-col'}`}
                              style={{ borderColor: border }}
                              onClick={e => e.stopPropagation()}
                            >
                              {actions.map(a => (
                                isWide ? (
                                  <button
                                    key={a.key}
                                    onClick={a.onClick}
                                    title={a.title}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${a.labeledCls}`}
                                  >
                                    <a.Icon className="w-3.5 h-3.5 shrink-0" />
                                    {a.label}
                                  </button>
                                ) : (
                                  <button
                                    key={a.key}
                                    onClick={a.onClick}
                                    title={a.title}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${a.iconCls}`}
                                  >
                                    <a.Icon className="w-3.5 h-3.5" />
                                  </button>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
