'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Landmark, LayoutDashboard, Package, Users, WalletCards } from 'lucide-react';

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
    <header className="space-y-4 sm:space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-teal/20 bg-teal-pale text-teal-ink">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">{title} · {nomeClinica}</p>
            <h1 className="mt-1 font-heading text-4xl font-normal tracking-tight text-foreground sm:text-[44px]">{pageTitle(pathname, title)}</h1>
          </div>
        </div>
        <div className="self-start sm:self-auto">
          <MonthPicker mes={currentMonth} />
        </div>
      </div>
      <nav aria-label={`Seções de ${title}`} className="-mx-4 overflow-x-auto border-y border-border bg-card px-4 py-1.5 [scroll-snap-type:x_proximity] [scrollbar-width:none] sm:mx-0 sm:rounded-2xl sm:border sm:p-1.5 [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1 sm:min-w-0 sm:w-full">
          {tabs.filter((tab) => !('personal' in tab) || hasPersonalFinance).map((tab) => {
            const href = `${basePath}${tab.path}`;
            const active = tab.path ? pathname.startsWith(href) : pathname === basePath;
            const Icon = tab.icon;
            return (
              <Link key={tab.id} href={href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 motion-reduce:transition-none sm:min-h-14 sm:flex-1 sm:justify-center', active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-[0.98]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-background')}>
                <Icon className={cn('size-4 shrink-0', active && 'text-teal')} aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
