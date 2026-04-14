"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { DexWidget } from "@/components/layout/dex-widget";
import { DexOnboarding } from "@/components/onboarding/dex-onboarding";
import { NeuralBackground } from "@/components/layout/NeuralBackground";
import type { DentistaRole } from "@/types/database";
import type { PlanoId } from "@/lib/planos";

interface DashboardShellProps {
  children: React.ReactNode;
  nome: string;
  clinicaNome: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
  dentistaId: string;
}

export function DashboardShell({ children, nome, clinicaNome, role, avatarUrl, plano, dentistaId }: DashboardShellProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="relative flex min-h-screen bg-bg overflow-hidden">
      {/* Neural pulsando em baixíssima opacidade — não deve competir com o conteúdo */}
      <NeuralBackground opacity={0.15} />
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        nome={nome}
        clinicaNome={clinicaNome}
        role={role}
        avatarUrl={avatarUrl}
        plano={plano}
      />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-300">
        {children}
      </main>
      <DexOnboarding nome={nome} dentistaId={dentistaId} role={role} plano={plano} />
      <DexWidget role={role} plano={plano} nome={nome} dentistaId={dentistaId} />
    </div>
  );
}
