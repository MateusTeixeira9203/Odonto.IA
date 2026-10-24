interface MetricsCardsProps {
  consultasHoje: number;
  agendaSemana: number;
  concluidosHoje: number;
}

interface MetricCardProps {
  label: string;
  value: number;
  context: string;
  highlight?: boolean;
}

function MetricCard({ label, value, context, highlight = false }: MetricCardProps) {
  const displayValue = String(value).padStart(2, '0');

  return (
    <div className="min-w-0 px-6 py-[18px]">
      <dt className="text-[12.5px] text-text-secondary">{label}</dt>
      <dd className={`mt-1 font-mono text-[21px] font-medium ${highlight ? 'text-teal-ink' : 'text-text-primary'}`}>
        {displayValue}
      </dd>
      <dd className="mt-1 text-[12px] text-text-secondary">{context}</dd>
    </div>
  );
}

export function MetricsCards({
  consultasHoje,
  agendaSemana,
  concluidosHoje,
}: MetricsCardsProps) {
  return (
    <dl
      id="dex-tour-metrics"
      className="mb-6 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-surface max-[600px]:grid-cols-1 max-[600px]:divide-x-0 max-[600px]:divide-y"
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
        context="Esta semana"
        highlight={false}
      />
      <MetricCard
        label="Concluídos hoje"
        value={concluidosHoje}
        context={concluidosHoje === 0 ? 'Nenhum ainda' : 'Finalizados hoje'}
        highlight={false}
      />
    </dl>
  );
}
