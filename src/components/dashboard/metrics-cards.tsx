interface MetricsCardsProps {
  consultasHoje: number;
  agendaSemana: number;
  concluidosHoje: number;
}

interface MetricCardProps {
  label: string;
  value: number;
  context: string;
  highlight: boolean;
}

function MetricCard({ label, value, context, highlight }: MetricCardProps) {
  const active = highlight && value > 0;
  const displayValue = String(value).padStart(2, '0');

  return (
    <div className="group relative bg-surface p-6 rounded-3xl border border-border hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden cursor-default">
      {/* Bottom accent for active state */}
      {active && (
        <div
          className="absolute inset-x-0 bottom-0 h-[2px]"
          style={{
            background:
              'linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.3) 60%, transparent 100%)',
          }}
        />
      )}

      {/* Dominant number */}
      <div
        className={`font-heading font-bold text-6xl md:text-7xl leading-none tracking-tight mb-4 transition-colors ${
          active ? 'text-text-primary' : 'text-text-primary/40'
        }`}
      >
        {displayValue}
      </div>

      {/* Label */}
      <p className="text-sm font-semibold text-text-primary leading-snug mb-2">{label}</p>

      {/* Context */}
      <p className={`text-xs tracking-wide ${active ? 'text-teal' : 'text-text-secondary'}`}>{context}</p>
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
        label="Consultas hoje"
        value={consultasHoje}
        context={consultasHoje === 0 ? 'Nenhum hoje' : 'Agendadas para hoje'}
        highlight
      />
      <MetricCard
        label="Agenda da semana"
        value={agendaSemana}
        context="Próximos 7 dias"
        highlight={false}
      />
      <MetricCard
        label="Concluídos hoje"
        value={concluidosHoje}
        context={concluidosHoje === 0 ? 'Nenhum ainda' : 'Finalizados hoje'}
        highlight
      />
    </div>
  );
}
