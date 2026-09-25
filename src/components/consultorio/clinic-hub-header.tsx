'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Landmark, LayoutDashboard, Package, Users, WalletCards } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MonthPicker } from './month-picker';

type ClinicHubHeaderProps = {
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
  nomeClinica: string;
  hasPersonalFinance: boolean;
  isSecretary: boolean;
  roleLabel: string;
  currentMonth: string;
};

const tabs = [
  { id: 'overview', label: 'Visão geral', path: '', icon: LayoutDashboard },
  { id: 'personal-finance', label: 'Meu financeiro', path: '/meu-financeiro', icon: WalletCards, personal: true },
  { id: 'clinic-finance', label: 'Financeiro da clínica', path: '/financeiro-clinica', icon: Landmark },
  { id: 'team', label: 'Minha equipe', path: '/equipe', icon: Users },
  { id: 'stock', label: 'Estoque', path: '/estoque', icon: Package },
] as const;

function pageMetadata(pathname: string): { title: string; subtitle: string } {
  if (pathname.includes('/meu-financeiro')) {
    return { title: 'Meu financeiro', subtitle: 'O que pertence ao dentista muda conforme o modelo e o contrato.' };
  }
  if (pathname.includes('/financeiro-clinica')) {
    return { title: 'Financeiro da clínica', subtitle: 'Resultado, previsão e fatos — sem saldo inventado.' };
  }
  if (pathname.includes('/equipe')) {
    return { title: 'Minha equipe', subtitle: 'Contratos, pessoas e permissões.' };
  }
  if (pathname.includes('/estoque')) {
    return { title: 'Estoque', subtitle: 'Alertas, reposição e entrada de materiais.' };
  }
  return { title: 'Visão geral', subtitle: 'O que merece sua atenção — antes dos relatórios.' };
}

export function ClinicHubHeader({ basePath, nomeClinica, hasPersonalFinance, isSecretary, roleLabel, currentMonth }: ClinicHubHeaderProps): React.JSX.Element {
  const pathname = usePathname();
  const page = pageMetadata(pathname);
  return (
    <header className="space-y-4 sm:space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">Meu consultório · {nomeClinica}</p>
          <h1 className="mt-1 font-heading text-4xl font-normal tracking-tight text-foreground sm:text-[44px]">{page.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{page.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="hidden rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground sm:inline">{roleLabel}</span>
          <MonthPicker mes={currentMonth} />
        </div>
      </div>
      <nav aria-label="Seções do meu consultório" className="-mx-4 overflow-x-auto border-y border-border bg-surface px-4 py-1.5 [scroll-snap-type:x_proximity] [scrollbar-width:none] sm:mx-0 sm:rounded-2xl sm:border sm:p-1.5 [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1 sm:min-w-0 sm:w-full">
          {tabs.filter((tab) => (!('personal' in tab) || hasPersonalFinance) && (!isSecretary || tab.id === 'overview')).map((tab) => {
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
