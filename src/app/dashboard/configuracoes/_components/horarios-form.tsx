'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { salvarHorarios, type HorarioDia } from '../actions';
import type { HorarioDisponivel } from '@/types/database';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface Props {
  horarios: HorarioDisponivel[];
}

function initHorarios(horarios: HorarioDisponivel[]): HorarioDia[] {
  return DIAS_SEMANA.map((_, dia) => {
    const existente = horarios.find((h) => h.dia_semana === dia);
    return {
      dia_semana: dia,
      hora_inicio: existente ? existente.hora_inicio.slice(0, 5) : '08:00',
      hora_fim: existente ? existente.hora_fim.slice(0, 5) : '18:00',
      intervalo_minutos: existente?.intervalo_minutos ?? 30,
      ativo: existente ? existente.ativo : dia >= 1 && dia <= 5,
    };
  });
}

export function HorariosForm({ horarios }: Props): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [dias, setDias] = useState<HorarioDia[]>(() => initHorarios(horarios));

  const inputClass =
    'font-sans text-sm px-3 py-1.5 rounded-xl border border-border bg-surface-alt text-text-primary focus:outline-none focus:ring-2 focus:ring-teal/40 transition-colors disabled:opacity-50';

  function atualizarDia(index: number, campo: keyof HorarioDia, valor: string | number | boolean): void {
    setDias((prev) => prev.map((d, i) => (i === index ? { ...d, [campo]: valor } : d)));
  }

  function handleSalvar(): void {
    startTransition(async () => {
      const result = await salvarHorarios(dias);
      if (result.error) {
        toast.error(`Erro ao salvar horários: ${result.error}`);
      } else {
        toast.success('Horários salvos!');
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt/50">
              <th className="text-left px-4 py-3 font-mono text-xs text-text-secondary uppercase tracking-wider w-28">
                Dia
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs text-text-secondary uppercase tracking-wider">Início</th>
              <th className="text-left px-4 py-3 font-mono text-xs text-text-secondary uppercase tracking-wider">Fim</th>
              <th className="text-left px-4 py-3 font-mono text-xs text-text-secondary uppercase tracking-wider">Intervalo (min)</th>
              <th className="px-4 py-3 font-mono text-xs text-text-secondary uppercase tracking-wider text-center w-16">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((dia, i) => (
              <tr
                key={dia.dia_semana}
                className={`border-b border-border/50 last:border-b-0 ${!dia.ativo ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-3 font-sans text-sm text-text-primary">
                  {DIAS_SEMANA[dia.dia_semana]}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={dia.hora_inicio}
                    onChange={(e) => atualizarDia(i, 'hora_inicio', e.target.value)}
                    disabled={!dia.ativo}
                    className={inputClass + ' w-28'}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={dia.hora_fim}
                    onChange={(e) => atualizarDia(i, 'hora_fim', e.target.value)}
                    disabled={!dia.ativo}
                    className={inputClass + ' w-28'}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    step={5}
                    value={dia.intervalo_minutos}
                    onChange={(e) => atualizarDia(i, 'intervalo_minutos', Number(e.target.value))}
                    disabled={!dia.ativo}
                    className={inputClass + ' w-20'}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={dia.ativo}
                    onChange={(e) => atualizarDia(i, 'ativo', e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-teal cursor-pointer"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleSalvar}
        className="h-10 px-6 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-dark disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando…' : 'Salvar Horários'}
      </button>
    </div>
  );
}
