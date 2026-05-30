'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Sun,
  Moon,
  Wallet,
  Lock,
  Search,
} from 'lucide-react';
import type { PlanoId } from '@/lib/planos';
import { temFeature } from '@/lib/planos';
import { motion, AnimatePresence } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { DentistaRole } from '@/types/database';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
import { NotificationBell } from '@/components/layout/notification-bell';
import { ClinicSwitcher } from '@/components/layout/clinic-switcher';
import Image from 'next/image';

export interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  nome: string;
  clinicaNome: string;
  activeClinicId: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
  onOpenSearch?: () => void;
}

export function SidebarContent({ isExpanded, onToggle, nome, clinicaNome, activeClinicId, role, avatarUrl, plano, onOpenSearch }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const showConfig = role === 'admin';
  const financeiroLocked = !temFeature(plano ?? 'CLINICA', 'financeiro');

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const allNavItems = [
    { href: '/dashboard',               icon: LayoutDashboard, label: 'Início',        id: 'dashboard-link',    visible: true,       locked: false },
    { href: '/dashboard/pacientes',     icon: Users,           label: 'Pacientes',     id: 'pacientes-link',    visible: true,       locked: false },
    { href: '/dashboard/agendamentos',  icon: Calendar,        label: 'Agenda',        id: 'agendamentos-link', visible: true,       locked: false },
    { href: '/dashboard/financeiro',    icon: Wallet,          label: 'Financeiro',    id: 'financeiro-link',   visible: true,       locked: financeiroLocked },
    { href: '/dashboard/configuracoes', icon: Settings,        label: 'Configurações', id: 'configuracoes-link',visible: showConfig, locked: false },
  ];

  const navItems = allNavItems.filter((item) => item.visible);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 256 : 72 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      id="sidebar"
      className="bg-brand-charcoal border-r border-white/[0.04] flex flex-col h-screen sticky top-0 z-20 relative overflow-hidden"
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        title={isExpanded ? 'Recolher' : 'Expandir'}
        className="absolute -right-3 top-9 w-6 h-6 bg-brand-charcoal border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:border-teal/40 active:scale-90 transition-all z-30"
      >
        {isExpanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Logo */}
      <div className={`flex items-center gap-3 px-5 pt-6 pb-5 ${!isExpanded && 'justify-center px-0'}`}>
        <OdontoIALogo className="w-6 h-6 text-teal shrink-0" />
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <span className="font-bold text-[16px] tracking-[0.04em] text-white block leading-none whitespace-nowrap">
                Odonto<span className="text-teal">.</span><span className="text-teal-lt font-semibold">IA</span>
              </span>
              <span className="font-mono text-[9px] tracking-[0.18em] text-white/25 uppercase mt-1 block whitespace-nowrap">
                Inteligência
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Clinic Switcher */}
      <ClinicSwitcher
        isExpanded={isExpanded}
        activeClinicId={activeClinicId}
        activeClinicNome={clinicaNome}
      />

      {/* Separator */}
      <div className="mx-3 mb-3 border-t border-white/[0.05]" />

      {/* Search / Command Palette trigger */}
      <div className="px-2 mb-2">
        <button
          onClick={onOpenSearch}
          title="Buscar (⌘K)"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group w-full border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-teal/20 ${!isExpanded && 'justify-center'}`}
        >
          <Search className="w-3.5 h-3.5 text-white/35 group-hover:text-teal/70 shrink-0 transition-colors" />
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-between flex-1 overflow-hidden"
              >
                <span className="text-white/35 group-hover:text-white/60 transition-colors text-xs font-medium whitespace-nowrap">
                  Buscar...
                </span>
                <span className="font-mono text-[9px] text-white/20 group-hover:text-teal/40 transition-colors whitespace-nowrap ml-2">
                  ⌘K
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              id={item.id}
              href={item.href}
              title={!isExpanded ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-teal/[0.10] text-teal border-l-2 border-teal'
                  : item.locked
                    ? 'text-white/25 hover:bg-white/[0.04] hover:text-white/40 border-l-2 border-transparent'
                    : 'text-white/50 hover:bg-white/[0.06] hover:text-white/90 border-l-2 border-transparent'
              } ${!isExpanded && 'justify-center'}`}
            >
              <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                isActive ? 'text-teal' : item.locked ? 'text-white/20' : 'text-white/35 group-hover:text-white/70'
              }`} />
              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.18 }}
                    className="whitespace-nowrap overflow-hidden flex items-center gap-1.5 flex-1"
                  >
                    {item.label}
                    {item.locked && <Lock className="w-3 h-3 text-teal/50 ml-auto shrink-0" />}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.05] p-2 space-y-0.5">
        {/* Notification Bell */}
        <NotificationBell isExpanded={isExpanded} />

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group text-white/40 hover:bg-white/[0.06] hover:text-white/90 border-l-2 border-transparent w-full ${!isExpanded && 'justify-center'}`}
        >
          {mounted && (theme === 'dark' ? (
            <Sun className="w-4 h-4 shrink-0 text-white/35 group-hover:text-white/70" />
          ) : (
            <Moon className="w-4 h-4 shrink-0 text-white/35 group-hover:text-white/70" />
          ))}
          {!mounted && <div className="w-4 h-4 shrink-0" />}
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                className="whitespace-nowrap overflow-hidden"
              >
                {mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User Profile */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              title={!isExpanded ? nome : undefined}
              className={`mt-1 px-3 flex items-center gap-3 w-full hover:bg-white/[0.06] py-2 rounded-lg transition-colors cursor-pointer border-l-2 border-transparent ${!isExpanded && 'justify-center'}`}
            >
              <div className="w-7 h-7 rounded-full bg-teal flex items-center justify-center text-white font-bold text-[11px] shrink-0 overflow-hidden ring-2 ring-teal/25">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={nome} width={28} height={28} className="w-full h-full object-cover" />
                ) : (
                  nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>
              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-left overflow-hidden"
                  >
                    <div className="text-[12px] font-semibold text-white/80 whitespace-nowrap truncate max-w-[120px]">{nome}</div>
                    <div className="text-[10px] text-white/30 font-mono whitespace-nowrap truncate max-w-[120px]">{clinicaNome}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[160px] rounded-xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in duration-200 text-white"
              style={{ background: 'rgba(13,13,13,0.97)', border: '1px solid rgba(47,156,133,0.15)' }}
              sideOffset={10}
              align={isExpanded ? 'start' : 'center'}
              side="right"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg outline-none cursor-pointer transition-colors"
                onSelect={() => router.push('/dashboard/perfil')}
              >
                <User className="w-4 h-4" />
                Meu Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-white/[0.06] my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg outline-none cursor-pointer transition-colors"
                onSelect={() => { void handleLogout(); }}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </motion.aside>
  );
}

export default SidebarContent;
