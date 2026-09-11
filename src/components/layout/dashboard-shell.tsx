"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FloatingDock } from "@/components/layout/floating-dock";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { DexWidget } from "@/components/layout/dex-widget";
// FASE 1: guia desativado — ver roadmap-3-fases A2
// import { DexGuide } from "@/components/onboarding/dex-guide";
import { BrandBackground } from "@/components/layout/brand-background";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { PaymentBlockOverlay } from "@/app/dashboard/_components/payment-block-overlay";
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
  bloqueioPagamento?: boolean;
  consultorioPessoalEnabled?: boolean;
}

export function DashboardShell({ children, nome, clinicaNome, activeClinicId, role, avatarUrl, plano, bloqueioPagamento = false, consultorioPessoalEnabled = false }: DashboardShellProps) {
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
      <BrandBackground variant="product" position="fixed" />

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
        consultorioPessoalEnabled={consultorioPessoalEnabled}
      />

      <MobileDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        nome={nome}
        clinicaNome={clinicaNome}
        role={role}
        avatarUrl={avatarUrl}
        plano={plano}
        consultorioPessoalEnabled={consultorioPessoalEnabled}
      />

      {/* FASE 1: guia desativado — ver roadmap-3-fases A2 */}
      {/* {role !== 'secretaria' && <DexGuide nome={nome} dentistaId={dentistaId} />} */}

      {/* D4 — hub monta também pra secretária: ela tem os 3 alertas computados e é
          quem liga pro paciente; antes o botão dela existia mas nunca abria nada (C2) */}
      {role !== 'protetico' && <DexWidget nome={nome} />}

      {hasMountedPalette && (
        <CommandPalette
          open={isCommandPaletteOpen}
          onClose={closeCommandPalette}
          clinicaId={activeClinicId}
        />
      )}

      {bloqueioPagamento && <PaymentBlockOverlay />}
    </div>
  );
}
