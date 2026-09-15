'use client';

// R-64 — grade da semana pro "Marcar retorno". Porta a MESMA ideia da WeekView real da
// Agenda (hora à esquerda, blocos de ocupado, clique-pra-marcar por posição), só menor e de
// 1 dentista só — decisão dele ao vivo (v1 do artefato, lista de horários livres, foi
// rejeitada: "só trazer o que já temos no sistema, só que menor, já resolveria"). Não reusa
// `WeekView` (acoplada à página inteira da Agenda) — componente novo, mesma linguagem visual.

import { useMemo, useState } from 'react';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks,
  addDays, addMonths, addYears, isToday as isDateToday, isSameDay, parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatHora, slotPodeSerSelecionadoParaRetorno, type DisponibilidadeDia } from '@/lib/agenda/disponibilidade';

// spec §8 propunha janela fixa 07h-20h — 13h sempre, mesmo pro dentista que trabalha 6.
// Pedido dele ao vivo ("podemos deixar maior... sem precisar rolar"): a janela passa a ser
// o expediente REAL desse dentista (min/max de `livres` na semana carregada), então quem
// trabalha menos horas ganha uma grade menor de graça, sem scroll. Fallback só pra semana
// sem NENHUM horário configurado (grade toda hachurada não tem expediente pra medir).
const HOUR_FALLBACK_START = 8;
const HOUR_FALLBACK_END = 18;
// spec §8 propunha 34px (pequeno demais pra ler/clicar) → 48px (grande demais depois que
// o layout ganhou a coluna fixa ao lado, R-64 D5-bis). 40px é o meio-termo dos dois pedidos.
const SLOT_HEIGHT = 40;
const MIN_POR_SLOT = 15; // mesma granularidade de horaDoClique (week-view.tsx)
const GUTTER_WIDTH = 36;

const SALTOS = [
  { label: '7 dias', alvo: (hoje: Date) => addDays(hoje, 7) },
  { label: '15 dias', alvo: (hoje: Date) => addDays(hoje, 15) },
  { label: '30 dias', alvo: (hoje: Date) => addDays(hoje, 30) },
  { label: '60 dias', alvo: (hoje: Date) => addDays(hoje, 60) },
  { label: '90 dias', alvo: (hoje: Date) => addDays(hoje, 90) },
  { label: '180 dias', alvo: (hoje: Date) => addDays(hoje, 180) },
  { label: '6 meses', alvo: (hoje: Date) => addMonths(hoje, 6) },
  { label: '1 ano', alvo: (hoje: Date) => addYears(hoje, 1) },
] as const;

/** Janela de horas a mostrar — une expediente e ocupações da semana, arredondada para a hora
 * cheia. Um retorno/agendamento pode existir em dia sem grade ou fora do expediente; esconder
 * esse bloco faria o profissional acreditar que a faixa está livre. A janela também expande para
 * caber o horário selecionado (ex.: digitado no campo Hora fora do expediente). Só dimensiona a
 * grade; não limita o clique — a decisão final continua no servidor. */
function janelaHoras(
  dias: DisponibilidadeDia[] | null,
  selecionado: { minutoDoDia: number; duracaoMin: number } | null,
): { inicio: number; fim: number } {
  const blocos = dias?.flatMap((dia) => [
    ...dia.livres,
    ...dia.ocupados.map((ocupado) => ({
      inicioMin: ocupado.inicioMin,
      fimMin: ocupado.inicioMin + ocupado.duracaoMin,
    })),
  ]) ?? [];
  const base = blocos.length === 0
    ? { inicio: HOUR_FALLBACK_START, fim: HOUR_FALLBACK_END }
    : {
        inicio: Math.floor(Math.min(...blocos.map((b) => b.inicioMin)) / 60),
        fim: Math.ceil(Math.max(...blocos.map((b) => b.fimMin)) / 60),
      };
  if (!selecionado) return base;
  const selInicio = Math.floor(selecionado.minutoDoDia / 60);
  const selFim = Math.ceil((selecionado.minutoDoDia + selecionado.duracaoMin) / 60);
  return { inicio: Math.min(base.inicio, selInicio), fim: Math.max(base.fim, selFim) };
}

