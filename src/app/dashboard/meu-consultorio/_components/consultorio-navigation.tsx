'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, Tags } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { cn } from '@/lib/utils';

const SECOES = [
  { href: '/dashboard/meu-consultorio/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/dashboard/meu-consultorio/precos', label: 'Preços', icon: Tags },
] as const;

export function ConsultorioNavigation() {
  const pathname = usePathname();

  return (
    <PageContainer variant="wide" className="!pb-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consultório</p>
      <nav aria-label="Seções do consultório" className="flex gap-2 border-b border-border">
        {SECOES.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                active ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </PageContainer>
  );
}
