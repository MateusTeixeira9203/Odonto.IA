'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Landmark, LayoutDashboard, Package, Users, WalletCards } from 'lucide-react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';
import { MonthPicker } from './month-picker';

type ClinicHubHeaderProps = {
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
  nomeClinica: string;
  title: 'Meu Consultório' | 'Minha Clínica';
  hasPersonalFinance: boolean;
  currentMonth: string;
};

const tabs = [
  { id: 'overview', label: 'Visão geral', path: '', icon: LayoutDashboard },
  { id: 'personal-finance', label: 'Meu financeiro', path: '/meu-financeiro', icon: WalletCards, personal: true },
  { id: 'clinic-finance', label: 'Financeiro da clínica', path: '/financeiro-clinica', icon: Landmark },
  { id: 'team', label: 'Minha equipe', path: '/equipe', icon: Users },
  { id: 'stock', label: 'Estoque', path: '/estoque', icon: Package },
] as const;

function pageTitle(pathname: string, title: ClinicHubHeaderProps['title']): string {
  if (pathname.includes('/meu-financeiro')) return 'Meu financeiro';
  if (pathname.includes('/financeiro-clinica')) return 'Financeiro da clínica';
  if (pathname.includes('/equipe')) return 'Minha equipe';
  if (pathname.includes('/estoque')) return 'Estoque';
  return title;
}

export function ClinicHubHeader({ basePath, nomeClinica, title, hasPersonalFinance, currentMonth }: ClinicHubHeaderProps): React.JSX.Element {
  const pathname = usePathname();
  return (
    <header className="space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-teal/20 bg-teal-pale text-teal-ink">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">{title} · {nomeClinica}</p>
            <h1 className="mt-1 font-heading text-4xl font-normal tracking-tight text-foreground sm:text-[44px]">{pageTitle(pathname, title)}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <MonthPicker mes={currentMonth} />
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label={`Seções de ${title}`} className={cn('grid gap-1 rounded-2xl border border-border bg-card p-1.5', hasPersonalFinance ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}>
        {tabs.filter((tab) => !('personal' in tab) || hasPersonalFinance).map((tab) => {
          const href = `${basePath}${tab.path}`;
          const active = tab.path ? pathname.startsWith(href) : pathname === basePath;
          const Icon = tab.icon;
          return (
            <Link key={tab.id} href={href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 text-center text-sm font-semibold transition-colors', active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
              <Icon className={cn('size-4 shrink-0', active && 'text-teal')} aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
