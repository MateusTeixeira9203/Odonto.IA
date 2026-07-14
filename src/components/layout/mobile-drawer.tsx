'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, Calendar, Wallet, Settings,
  X, LogOut, Sun, Moon, Lock, Loader2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { temFeature } from '@/lib/planos';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
import { useLogout } from '@/hooks/use-logout';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  nome: string;
  clinicaNome: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
}

const NAV_ITEMS = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Início' },
  { href: '/dashboard/pacientes',    icon: Users,           label: 'Pacientes' },
  { href: '/dashboard/agendamentos', icon: Calendar,        label: 'Agenda' },
  { href: '/dashboard/financeiro',   icon: Wallet,          label: 'Financeiro', requiresFeature: 'financeiro' as const },
  { href: '/dashboard/configuracoes',icon: Settings,        label: 'Configurações', hideFromSecretaria: true },
] as const;

export function MobileDrawer({ open, onClose, nome, clinicaNome, role, avatarUrl, plano }: MobileDrawerProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { logout, isLoggingOut } = useLogout();

  useEffect(() => { setMounted(true); }, []);

  const avatarInitials = nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const financeiroLocked = !temFeature(plano ?? 'SOLO', 'financeiro');

  const visibleItems = NAV_ITEMS.filter(item => !('hideFromSecretaria' in item && item.hideFromSecretaria && role === 'secretaria'));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-[70] w-72 flex flex-col md:hidden"
            style={{
              background: 'rgba(12, 17, 14, 0.97)',
              backdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <OdontoIALogo className="w-5 h-5 text-teal" />
                <span className="font-bold text-[15px] text-white">
                  Odonto<span className="text-teal">.IA</span>
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.07] transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* User info */}
            <div className="px-4 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-teal flex items-center justify-center text-white font-bold text-[12px] overflow-hidden ring-2 ring-teal/20">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={nome} width={36} height={36} className="w-full h-full object-cover" />
                    ) : avatarInitials}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-[1.5px] border-[#0c110e]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white/90 truncate">{nome}</div>
                  <div className="text-[11px] text-white/35 truncate">{clinicaNome}</div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {visibleItems.map(item => {
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);
                const locked = 'requiresFeature' in item && item.requiresFeature === 'financeiro'
                  ? financeiroLocked
                  : false;

                return (
                  <Link
                    key={item.href}
                    href={locked ? '#' : item.href}
                    onClick={() => { if (!locked) onClose(); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-teal/10 text-teal'
                        : locked
                        ? 'cursor-not-allowed text-white/20'
                        : 'text-white/55 hover:bg-white/[0.05] hover:text-white/85'
                    }`}
                  >
                    <item.icon style={{ width: 18, height: 18 }} />
                    <span className="text-[14px] font-medium">{item.label}</span>
                    {locked && <Lock className="w-3 h-3 ml-auto text-teal/30" />}
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-3 border-t border-white/[0.06] space-y-0.5 shrink-0">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-white/55 hover:bg-white/[0.05] hover:text-white/85 transition-colors"
              >
                {mounted && theme === 'dark'
                  ? <Sun style={{ width: 18, height: 18 }} />
                  : <Moon style={{ width: 18, height: 18 }} />
                }
                <span className="text-[14px] font-medium">
                  {mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
                </span>
              </button>
              <button
                onClick={() => { void logout(); }}
                disabled={isLoggingOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {isLoggingOut
                  ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                  : <LogOut style={{ width: 18, height: 18 }} />}
                <span className="text-[14px] font-medium">{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
