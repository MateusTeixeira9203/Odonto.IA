'use client';

import { useMemo } from 'react';
import {
  format,
  startOfWeek,
  eachDayOfInterval,
  addDays,
  addWeeks,
  subWeeks,
  isToday as isDateToday,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { STATUS_CONFIG } from './status-config';
import { calcularFaixas } from './layout-sobreposicao';
import { corDoDentista, type DentistaAgenda } from './cor-dentista';
import type { AgendamentoRow, BloqueioRow } from '../page';
import type { AgendamentoStatus } from '@/types/database';
import { formatarHoraBRT, partesDataHoraBRT } from '@/lib/hora-brt';

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
  /** R-102 — compromissos pessoais da semana, mesma janela de `agendamentos`. */
  bloqueios: BloqueioRow[];
  selectedWeek: Date;
  onWeekChange: (d: Date) => void;
  onAppointmentClick: (apt: AgendamentoRow) => void;
  /** R-102 — clique no card do bloqueio abre o dialog em modo edição. */
  onBloqueioClick: (bloqueio: BloqueioRow) => void;
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
  bloqueios,
  selectedWeek,
  onWeekChange,
  onAppointmentClick,
  onBloqueioClick,
  onDayClick,
  isSecretaria,
  slotPorDentista,
  filtroDentistaId,
  dentistas,
  diaDestacado,
  onSlotVazioClick,
  onCargaClick,
}: WeekViewProps) {
  const { weekStart, weekEnd, days } = useMemo(() => {
    const inicio = startOfWeek(selectedWeek, { weekStartsOn: 1 });
    const fim = addDays(inicio, 5);
    return {
      weekStart: inicio,
      weekEnd: fim,
      days: eachDayOfInterval({ start: inicio, end: fim }),
    };
  }, [selectedWeek]);

  const chavesDaSemana = useMemo(
    () => new Set(days.map((day) => format(day, 'yyyy-MM-dd'))),
    [days],
  );

  // "Todos" só vira mapa de carga quando há de fato mais de um dentista pra comparar —
  // com 0 ou 1, a indireção não ajuda ninguém, mostra a grade direto (mesma regra do Dia).
  const mostraCarga = isSecretaria && filtroDentistaId === 'todos' && dentistas.length > 1;

  const weekApts = useMemo(() => {
    return agendamentos.filter((apt) => chavesDaSemana.has(partesDataHoraBRT(apt.data_hora).data));
  }, [agendamentos, chavesDaSemana]);

  // O que a GRADE (cabeçalho de dia + grade cheia) mostra: tudo, ou só o dentista filtrado.
  const aptsEfetivos = useMemo(() => {
    if (!isSecretaria || filtroDentistaId === 'todos') return weekApts;
    return weekApts.filter(a => a.dentista_id === filtroDentistaId);
  }, [weekApts, isSecretaria, filtroDentistaId]);

  const aptsByDay = useMemo(() => {
    const map: Record<string, AgendamentoRow[]> = {};
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      map[key]  = aptsEfetivos.filter((apt) => partesDataHoraBRT(apt.data_hora).data === key);
    }
    return map;
  }, [aptsEfetivos, days]);

  // R-102 — mesmo recorte de semana + filtro de dentista que `aptsEfetivos`/`aptsByDay`.
  const weekBloqueios = useMemo(() => {
    return bloqueios.filter((bloqueio) => chavesDaSemana.has(partesDataHoraBRT(bloqueio.data_hora).data));
  }, [bloqueios, chavesDaSemana]);

  const bloqueiosEfetivos = useMemo(() => {
    if (!isSecretaria || filtroDentistaId === 'todos') return weekBloqueios;
    return weekBloqueios.filter(b => b.dentista_id === filtroDentistaId);
  }, [weekBloqueios, isSecretaria, filtroDentistaId]);

  const bloqueiosByDay = useMemo(() => {
    const map: Record<string, BloqueioRow[]> = {};
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      map[key]  = bloqueiosEfetivos.filter((bloqueio) => partesDataHoraBRT(bloqueio.data_hora).data === key);
    }
    return map;
  }, [bloqueiosEfetivos, days]);

  const hours       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;

  function getAptStyle(apt: AgendamentoRow) {
    const hourDecimal = partesDataHoraBRT(apt.data_hora).minutoDoDia / 60;
    const top         = (hourDecimal - HOUR_START) * SLOT_HEIGHT;
    const height      = Math.max((apt.duracao_minutos / 60) * SLOT_HEIGHT - 4, 22);
    const { bg, border, text } = (STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled).timeline;
    return { top, height, bg, border, text };
  }

  function getBloqueioStyle(bl: BloqueioRow) {
    const hourDecimal = partesDataHoraBRT(bl.data_hora).minutoDoDia / 60;
    const top         = (hourDecimal - HOUR_START) * SLOT_HEIGHT;
    const height      = Math.max((bl.duracao_minutos / 60) * SLOT_HEIGHT - 4, 22);
    return { top, height };
  }

  // Itens combinados por dia (agendamento + bloqueio) — é sobre esta lista que o JSX itera.
  const itensByDay = useMemo(() => {
    const map: Record<string, Array<{ kind: 'apt'; id: string; data: AgendamentoRow } | { kind: 'bloqueio'; id: string; data: BloqueioRow }>> = {};
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = [
        ...(aptsByDay[key] ?? []).map((a) => ({ kind: 'apt' as const, id: a.id, data: a })),
        ...(bloqueiosByDay[key] ?? []).map((b) => ({ kind: 'bloqueio' as const, id: `bl-${b.id}`, data: b })),
      ];
    }
    return map;
  }, [aptsByDay, bloqueiosByDay, days]);

  /**
   * Layout de sobreposição — BUG CORRIGIDO 21/07: todo card usava a largura inteira da
   * coluna, então dois horários sobrepostos eram desenhados no MESMO retângulo (texto por
   * cima de texto, o de baixo inclicável). Com o "marcar mesmo assim" e com consultas
   * longas (240min), sobreposição deixou de ser exceção.
   *
   * O algoritmo mora em `layout-sobreposicao.ts`, compartilhado com a visão de Dia. Bloqueio
   * (R-102) mescla nas MESMAS caixas — overlap entre bloqueio e consulta fica lado a lado.
   */
  const faixasPorDia = useMemo(() => {
    const porDia = new Map<string, ReturnType<typeof calcularFaixas>>();
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      const caixas = (itensByDay[key] ?? [])
        .map(({ id, data, kind }) => {
          const { top, height } = kind === 'apt' ? getAptStyle(data as AgendamentoRow) : getBloqueioStyle(data as BloqueioRow);
          return { id, top, height };
        })
        .sort((a, b) => a.top - b.top); // `calcularFaixas` espera ordenado por topo
      porDia.set(key, calcularFaixas(caixas));
    }
    return porDia;
  }, [itensByDay, days]);

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
        weekApts.filter((apt) => apt.dentista_id === d.id && partesDataHoraBRT(apt.data_hora).data === format(day, 'yyyy-MM-dd')).length,
      ));
    }
    return porDentista;
  }, [dentistasOrdenados, weekApts, days]);
  const picoCarga = Math.max(1, ...[...cargaPorDentistaDia.values()].flat());

  return (
    <>
      {/* A lista abaixo foi substituída pela própria grade no celular. Mantemos o bloco
          temporariamente escondido para não duplicar a regra de agendamento em duas UIs. */}
      <div className="hidden">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-2 py-2">
          <button
            type="button"
            onClick={() => onWeekChange(subWeeks(selectedWeek, 1))}
            aria-label="Semana anterior"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-0 text-center text-sm font-bold text-text-primary">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} – {format(weekEnd, "d 'de' MMM", { locale: ptBR })}
          </p>
          <button
            type="button"
            onClick={() => onWeekChange(addWeeks(selectedWeek, 1))}
            aria-label="Próxima semana"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const consultas = aptsByDay[key] ?? [];
          const bloqueiosDoDia = bloqueiosByDay[key] ?? [];
          const hoje = isDateToday(day);
          return (
            <section key={key} className={`overflow-hidden rounded-xl border ${hoje ? 'border-teal/40 bg-teal/[0.03]' : 'border-border bg-surface'}`}>
              <button
                type="button"
                onClick={() => onDayClick(day)}
                className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left active:bg-surface-alt"
              >
                <span>
                  <span className={`block text-sm font-bold capitalize ${hoje ? 'text-teal' : 'text-text-primary'}`}>
                    {format(day, 'EEEE', { locale: ptBR })}, {format(day, 'd')}
                  </span>
                  <span className="text-xs text-text-secondary">Abrir agenda do dia</span>
                </span>
                <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-bold text-text-secondary">
                  {consultas.length} {consultas.length === 1 ? 'consulta' : 'consultas'}
                </span>
              </button>
              <div className="space-y-1 p-2">
                {consultas.slice(0, 3).map((apt) => {
                  const config = STATUS_CONFIG[apt.status as AgendamentoStatus] ?? STATUS_CONFIG.scheduled;
                  return (
                    <button
                      key={apt.id}
                      type="button"
                      onClick={() => onAppointmentClick(apt)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left active:bg-surface-alt"
                    >
                      <span className="w-11 shrink-0 font-mono text-xs font-bold" style={{ color: config.timeline.text }}>
                        {formatarHoraBRT(apt.data_hora)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{apt.paciente?.nome ?? '—'}</span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${config.bg} ${config.text}`}>{config.label}</span>
                    </button>
                  );
                })}
                {bloqueiosDoDia.slice(0, 2).map((bloqueio) => (
                  <button
                    key={bloqueio.id}
                    type="button"
                    onClick={() => onBloqueioClick(bloqueio)}
                    className="flex w-full items-center gap-3 rounded-lg bg-surface-alt px-2 py-2 text-left"
                  >
                    <Lock className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-secondary">{bloqueio.titulo || 'Compromisso pessoal'}</span>
                    <span className="font-mono text-xs text-text-secondary">{formatarHoraBRT(bloqueio.data_hora)}</span>
                  </button>
                ))}
                {consultas.length === 0 && bloqueiosDoDia.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onSlotVazioClick(day, '09:00')}
                    className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs font-semibold text-text-secondary"
                  >
                    + Agendar neste dia
                  </button>
                )}
                {consultas.length > 3 && <p className="px-2 pt-1 text-xs text-text-secondary">+ {consultas.length - 3} na agenda do dia</p>}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-col">
      {/* Week navigation header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border bg-surface-alt/40 shrink-0 md:px-4 md:py-3">
        <div className="flex min-w-0 items-center gap-1 md:gap-2">
          <button
            onClick={() => onWeekChange(subWeeks(selectedWeek, 1))}
            className="h-10 w-10 shrink-0 hover:bg-surface rounded-lg transition-colors border border-border flex items-center justify-center md:h-11 md:w-11"
          >
            <ChevronLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <span className="min-w-0 text-center text-xs font-semibold text-text-primary md:text-sm">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} –{' '}
            {format(weekEnd, "d 'de' MMM", { locale: ptBR })}<span className="hidden md:inline"> {format(weekEnd, 'yyyy')}</span>
          </span>
          <button
            onClick={() => onWeekChange(addWeeks(selectedWeek, 1))}
            className="h-10 w-10 shrink-0 hover:bg-surface rounded-lg transition-colors border border-border flex items-center justify-center md:h-11 md:w-11"
          >
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
        <button
          onClick={() => onWeekChange(new Date())}
          className="min-h-10 shrink-0 text-xs font-semibold text-teal hover:opacity-80 transition-colors px-2 py-1.5 rounded-lg bg-teal/5 hover:bg-teal/10 md:min-h-11 md:px-3"
        >
          Hoje
        </button>
      </div>

      {/* No celular as sete colunas cabem juntas: 28px de horas + 7×44px de dia.
          A mesma grade continua rolando apenas quando houver mais largura de conteúdo no desktop. */}
      <div className="relative">
        <div className="overflow-x-auto">
          <div className="min-w-[336px] md:min-w-[600px]">
      {/* Day headers — vale nos dois estados; é o atalho pro Dia daquela data.
          w-36 tem que bater com a coluna de nome do mapa de carga logo abaixo e com o
          gutter de hora da grade cheia — as 3 faixas alinham as mesmas 7 colunas. */}
      <div className="flex border-b border-border shrink-0 bg-surface-alt/30">
        <div className="w-7 shrink-0 md:w-36" />
        {days.map(day => {
          const isToday = isDateToday(day);
          const key     = format(day, 'yyyy-MM-dd');
          const count   = aptsByDay[key]?.length ?? 0;
          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className="flex-1 min-w-0 cursor-pointer py-2 text-center transition-colors hover:bg-surface-alt md:py-2.5"
            >
              <div className={`mb-1 text-[8px] font-bold uppercase leading-none tracking-normal md:text-[10px] md:tracking-widest ${isToday ? 'text-teal' : 'text-text-secondary'}`}>
                {format(day, 'EEE', { locale: ptBR })}
              </div>
              <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-base font-bold leading-none md:h-8 md:w-8 md:text-lg ${
                isToday ? 'bg-teal text-white' : 'text-text-primary'
              }`}>
                {format(day, 'd')}
              </div>
              {count > 0 && (
                <div className="mt-0.5 hidden text-[10px] font-semibold text-teal md:block">{count}x</div>
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
                <div className="flex h-[62px] w-7 shrink-0 items-center gap-2 overflow-hidden md:w-36 md:min-w-0 md:pl-3 md:pr-2">
                  <span
                    className="hidden h-2 w-2 shrink-0 rounded-full md:block"
                    style={{ background: corDoDentista(d.slot) }}
                  />
                  <span className="hidden truncate text-xs font-semibold text-text-primary md:block">{d.nome}</span>
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
            <div className="relative w-7 shrink-0 md:w-36">
              {hours.map(h => (
                <div
                  key={h}
                  className="absolute flex w-full items-start justify-end pr-1 pt-0.5 md:pr-2"
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

                  {(itensByDay[key] ?? []).map(item => {
                    const fx = faixasPorDia.get(key)?.get(item.id);
                    const leftPct = fx?.leftPct ?? 0;
                    const larguraPct = fx?.widthPct ?? 100;
                    const faixa = fx?.faixa ?? 0;
                    const faixas = fx?.faixas ?? 1;

                    // R-102 — bloqueio: card neutro, sem status, clique abre o dialog de edição.
                    if (item.kind === 'bloqueio') {
                      const bl = item.data;
                      const { top, height } = getBloqueioStyle(bl);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onBloqueioClick(bl); }}
                          title={`${formatarHoraBRT(bl.data_hora)} — ${bl.titulo || 'Compromisso pessoal'}`}
                          className="absolute rounded-md px-1.5 py-1 text-left cursor-pointer hover:brightness-95 active:brightness-90 transition-all overflow-hidden select-none border border-border bg-surface-alt"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${larguraPct}% - 4px)`,
                            zIndex: faixas > 1 ? faixa + 1 : undefined,
                          }}
                        >
                          <p className="text-[10px] font-semibold leading-tight truncate flex items-center gap-1 text-text-secondary">
                            <Lock className="w-2.5 h-2.5 shrink-0" />
                            {formatarHoraBRT(bl.data_hora)} · {bl.titulo || 'Compromisso'}
                          </p>
                        </button>
                      );
                    }

                    const apt = item.data;
                    const { top, height, bg, border, text } = getAptStyle(apt);
                    const corSlot = slotPorDentista[apt.dentista_id];
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => onAppointmentClick(apt)}
                        title={`${formatarHoraBRT(apt.data_hora)} — ${apt.paciente?.nome ?? '—'}`}
                        aria-label={`Abrir consulta de ${apt.paciente?.nome ?? 'paciente'} às ${formatarHoraBRT(apt.data_hora)}`}
                        className="absolute rounded-md px-1.5 py-1 text-left cursor-pointer hover:brightness-95 active:brightness-90 transition-all overflow-hidden select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1"
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
                        <span className="block text-[10px] font-semibold leading-tight truncate" style={{ color: text }}>
                          {formatarHoraBRT(apt.data_hora)} · {apt.paciente?.nome?.split(' ')[0] ?? '—'}
                        </span>
                        {height > 32 && apt.observacoes && (
                          <span className="block text-[10px] truncate mt-0.5 opacity-70" style={{ color: text }}>
                            {apt.observacoes}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
