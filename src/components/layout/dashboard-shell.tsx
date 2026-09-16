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
import { useSessionGuard } from "@/hooks/use-session-guard";
import type { DentistaRole } from "@/types/database";
import type { PlanoId } from "@/lib/planos";

interface DashboardShellProps {
  children: React.ReactNode;
  nome: string;
  clinicaNome: string;
  activeClinicId: string;
  role: DentistaRole | 'gestor';
  avatarUrl?: string | null;
  plano?: PlanoId;
  dentistaId?: string;
  consultorioPessoalEnabled?: boolean;
  pendenciasEnabled?: boolean;
  clinicaOwnerEnabled?: boolean;
  managementOnly?: boolean;
  operationalReception?: boolean;
  operationalRecebimentos?: boolean;
}

export function DashboardShell({ children, nome, clinicaNome, activeClinicId, role, avatarUrl, plano, consultorioPessoalEnabled = false, pendenciasEnabled = false, clinicaOwnerEnabled = false, managementOnly = false, operationalReception = false, operationalRecebimentos = false }: DashboardShellProps) {
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
      if (managementOnly) return;
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
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette, managementOnly]);

  return (
    // A janela é a única dona da rolagem. `overflow-x-hidden` transforma o eixo Y em
    // `auto` pelo CSS e, junto de outro `overflow-y-auto`, criava rolagens concorrentes.
    <div className="relative min-h-screen overflow-x-clip">
      <BrandBackground variant="product" position="fixed" />

      <MobileHeader onOpenDrawer={() => setIsDrawerOpen(true)} />

      <main className="relative z-[1] flex min-h-screen w-full flex-col pt-14 pb-28 md:pt-0">
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
        pendenciasEnabled={pendenciasEnabled}
        clinicaOwnerEnabled={clinicaOwnerEnabled}
        managementOnly={managementOnly}
        operationalReception={operationalReception}
        operationalRecebimentos={operationalRecebimentos}
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
        pendenciasEnabled={pendenciasEnabled}
        clinicaOwnerEnabled={clinicaOwnerEnabled}
        managementOnly={managementOnly}
        operationalReception={operationalReception}
        operationalRecebimentos={operationalRecebimentos}
      />

      {/* FASE 1: guia desativado — ver roadmap-3-fases A2 */}
      {/* {role !== 'secretaria' && <DexGuide nome={nome} dentistaId={dentistaId} />} */}

      {/* D4 — hub monta também pra secretária: ela tem os 3 alertas computados e é
          quem liga pro paciente; antes o botão dela existia mas nunca abria nada (C2) */}
      {!managementOnly && !operationalReception && role !== 'protetico' && <DexWidget nome={nome} />}

      {!managementOnly && !operationalReception && hasMountedPalette && (
        <CommandPalette
          open={isCommandPaletteOpen}
          onClose={closeCommandPalette}
          clinicaId={activeClinicId}
        />
      )}
    </div>
  );
}
