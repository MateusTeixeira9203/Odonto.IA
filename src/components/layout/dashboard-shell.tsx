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
