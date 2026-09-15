'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, Stethoscope, Package } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { cn } from '@/lib/utils';

const SECOES = [
  { href: '/dashboard/meu-consultorio/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/dashboard/meu-consultorio/precos', label: 'Procedimentos', icon: Stethoscope },
  { href: '/dashboard/meu-consultorio/estoque', label: 'Estoque', icon: Package },
] as const;

export function ConsultorioNavigation() {
  const pathname = usePathname();

  return (
    <PageContainer variant="wide" className="!pb-0">
      <header className="mb-6">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-1">Consultório</h1>
        <p className="text-muted-foreground text-sm font-medium">Seu financeiro, procedimentos e materiais.</p>
      </header>
      <nav aria-label="Seções do consultório" className="flex gap-1 overflow-x-auto border-b border-border sm:gap-2">
        {SECOES.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              id={label === 'Procedimentos' ? 'dex-tour-procedimentos' : undefined}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-1 border-b-2 px-3 text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-2 sm:px-4',
                active ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              <Icon aria-hidden="true" className="hidden size-4 sm:block" />
              {label}
            </Link>
          );
        })}
      </nav>
    </PageContainer>
  );
}
