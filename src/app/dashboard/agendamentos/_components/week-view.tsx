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
import { corDoDentista, type DentistaAgenda } from './cor-dentista';
import type { AgendamentoRow } from '../page';
import type { AgendamentoStatus } from '@/types/database';

const HOUR_START  = 7;
const HOUR_END    = 20;
const SLOT_HEIGHT = 60;

// w-36 (9rem) é a largura da faixa esquerda — MESMA classe no cabeçalho de dias, no gutter
// de hora (grade cheia) e na coluna de nome (mapa de carga). Bug real (achado pelo Mateus
// em 22/07): o cabeçalho usava w-14 (56px) e o mapa de carga usava 9rem (144px) pra essa
// mesma faixa — as 7 colunas de dia nasciam em offsets diferentes e nunca alinhavam.
// Precisa ser a classe Tailwind LITERAL (w-36) nos 3 lugares, não uma constante JS
// interpolada — Tailwind só reconhece nome de classe completo e estático no build.

// Camada de clique — mesma lógica do Dia (um elemento por coluna, hora pela posição do
// clique), na escala menor da Semana. Ver o comentário em day-view.tsx.
const MIN_POR_SLOT = 15;
function horaDoClique(offsetY: number): string {
  const hourDecimal = HOUR_START + offsetY / SLOT_HEIGHT;
  const totalMin = Math.max(0, Math.floor(hourDecimal * 60));
  const arredondado = totalMin - (totalMin % MIN_POR_SLOT);
  const h = Math.min(HOUR_END - 1, Math.floor(arredondado / 60));
  const m = arredondado % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ALTURA_LINHA_CARGA = 62;

interface WeekViewProps {
  /** Janela inteira, NÃO pré-filtrada — o mapa de carga precisa ver todos os dentistas. */
  agendamentos: AgendamentoRow[];
  selectedWeek: Date;
  onWeekChange: (d: Date) => void;
  onAppointmentClick: (apt: AgendamentoRow) => void;
  onDayClick: (d: Date) => void;
  isSecretaria: boolean;
  /** Mapa dentistaId → slot de cor. Vazio = sem faixa (dentista vendo a própria agenda). */
  slotPorDentista: Record<string, number>;
  /** 'todos' → mapa de carga (com >1 dentista). Um id → grade cheia daquele dentista. */
  filtroDentistaId: string;
  dentistas: DentistaAgenda[];
  /** Dia a destacar na grade cheia — vem de um clique no mapa de carga. Troca de chip limpa. */
  diaDestacado: Date | null;
  /** Só é chamado na grade de um dentista — o mapa de carga não tem slot. */
  onSlotVazioClick: (data: Date, hora: string) => void;
  /** Célula do mapa de carga → troca o filtro pra esse dentista e destaca o dia. Não navega de rota. */
  onCargaClick: (dentistaId: string, dia: Date) => void;
}

export function WeekView({
  agendamentos,
  selectedWeek,
  onWeekChange,
  onAppointmentClick,
  onDayClick,
  isSecretaria,
  slotPorDentista,
  filtroDentistaId,
  dentistas,
  diaDestacado,
  onSlotVazioClick,
  onCargaClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 });
  const weekEnd   = endOfWeek(selectedWeek, { weekStartsOn: 0 });
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // "Todos" só vira mapa de carga quando há de fato mais de um dentista pra comparar —
  // com 0 ou 1, a indireção não ajuda ninguém, mostra a grade direto (mesma regra do Dia).
  const mostraCarga = isSecretaria && filtroDentistaId === 'todos' && dentistas.length > 1;

  const weekApts = useMemo(() => {
    return agendamentos.filter(apt => {
      const d = parseISO(apt.data_hora);
      return d >= weekStart && d <= weekEnd;
    });
  }, [agendamentos, weekStart, weekEnd]);

  // O que a GRADE (cabeçalho de dia + grade cheia) mostra: tudo, ou só o dentista filtrado.
  const aptsEfetivos = useMemo(() => {
    if (!isSecretaria || filtroDentistaId === 'todos') return weekApts;
    return weekApts.filter(a => a.dentista_id === filtroDentistaId);
  }, [weekApts, isSecretaria, filtroDentistaId]);

  const aptsByDay = useMemo(() => {
    const map: Record<string, AgendamentoRow[]> = {};
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      map[key]  = aptsEfetivos.filter(a => isSameDay(parseISO(a.data_hora), day));
    }
    return map;
  }, [aptsEfetivos, days]);

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

  // Mapa de carga: contagem por dentista × dia, na semana inteira (não no filtro atual —
  // é ELE quem decide o filtro, faria pouco sentido já chegar filtrado).
  const dentistasOrdenados = useMemo(
    () => [...dentistas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [dentistas],
  );
  const cargaPorDentistaDia = useMemo(() => {
    const porDentista = new Map<string, number[]>();
    for (const d of dentistasOrdenados) {
      porDentista.set(d.id, days.map(day =>
        weekApts.filter(a => a.dentista_id === d.id && isSameDay(parseISO(a.data_hora), day)).length,
      ));
    }
    return porDentista;
  }, [dentistasOrdenados, weekApts, days]);
  const picoCarga = Math.max(1, ...[...cargaPorDentistaDia.values()].flat());

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

      {/* Day headers — vale nos dois estados; é o atalho pro Dia daquela data.
          w-36 tem que bater com a coluna de nome do mapa de carga logo abaixo e com o
          gutter de hora da grade cheia — as 3 faixas alinham as mesmas 7 colunas. */}
      <div className="flex border-b border-border shrink-0 bg-surface-alt/30">
        <div className="w-36 shrink-0" />
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

      {mostraCarga ? (
        /* ── Mapa de carga — spec §3.4: ZERO card de consulta aqui. Responde "quem está
            lotado, em que dia", não "que horário". Clicar numa célula com carga troca pra
            grade cheia daquele dentista, com o dia clicado destacado. ── */
        <div className="py-4">
          {/* py- não px-: o cabeçalho de dias acima não tem padding horizontal nenhum —
              com px-4 aqui as 7 colunas nasciam mais pra dentro e nunca alinhavam com os
              números de cima (achado pelo Mateus em 22/07, print em mãos).

              flex, não grid: era grid com gap-x-2 antes, e grid+gap distribui o espaço
              restante ENTRE as 7 colunas de um jeito diferente do flex do cabeçalho — a
              cada gap "comido", a coluna seguinte nascia um pouco mais estreita, e o desvio
              acumulava da esquerda pra direita (medido ao vivo: 0, -1, -2, -3, -5, -6, -7px).
              flex sem gap nas 7 colunas é a MESMA conta que o cabeçalho já faz — alinha
              exato, não por aproximação. */}
          <div className="space-y-1">
            {dentistasOrdenados.map(d => (
              <div key={d.id} className="flex items-center">
                {/* pl-3: respiro do nome contra a borda arredondada do painel (achado pelo
                    Mateus no print). Só o padding INTERNO muda — a largura w-36 continua a
                    mesma, então isto não mexe no alinhamento das 7 colunas de dia. */}
                <div className="w-36 shrink-0 flex items-center gap-2 h-[62px] min-w-0 pl-3 pr-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: corDoDentista(d.slot) }}
                  />
                  <span className="text-xs font-semibold text-text-primary truncate">{d.nome}</span>
                </div>
                {days.map((day, i) => {
                  const count = cargaPorDentistaDia.get(d.id)?.[i] ?? 0;
                  const diaLabel = format(day, "EEE d/MM", { locale: ptBR });
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={count === 0}
                      onClick={() => onCargaClick(d.id, day)}
                      title={count > 0 ? `${d.nome} · ${diaLabel} · ${count} consulta${count === 1 ? '' : 's'} — abre a semana dele` : `${d.nome} · ${diaLabel} · livre`}
                      className={`flex-1 flex flex-col items-center justify-end gap-1 rounded-lg transition-colors ${
                        count > 0 ? 'cursor-pointer hover:bg-teal/[0.06]' : 'cursor-default'
                      }`}
                      style={{ height: `${ALTURA_LINHA_CARGA}px` }}
                    >
                      {count > 0 && (
                        <span
                          className="w-full max-w-[26px] rounded-sm"
                          style={{
                            height: `${Math.round(6 + (count / picoCarga) * 30)}px`,
                            background: corDoDentista(d.slot),
                            opacity: 0.45 + (count / picoCarga) * 0.55,
                          }}
                        />
                      )}
                      <span className={`text-[10px] font-mono ${count > 0 ? 'text-text-secondary' : 'text-text-secondary/30'}`}>
                        {count > 0 ? `${count}x` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Grade cheia — de um dentista só (filtrado, ou dentista vendo a própria agenda).
            Card de largura inteira, faixa de cor na borda quando faz sentido mostrá-la. ── */
        <div>
          <div className="flex" style={{ height: `${totalHeight}px` }}>
            {/* Time gutter — w-36 pra bater com o cabeçalho de dias e o mapa de carga acima
                (mesma faixa esquerda nos 3); "07h" continua colado à direita do próprio texto. */}
            <div className="w-36 shrink-0 relative">
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
              const key      = format(day, 'yyyy-MM-dd');
              const dayApts  = aptsByDay[key] ?? [];
              const destacado = !!diaDestacado && isSameDay(day, diaDestacado);
              return (
                <div
                  key={key}
                  className={`flex-1 relative border-l border-border/60 transition-colors ${destacado ? 'bg-teal/[0.05]' : ''}`}
                >
                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-border/30"
                      style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px` }}
                    />
                  ))}

                  {/* Camada de clique — um elemento por dia. Só existe aqui: o mapa de carga
                      não tem horário nenhum pra clicar (spec §3.4/§5.3). */}
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSlotVazioClick(day, horaDoClique(e.clientY - rect.top));
                    }}
                    title="Clique pra agendar"
                    className="absolute inset-0 w-full"
                    style={{ height: `${totalHeight}px` }}
                  />

                  {dayApts.map(apt => {
                    const { top, height, bg, border, text } = getAptStyle(apt);
                    // Sobrepostos dividem a coluna lado a lado; sozinho ocupa tudo.
                    const fx = faixasPorDia.get(key)?.get(apt.id);
                    const leftPct = fx?.leftPct ?? 0;
                    const larguraPct = fx?.widthPct ?? 100;
                    const faixa = fx?.faixa ?? 0;
                    const faixas = fx?.faixas ?? 1;
                    const corSlot = slotPorDentista[apt.dentista_id];
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
                          // Cor de dentista (spec §3.2) — mesma faixa que o Dia usa.
                          ...(corSlot !== undefined
                            ? { borderLeftWidth: '4px', borderLeftColor: corDoDentista(corSlot) }
                            : {}),
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
      )}
    </div>
  );
}
