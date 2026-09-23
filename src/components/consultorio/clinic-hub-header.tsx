import Link from 'next/link';
import { Building2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type ClinicHubHeaderProps = {
  active: 'overview' | 'personal-finance' | 'clinic-finance' | 'team' | 'stock';
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
  nomeClinica: string;
  title: 'Meu Consultório' | 'Minha Clínica';
  hasPersonalFinance: boolean;
};

const tabs = [
  { id: 'overview', label: 'Visão geral', path: '' },
  { id: 'personal-finance', label: 'Meu financeiro', path: '/meu-financeiro', personal: true },
  { id: 'clinic-finance', label: 'Financeiro da clínica', path: '/financeiro-clinica' },
  { id: 'team', label: 'Minha equipe', path: '/equipe' },
  { id: 'stock', label: 'Estoque', path: '/estoque' },
] as const;

export function ClinicHubHeader({ active, basePath, nomeClinica, title, hasPersonalFinance }: ClinicHubHeaderProps): React.JSX.Element {
  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-pale text-teal-ink">
            <Building2 className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">{title} · {nomeClinica}</p>
            <h1 className="mt-1 font-heading text-3xl text-text-primary">{active === 'clinic-finance' ? 'Financeiro da clínica' : title}</h1>
          </div>
        </div>
      </div>
      <nav aria-label={`Seções de ${title}`} className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-alt p-1">
        {tabs.filter((tab) => !('personal' in tab) || hasPersonalFinance).map((tab) => (
          <Link
            key={tab.id}
            href={`${basePath}${tab.path}`}
            className={cn(
              'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active === tab.id ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:bg-surface/60 hover:text-text-primary',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
