'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';
import { cn } from '@/lib/utils';
export function ClinicaNavigation({ podeAtender, nome }: { podeAtender: boolean; nome: string }) {
  const pathname = usePathname();
  const tabs = [{ href: '/clinica', label: 'Resultados da clínica' }, ...(podeAtender ? [{ href: '/clinica/meus-resultados', label: 'Meus resultados' }, { href: '/dashboard/meu-consultorio/precos', label: 'Procedimentos' }, { href: '/dashboard/meu-consultorio/estoque', label: 'Estoque' }] : [])];
  return <PageContainer variant="wide" className="!pb-0">
    <header className="mb-6"><h1 className="mb-1 font-heading text-3xl font-bold text-foreground md:text-4xl">Clínica</h1><p className="text-sm font-medium text-muted-foreground">{nome}</p></header>
    <nav aria-label="Visões da clínica" className="flex gap-2 overflow-x-auto border-b border-border">
      {tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? 'page' : undefined} className={cn('inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring', pathname === tab.href ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{tab.label}</Link>)}
    </nav>
  </PageContainer>;
}