/** Offset do clique (px) → minuto do dia, arredondado pros 15min mais próximos — mesma
 *  conta de `horaDoClique` (week-view.tsx), só com o SLOT_HEIGHT desta grade menor. */
function minutoDoClique(offsetY: number, hourStart: number, hourEnd: number): number {
  const hourDecimal = hourStart + offsetY / SLOT_HEIGHT;
  const totalMin = Math.max(hourStart * 60, Math.floor(hourDecimal * 60));
  const arredondado = totalMin - (totalMin % MIN_POR_SLOT);
  return Math.min((hourEnd - 1) * 60 + (60 - MIN_POR_SLOT), arredondado);
}

export interface RetornoSemanaGridProps {
  dentistaId: string | null;
  duracaoMin: number;
  semanaInicio: Date;
  onSemanaInicioChange: (semanaInicio: Date) => void;
  dias: DisponibilidadeDia[] | null;
  erro: string | null;
  selecionado: { data: string; minutoDoDia: number; agendaLivre: boolean } | null;
  onSelecionar: (data: string, minutoDoDia: number, agendaLivre: boolean) => void;
}

export function RetornoSemanaGrid({ dentistaId, duracaoMin, semanaInicio, onSemanaInicioChange, dias, erro, selecionado, onSelecionar }: RetornoSemanaGridProps) {
  const [diaDestacado, setDiaDestacado] = useState<Date | null>(null);

  const weekStart = semanaInicio;
  const weekEnd = endOfWeek(semanaInicio, { weekStartsOn: 0 });
  const weekStartVisivel = addDays(weekStart, 1);

  // A disponibilidade continua sendo buscada de domingo a sábado pelo contrato compartilhado.
  // O retorno, porém, opera de segunda a sábado tanto no desktop quanto no mobile.
  const diasVisiveis = useMemo(
    () => (dias ?? []).filter((dia) => dia.diaSemana !== 0),
    [dias],
  );

  function navegar(proxima: Date) {
    onSemanaInicioChange(startOfWeek(proxima, { weekStartsOn: 0 }));
    setDiaDestacado(null);
  }

  function aplicarSalto(alvo: Date) {
    onSemanaInicioChange(startOfWeek(alvo, { weekStartsOn: 0 }));
    setDiaDestacado(alvo);
  }

  const { inicio: hourStart, fim: hourEnd } = useMemo(
    () => janelaHoras(diasVisiveis, selecionado ? { minutoDoDia: selecionado.minutoDoDia, duracaoMin } : null),
    [diasVisiveis, selecionado, duracaoMin],
  );

  function handleClickDia(dia: DisponibilidadeDia, offsetY: number) {
    const minuto = minutoDoClique(offsetY, hourStart, hourEnd);
    if (!slotPodeSerSelecionadoParaRetorno(minuto, duracaoMin, dia, new Date())) return;
    onSelecionar(dia.data, minuto, !dia.temGrade);
  }

  const totalHeight = (hourEnd - hourStart) * SLOT_HEIGHT;
  const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i);

  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap gap-1.5 border-b border-border p-2.5">
        {SALTOS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => aplicarSalto(s.alvo(new Date()))}
            className="rounded-full border border-teal px-2.5 py-1 text-[11px] font-bold text-teal-ink hover:bg-teal/5"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-b border-border bg-surface-alt/40 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => navegar(subWeeks(semanaInicio, 1))}
            className="rounded-lg border border-border p-1 hover:bg-surface"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-text-secondary" />
          </button>
          <span className="text-xs font-semibold text-text-primary">
            {format(weekStartVisivel, "d 'de' MMM", { locale: ptBR })} – {format(weekEnd, "d 'de' MMM yyyy", { locale: ptBR })}
          </span>
          <button
            type="button"
            aria-label="Próxima semana"
            onClick={() => navegar(addWeeks(semanaInicio, 1))}
            className="rounded-lg border border-border p-1 hover:bg-surface"
          >
            <ChevronRight className="h-3.5 w-3.5 text-text-secondary" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => navegar(new Date())}
          className="rounded-lg bg-teal/5 px-2.5 py-1 text-[11px] font-semibold text-teal-ink hover:opacity-80"
        >
          Hoje
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[680px] border-b border-border">
          <div style={{ width: GUTTER_WIDTH }} className="shrink-0" />
          {eachDayOfInterval({ start: weekStartVisivel, end: weekEnd }).map((day) => {
          const isToday = isDateToday(day);
          return (
            <div key={day.toISOString()} className="flex-1 py-2 text-center">
              <div className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-teal' : 'text-text-secondary'}`}>
                {format(day, 'EEE', { locale: ptBR })}
              </div>
            </div>
          );
          })}
        </div>

        {!dentistaId ? (
          <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-text-secondary">
            Selecione o dentista para ver a agenda.
          </div>
        ) : erro ? (
        <p className="p-4 text-center text-sm text-coral-ink">{erro}</p>
      ) : !dias ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
        </div>
      ) : (
        // Sem scroll próprio: 1 scroll só (o do modal inteiro, ver marcar-retorno-modal.tsx)
        // — 2 scrollboxes aninhadas ("rolar dentro de rolar") era mais confuso que ajudava.
        // A janela dinâmica de horas (hourStart/hourEnd) é o que evita precisar de QUALQUER
        // scroll no caso comum; overflow-x continua só pra semana não quebrar em telas estreitas.
        <div className="flex min-w-[680px]" style={{ height: totalHeight }}>
          <div style={{ width: GUTTER_WIDTH }} className="sticky left-0 z-10 shrink-0 bg-surface">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute w-full text-right text-[10px]"
                style={{ top: (h - hourStart) * SLOT_HEIGHT, width: GUTTER_WIDTH }}
              >
                <span className="pr-1 font-mono text-text-muted">{String(h).padStart(2, '0')}h</span>
              </div>
            ))}
          </div>

          {diasVisiveis.map((dia) => {
            const destacado = !!diaDestacado && isSameDay(parseISO(dia.data), diaDestacado);
            const selecionadoAqui = selecionado?.data === dia.data ? selecionado : null;
            return (
              <div
                key={dia.data}
                className={`relative flex-1 border-l border-border/60 transition-colors ${destacado ? 'bg-teal/[0.05]' : ''}`}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-border/30"
                    style={{ top: (h - hourStart) * SLOT_HEIGHT }}
                  />
                ))}

                <button
                  type="button"
                  aria-label={`Marcar retorno em ${format(parseISO(dia.data), "EEEE, d 'de' MMMM", { locale: ptBR })}`}
                  title="Escolha um horário livre para marcar o retorno"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleClickDia(dia, e.clientY - rect.top);
                  }}
                  className="absolute inset-0 w-full"
                  style={{ height: totalHeight }}
                />

                {dia.ocupados
                  // Fora da janela visível (ex.: um encaixe às 23h com expediente até 18h)
                  // não desenha — do contrário infla a altura do quadro e forçaria scroll
                  // por causa de 1 ocorrência isolada, o oposto do que a janela dinâmica
                  // (hourStart/hourEnd) existe pra resolver.
                  .filter((o) => o.inicioMin + o.duracaoMin > hourStart * 60 && o.inicioMin < hourEnd * 60)
                  .map((o, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute inset-x-0.5 overflow-hidden rounded px-1 py-0.5"
                    style={{
                      top: Math.max((o.inicioMin - hourStart * 60) / 60 * SLOT_HEIGHT, 0),
                      height: Math.max((o.duracaoMin / 60) * SLOT_HEIGHT - 2, 12),
                      background: 'var(--color-slate-pale)',
                      border: '1px solid var(--color-slate)',
                    }}
                  >
                    <p className="truncate text-[10px] font-semibold leading-tight" style={{ color: 'var(--color-slate-ink)' }}>
                      {formatHora(o.inicioMin)} · {o.pacienteNome?.split(' ')[0] ?? '—'}
                    </p>
                  </div>
                ))}

                {selecionadoAqui && (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 flex items-center justify-center overflow-hidden rounded bg-teal-dark"
                    style={{
                      top: (selecionadoAqui.minutoDoDia - hourStart * 60) / 60 * SLOT_HEIGHT,
                      height: Math.max((duracaoMin / 60) * SLOT_HEIGHT - 2, 15),
                    }}
                  >
                    <p className="truncate text-[10px] font-bold text-white">{formatHora(selecionadoAqui.minutoDoDia)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
