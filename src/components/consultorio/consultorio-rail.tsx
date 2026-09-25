'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Calendar, CalendarClock, Home, Moon, Settings, Sun, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
import { cn } from '@/lib/utils';

type ConsultorioRailProps = { canManageSettings: boolean };

const items = [
  { href: '/dashboard', icon: Home, label: 'Início', exact: true },
  { href: '/dashboard/meu-dia', icon: CalendarClock, label: 'Meu dia' },
  { href: '/dashboard/meu-consultorio', icon: Building2, label: 'Meu consultório' },
  { href: '/dashboard/pacientes', icon: Users, label: 'Pacientes' },
  { href: '/dashboard/agendamentos', icon: Calendar, label: 'Agenda' },
] as const;

const subscribeMounted = () => () => {};

export function ConsultorioRail({ canManageSettings }: ConsultorioRailProps): React.JSX.Element {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);

  return <aside aria-label="Navegação principal" className="fixed inset-y-0 left-0 z-50 hidden w-[72px] flex-col items-center border-r border-white/[0.07] bg-brand-charcoal py-4 lg:flex">
    <Link href="/dashboard" aria-label="Odonto.IA" className="mb-8 flex size-10 items-center justify-center rounded-xl border border-white/[0.08] text-teal transition-colors hover:border-teal/60">
      <OdontoIALogo className="size-5" aria-hidden="true" />
    </Link>
    <nav className="flex w-full flex-col items-center gap-2">
      {items.map((item) => {
        const active = ('exact' in item && item.exact) ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} title={item.label} aria-current={active ? 'page' : undefined} className={cn('flex size-11 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white', active && 'bg-teal/15 text-teal')}>
          <Icon className="size-[18px]" aria-hidden="true" />
          <span className="sr-only">{item.label}</span>
        </Link>;
      })}
    </nav>
    <div className="mt-auto flex flex-col items-center gap-2">
      <button type="button" title={mounted ? (theme === 'dark' ? 'Modo claro' : 'Modo escuro') : 'Tema'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex size-11 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white">
        {mounted && theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        <span className="sr-only">Alternar tema</span>
      </button>
      {canManageSettings && <Link href="/dashboard/configuracoes" title="Configurações" className="flex size-11 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"><Settings className="size-[18px]" aria-hidden="true" /><span className="sr-only">Configurações</span></Link>}
    </div>
  </aside>;
}
