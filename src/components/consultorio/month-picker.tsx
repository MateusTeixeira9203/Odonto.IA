'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

function getMonths(reference: string): string[] {
  const [year, month] = reference.split('-').map(Number);
  return Array.from({ length: 13 }, (_, index) => {
    const date = new Date(year, month - 1 - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function label(month: string): string {
  const [year, value] = month.split('-').map(Number);
  const formatted = MONTH_FORMATTER.format(new Date(year, value - 1, 1));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function MonthPicker({ mes }: { mes: string }): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="sr-only">
      Mês de referência
      <select
        value={mes}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('mes', event.target.value);
          router.push(`?${params.toString()}`);
        }}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-teal"
      >
        {getMonths(mes).map((month) => <option key={month} value={month}>{label(month)}</option>)}
      </select>
    </label>
  );
}
