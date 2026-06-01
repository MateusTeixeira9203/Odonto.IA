'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  LayoutDashboard, Users, Calendar, Wallet, Settings,
  Sun, Moon, User, LogOut,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { temFeature } from '@/lib/planos';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { DockNavItem } from './dock-nav-item';
import { NotificationBell } from './notification-bell';

interface FloatingDockProps {
  nome: string;
  clinicaNome: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
}

const NAV_ITEMS = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Início',     id: 'dashboard' },
  { href: '/dashboard/pacientes',    icon: Users,           label: 'Pacientes',  id: 'pacientes' },
  { href: '/dashboard/agendamentos', icon: Calendar,        label: 'Agenda',     id: 'agenda' },
  { href: '/dashboard/financeiro',   icon: Wallet,          label: 'Financeiro', id: 'financeiro', requiresFeature: 'financeiro' as const },
  { href: '/dashboard/configuracoes',icon: Settings,        label: 'Config',     id: 'config',     adminOnly: true },
] as const;

export function FloatingDock({ nome, clinicaNome, role, avatarUrl, plano }: FloatingDockProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const avatarInitials = nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const financeiroLocked = !temFeature(plano ?? 'SOLO', 'financeiro');

  const visibleItems = NAV_ITEMS.filter(item => {
    if ('adminOnly' in item && item.adminOnly && role !== 'admin') return false;
    return true;
  });

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-1 px-2 py-2 rounded-2xl"
      style={{
        background: 'rgba(12, 17, 14, 0.88)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 40px -8px rgba(47,156,133,0.22), 0 2px 12px -4px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Nav items ── */}
      {visibleItems.map(item => {
        const isActive = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(item.href);
        const locked = 'requiresFeature' in item && item.requiresFeature === 'financeiro'
          ? financeiroLocked
          : false;

        return (
          <DockNavItem
            key={item.id}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={isActive}
            locked={locked}
          />
        );
      })}

      {/* ── Separador ── */}
      <div className="w-px h-6 bg-white/[0.07] mx-1 shrink-0" />

      {/* ── Notification bell ── */}
      <div className="flex items-center justify-center px-1">
        <NotificationBell isExpanded={false} />
      </div>

      {/* ── Avatar + dropdown ── */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            title={nome}
            className="relative ml-1 mr-1 hover:scale-105 active:scale-95 transition-transform outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white font-bold text-[11px] ring-2 ring-teal/20 overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={nome} width={32} height={32} className="w-full h-full object-cover" />
              ) : avatarInitials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-[1.5px] border-[#0c110e]" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            sideOffset={12}
            align="end"
            className="rounded-xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in duration-200 min-w-[200px] text-white"
            style={{ background: 'rgba(12,17,14,0.97)', border: '1px solid rgba(47,156,133,0.12)' }}
          >
            {/* User header */}
            <div className="px-3 py-2.5 border-b border-white/[0.06] mb-1">
              <div className="text-[13px] font-semibold text-white/90 truncate">{nome}</div>
              <div className="text-[11px] text-white/35 truncate mt-0.5">{clinicaNome}</div>
            </div>

            {/* Tema */}
            <DropdownMenu.Item
              onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/55 hover:text-white hover:bg-white/[0.06] rounded-lg outline-none cursor-pointer transition-colors"
            >
              {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
            </DropdownMenu.Item>

            {/* Perfil */}
            <DropdownMenu.Item
              onSelect={() => router.push('/dashboard/perfil')}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/55 hover:text-white hover:bg-white/[0.06] rounded-lg outline-none cursor-pointer transition-colors"
            >
              <User className="w-4 h-4" />
              Meu Perfil
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-white/[0.06] my-1" />

            {/* Sair */}
            <DropdownMenu.Item
              onSelect={() => { void handleLogout(); }}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg outline-none cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </motion.div>
  );
}
