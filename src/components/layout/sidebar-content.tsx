'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  Calendar,
  ChevronsLeft,
  LogOut,
  User,
  Sun,
  Moon,
  Wallet,
  FileText,
  Lock,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  id: string;
  visible: boolean;
  locked: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export function SidebarContent({
  isExpanded,
  onToggle,
  nome,
  clinicaNome,
  activeClinicId,
  role,
  avatarUrl,
  plano,
}: SidebarProps) {
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

  const allNavGroups: NavGroup[] = [
    {
      label: 'ATENDIMENTO',
      items: [
        { href: '/dashboard',              icon: LayoutDashboard, label: 'Início',        id: 'dashboard-link',    visible: true,       locked: false },
        { href: '/dashboard/pacientes',    icon: Users,           label: 'Pacientes',     id: 'pacientes-link',    visible: true,       locked: false },
        { href: '/dashboard/agendamentos', icon: Calendar,        label: 'Agenda',        id: 'agendamentos-link', visible: true,       locked: false },
      ],
    },
    {
      label: 'GESTÃO',
      items: [
        { href: '/dashboard/financeiro',  icon: Wallet,    label: 'Financeiro', id: 'financeiro-link',  visible: true, locked: financeiroLocked },
        { href: '/dashboard/orcamentos',  icon: FileText,  label: 'Orçamentos', id: 'orcamentos-link',  visible: true, locked: false },
      ],
    },
    {
      label: 'SISTEMA',
      items: [
        { href: '/dashboard/configuracoes',icon: Settings,        label: 'Configurações', id: 'configuracoes-link',visible: showConfig, locked: false },
      ],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter((i) => i.visible) }))
    .filter((group) => group.items.length > 0);

  const avatarInitials = nome
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 256 : 72 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      id="sidebar"
      className="bg-brand-charcoal border-r border-white/[0.05] flex flex-col h-screen sticky top-0 z-20 overflow-hidden"
    >
      {/* ── Header: adapta entre row (expandido) e coluna (recolhido) ── */}
      <div
        className={`flex shrink-0 ${
          isExpanded
            ? 'flex-row items-center gap-3 px-5 pt-6 pb-5'
            : 'flex-col items-center gap-2.5 pt-5 pb-4'
        }`}
      >
        <OdontoIALogo className="w-6 h-6 text-teal shrink-0" />

        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              className="flex-1 min-w-0"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <span className="font-bold text-[16px] tracking-[0.04em] text-white block leading-none whitespace-nowrap">
                Odonto<span className="text-teal">.</span><span className="text-teal-lt font-semibold">IA</span>
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] text-white/20 uppercase mt-1 block whitespace-nowrap">
                Inteligência
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle com borda premium */}
        <button
          onClick={onToggle}
          title={isExpanded ? 'Recolher' : 'Expandir'}
          className="w-10 h-10 rounded-xl border border-white/[0.12] bg-white/[0.04]
            flex items-center justify-center text-white/55
            hover:border-white/[0.25] hover:bg-white/[0.08] hover:text-white/85
            active:scale-95 transition-all shrink-0"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 0 : 180 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <ChevronsLeft className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* ── Separador plataforma → clínica ── */}
      <div className="mx-4 mb-3 border-t border-white/[0.06] shrink-0" />

      {/* ── Workspace da Clínica (visível apenas expandido) ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden shrink-0"
          >
            <ClinicSwitcher
              isExpanded={isExpanded}
              activeClinicId={activeClinicId}
              activeClinicNome={clinicaNome}
            />
            <div className="mx-4 mt-1 mb-2 border-t border-white/[0.06]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navegação por grupos ── */}
      <nav className="flex-1 px-2 pt-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {allNavGroups.map((group, gIdx) => (
          <div key={group.label}>
            {gIdx > 0 && (
              <div className="mx-1 my-3 border-t border-white/[0.06]" />
            )}

            {/* Label do grupo */}
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="px-3 mb-1.5"
                >
                  <span className="text-xs font-medium tracking-widest text-white/38 uppercase select-none">
                    {group.label}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Itens */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    id={item.id}
                    href={item.href}
                    title={!isExpanded ? item.label : undefined}
                    className={`relative flex items-center gap-3 py-2 rounded-xl transition-all duration-150 group ${
                      !isExpanded ? 'justify-center px-1' : 'px-2'
                    } ${
                      isActive
                        ? 'bg-teal/10'
                        : item.locked
                          ? ''
                          : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Indicador ativo */}
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active-pill"
                        className="absolute left-0 inset-y-2 w-[3px] rounded-r-full bg-teal"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}

                    {/* Icon box */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-teal/15'
                          : item.locked
                            ? 'bg-white/[0.04]'
                            : 'bg-white/[0.07] group-hover:bg-white/[0.11]'
                      }`}
                    >
                      <item.icon
                        className={`transition-colors ${
                          isActive
                            ? 'text-teal'
                            : item.locked
                              ? 'text-white/20'
                              : 'text-white/55 group-hover:text-white/85'
                        }`}
                        style={{ width: 20, height: 20 }}
                      />
                    </div>

                    <AnimatePresence mode="wait">
                      {isExpanded && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.18 }}
                          className={`whitespace-nowrap overflow-hidden flex items-center gap-1.5 flex-1 text-[15px] font-medium transition-colors ${
                            isActive
                              ? 'text-teal'
                              : item.locked
                                ? 'text-white/20'
                                : 'text-white/70 group-hover:text-white/92'
                          }`}
                        >
                          {item.label}
                          {item.locked && (
                            <Lock className="w-3 h-3 text-teal/40 ml-auto shrink-0" />
                          )}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Separador nav → utilitários ── */}
      <div className="mx-4 mt-1 border-t border-white/[0.06] shrink-0" />

      {/* ── Utilitários ── */}
      <div className="py-1 px-2 space-y-0.5 shrink-0">
        <NotificationBell isExpanded={isExpanded} />

        {/* Modo Escuro / Claro */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
          className={`flex items-center gap-3 py-2 rounded-xl transition-all group w-full hover:bg-white/[0.05] ${
            !isExpanded ? 'justify-center px-1' : 'px-2'
          }`}
        >
          {/* Icon box */}
          <div className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center shrink-0 group-hover:bg-white/[0.11] transition-colors">
            {mounted && theme === 'dark' && (
              <Sun style={{ width: 20, height: 20 }} className="text-white/55 group-hover:text-white/85 transition-colors" />
            )}
            {mounted && theme !== 'dark' && (
              <Moon style={{ width: 20, height: 20 }} className="text-white/55 group-hover:text-white/85 transition-colors" />
            )}
            {!mounted && <div style={{ width: 20, height: 20 }} />}
          </div>

          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                className="whitespace-nowrap overflow-hidden flex-1 text-[15px] font-medium text-white/70 group-hover:text-white/92 transition-colors text-left"
              >
                {mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
              </motion.span>
            )}
          </AnimatePresence>

        </button>
      </div>

      {/* ── Separador utilitários → perfil ── */}
      <div className="mx-4 border-t border-white/[0.06] shrink-0" />

      {/* ── Perfil do Usuário ── */}
      <div className="p-2 shrink-0">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              title={!isExpanded ? nome : undefined}
              className={`flex items-center gap-3 w-full hover:bg-white/[0.06] py-2.5 rounded-xl transition-colors cursor-pointer group ${
                !isExpanded ? 'justify-center px-1' : 'px-2'
              }`}
            >
              {/* Avatar com indicador online */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-teal flex items-center justify-center text-white font-bold text-[12px] overflow-hidden ring-2 ring-teal/20">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={nome}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    avatarInitials
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal border-2 border-brand-charcoal" />
              </div>

              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-left overflow-hidden flex-1 min-w-0"
                  >
                    <div className="text-[14px] font-semibold text-white/90 whitespace-nowrap truncate">
                      {nome}
                    </div>
                    <div className="text-[11px] text-white/35 whitespace-nowrap truncate mt-0.5">
                      {clinicaNome}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="shrink-0"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/45 transition-colors" />
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
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/55 hover:text-white hover:bg-white/[0.06] rounded-lg outline-none cursor-pointer transition-colors"
                onSelect={() => router.push('/dashboard/perfil')}
              >
                <User className="w-4 h-4" />
                Meu Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-white/[0.07] my-1" />
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
