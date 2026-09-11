'use client';

import { useMemo } from 'react';
import {
  format, isToday as isDateToday, parseISO, isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle,
  X as XIcon, FileText, CalendarOff, SlidersHorizontal, ThumbsUp, Lock,
} from 'lucide-react';
import { STATUS_CONFIG } from './status-config';
import { calcularFaixas } from './layout-sobreposicao';
import { corDoDentista, type DentistaAgenda } from './cor-dentista';
import { diaAnteriorDeAgenda, proximoDiaDeAgenda } from './date-helpers';
import type { AgendamentoRow, BloqueioRow } from '../page';
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
  /** R-102 — compromissos pessoais do dia, mesclados nas caixas antes de calcularFaixas. */
  bloqueios: BloqueioRow[];
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onAppointmentClick: (apt: AgendamentoRow) => void;
  /** R-102 — clique no card do bloqueio abre o dialog em modo edição. */
  onBloqueioClick: (bloqueio: BloqueioRow) => void;
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
  bloqueios,
  selectedDate,
  onDateChange,
  onAppointmentClick,
  onBloqueioClick,
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

  // R-102 — compromissos pessoais do dia, mesmo filtro de `dayApts`.
  const dayBloqueios = useMemo(() => {
    return bloqueios
      .filter(bl => isSameDay(parseISO(bl.data_hora), selectedDate))
      .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  }, [bloqueios, selectedDate]);

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
        blocos: dayBloqueios.filter((b) => b.dentista_id === c.id),
      }));
    }
    return [{
      dentistaId: colunas[0]?.id as string | undefined,
      nome: undefined as string | undefined,
      apts: dayApts,
      blocos: dayBloqueios,
    }];
  }, [multiColuna, colunas, dayApts, dayBloqueios]);

  // Itens combinados por coluna (agendamento + bloqueio), ordenados por horário — é sobre
  // esta lista que o JSX itera, escolhendo o card certo por `kind`.
  const itensPorColuna = useMemo(() => {
    return colunasRender.map(({ apts, blocos }) => {
      const itens = [
        ...apts.map((a) => ({ kind: 'apt' as const, id: a.id, data: a })),
        ...blocos.map((b) => ({ kind: 'bloqueio' as const, id: `bl-${b.id}`, data: b })),
      ];
      itens.sort((x, y) => x.data.data_hora.localeCompare(y.data.data_hora));
      return itens;
    });
  }, [colunasRender]);

  // Layout com colunas internas: itens (agendamento OU bloqueio) cujas CAIXAS se sobrepõem
  // visualmente (não só no tempo — o piso de altura infla itens curtos) vão lado a lado, em
  // vez de empilhados um sobre o outro. Calculado POR COLUNA — dois dentistas nunca disputam
  // faixa. Bloqueio mescla nas MESMAS caixas que agendamento (spec §4.6) — overlap entre os
  // dois fica lado a lado, não escondido.
  const layoutsPorColuna = useMemo(() => {
    return itensPorColuna.map((itens) => {
      const boxes = itens.map(({ id, data }) => {
        const d           = parseISO(data.data_hora);
        const hourDecimal = d.getHours() + d.getMinutes() / 60;
        const top         = (hourDecimal - HOUR_START) * SLOT_HEIGHT;
        const height      = Math.max((data.duracao_minutos / 60) * SLOT_HEIGHT - 6, MIN_APT_HEIGHT);
        return { id, top, bottom: top + height, height };
      }).sort((a, b) => a.top - b.top);
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
  }, [itensPorColuna]);

  function getAptColors(apt: AgendamentoRow) {
    return (STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled).timeline;
  }

  return (
    <>
      {/* A lista foi substituída pela grade no celular para preservar o panorama do dia. */}
      <div className="hidden">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-2 py-2">
          <button
            type="button"
            onClick={() => onDateChange(diaAnteriorDeAgenda(selectedDate))}
            aria-label="Dia anterior"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 text-center">
            <p className={`truncate text-sm font-bold capitalize ${isToday ? 'text-teal' : 'text-text-primary'}`}>
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-[11px] text-text-secondary">{dayApts.length} consulta{dayApts.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => onDateChange(proximoDiaDeAgenda(selectedDate))}
            aria-label="Próximo dia"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSlotVazioClick(selectedDate, '09:00', colunas.length === 1 ? colunas[0]?.id : undefined)}
          className="min-h-12 rounded-xl border border-dashed border-teal/40 bg-teal/5 px-4 text-sm font-bold text-teal transition-colors active:bg-teal/10"
        >
          + Novo agendamento neste dia
        </button>

        <div className="space-y-2">
          {dayApts.map((apt) => {
            const config = STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled;
            const corSlot = slotPorDentista[apt.dentista_id];
            return (
              <button
                key={apt.id}
                type="button"
                onClick={() => onAppointmentClick(apt)}
                className={`w-full rounded-xl border p-3 text-left transition-colors active:bg-surface-alt ${config.bg} ${config.border}`}
                style={corSlot !== undefined ? { borderLeftWidth: '4px', borderLeftColor: corDoDentista(corSlot) } : undefined}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 font-mono text-sm font-bold" style={{ color: config.timeline.text }}>
                    {format(parseISO(apt.data_hora), 'HH:mm')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-text-primary">{apt.paciente?.nome ?? '—'}</span>
                    <span className="mt-0.5 block truncate text-xs text-text-secondary">
                      {apt.duracao_minutos} min{isSecretaria && apt.dentista ? ` · Dr. ${apt.dentista.nome.split(' ')[0]}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${config.text} ${config.bg}`}>
                    {config.label}
                  </span>
                </div>
              </button>
            );
          })}
          {dayBloqueios.map((bloqueio) => (
            <button
              key={bloqueio.id}
              type="button"
              onClick={() => onBloqueioClick(bloqueio)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-alt px-3 py-3 text-left"
            >
              <Lock className="h-4 w-4 shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-primary">{bloqueio.titulo || 'Compromisso pessoal'}</span>
                <span className="block text-xs text-text-secondary">{format(parseISO(bloqueio.data_hora), 'HH:mm')}</span>
              </span>
            </button>
          ))}
          {dayApts.length === 0 && dayBloqueios.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
              Nenhum compromisso neste dia.
            </p>
          )}
        </div>
      </div>

      <div className="flex h-full flex-col">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border bg-surface-alt/40 shrink-0 md:px-4 md:py-3">
        <div className="flex min-w-0 items-center gap-1 md:gap-2">
          <button
            onClick={() => onDateChange(diaAnteriorDeAgenda(selectedDate))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface md:h-11 md:w-11"
          >
            <ChevronLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <div className="min-w-0 px-1 text-center md:px-2">
            <div className={`truncate text-sm font-bold capitalize md:text-base ${isToday ? 'text-teal' : 'text-text-primary'}`}>
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </div>
            {isToday && (
              <div className="text-[10px] font-semibold uppercase tracking-widest text-teal">
                Hoje
              </div>
            )}
          </div>
          <button
            onClick={() => onDateChange(proximoDiaDeAgenda(selectedDate))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface md:h-11 md:w-11"
          >
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-3">
          <span className="hidden text-sm font-medium text-text-secondary sm:inline">
            {dayApts.length} consulta{dayApts.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onDateChange(new Date())}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-teal/5 px-2 py-1.5 text-xs font-semibold text-teal transition-colors hover:bg-teal/10 hover:opacity-80 md:min-h-11 md:px-3"
          >
            Hoje
            <kbd className="hidden rounded bg-teal/10 px-1 py-0.5 font-mono text-[10px] leading-none text-teal/60 md:block">T</kbd>
          </button>
        </div>
      </div>

      {/* Time grid — overflow nas duas direções: várias colunas de dentista podem exceder
          a largura da tela (assunção da spec: acima de 8, rola na horizontal). */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          {/* Time gutter */}
          <div className="sticky left-0 z-10 relative w-10 shrink-0 border-r border-border/40 bg-surface md:w-16">
            {hours.map(h => (
              <div
                key={h}
                  className="absolute flex w-full items-start justify-end pr-1 pt-0.5 md:pr-3"
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

                  {itensPorColuna[colIdx].length === 0 && !multiColuna && (
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

                  {itensPorColuna[colIdx].map(item => {
                    const lay = layout.get(item.id);
                    if (!lay) return null;
                    const { top, height, leftPct, widthPct } = lay;

                    // R-102 — bloqueio: card neutro, sem status/ações clínicas, clique
                    // abre o dialog em modo edição (spec §6).
                    if (item.kind === 'bloqueio') {
                      const bl = item.data;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onBloqueioClick(bl); }}
                          className="absolute rounded-xl overflow-hidden border border-border bg-surface-alt text-left px-3 py-1 flex flex-col justify-center min-w-0 hover:bg-surface transition-all"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `calc(${leftPct}% + 6px)`,
                            width: `calc(${widthPct}% - 10px)`,
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Lock className="w-3 h-3 text-text-secondary shrink-0" />
                            <span className="font-mono text-[11px] font-bold text-text-secondary">
                              {format(parseISO(bl.data_hora), 'HH:mm')}
                            </span>
                          </div>
                          <p className="font-semibold text-sm truncate leading-tight text-text-secondary">
                            {bl.titulo || 'Compromisso pessoal'}
                          </p>
                        </button>
                      );
                    }

                    const apt = item.data;
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

                    // A coluna única preserva os atalhos existentes. Em multi-coluna, a largura
                    // recuperada é reservada para horário, status e nome; as mesmas ações seguem
                    // no detalhe aberto pelo card (R-164).
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
                        className={`absolute overflow-hidden ${multiColuna ? 'rounded-[9px]' : 'rounded-xl'}`}
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
                            type="button"
                            onClick={() => onAppointmentClick(apt)}
                            aria-label={`Abrir detalhes de ${apt.paciente?.nome ?? 'paciente sem nome'}, ${format(parseISO(apt.data_hora), 'HH:mm')} — ${statusLabel}`}
                            className={`flex flex-1 min-w-0 flex-col justify-center text-left hover:brightness-[0.97] transition-all ${multiColuna ? 'px-[7px] py-[6px]' : 'px-3 py-1'}`}
                          >
                            {multiColuna ? (
                              <>
                                <div className="mb-1 flex min-w-0 items-center gap-1">
                                  <span className="shrink-0 font-mono text-[10px] font-extrabold leading-none" style={{ color: text }}>
                                    {format(parseISO(apt.data_hora), 'HH:mm')}
                                  </span>
                                  <span
                                    className="min-w-0 truncate rounded-[4px] px-[4px] py-[2px] text-[9px] font-extrabold uppercase leading-none tracking-[0.04em]"
                                    style={{ background: `${text}20`, color: text }}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>
                                <p className="truncate text-[12px] font-[750] leading-[13.8px]" style={{ color: text }}>
                                  {apt.paciente?.nome ?? '—'}
                                </p>
                              </>
                            ) : (
                              <>
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
                              </>
                            )}
                          </button>

                          {/* Ações rápidas permanecem apenas na coluna única. */}
                          {!multiColuna && actions.length > 0 && (
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
    </>
  );
}
