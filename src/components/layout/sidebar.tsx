'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  nome?: string;
  clinicaNome?: string;
}

export function Sidebar({ isExpanded, onToggle, nome = 'Dentista', clinicaNome = '' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const iniciais = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Início' },
    { href: '/dashboard/agendamentos', icon: Calendar, label: 'Agendamentos' },
    { href: '/dashboard/pacientes', icon: Users, label: 'Pacientes' },
    { href: '/dashboard/fichas', icon: FileText, label: 'Fichas' },
    { href: '/dashboard/orcamentos', icon: CircleDollarSign, label: 'Orçamentos' },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 256 : 80 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-zinc-950 text-zinc-400 border-r border-white/5 flex flex-col h-screen sticky top-0 shadow-2xl z-20 relative dark:bg-black dark:border-white/10"
    >
      <button
        onClick={onToggle}
        className="absolute -right-3 top-10 w-6 h-6 bg-teal rounded-full flex items-center justify-center text-white border-2 border-zinc-950 hover:bg-teal-lt transition-colors z-30 dark:border-black"
      >
        {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className={`p-6 flex items-center gap-3 mb-4 ${!isExpanded && 'justify-center px-0'}`}>
        <svg width="28" height="28" viewBox="370 648 200 200" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <path fill="#2f9c85" d="M511.668 653.836L497.934 653.836C487.77 653.836 477.957 657.668 470.457 664.355C462.961 657.668 453.145 653.836 442.984 653.836L429.246 653.836C398.949 653.836 374.301 678.488 374.301 708.785L374.301 735.59C374.301 768.543 382.086 801.535 396.824 831.023C401.504 840.352 410.891 846.152 421.324 846.152C433.137 846.152 443.574 838.629 447.305 827.426L458.895 792.656C460.559 787.68 465.191 784.336 470.484 784.336C475.723 784.336 480.359 787.68 482.023 792.656L493.605 827.426C497.34 838.629 507.777 846.152 519.59 846.152C530.027 846.152 539.41 840.352 544.094 831.016C558.828 801.535 566.617 768.543 566.617 735.59L566.617 708.785C566.617 678.488 541.965 653.836 511.668 653.836Z"/>
        </svg>
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <span className="font-bold text-xl tracking-tight text-white block leading-none whitespace-nowrap">
                DENT <em className="text-teal-lt not-italic font-serif italic">IA</em>
              </span>
              <span className="font-mono text-[9px] tracking-[0.2em] text-zinc-500 uppercase mt-1 block whitespace-nowrap">Inteligência</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
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
          {mounted && (theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />)}
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

        <Link
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

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={`mt-4 px-3 flex items-center gap-3 w-full hover:bg-white/5 py-2 rounded-lg transition-colors cursor-pointer ${!isExpanded && 'justify-center'}`}>
              <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white font-bold text-xs shrink-0">
                {iniciais}
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
                    <div className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">{clinicaNome}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[160px] bg-zinc-900 border border-white/10 rounded-xl p-1.5 shadow-2xl z-[100] text-white"
              sideOffset={10}
              align={isExpanded ? 'start' : 'center'}
              side="right"
            >
              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg outline-none cursor-pointer transition-colors">
                <User className="w-4 h-4" />
                Meu Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-white/5 my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg outline-none cursor-pointer transition-colors"
                onSelect={handleLogout}
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
