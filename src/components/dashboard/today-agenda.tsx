import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Calendar, ArrowRight } from 'lucide-react';

export type AgendamentoHojeItem = {
  id: string;
  data_hora: string;
  status: string;
  paciente: { id: string; nome: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Aguardando',     color: 'bg-surface-alt text-text-secondary' },
  confirmed:   { label: 'Confirmado',     color: 'bg-teal/10 text-teal' },
  checked_in:  { label: 'Na Recepção',    color: 'bg-teal/20 text-teal font-bold' },
  in_progress: { label: 'Em Atendimento', color: 'bg-teal text-white' },
  completed:   { label: 'Realizado',      color: 'bg-surface-alt text-text-secondary' },
  no_show:     { label: 'Faltou',         color: 'bg-coral/10 text-coral' },
  cancelled:   { label: 'Cancelado',      color: 'bg-coral/10 text-coral' },
};

const DONE_STATUSES = new Set(['completed', 'no_show', 'cancelled']);
const ACTIVE_STATUSES = new Set(['in_progress', 'checked_in']);

interface TodayAgendaProps {
  agendamentos: AgendamentoHojeItem[];
}

export function TodayAgenda({ agendamentos }: TodayAgendaProps) {
  if (agendamentos.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-10 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mb-4">
          <Calendar className="w-5 h-5 text-text-secondary" />
        </div>
        <p className="text-sm font-semibold text-text-primary mb-1">Agenda vazia</p>
        <p className="text-text-secondary text-xs leading-relaxed">
          Nenhum atendimento agendado para hoje.
        </p>
      </div>
    );
  }

  // Primeiro não encerrado e não ativo = "próximo"
  const nextIdx = agendamentos.findIndex(
    (a) => !DONE_STATUSES.has(a.status) && !ACTIVE_STATUSES.has(a.status),
  );

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="divide-y divide-border">
        {agendamentos.map((apt, idx) => {
          const hora = format(parseISO(apt.data_hora), 'HH:mm');
          const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled;
          const isDone = DONE_STATUSES.has(apt.status);
          const isActive = ACTIVE_STATUSES.has(apt.status);
          const isNext = idx === nextIdx && nextIdx !== -1;

          const rowClasses = [
            'flex items-center justify-between px-4 py-3.5 transition-colors border-l-2',
            isActive ? 'bg-teal/[0.04] border-l-teal' : '',
            isNext && !isActive ? 'bg-surface-alt/30 border-l-teal/60' : '',
            !isActive && !isNext ? 'border-l-transparent' : '',
            isDone ? 'opacity-50' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={apt.id} className={rowClasses}>
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`font-mono text-sm font-bold shrink-0 w-11 text-center ${
                    isActive || isNext ? 'text-teal' : 'text-text-secondary'
                  }`}
                >
                  {hora}
                </span>
                <div
                  className={`w-px h-8 rounded-full shrink-0 ${
                    isActive || isNext ? 'bg-teal' : 'bg-border'
                  }`}
                />
                {apt.paciente ? (
                  <span
                    className={`font-semibold text-sm truncate ${
                      isDone ? 'text-text-secondary' : 'text-text-primary'
                    }`}
                  >
                    {apt.paciente.nome}
                  </span>
                ) : (
                  <span className="text-sm text-text-secondary">Paciente</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg ${cfg.color}`}
                >
                  {cfg.label}
                </span>
                {apt.paciente && !isDone && (
                  <Link
                    href={`/dashboard/pacientes/${apt.paciente.id}`}
                    className="text-[10px] font-bold uppercase tracking-wider text-teal transition-colors flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-teal/5"
                  >
                    Abrir <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
