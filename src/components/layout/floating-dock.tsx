'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  LayoutDashboard, Users, Calendar, Wallet, Settings,
  Sun, Moon, User, LogOut, Bot, Check, ChevronsUpDown, Loader2,
} from 'lucide-react';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
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
import { useClinicSwitcher } from '@/hooks/use-clinic-switcher';

interface FloatingDockProps {
  nome: string;
  clinicaNome: string;
  activeClinicId: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
}

const ROLE_PT: Record<string, string> = {
  admin: 'Admin',
  dentista: 'Dentista',
  secretaria: 'Secretária',
};

const NAV_ITEMS = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Início',     id: 'dashboard' },
  { href: '/dashboard/pacientes',    icon: Users,           label: 'Pacientes',  id: 'pacientes' },
  { href: '/dashboard/agendamentos', icon: Calendar,        label: 'Agenda',     id: 'agenda' },
  { href: '/dashboard/financeiro',   icon: Wallet,          label: 'Financeiro', id: 'financeiro', requiresFeature: 'financeiro' as const },
  { href: '/dashboard/configuracoes',icon: Settings,        label: 'Config',     id: 'config',     adminOnly: true },
] as const;

export function FloatingDock({ nome, clinicaNome, activeClinicId, role, avatarUrl, plano }: FloatingDockProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { clinicas, loading: clinicasLoading, switching, switchClinic } = useClinicSwitcher();

  useEffect(() => { setMounted(true); }, []);

  const canSwitch = clinicas.length > 1;

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
      {/* ── Logo + nome ── */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0">
        <OdontoIALogo className="w-5 h-5 text-teal shrink-0" />
        <span className="font-bold text-[14px] tracking-[0.03em] text-white whitespace-nowrap">
          Odonto<span className="text-teal">.IA</span>
        </span>
      </div>

      {/* ── Separador ── */}
      <div className="w-px h-6 bg-white/[0.07] mx-1 shrink-0" />

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

      {/* ── Separador centro ── */}
      <div className="w-px h-6 bg-white/[0.07] mx-1 shrink-0" />

      {/* ── Dex ball ── */}
      <button
        title="Abrir DEX"
        onClick={() => window.dispatchEvent(new Event('dex-toggle'))}
        className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:scale-110 active:scale-95 transition-transform mx-1 outline-none"
        style={{
          background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)',
          boxShadow: '0 4px 16px -4px rgba(47,156,133,0.6)',
        }}
      >
        <Bot className="w-4 h-4 text-white" />
        <span className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: 'rgba(47,156,133,0.4)' }} />
      </button>

      {/* ── Toggle tema ── */}
      <button
        title={mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white/45 hover:text-white/80 hover:bg-white/[0.07] transition-all mx-0.5 outline-none"
      >
        {mounted && theme === 'dark'
          ? <Sun style={{ width: 18, height: 18 }} />
          : <Moon style={{ width: 18, height: 18 }} />
        }
      </button>

      {/* ── Separador direita ── */}
      <div className="w-px h-6 bg-white/[0.07] mx-1 shrink-0" />

      {/* ── Notification bell ── */}
      <div className="flex items-center justify-center px-1">
        <NotificationBell isExpanded={false} />
      </div>

      {/* ── Avatar + dropdown ── */}
      {/* Radix DropdownMenu só monta no cliente para evitar hydration mismatch com useId */}
      {mounted ? (
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            title={nome}
            className="relative ml-1 mr-1 hover:brightness-110 active:opacity-80 transition-all outline-none"
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
            className="rounded-2xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-150 min-w-[224px]"
            style={{ background: 'rgba(11,16,13,0.98)', border: '1px solid rgba(47,156,133,0.18)', backdropFilter: 'blur(12px)' }}
          >
            {/* User header */}
            <div className="px-2.5 py-3 border-b mb-1.5 flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden font-bold text-[11px] text-teal"
                style={{ background: 'rgba(47,156,133,0.18)', border: '1px solid rgba(47,156,133,0.28)' }}>
                {avatarUrl
                  ? <Image src={avatarUrl} alt={nome} width={36} height={36} className="w-full h-full object-cover" />
                  : avatarInitials}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white leading-tight truncate">{nome}</div>
                <div className="text-[11px] truncate mt-0.5 font-medium" style={{ color: 'rgba(47,156,133,0.75)' }}>{clinicaNome}</div>
              </div>
            </div>

            {/* Clinic switcher */}
            {clinicasLoading ? (
              <div className="px-2.5 py-2 mb-1.5">
                <div className="h-6 w-32 rounded-lg bg-white/[0.06] animate-pulse" />
              </div>
            ) : canSwitch ? (
              <div className="mb-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-2.5 pt-1 pb-0.5">
                  <span className="text-[10px] text-white/30 font-mono uppercase tracking-[0.15em]">
                    Clínicas
                  </span>
                </div>
                {clinicas.map((clinica) => {
                  const isActive = clinica.id === activeClinicId;
                  return (
                    <DropdownMenu.Item
                      key={clinica.id}
                      disabled={isActive || switching}
                      onSelect={() => { void switchClinic(clinica.id); }}
                      className={`flex items-center gap-2.5 px-2 py-2 rounded-xl outline-none cursor-pointer transition-all text-sm ${
                        isActive
                          ? 'text-teal bg-teal/[0.08] cursor-default'
                          : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: isActive ? 'rgba(47,156,133,0.18)' : 'rgba(255,255,255,0.05)' }}>
                        {isActive
                          ? <Check className="w-3.5 h-3.5 text-teal" />
                          : switching
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        }
                      </div>
                      <span className="flex-1 truncate">{clinica.nome}</span>
                      <span className="text-[10px] font-mono text-white/28 shrink-0">
                        {ROLE_PT[clinica.role] ?? clinica.role}
                      </span>
                    </DropdownMenu.Item>
                  );
                })}
                <div className="pb-1.5" />
              </div>
            ) : null}

            {/* Perfil */}
            <DropdownMenu.Item
              onSelect={() => router.push('/dashboard/perfil')}
              className="flex items-center gap-2.5 px-2 py-2 text-sm text-white/55 hover:text-white hover:bg-white/[0.06] rounded-xl outline-none cursor-pointer transition-all group"
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-white/[0.08]"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <User className="w-3.5 h-3.5" />
              </div>
              Meu Perfil
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px my-1.5 mx-1" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* Sair */}
            <DropdownMenu.Item
              onSelect={() => { void handleLogout(); }}
              className="flex items-center gap-2.5 px-2 py-2 text-sm text-white/40 hover:text-red-400 hover:bg-red-400/[0.08] rounded-xl outline-none cursor-pointer transition-all group"
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-red-400/[0.12]"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <LogOut className="w-3.5 h-3.5" />
              </div>
              Sair
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      ) : (
        /* Fallback estático durante SSR/hydration — sem Radix, sem mismatch */
        <button
          title={nome}
          className="relative ml-1 mr-1 outline-none"
          aria-label="Menu do usuário"
        >
          <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white font-bold text-[11px] ring-2 ring-teal/20 overflow-hidden">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={nome} width={32} height={32} className="w-full h-full object-cover" />
            ) : avatarInitials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-[1.5px] border-[#0c110e]" />
        </button>
      )}
    </motion.div>
  );
}
