# Plano de Implementação — Floating Dock Navigation
**Data:** 2026-06-01  
**Spec:** `docs/superpowers/specs/2026-06-01-floating-dock-nav.md`  
**Estimativa:** ~45 min (6 tasks)

---

## Arquitetura

Substituir a sidebar lateral pelo floating dock. O `DashboardShell` deixa de montar `<Sidebar>` e passa a montar `<FloatingDock>` + `<MobileHeader>` + `<MobileDrawer>`.

## Arquivos

| Arquivo | Operação |
|---|---|
| `src/components/layout/dock-nav-item.tsx` | CRIAR |
| `src/components/layout/floating-dock.tsx` | CRIAR |
| `src/components/layout/mobile-header.tsx` | CRIAR |
| `src/components/layout/mobile-drawer.tsx` | CRIAR |
| `src/components/layout/dashboard-shell.tsx` | MODIFICAR |

---

## Task 1 — DockNavItem

**Arquivo:** `src/components/layout/dock-nav-item.tsx`

Item individual de navegação do dock. Trata estados: ativo (pill teal animado com `layoutId`), hover (ícone sobe 1px), bloqueado (ícone opaco + cadeado).

```tsx
'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DockNavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  locked?: boolean;
}

export function DockNavItem({ href, icon: Icon, label, isActive, locked }: DockNavItemProps) {
  if (locked) {
    return (
      <div className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[64px] cursor-not-allowed">
        <div className="relative">
          <Icon style={{ width: 20, height: 20 }} className="text-white/20" />
          <Lock className="absolute -bottom-1 -right-1 w-3 h-3 text-teal/40" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/20">
          {label}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[64px] transition-all duration-150 group ${
        isActive ? '' : 'hover:bg-white/[0.05]'
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="dock-active-pill"
          className="absolute inset-0 rounded-xl bg-teal/[0.12]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon
        style={{ width: 20, height: 20 }}
        className={`relative transition-all duration-150 ${
          isActive
            ? 'text-teal'
            : 'text-white/50 group-hover:text-white/80 group-hover:-translate-y-0.5'
        }`}
      />
      <span
        className={`relative text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
          isActive ? 'text-teal/80' : 'text-white/35 group-hover:text-white/60'
        }`}
      >
        {label}
      </span>
      {isActive && (
        <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal" />
      )}
    </Link>
  );
}
```

**Verificação:** arquivo salvo sem erros de TypeScript.

---

## Task 2 — FloatingDock

**Arquivo:** `src/components/layout/floating-dock.tsx`

Pill glassmorphism fixo em `bottom-6 left-1/2 -translate-x-1/2`. Contém: 5 nav items filtrados por role/plano, separador, NotificationBell, avatar com dropdown (tema, perfil, sair).

```tsx
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
  activeClinicId: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
}

const NAV_ITEMS = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Início',    id: 'dashboard' },
  { href: '/dashboard/pacientes',    icon: Users,           label: 'Pacientes', id: 'pacientes' },
  { href: '/dashboard/agendamentos', icon: Calendar,        label: 'Agenda',    id: 'agenda' },
  { href: '/dashboard/financeiro',   icon: Wallet,          label: 'Financeiro',id: 'financeiro', requiresFeature: 'financeiro' as const },
  { href: '/dashboard/configuracoes',icon: Settings,        label: 'Config',    id: 'config',     adminOnly: true },
] as const;

export function FloatingDock({ nome, clinicaNome, activeClinicId: _activeClinicId, role, avatarUrl, plano }: FloatingDockProps) {
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
  const financeiroLocked = !temFeature(plano ?? 'CLINICA', 'financeiro');

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
```

**Verificação:** componente salvo sem erros de TypeScript.

---

## Task 3 — MobileHeader

**Arquivo:** `src/components/layout/mobile-header.tsx`

Header fixo visível apenas em mobile (`md:hidden`). Logo + nome do produto + botão hamburger.

```tsx
'use client';

import { Menu } from 'lucide-react';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';

interface MobileHeaderProps {
  onOpenDrawer: () => void;
}

export function MobileHeader({ onOpenDrawer }: MobileHeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center justify-between px-4 h-14"
      style={{
        background: 'rgba(12, 17, 14, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <OdontoIALogo className="w-5 h-5 text-teal" />
      <span className="font-bold text-[15px] text-white">
        Odonto<span className="text-teal">.IA</span>
      </span>
      <button
        onClick={onOpenDrawer}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.07] transition-colors"
      >
        <Menu className="w-5 h-5 text-white/70" />
      </button>
    </header>
  );
}
```

**Verificação:** salvo sem erros de TypeScript.

---

## Task 4 — MobileDrawer

**Arquivo:** `src/components/layout/mobile-drawer.tsx`

