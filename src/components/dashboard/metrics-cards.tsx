import { Stethoscope, CalendarDays, CalendarCheck2 } from 'lucide-react';

interface MetricsCardsProps {
  consultasHoje: number;
  agendaSemana: number;
  concluidosHoje: number;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  sublabel: string;
  highlight: boolean;
}

function MetricCard({ icon: Icon, label, value, sublabel, highlight }: MetricCardProps) {
  return (
    <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
        <Icon className="w-20 h-20 text-text-primary" />
      </div>
      <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-teal" />
        {label}
      </div>
      <div className="font-mono text-4xl md:text-5xl font-medium text-text-primary tracking-tight">
        {value}
      </div>
      <div
        className={`text-[10px] mt-4 font-bold uppercase tracking-wider flex items-center gap-1 w-fit px-2 py-1 rounded-md ${
          highlight && value > 0
            ? 'bg-teal/10 text-teal'
            : 'bg-surface-alt text-text-secondary'
        }`}
      >
        {sublabel}
      </div>
    </div>
  );
}

export function MetricsCards({
  consultasHoje,
  agendaSemana,
  concluidosHoje,
}: MetricsCardsProps) {
  return (
    <div
      id="dex-tour-metrics"
      className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10"
    >
      <MetricCard
        icon={Stethoscope}
        label="Consultas hoje"
        value={consultasHoje}
        sublabel={consultasHoje === 1 ? 'Agendada' : 'Agendadas'}
        highlight
      />
      <MetricCard
        icon={CalendarDays}
        label="Agenda da semana"
        value={agendaSemana}
        sublabel="Esta semana"
        highlight={false}
      />
      <MetricCard
        icon={CalendarCheck2}
        label="Concluídos hoje"
        value={concluidosHoje}
        sublabel={concluidosHoje === 1 ? 'Atendimento' : 'Atendimentos'}
        highlight
      />
    </div>
  );
}
