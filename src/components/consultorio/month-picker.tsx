'use client';

import { CalendarDays } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedMonth = searchParams.get('mes') ?? mes;

  return (
    <label className="relative flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground">
      <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Mês de referência</span>
      <select
        value={selectedMonth}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('mes', event.target.value);
          router.replace(`${pathname}?${params.toString()}`);
        }}
        className="appearance-none bg-transparent pr-4 text-sm font-medium text-foreground outline-none"
      >
        {getMonths(selectedMonth).map((month) => <option key={month} value={month}>{label(month)}</option>)}
      </select>
    </label>
  );
}
