'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

export type AtendimentoHoje = {
  id: string;
  data_hora: string;
  status: string;
  paciente: { id: string; nome: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  agendado:       { label: 'Agendado',      color: 'bg-surface-alt text-text-secondary' },
  confirmado:     { label: 'Confirmado',    color: 'bg-teal/10 text-teal' },
  na_recepcao:    { label: 'Na Recepção',   color: 'bg-teal/20 text-teal font-bold' },
  em_atendimento: { label: 'Em Atendimento',color: 'bg-teal text-white' },
  realizado:      { label: 'Realizado',     color: 'bg-teal/10 text-teal' },
  cancelado:      { label: 'Cancelado',     color: 'bg-coral/10 text-coral' },
  faltou:         { label: 'Faltou',        color: 'bg-coral/10 text-coral' },
};

function isCheckedIn(status: string) {
  return status === 'na_recepcao' || status === 'em_atendimento';
}

export function AtendimentosHoje({ atendimentos }: { atendimentos: AtendimentoHoje[] }) {
  if (atendimentos.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-12 text-center">
        <Calendar className="w-8 h-8 text-border mx-auto mb-3" />
        <p className="text-text-secondary text-sm font-medium">Nenhum atendimento agendado para hoje.</p>
        <p className="text-text-secondary text-xs mt-1">Aproveite para organizar os prontuários.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="divide-y divide-border">
        {atendimentos.map((apt) => {
          const hora = format(parseISO(apt.data_hora), 'HH:mm');
          const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.agendado;
          const checkedIn = isCheckedIn(apt.status);

          return (
            <div
              key={apt.id}
              className={`flex items-center justify-between px-4 py-3.5 transition-colors ${
                checkedIn
                  ? 'bg-teal/[0.04] border-l-2 border-l-teal'
                  : 'hover:bg-surface-alt border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Hora */}
                <div className={`flex flex-col items-center w-11 shrink-0 ${checkedIn ? 'text-teal' : 'text-text-secondary'}`}>
                  <Clock className="w-3 h-3 mb-0.5 opacity-50" />
                  <span className="font-mono text-sm font-bold leading-none">{hora}</span>
                </div>

                <div className={`w-px h-8 rounded-full shrink-0 ${checkedIn ? 'bg-teal' : 'bg-border'}`} />

                {/* Nome do paciente */}
                {apt.paciente ? (
                  <Link
                    href={`/dashboard/pacientes/${apt.paciente.id}`}
                    className="font-semibold text-sm text-text-primary hover:text-teal transition-colors"
                  >
                    {apt.paciente.nome}
                  </Link>
                ) : (
                  <span className="font-semibold text-sm text-text-secondary">Paciente</span>
                )}
              </div>

              {/* Badge de status */}
              <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
