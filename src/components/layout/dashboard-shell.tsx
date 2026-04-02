"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { OnboardingTour } from "@/components/onboarding/tour";
import type { DentistaRole } from "@/types/database";

interface DashboardShellProps {
  children: React.ReactNode;
  nome: string;
  clinicaNome: string;
  role: DentistaRole;
  avatarUrl?: string | null;
}

export function DashboardShell({ children, nome, clinicaNome, role, avatarUrl }: DashboardShellProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-screen bg-bg overflow-hidden">
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        nome={nome}
        clinicaNome={clinicaNome}
        role={role}
        avatarUrl={avatarUrl}
      />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-300">
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
