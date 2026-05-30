"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  // Uma vez montado, nunca desmonta — abre subsequentes são só prop changes (instant)
  const [hasMountedPalette, setHasMountedPalette] = useState(false);

  useEffect(() => {
    setIsSidebarExpanded(window.innerWidth >= 1024);
  }, []);

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
    setHasMountedPalette(true); // monta na primeira abertura, nunca desmonta
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);

  // Global keyboard shortcut: Cmd/Ctrl+K
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
    <div className="relative flex min-h-screen bg-bg overflow-hidden">
      {/* Neural pulsando em baixíssima opacidade — não deve competir com o conteúdo */}
      <NeuralBackground opacity={0.15} />
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        nome={nome}
        clinicaNome={clinicaNome}
        activeClinicId={activeClinicId}
        role={role}
        avatarUrl={avatarUrl}
        plano={plano}
        onOpenSearch={openCommandPalette}
      />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-300">
        {children}
      </main>
      {/* Tour de onboarding — todos os roles recebem */}
      <DexOnboarding nome={nome} dentistaId={dentistaId} role={role} plano={plano} />
      {/* DEX widget — apenas dentista e admin */}
      {role !== 'secretaria' && (
        <DexWidget role={role} plano={plano} nome={nome} dentistaId={dentistaId} />
      )}
      {/* Command Palette — montado uma vez, nunca desmontado (P2 keep-alive) */}
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