Drawer lateral que desliza da esquerda. Visível apenas em mobile. Contém todos os nav items, toggle de tema, logout. Backdrop fecha o drawer ao clicar.

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, Calendar, Wallet, Settings,
  X, LogOut, Sun, Moon, Lock,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { temFeature } from '@/lib/planos';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';

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
  { href: '/dashboard/configuracoes',icon: Settings,        label: 'Configurações', adminOnly: true },
] as const;

export function MobileDrawer({ open, onClose, nome, clinicaNome, role, avatarUrl, plano }: MobileDrawerProps) {
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
  const financeiroLocked = !temFeature(plano ?? 'CLINICA', 'financeiro');

  const visibleItems = NAV_ITEMS.filter(item => !('adminOnly' in item && item.adminOnly && role !== 'admin'));

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
                onClick={() => { void handleLogout(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-colors"
              >
                <LogOut style={{ width: 18, height: 18 }} />
                <span className="text-[14px] font-medium">Sair</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Verificação:** salvo sem erros de TypeScript.

---

## Task 5 — Atualizar DashboardShell

**Arquivo:** `src/components/layout/dashboard-shell.tsx`

Remover `Sidebar` e estado `isSidebarExpanded`. Adicionar `FloatingDock`, `MobileHeader`, `MobileDrawer` e estado `isDrawerOpen`. Ajustar layout: `w-full`, `pb-28` no main, `pt-14 md:pt-0` para o header mobile.

**Substituir o arquivo completo por:**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { FloatingDock } from "@/components/layout/floating-dock";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { DexWidget } from "@/components/layout/dex-widget";
import { DexOnboarding } from "@/components/onboarding/dex-onboarding";
import { NeuralBackground } from "@/components/layout/NeuralBackground";
import { CommandPalette } from "@/components/command-palette/command-palette";
import type { DentistaRole } from "@/types/database";
import type { PlanoId } from "@/lib/planos";

interface DashboardShellProps {
  children: React.ReactNode;
  nome: string;
  clinicaNome: string;
  activeClinicId: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
  dentistaId: string;
}

export function DashboardShell({ children, nome, clinicaNome, activeClinicId, role, avatarUrl, plano, dentistaId }: DashboardShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hasMountedPalette, setHasMountedPalette] = useState(false);

  // P2 — warm-up do cliente Supabase no idle para primeira busca instantânea
  useEffect(() => {
    const warm = () => {
      import('@/lib/supabase/client').then(m => { m.createClient(); });
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(warm, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 1800);
    return () => clearTimeout(t);
  }, []);

  const openCommandPalette = useCallback(() => {
    setHasMountedPalette(true);
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isCommandPaletteOpen) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette]);

  return (
    <div className="relative min-h-screen bg-bg overflow-x-hidden">
      <NeuralBackground opacity={0.15} />

      <MobileHeader onOpenDrawer={() => setIsDrawerOpen(true)} />

      <main className="w-full flex flex-col min-h-screen overflow-y-auto pt-14 md:pt-0 pb-28">
        {children}
      </main>

      <FloatingDock
        nome={nome}
        clinicaNome={clinicaNome}
        activeClinicId={activeClinicId}
        role={role}
        avatarUrl={avatarUrl}
        plano={plano}
      />

      <MobileDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        nome={nome}
        clinicaNome={clinicaNome}
        role={role}
        avatarUrl={avatarUrl}
        plano={plano}
      />

      <DexOnboarding nome={nome} dentistaId={dentistaId} role={role} plano={plano} />

      {role !== 'secretaria' && (
        <DexWidget role={role} plano={plano} nome={nome} dentistaId={dentistaId} />
      )}

      {hasMountedPalette && (
        <CommandPalette
          open={isCommandPaletteOpen}
          onClose={closeCommandPalette}
          clinicaId={activeClinicId}
        />
      )}
    </div>
  );
}
```

**Verificação:**
```bash
npx tsc --noEmit
```
- [ ] Zero erros de TypeScript nos 5 arquivos
- [ ] Dock visível no dashboard (desktop)
- [ ] MobileHeader visível só em mobile
- [ ] Active state com pill teal animado ao navegar
- [ ] Avatar abre dropdown com tema/perfil/sair
- [ ] Conteúdo não some atrás do dock (`pb-28`)
- [ ] Dark mode sem regressão

---

## Task 6 — Commit

```bash
git add src/components/layout/dock-nav-item.tsx \
        src/components/layout/floating-dock.tsx \
        src/components/layout/mobile-header.tsx \
        src/components/layout/mobile-drawer.tsx \
        src/components/layout/dashboard-shell.tsx

git commit -m "feat: substituir sidebar por floating dock navigation"
```
