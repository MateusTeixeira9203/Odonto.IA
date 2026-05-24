import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Clock, Calendar, AlertCircle, FileText } from 'lucide-react';
import { ConsultaCtaButton } from './consulta-cta-button';

interface NextAppointmentHeroProps {
  agendamento: {
    id: string;
    data_hora: string;
    observacoes: string | null;
    paciente: { id: string; nome: string; observacoes: string | null } | null;
    ultimaFichaQueixa: string | null;
  } | null;
}

export function NextAppointmentHero({ agendamento }: NextAppointmentHeroProps) {
  if (!agendamento?.paciente) {
    return (
      <div className="mb-8 md:mb-10 bg-surface rounded-3xl border border-border p-8 md:p-10 flex flex-col items-center justify-center text-center min-h-[180px]">
        <Calendar className="w-10 h-10 text-border mb-4" />
        <p className="font-heading text-xl text-text-primary mb-1">
          Nenhum atendimento pendente
        </p>
        <p className="text-sm text-text-secondary mb-4">
          Sua agenda está vazia ou todos os atendimentos foram concluídos.
        </p>
        <Link
          href="/dashboard/agendamentos"
          className="text-teal text-sm font-semibold hover:underline"
        >
          Ver agenda completa →
        </Link>
      </div>
    );
  }

  const { paciente, data_hora, observacoes, ultimaFichaQueixa } = agendamento;
  const hora = format(parseISO(data_hora), 'HH:mm');

  const alertas = paciente.observacoes
    ? paciente.observacoes
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      className="mb-8 md:mb-10 rounded-3xl border border-border/60 overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 92%, #2f9c85) 100%)',
      }}
    >
      <div className="p-6 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            Próximo atendimento
          </div>

          <h2 className="font-heading text-3xl md:text-4xl text-text-primary mb-2 truncate">
            {paciente.nome}
          </h2>

          <div className="flex items-center gap-2 text-text-secondary mb-4 flex-wrap">
            <Clock className="w-4 h-4 shrink-0" />
            <span className="font-mono text-lg font-bold text-text-primary">{hora}</span>
            {observacoes && (
              <>
                <span className="text-border">·</span>
                <span className="text-sm text-text-secondary">{observacoes}</span>
              </>
            )}
          </div>

          {alertas.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {alertas.map((alerta, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                >
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {alerta}
                </span>
              ))}
            </div>
          )}

          {ultimaFichaQueixa && (
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>
                Último:{' '}
                <span className="text-text-primary font-medium">{ultimaFichaQueixa}</span>
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 shrink-0">
          <ConsultaCtaButton />
          <Link
            href={`/dashboard/pacientes/${paciente.id}`}
            className="text-center text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            Ver perfil do paciente →
          </Link>
        </div>
      </div>
    </div>
  );
}
