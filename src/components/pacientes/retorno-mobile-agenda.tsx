'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, endOfWeek, format, startOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { buscarDisponibilidadeSemana } from '@/server/agenda/buscar-disponibilidade';
import { formatHora, slotEstaLivre, type DisponibilidadeDia } from '@/lib/agenda/disponibilidade';

interface RetornoMobileAgendaProps {
  dentistaId: string | null;
  duracaoMin: number;
  selecionado: { data: string; minutoDoDia: number; agendaLivre: boolean } | null;
  onSelecionar: (data: string, minutoDoDia: number, agendaLivre: boolean) => void;
  onInvalidarSelecao?: () => void;
}

function hojeISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function diaTemHorarioLivre(dia: DisponibilidadeDia, duracaoMin: number): boolean {
  const agora = new Date();
  return dia.livres.some((bloco) => {
    for (let minuto = bloco.inicioMin; minuto + duracaoMin <= bloco.fimMin; minuto += dia.intervaloMinutos) {
      if (slotEstaLivre(minuto, duracaoMin, dia, agora)) return true;
    }
    return false;
  });
}

const DIA_LABEL_MOBILE: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

export function RetornoMobileAgenda({
  dentistaId,
  duracaoMin,
  selecionado,
  onSelecionar,
  onInvalidarSelecao,
}: RetornoMobileAgendaProps) {
  const [semanaInicio, setSemanaInicio] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [dias, setDias] = useState<DisponibilidadeDia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const semanaInicioISO = format(semanaInicio, 'yyyy-MM-dd');
  const chave = `${dentistaId ?? 'sem-dentista'}:${semanaInicioISO}`;
  const [chaveCarregada, setChaveCarregada] = useState(chave);

  if (chaveCarregada !== chave) {
    setChaveCarregada(chave);
    setDias(null);
    setErro(null);
    setDiaAberto(null);
  }

  useEffect(() => {
    if (!dentistaId) return;
    let cancelado = false;
    buscarDisponibilidadeSemana(dentistaId, semanaInicioISO)
      .then((resultado) => { if (!cancelado) setDias(resultado); })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar a agenda.'); });
    return () => { cancelado = true; };
  }, [dentistaId, semanaInicioISO]);

  // A API continua retornando domingo–sábado para manter o contrato compartilhado com
  // a grade desktop. No mobile, domingo não entra na faixa: seis cartões de 44px cabem
  // inteiros na viewport e a semana de trabalho fica legível sem rolagem horizontal.
  const diasSemana = useMemo(
    () => (dias ?? []).filter((dia) => dia.diaSemana !== 0),
    [dias],
  );
  const diaAtivo = diasSemana.find((dia) => dia.data === diaAberto)
    ?? diasSemana.find((dia) => dia.data === selecionado?.data)
    ?? diasSemana.find((dia) => dia.data === hojeISO() && diaTemHorarioLivre(dia, duracaoMin))
    ?? diasSemana.find((dia) => diaTemHorarioLivre(dia, duracaoMin))
    ?? diasSemana.find((dia) => dia.data === hojeISO())
    ?? diasSemana[0]
    ?? null;
  const slots = useMemo(() => {
    if (!diaAtivo) return [];
    const agora = new Date();
    return diaAtivo.livres.flatMap((bloco) => {
      const opcoes: number[] = [];
      for (let minuto = bloco.inicioMin; minuto + duracaoMin <= bloco.fimMin; minuto += diaAtivo.intervaloMinutos) {
        if (slotEstaLivre(minuto, duracaoMin, diaAtivo, agora)) opcoes.push(minuto);
      }
      return opcoes;
    });
  }, [diaAtivo, duracaoMin]);
  const ocupados = useMemo(
    () => [...(diaAtivo?.ocupados ?? [])].sort((a, b) => a.inicioMin - b.inicioMin),
    [diaAtivo?.ocupados],
  );

  useEffect(() => {
    if (!selecionado || selecionado.data !== diaAtivo?.data) return;
    if (selecionado.agendaLivre && diaAtivo?.temGrade === false) return;
    if (!slots.includes(selecionado.minutoDoDia)) onInvalidarSelecao?.();
  }, [diaAtivo?.data, diaAtivo?.temGrade, onInvalidarSelecao, selecionado, slots]);

  if (!dentistaId) {
    return <p className="rounded-xl border border-border bg-surface-alt/50 px-3 py-4 text-center text-sm text-text-secondary">Selecione o dentista para ver a agenda.</p>;
  }

  return (
    <div className="space-y-3 md:hidden">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => setSemanaInicio(startOfWeek(subWeeks(semanaInicio, 1), { weekStartsOn: 0 }))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 truncate text-center text-xs font-semibold text-text-primary">
          {format(addDays(semanaInicio, 1), 'd MMM', { locale: ptBR })} – {format(endOfWeek(semanaInicio, { weekStartsOn: 0 }), 'd MMM', { locale: ptBR })}
        </p>
        <button
          type="button"
          aria-label="Próxima semana"
          onClick={() => setSemanaInicio(startOfWeek(addWeeks(semanaInicio, 1), { weekStartsOn: 0 }))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {erro ? (
        <p role="alert" className="rounded-xl bg-coral-pale px-3 py-2 text-sm text-coral-ink">{erro}</p>
      ) : !dias ? (
        <div role="status" aria-live="polite" className="flex h-20 items-center justify-center rounded-xl border border-border bg-surface-alt/40">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-text-secondary" />
          <span className="sr-only">Carregando agenda.</span>
        </div>
      ) : diasSemana.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-alt/50 px-3 py-4 text-center text-sm text-text-secondary">Sem expediente de segunda a sábado.</p>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-2">
            {diasSemana.map((dia) => {
              const ativo = dia.data === diaAtivo?.data;
              const agendaLivre = !dia.temGrade;
              return (
                <button
                  key={dia.data}
                  type="button"
                  onClick={() => setDiaAberto(dia.data)}
                  aria-pressed={ativo}
                  className={`min-h-[52px] min-w-0 rounded-xl border px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
                    ativo ? 'border-teal bg-teal/10 text-teal-ink' : agendaLivre ? 'border-teal/30 bg-teal/5 text-teal-ink' : 'border-border bg-surface-alt/50 text-text-secondary hover:border-teal/40'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-normal">{DIA_LABEL_MOBILE[dia.diaSemana]}</span>
                  <span className="mt-0.5 block text-base font-bold leading-none">{format(new Date(`${dia.data}T12:00:00`), 'd')}</span>
                </button>
              );
            })}
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-teal-ink">Agenda do dia</p>
            {ocupados.length > 0 && (
              <details
                key={diaAtivo?.data}
                className="group mb-3 rounded-xl border border-border bg-surface-alt/50"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 [&::-webkit-details-marker]:hidden">
                  <span>{ocupados.length} {ocupados.length === 1 ? 'horário já agendado' : 'horários já agendados'}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-teal-ink group-open:hidden">Ver</span>
                  <span className="hidden text-[10px] font-bold uppercase tracking-widest text-teal-ink group-open:inline">Ocultar</span>
                </summary>
                <ul className="max-h-40 space-y-1.5 overflow-y-auto border-t border-border p-3" aria-label="Horários já agendados">
                  {ocupados.map((ocupado) => (
                    <li key={ocupado.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface px-2.5 py-2">
                      <span className="font-mono text-xs font-semibold text-text-primary">{formatHora(ocupado.inicioMin)}</span>
                      <span className="min-w-0 truncate text-xs text-text-secondary">{ocupado.bloqueio ? 'Horário bloqueado' : ocupado.pacienteNome ?? 'Paciente agendado'}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-teal-ink">
              {diaAtivo?.temGrade === false ? 'Horário' : 'Horários livres'}
            </p>
            {diaAtivo?.temGrade === false ? (
              <div className="rounded-xl border border-teal/25 bg-teal/5 p-3">
                <p className="text-sm font-semibold text-teal-ink">Agenda livre neste dia.</p>
                <label htmlFor="retorno-hora-livre" className="mt-3 block text-[10px] font-bold uppercase tracking-widest text-teal-ink">Hora de atendimento</label>
                <input
                  id="retorno-hora-livre"
                  type="time"
                  step="900"
                  value={selecionado?.data === diaAtivo.data ? formatHora(selecionado.minutoDoDia) : ''}
                  onChange={(event) => {
                    const [hora, minuto] = event.target.value.split(':').map(Number);
                    if (Number.isInteger(hora) && Number.isInteger(minuto)) onSelecionar(diaAtivo.data, hora * 60 + minuto, true);
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-alt px-3 font-mono text-sm font-semibold text-text-primary outline-none focus:border-teal/40 focus:ring-2 focus:ring-teal/15"
                />
                <p className="mt-2 text-xs text-text-secondary">Escolha a hora. O sistema confere conflitos antes de marcar.</p>
              </div>
            ) : slots.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-alt/50 px-3 py-4 text-center text-sm text-text-secondary">Nenhum horário livre neste dia.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((minuto) => {
                  const ativo = selecionado?.data === diaAtivo?.data && selecionado.minutoDoDia === minuto;
                  return (
                    <button
                      key={minuto}
                      type="button"
                      onClick={() => onSelecionar(diaAtivo!.data, minuto, false)}
                      className={`min-h-11 rounded-xl border font-mono text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
                        ativo ? 'border-teal bg-teal-dark text-white' : 'border-border bg-surface-alt/50 text-text-primary hover:border-teal/40 hover:text-teal-ink'
                      }`}
                    >
                      {formatHora(minuto)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
