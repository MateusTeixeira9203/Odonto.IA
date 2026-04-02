'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  CircleDollarSign,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Sun,
  Moon,
  MessageCircle,
  BotMessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { DentistaRole } from '@/types/database';
import { DentIALogo } from '@/components/ui/dent-ia-logo';

export interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  nome: string;
  clinicaNome: string;
  role: DentistaRole;
  avatarUrl?: string | null;
}

export function SidebarContent({ isExpanded, onToggle, nome, clinicaNome, role, avatarUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const showClinical   = role === 'admin' || role === 'dentista';
  const showConfig     = role === 'admin' || role === 'dentista';
  const showWhatsApp   = role === 'secretaria';

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
    { href: '/dashboard', icon: LayoutDashboard, label: 'Início', id: 'dashboard-link', visible: true },
    { href: '/dashboard/agendamentos', icon: Calendar, label: 'Agendamentos', id: 'agendamentos-link', visible: true },
    { href: '/dashboard/pacientes', icon: Users, label: 'Pacientes', id: 'pacientes-link', visible: true },
    { href: '/dashboard/fichas', icon: FileText, label: 'Fichas', id: 'fichas-link', visible: showClinical },
    { href: '/dashboard/orcamentos', icon: CircleDollarSign, label: 'Orçamentos', id: 'orcamentos-link', visible: true },
    { href: '/dashboard/whatsapp',   icon: MessageCircle,   label: 'WhatsApp',   id: 'whatsapp-link',  visible: showWhatsApp },
  ];

  const navItems = allNavItems.filter((item) => item.visible);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 256 : 80 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      id="sidebar"
    className="bg-zinc-950 text-zinc-400 border-r border-white/5 flex flex-col h-screen sticky top-0 shadow-2xl z-20 relative dark:bg-black dark:border-white/10"
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-10 w-6 h-6 bg-teal rounded-full flex items-center justify-center text-white border-2 border-zinc-950 hover:bg-teal-lt transition-colors z-30 dark:border-black"
      >
        {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className={`p-6 flex items-center gap-3 mb-4 ${!isExpanded && 'justify-center px-0'}`}>
        <DentIALogo className="w-7 h-7 text-teal shrink-0" />
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <span className="font-heading text-xl tracking-widest text-white block leading-none whitespace-nowrap">
                DENT <em className="italic text-teal-lt">IA</em>
              </span>
              <span className="font-mono text-[9px] tracking-[0.2em] text-zinc-500 uppercase mt-1 block whitespace-nowrap">Inteligência</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              id={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all group ${
                isActive
                  ? 'bg-teal/10 text-teal-lt shadow-inner border-l-2 border-teal-lt'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
              } ${!isExpanded && 'justify-center'}`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-lt' : 'text-zinc-400 group-hover:text-white'}`} />
              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all group text-zinc-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent w-full mb-1 ${!isExpanded && 'justify-center'}`}
        >
          {mounted && (theme === 'dark' ? (
            <Sun className="w-4 h-4 shrink-0" />
          ) : (
            <Moon className="w-4 h-4 shrink-0" />
          ))}
          {!mounted && <div className="w-4 h-4 shrink-0" />}
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap overflow-hidden"
              >
                {mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Modo...'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {role === 'secretaria' && (
          <Link
            id="whatsapp-config-link"
            href="/dashboard/configuracoes/whatsapp"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all group ${
              pathname === '/dashboard/configuracoes/whatsapp'
                ? 'bg-teal/10 text-teal-lt border-l-2 border-teal-lt'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
            } ${!isExpanded && 'justify-center'}`}
          >
            <BotMessageSquare className={`w-4 h-4 shrink-0 ${pathname === '/dashboard/configuracoes/whatsapp' ? 'text-teal-lt' : 'text-zinc-400 group-hover:text-white'}`} />
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Bot WhatsApp
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}

        {showConfig && (
          <Link
            id="configuracoes-link"
            href="/dashboard/configuracoes"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all group ${
              pathname === '/dashboard/configuracoes'
                ? 'bg-teal/10 text-teal-lt border-l-2 border-teal-lt'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
            } ${!isExpanded && 'justify-center'}`}
          >
            <Settings className={`w-4 h-4 shrink-0 ${pathname === '/dashboard/configuracoes' ? 'text-teal-lt' : 'text-zinc-400 group-hover:text-white'}`} />
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Configurações
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={`mt-4 px-3 flex items-center gap-3 w-full hover:bg-white/5 py-2 rounded-lg transition-colors cursor-pointer ${!isExpanded && 'justify-center'}`}>
              <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden ring-2 ring-teal/30">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={nome} className="w-full h-full object-cover" />
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
                    transition={{ duration: 0.2 }}
                    className="text-left overflow-hidden"
                  >
                    <div className="text-xs font-medium text-white whitespace-nowrap">{nome}</div>
                    <div className="text-[10px] text-zinc-500 font-mono whitespace-nowrap truncate max-w-[120px]">{clinicaNome}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[160px] bg-zinc-900 border border-white/10 rounded-xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in duration-200 text-white"
              sideOffset={10}
              align={isExpanded ? 'start' : 'center'}
              side="right"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg outline-none cursor-pointer transition-colors"
                onSelect={() => router.push('/dashboard/perfil')}
              >
                <User className="w-4 h-4" />
                Meu Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-white/5 my-1" />
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
