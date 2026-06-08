"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FloatingDock } from "@/components/layout/floating-dock";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { DexWidget } from "@/components/layout/dex-widget";
import { DexWelcome } from "@/components/onboarding/dex-welcome";
import ParticleNetwork from "@/components/ParticleNetwork";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { useSessionGuard } from "@/hooks/use-session-guard";
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
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hasMountedPalette, setHasMountedPalette] = useState(false);

  useSessionGuard({
    onExpired: () => router.push('/login?reason=session_expired'),
  });

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
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Canvas de partículas — position: fixed, cobre o viewport inteiro uniformemente */}
      <ParticleNetwork />

      {/* Gradiente radial fixo — glow teal sutil ao centro */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(47,156,133,0.12) 0%, transparent 65%)' }}
      />

      {/* Depth Layer — blobs com teal real para contraste visível */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          top: '-15%',
          right: '-10%',
          backgroundColor: 'rgba(47, 156, 133, 0.28)',
          borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
          filter: 'blur(120px)',
          animation: 'blob-morph 18s ease-in-out infinite, blob-float 20s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          bottom: '5%',
          left: '-8%',
          backgroundColor: 'rgba(47, 156, 133, 0.20)',
          borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
          filter: 'blur(120px)',
          animation: 'blob-morph 18s ease-in-out infinite, blob-float 20s ease-in-out infinite',
          animationDelay: '-8s',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      <MobileHeader onOpenDrawer={() => setIsDrawerOpen(true)} />

      <main className="relative z-[1] w-full flex flex-col min-h-screen overflow-y-auto pt-14 md:pt-0 pb-28">
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

      <DexWelcome nome={nome.split(' ')[0]} dentistaId={dentistaId} />

      {role !== 'secretaria' && (
        <DexWidget
          nome={nome}
          dentistaId={dentistaId}
          role={role}
          plano={plano}
          hideTrigger
        />
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
